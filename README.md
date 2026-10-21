# OCProfile
非常重要的人物資料整理網站。 - Deployed by EZPage


雲端大型存檔修正（2026-10-21）：既有協作 v2 專案依序套用 `supabase/upgrade-collaboration-v2-performance.sql`、`supabase/upgrade-collaboration-v2-timeouts.sql`。後者僅為兩個整批提交函式設定 55 秒處理時間，不變更帳號權限或存檔格式。一般前端請求維持 30 秒，整批提交等待 75 秒；結果不明的網路中斷只會以相同批次識別碼確認一次，不會另建批次重複上傳。

`supabase/verify-large-save-rollback.sql` 可用來診斷大型分段提交；它以 session 暫存函式驗證現有資料的 20 筆測試變更，隨即回滾，並回報原版本、歷史、修改紀錄及分段資料是否維持不變。正式存檔不會寫入測試內容。
