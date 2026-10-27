#!/usr/bin/env python3
"""Inventory an extracted Kenney pack and optionally write a JSON manifest."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXTRACT_ROOT = PROJECT_ROOT / "public" / "assets" / "kenney"
ARCHIVE_ROOT = PROJECT_ROOT / "assets" / "source" / "kenney"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def valid_slug(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError("Pack slug must use lowercase letters, digits, and single hyphens.")
    return value


def png_dimensions(path: Path) -> Optional[Tuple[int, int]]:
    try:
        with path.open("rb") as image:
            header = image.read(24)
    except OSError:
        return None
    if len(header) >= 24 and header[:8] == PNG_SIGNATURE and header[12:16] == b"IHDR":
        return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Summarize an extracted Kenney pack and optionally save a JSON manifest."
    )
    parser.add_argument("slug", help="pack slug used under public/assets/kenney/")
    parser.add_argument("--write", action="store_true", help="write a manifest beside the source ZIP")
    parser.add_argument(
        "--force",
        action="store_true",
        help="replace an existing generated manifest (only with --write)",
    )
    args = parser.parse_args()

    try:
        slug = valid_slug(args.slug)
        if args.force and not args.write:
            raise ValueError("--force requires --write.")

        pack_root = EXTRACT_ROOT / slug
        if pack_root.is_symlink() or not pack_root.is_dir():
            raise FileNotFoundError(
                f"Extracted pack directory does not exist: "
                f"{pack_root.relative_to(PROJECT_ROOT)}"
            )

        file_records = []
        extension_counts: Counter[str] = Counter()
        total_bytes = 0
        for path in sorted(pack_root.rglob("*"), key=lambda item: item.as_posix().casefold()):
            if path.is_symlink() or not path.is_file():
                continue
            relative = path.relative_to(pack_root).as_posix()
            size = path.stat().st_size
            extension = path.suffix.lower() or "[no extension]"
            extension_counts[extension] += 1
            total_bytes += size
            record = {"path": relative, "bytes": size, "extension": extension}
            dimensions = png_dimensions(path) if extension == ".png" else None
            if dimensions:
                record["width"] = dimensions[0]
                record["height"] = dimensions[1]
            file_records.append(record)

        if not file_records:
            raise ValueError("No regular files were found in the extracted pack.")

        important_files = {
            "licenses": [],
            "readmes": [],
            "tilesheets": [],
            "instructions": [],
            "previews": [],
        }
        for record in file_records:
            name = Path(record["path"]).name.lower()
            if name == "license" or name.startswith("license.") or name.startswith("licence"):
                important_files["licenses"].append(record["path"])
            if name == "readme" or name.startswith("readme."):
                important_files["readmes"].append(record["path"])
            if "tilesheet" in name:
                important_files["tilesheets"].append(record["path"])
            if "instruction" in name:
                important_files["instructions"].append(record["path"])
            if name == "preview.png" or name == "sample.png":
                important_files["previews"].append(record["path"])

        download_metadata_path = ARCHIVE_ROOT / f"{slug}.download.json"
        download_metadata = None
        if download_metadata_path.is_file():
            with download_metadata_path.open("r", encoding="utf-8") as source:
                download_metadata = json.load(source)

        manifest = {
            "schemaVersion": 1,
            "pack": slug,
            "assetRoot": pack_root.relative_to(PROJECT_ROOT).as_posix(),
            "source": download_metadata,
            "summary": {
                "fileCount": len(file_records),
                "totalBytes": total_bytes,
                "byExtension": dict(sorted(extension_counts.items())),
            },
            "referenceFiles": important_files,
            "files": file_records,
        }

        print(f"Pack: {slug}")
        print(f"Files: {len(file_records)}")
        print(f"Total size: {total_bytes:,} bytes")
        print("By extension:")
        for extension, count in sorted(extension_counts.items()):
            print(f"  {extension}: {count}")
        for label, key in (
            ("License files", "licenses"),
            ("README files", "readmes"),
            ("Tilesheet files", "tilesheets"),
            ("Instruction files", "instructions"),
            ("Preview files", "previews"),
        ):
            values = important_files[key]
            print(f"{label}: {', '.join(values) if values else 'none found'}")

        if args.write:
            output_path = ARCHIVE_ROOT / f"{slug}.manifest.json"
            ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
            if output_path.exists() and not args.force:
                raise FileExistsError(
                    f"Manifest already exists: {output_path.relative_to(PROJECT_ROOT)} "
                    "(use --force to replace the generated manifest)."
                )
            with output_path.open("w" if args.force else "x", encoding="utf-8") as output:
                json.dump(manifest, output, ensure_ascii=False, indent=2)
                output.write("\n")
            print(f"Manifest: {output_path.relative_to(PROJECT_ROOT)}")
        else:
            print("Use --write to save the full file inventory as a JSON manifest.")
        return 0

    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"kenney-inspect: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
