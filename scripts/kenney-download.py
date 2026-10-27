#!/usr/bin/env python3
"""Download and safely extract a Kenney asset pack from a verified HTTPS URL."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import List, Set, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = PROJECT_ROOT / "assets" / "source" / "kenney"
EXTRACT_ROOT = PROJECT_ROOT / "public" / "assets" / "kenney"


class HttpsRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise urllib.error.URLError("Download redirects must stay on HTTPS.")
        if parsed.username or parsed.password:
            raise urllib.error.URLError("Credentials in redirect URLs are not allowed.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def official_https_url(value: str, label: str) -> urllib.parse.SplitResult:
    parsed = urllib.parse.urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    is_kenney = host == "kenney.nl" or host.endswith(".kenney.nl")
    is_itch = host == "itch.io" or host.endswith(".itch.io")
    if parsed.scheme.lower() != "https" or not parsed.netloc:
        raise ValueError(f"{label} must be an HTTPS URL.")
    if parsed.username or parsed.password:
        raise ValueError(f"{label} must not include embedded credentials.")
    if not (is_kenney or is_itch):
        raise ValueError(f"{label} must start at kenney.nl or itch.io.")
    return parsed


def pack_slug(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError("Pack slug must use lowercase letters, digits, and single hyphens.")
    return value


def validated_entries(
    archive: zipfile.ZipFile, max_entries: int, max_uncompressed_bytes: int
) -> Tuple[List[Tuple[zipfile.ZipInfo, PurePosixPath]], int]:
    infos = archive.infolist()
    if not infos:
        raise ValueError("The downloaded archive is empty.")
    if len(infos) > max_entries:
        raise ValueError(f"The archive has too many entries (limit: {max_entries}).")

    seen: Set[str] = set()
    entries: List[Tuple[zipfile.ZipInfo, PurePosixPath]] = []
    total_bytes = 0
    file_count = 0

    for info in infos:
        raw_name = info.filename
        if not raw_name or "\\" in raw_name or raw_name.startswith("/"):
            raise ValueError(f"Unsafe archive path: {raw_name!r}")
        if re.match(r"^[a-zA-Z]:", raw_name):
            raise ValueError(f"Unsafe archive path: {raw_name!r}")
        path_name = raw_name[:-1] if info.is_dir() and raw_name.endswith("/") else raw_name
        parts = path_name.split("/")
        if not path_name or any(part in ("", ".", "..") for part in parts):
            raise ValueError(f"Unsafe archive path: {raw_name!r}")

        relative_path = PurePosixPath(*parts)
        normalized = unicodedata.normalize("NFD", relative_path.as_posix()).casefold()
        if normalized in seen:
            raise ValueError(f"Duplicate or case-colliding archive path: {raw_name!r}")
        seen.add(normalized)

        unix_mode = (info.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(unix_mode):
            raise ValueError(f"Symbolic links are not allowed in archives: {raw_name!r}")
        if info.flag_bits & 0x1:
            raise ValueError("Password-protected ZIP archives are not supported.")

        if not info.is_dir():
            file_count += 1
            total_bytes += info.file_size
            if total_bytes > max_uncompressed_bytes:
                raise ValueError(
                    "The archive expands beyond the configured size limit "
                    f"({max_uncompressed_bytes} bytes)."
                )
        entries.append((info, relative_path))

    if file_count == 0:
        raise ValueError("The archive contains no files.")

    bad_file = archive.testzip()
    if bad_file is not None:
        raise ValueError(f"ZIP integrity check failed for {bad_file!r}.")
    return entries, total_bytes


def extract_entries(
    archive: zipfile.ZipFile,
    entries: List[Tuple[zipfile.ZipInfo, PurePosixPath]],
    destination: Path,
) -> None:
    if not destination.is_dir() or any(destination.iterdir()):
        raise ValueError("The temporary extraction directory is not empty.")
    for info, relative_path in entries:
        target = destination.joinpath(*relative_path.parts)
        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(info, "r") as source, target.open("xb") as output:
            shutil.copyfileobj(source, output)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Download a ZIP from an official Kenney/itch.io HTTPS link, "
            "then save and extract it using this project's Kenney asset layout."
        )
    )
    parser.add_argument("slug", help="lowercase pack slug, for example one-bit-platformer-pack")
    parser.add_argument("--url", required=True, help="verified direct HTTPS URL to the ZIP file")
    parser.add_argument("--source-page", help="official Kenney asset page for provenance")
    parser.add_argument("--dry-run", action="store_true", help="show planned paths without downloading")
    parser.add_argument("--timeout", type=float, default=45, help="network timeout in seconds (default: 45)")
    parser.add_argument(
        "--max-download-mb", type=int, default=2048,
        help="maximum compressed download size in MB (default: 2048)",
    )
    parser.add_argument(
        "--max-unpacked-mb", type=int, default=4096,
        help="maximum expanded archive size in MB (default: 4096)",
    )
    parser.add_argument(
        "--max-entries", type=int, default=50000,
        help="maximum number of ZIP entries (default: 50000)",
    )
    args = parser.parse_args()

    try:
        slug = pack_slug(args.slug)
        source_url = official_https_url(args.url, "Download URL")
        if args.source_page:
            official_https_url(args.source_page, "Source page")
        if args.timeout <= 0 or args.max_download_mb <= 0 or args.max_unpacked_mb <= 0:
            raise ValueError("Timeout and size limits must be positive.")
        if args.max_entries <= 0:
            raise ValueError("The entry limit must be positive.")

        archive_path = ARCHIVE_ROOT / f"{slug}.zip"
        metadata_path = ARCHIVE_ROOT / f"{slug}.download.json"
        extract_path = EXTRACT_ROOT / slug
        outputs = (archive_path, metadata_path, extract_path)
        existing = [
            str(path.relative_to(PROJECT_ROOT))
            for path in outputs
            if path.exists() or path.is_symlink()
        ]
        if existing:
            raise FileExistsError(
                "Refusing to overwrite existing output(s): " + ", ".join(existing)
            )

        if args.dry_run:
            print("Dry run: no files downloaded or changed.")
            print(f"Archive:  {archive_path.relative_to(PROJECT_ROOT)}")
            print(f"Extract:  {extract_path.relative_to(PROJECT_ROOT)}")
            print(f"Source:   {source_url.hostname} (HTTPS)")
            return 0

        ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
        EXTRACT_ROOT.mkdir(parents=True, exist_ok=True)
        archive_temp_fd, archive_temp_name = tempfile.mkstemp(
            prefix=f".{slug}.", suffix=".part", dir=ARCHIVE_ROOT
        )
        os.close(archive_temp_fd)
        archive_temp = Path(archive_temp_name)
        stage = None

        try:
            stage = Path(tempfile.mkdtemp(prefix=f".{slug}.extract-", dir=EXTRACT_ROOT))
            request = urllib.request.Request(
                args.url,
                headers={"User-Agent": "KenneyAssetWorkflow/1.0"},
            )
            opener = urllib.request.build_opener(HttpsRedirectHandler())
            digest = hashlib.sha256()
            downloaded_bytes = 0
            max_download_bytes = args.max_download_mb * 1024 * 1024
            with opener.open(request, timeout=args.timeout) as response:
                final_url = urllib.parse.urlsplit(response.geturl())
                if final_url.scheme.lower() != "https" or not final_url.netloc:
                    raise ValueError("The final download URL must use HTTPS.")
                with archive_temp.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        downloaded_bytes += len(chunk)
                        if downloaded_bytes > max_download_bytes:
                            raise ValueError(
                                "The download exceeds the configured limit "
                                f"({args.max_download_mb} MB)."
                            )
                        digest.update(chunk)
                        output.write(chunk)

            if not zipfile.is_zipfile(archive_temp):
                raise ValueError(
                    "The response is not a ZIP file. Provide the official direct download URL, "
                    "not the asset page or preview image."
                )

            max_unpacked_bytes = args.max_unpacked_mb * 1024 * 1024
            with zipfile.ZipFile(archive_temp) as archive:
                entries, unpacked_bytes = validated_entries(
                    archive, args.max_entries, max_unpacked_bytes
                )
                extract_entries(archive, entries, stage)

            archive_temp.replace(archive_path)
            try:
                stage.replace(extract_path)
            except Exception:
                archive_path.unlink(missing_ok=True)
                raise

            metadata = {
                "schemaVersion": 1,
                "pack": slug,
                "sourcePage": args.source_page,
                "downloadedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "archive": archive_path.relative_to(PROJECT_ROOT).as_posix(),
                "extractedTo": extract_path.relative_to(PROJECT_ROOT).as_posix(),
                "archiveBytes": downloaded_bytes,
                "archiveSha256": digest.hexdigest(),
                "expandedBytes": unpacked_bytes,
            }
            with metadata_path.open("x", encoding="utf-8") as output:
                json.dump(metadata, output, ensure_ascii=False, indent=2)
                output.write("\n")

            print("Kenney pack downloaded and extracted.")
            print(f"Archive:  {archive_path.relative_to(PROJECT_ROOT)}")
            print(f"Extract:  {extract_path.relative_to(PROJECT_ROOT)}")
            print(f"SHA-256:  {digest.hexdigest()}")
            print(f"Metadata: {metadata_path.relative_to(PROJECT_ROOT)}")
            return 0
        finally:
            archive_temp.unlink(missing_ok=True)
            if stage is not None and stage.exists():
                shutil.rmtree(stage)

    except (
        OSError,
        ValueError,
        urllib.error.URLError,
        zipfile.BadZipFile,
        NotImplementedError,
        RuntimeError,
    ) as error:
        print(f"kenney-download: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
