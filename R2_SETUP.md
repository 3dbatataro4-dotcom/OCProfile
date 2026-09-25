# 人物圖廊與視覺小說素材 R2 設定

人物圖廊、頭像與視覺小說 CG／BGM／SE 可以先存在目前瀏覽器。檔案存在 IndexedDB，標題、標籤與關聯資料存在網站資料中。執行人設卡雲端備份時，待同步檔案會先批次上傳到 R2，再保存資料。一般 JSON 備份只保存素材資料，不包含本機檔案本身。

1. 在 Cloudflare 建立 R2 儲存桶 `oc-image-library`，並啟用 Workers。
2. 複製 `r2-worker/wrangler.toml.example` 為 `r2-worker/wrangler.toml`，把 `ALLOWED_ORIGIN` 換成網站的完整來源（例如 `https://example.com`），將 `SUPABASE_PUBLISHABLE_KEY` 換成 `cloud-sync.js` 的公開 publishable key。不可使用 `sb_secret_...` 或舊的 `service_role` key。
3. 於 `r2-worker` 目錄執行 `npx wrangler deploy`。Worker 會使用現有 Supabase 登入權杖驗證使用者，並將圖片儲存在 `使用者 ID／圖片 ID` 路徑。儲存桶保持私有。
4. 人物圖廊選擇圖片後按「加入本機圖庫」，即可在本機模式預覽，不必先部署網站或登入雲端。視覺小說的本機上傳可直接插入劇本，是否顯示於素材庫由「同時加入素材庫」決定。進行雲端同步前，在「DeepSeek AI API 設定」填入 Worker HTTPS 網址，並在「備份中心」登入；上傳人設卡資料時，待同步檔案會先上傳至 R2。

每張圖片上限 20 MB，接受 PNG、JPEG、WebP、GIF、AVIF；每個音訊檔上限 50 MB，接受 MP3、M4A、OGG、WAV、WebM。Worker 也接受 `http://127.0.0.1:8123` 與 `http://localhost:8123` 的本機預覽來源。若正式網站換了網域，更新 `ALLOWED_ORIGIN` 並重新部署。Worker 網址會隨人設卡雲端同步與備份；本機檔案留在該瀏覽器，成功同步後由 R2 供其他裝置讀取。
