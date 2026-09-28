# 人物圖廊、視覺小說與音樂媒體 R2 設定

人物圖廊、頭像與視覺小說 CG／BGM／SE 可以先存在目前瀏覽器。音樂媒體應用預設把音訊、MV 和上傳的封面直接放到 R2；專輯、歌曲、歌詞、人物關聯與播放清單描述存在網站資料中。R2 檔案仍以網站登入帳號分隔，播放時由 Worker 發出限時簽名串流網址，支援進度拖曳和影片範圍請求。一般 JSON 備份只保存資料，不包含音訊／影片二進位檔。

1. 在 Cloudflare 建立 R2 儲存桶 `oc-image-library`，並啟用 Workers。
2. 複製 `r2-worker/wrangler.toml.example` 為 `r2-worker/wrangler.toml`，把 `ALLOWED_ORIGIN` 換成網站的完整來源（例如 `https://example.com`），將 `SUPABASE_PUBLISHABLE_KEY` 換成 `cloud-sync.js` 的公開 publishable key。不可使用 `sb_secret_...` 或舊的 `service_role` key。
3. 設定播放器限時播放網址的簽名密鑰（至少 32 個隨機字元）：在 `r2-worker` 目錄執行 `npx wrangler secret put MUSIC_SIGNING_SECRET`，依提示貼入密鑰。不要把密鑰放進前端或 `wrangler.toml`。然後執行 `npx wrangler deploy`。Worker 會用既有 Supabase 登入權杖驗證上傳者，並將媒體存於 `使用者 ID／隨機媒體 ID` 路徑；R2 儲存桶保持私有。
4. **網站尚未部署也可以測試 R2**：先部署上面的 Worker（R2 本身必須可連線），在本機以 HTTP 網站伺服器開啟設定表，不要直接雙擊 `index.html`。本機預覽網址可使用 `http://127.0.0.1:8765` 或 `http://localhost:8765`；Worker 已允許這兩個精確來源。到本機網站的 AI／雲端設定中填入已部署的 Worker HTTPS 網址，登入 Supabase，再到音樂媒體新增測試歌曲即可。正式網站尚未上線不會妨礙音訊／影片直接上傳到 R2。若你使用不同本機連接埠，需把該精確來源加入 Worker 白名單並重新部署 Worker。
5. 人物圖廊選擇圖片後按「加入本機圖庫」，即可在本機模式預覽，不必先部署網站或登入雲端。視覺小說的本機上傳可直接插入劇本，是否顯示於素材庫由「同時加入素材庫」決定。進行雲端同步前，在「DeepSeek AI API 設定」填入 Worker HTTPS 網址，並在「備份中心」登入；上傳人設卡資料時，待同步檔案會先上傳至 R2。

圖片上限 20 MB，接受 PNG、JPEG、WebP、GIF、AVIF；音訊接受 MP3、M4A、OGG、WAV、WebM、AAC、FLAC，影片接受 MP4、WebM、MOV、OGG。音訊／影片單一檔案上限 2 GB。90 MB 以內以單次上傳，較大檔案改用 32 MiB 分段上傳並逐段重試；例如 474 MB MV 約 15 段。Cloudflare 一般網站請求本文上限目前為每次 100 MB，所以不能把大影片當單一 Worker 請求送出；分段上傳會避開這項限制。若正式網站換了網域，更新 `ALLOWED_ORIGIN` 並重新部署。Worker 網址會隨人設卡雲端同步與備份；音樂媒體記錄也會放進人設卡存檔，其他裝置可在登入後透過限時網址播放 R2 檔案。下載的普通 JSON 不含大型媒體本體。

如果不使用 R2，可在歌曲設定選「只存這台裝置」或「使用音訊連結」。本機音訊留在目前瀏覽器的 IndexedDB，不佔 localStorage，但清除網站資料會一併清掉；外部網址必須是瀏覽器可直接讀取／播放的檔案網址，不是一般網頁分享頁。
