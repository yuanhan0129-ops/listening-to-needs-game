---
name: kenney-asset-finder
description: 在 Kenney Game Assets 預覽目錄中尋找、比較素材包；使用者要求時，核對官方下載與授權，呼叫專案下載和盤點腳本整理素材，並依檔案類型套用對應的 Phaser 4 skills。
---

# Kenney Asset Finder

協助使用者從 [Kenney Game Assets 預覽目錄](https://kenney.nl/data/itch/preview/) 找到合適素材。使用者要求下載或導入時，延伸處理官方來源核對、檔案整理及 Phaser 4 整合。搜尋、下載、導入是不同階段；沒有明確要求時，不要下載素材或修改專案。

## 搜尋與核對

- 每次都查看目前的預覽目錄，不沿用舊的套件數量或目錄清單；頁面內容可能更新。
- 使用頁面上的文字篩選和分類（2D、3D、UI、Icons、Audio、Other），依遊戲類型、視角、畫風和用途縮小候選，再查看候選項目的預覽圖。
- 保留英文素材包名稱；中文名稱標示為方便辨識的翻譯，不暗示是官方譯名。
- 若要確認內容、標籤、尺寸、檔案數、授權或下載方式，查找並引用 Kenney 的該素材官方頁面。不要只憑名稱宣稱精確內容、授權或下載狀態，也不要把預覽圖當成素材下載檔。
- 預覽或官方說明無法取得時，將依名稱、分類或圖片做出的判讀標示為推測，並與核實資訊分開。
- 預覽目錄可能未顯示所有套件；除非有官方來源佐證，描述為「目前頁面可見的候選素材」，不要宣稱清單完整。

## 使用者要求下載或導入時

1. 先檢查專案現有的資料夾慣例、建置工具、Phaser 版本和資產載入方式，再選擇存放位置；不要假設每個專案結構都相同。
2. 從 Kenney 官方素材頁確認素材包及授權。取得官方提供的直接 ZIP 下載連結後再執行下載腳本；不要猜下載網址、使用預覽縮圖網址，或把素材頁 URL 當成 ZIP 下載 URL。若官方頁面無法確認下載來源或條款，先回報限制，不要繞過登入、付費或存取限制。
3. 本專案使用 Python 3.9 以上版本的標準函式庫提供下載與盤點腳本，不需新增 npm 套件。先用 `npm run kenney:download -- --dry-run <pack-slug> --url <official-direct-zip-url> --source-page <official-pack-page>` 預覽存放位置；確認來源後，再移除 `--dry-run` 執行下載。下載器只接受 Kenney／itch.io 的 HTTPS 起始網域，要求重新導向留在 HTTPS，拒絕既有目的地或不安全 ZIP 路徑，並保留原始壓縮檔與 SHA-256／來源頁中繼資料。
4. 此專案目前的慣例是將壓縮檔存於 `assets/source/kenney/<pack-slug>.zip`，解壓至 `public/assets/kenney/<pack-slug>/`。若目標專案已有不同慣例，沿用該專案的方式；不要覆寫同名素材包。下載成功後執行 `npm run kenney:inspect -- <pack-slug> --write`，盤點檔案類型、大小、PNG 尺寸及 License、README、Tilesheet 等說明檔，並在 `assets/source/kenney/<pack-slug>.manifest.json` 產生清單。若 manifest 已存在，先保留現有檔案；使用者明確要求重建時才加上 `--force`。
5. 檢查盤點結果與授權檔。只把遊戲需要的素材接入程式；若使用者只要求下載或整理，完成檔案流程即可，不要自行擴大成遊戲功能修改。
6. 需要修改 Phaser 程式碼時，先依實際素材和工作範圍讀取 `.agents/skills/` 中對應的 Phaser skill `SKILL.md`，遵循該 skill 的 Phaser 4 API 與專案模式。不要一次載入所有 Phaser skills，也不要從 Phaser 3 範例推測 Phaser 4 API。

### Phaser skill 對應

- 任何 Phaser 資產載入或 Loader 程式碼：loading-assets。
- 靜態圖片、精靈顯示與尺寸／位置：sprites-and-images。
- spritesheet、atlas、動畫影格與播放：animations；若要實際載入，也讀取 loading-assets。
- Tiled JSON、tilemap 圖層與碰撞：tilemaps；載入地圖資料時也讀取 loading-assets。
- 音效或音樂：audio-and-sound；載入檔案時也讀取 loading-assets。
- Bitmap font 或文字顯示：text-and-bitmaptext；載入字型資產時也讀取 loading-assets。
- 場景 preload、場景切換或場景間資產使用：scenes。
- 粒子素材與 emitter：particles。
- 素材整合需要調整碰撞時，依專案採用的引擎讀取 physics-arcade 或 physics-matter。
- 需要改遊戲初始化設定或畫面縮放時，分別讀取 game-setup-and-config 或 scale-and-responsive。
- 其他素材類型則依工作內容選讀最相關的 Phaser skill；不需要 Phaser 程式碼時，不必讀取 Phaser skills。

## 回覆與交付

- 找素材時預設以表格列出：英文名稱、繁體中文名稱、內容／適用用途、分類及可用的預覽或官方素材頁連結。只列與需求相關的候選；使用者要求完整清單時才整理全目錄。
- 導入完成後，簡要列出官方素材頁、已核實的授權資訊、壓縮檔與解壓位置、manifest 位置、實際接入的素材、使用的 Phaser skills，以及執行過的建置或檢查結果。沒有執行檢查時要明確說明，不要暗示已驗證。
- 對預覽目錄及各素材包連結提供直接來源；若使用者詢問授權或可下載性，附上相應官方頁面的來源。
