# GPT5 介面任務包

使用者已確認：以下四項交給 GPT5。本輪已完成雲端上傳／下載、AI 與社交資料邏輯；以下介面工作尚未實作。按 A → B → C → D 順序，一次貼一份任務；都在目前專案執行，不需重建專案。

## 每份任務前都貼上這段共同背景

```text
目前專案：C:\Users\User\Desktop\OCProfile-main
這是原生 HTML/CSS/JavaScript 網站，論壇是 forum.js 的 IIFE，使用 forum.css 與 forum-core.js。請先閱讀相關函式及既有樣式，再直接實作。

這次只改論壇的呈現。保留現有 data-action、元素 ID、資料格式與互動邏輯，不改 AI 請求、同步、記憶、排程、收藏資料夾、like 邏輯或匯入匯出。不要加入框架或 CDN 依賴。

主題沿用工坊的暖色系，使用 style.css 的 --text-main、--text-muted、--bg-card 等實際存在的變數。不要創造不存在變數的黑色 fallback。深色、淺色都必須清楚易讀。

測試環境已有 Playwright，路徑可參考 tests/forum-browser.cjs。驗證 320/390/768/1440px，深淺主題、長暱稱、長標題、空列表；手機不應橫向溢出。按鈕可視內容可小，但觸控目標保留約 44px。完成後跑 node tests/forum-browser.cjs 與 node tests/cloud-browser.cjs；若改變 DOM，調整相應測試定位，不降低既有行為驗證。
```

## A：手機字體與粗細

```text
請調整同人論壇手機排版，使字體大小與粗細更接近人設卡工坊，同時保留品牌標題與暖色美感。
主要修改 forum.css，參考 style.css 中工坊的正文、輔助字、標籤與按鈕大小。建議正文 14px 左右、輔助資訊 12–13px、一般字重 400/500、必要標題 600；實際以閱讀舒適為準。避免所有文字都粗體。
縮小 mobile hero、作者資訊、Tag 與導覽的視覺重量；保留輸入框 16px 以避免手機輸入時放大。不要修改 cloud-sync.css。
新留言是 article.ff-comment / .ff-subcomment；主留言不再有可收合的外層 details。不要把舊 .ff-comment-thread 收合樣式重新套回來。長正文才使用 .ff-long-content / .ff-chapter-content。
```

## B：瀑布流與熱帖卡片

```text
請把 forum.js 的 feed() 文章列表改成瀑布式卡片。桌面 2–3 欄，手機依寬度合理調整（窄手機一欄）；卡片高度隨摘要與內容變化，保留時間順序可理解的閱讀動線。
只包裝 feed/fan/favorites 的列表容器並修改 card() 的呈現。不要改 thread() 主文或留言為瀑布流，也不要對所有 .ff-card 一概套 columns。
熱帖需有特別標示及較醒目的卡片邊框或角標，不只靠顏色辨識。可在 card() 內讀 likes(p).length，以及 state.comments.filter(c => c.postId===p.id && !c.deleted && c.kind!=='chapter').length；採明確規則：至少 5 個讚或 10 則回覆。標示用這些即時計算值，不另存 hot 旗標，不改按讚或資料結構。
保留收藏、資料夾分類、按讚、誰按讚、進入討論及頭像連結，不能巢狀 button；卡片不能被分割到不同欄。
```

## C：用戶管理小格與人數

```text
請只調整 forum.js 的 usersView() / accountsView() 呈現與相關 forum.css：虛擬用戶以更緊湊的資料格排列，頁首小字顯示「目前 N 位同好」，N 來自 state.users.length，不能包含 state.accounts。
卡片顯示小頭像、名稱、同好類型、簡短支持偏好，保留進入設定和主頁功能。手機兩欄若內容擁擠可改一欄，桌面依寬度增加欄數。長資料需截斷，完整設定可進編輯頁查看。
我的帳號與虛擬同好繼續分開；不要改 accounts/users 的資料移轉或登入概念。avatar(u) 已是可點擊 button，點擊會進 home:ID。不要再包 button 或 a。
```

## D：長名稱呈現

```text
請優化論壇貼文、留言與用戶格的長暱稱呈現。展示名稱最多約 20 個 Unicode 字元，以省略號結尾，配合單行 ellipsis、min-width:0，避免長名把版面擠壞。使用 [...String(name)] 分割，避免把 emoji 的代理對截壞；若可用 Intl.Segmenter，按字素截斷更好。
只縮短顯示文字，不更改 state 中的 name、handle、authorSnapshot，也不要在 save() 截斷原始資料。完整名稱保留在 title/aria-label；進入主頁仍可查看完整名稱。
名稱大小與字重需與任務 A 協調，避免全域縮小所有 .ff-btn。驗證 dynamicName 的「固定暱稱｜動態應援句」、emoji、中文長名稱、官方標記、handle 與簽名並存時的版面。
```

## 已完成的資料介面（請保留）

- 收藏資料夾：`state.favoriteFolders = [{id,name}]`；貼文 `starred`、`folderIds`；`foldersView()`、`folder-*` actions。
- 按讚：貼文／留言 `likedBy: [accountOrUserId]`；`likes(record)`、`likeButton()`、`simulateLikes()`。自動按讚是偏好規則模擬，沒有新增 AI 請求。
- 主頁：`userHome()`、`home:ID`；用戶／我的帳號的 `updates: [{id,content,createdAt}]`。
- 留言：`replyThread`、`commentSort`、`discussionRows()`；15 則分頁；`comment-thread:*` 開啟回覆，`comment-thread:` 返回主留言。回覆以「回覆 @名稱：」呈現，主留言不能整串收合。
- 長文章：`longText()`，超過 150 字可展開；書籍章節仍預設摺疊。
- AI：`shortReplies` 約 30%；`replyFocus`；`lore.identityIndex`；社交摘要上限 360 字、最近 3 次互動；`retry-ai` 按鈕。
- 生成：`state.generation.creationProfile` 為發帖專用設定 ID，空字串沿用目前模型；留言不受影響。
- 雲端：預設兩個區域，上傳／下載自動處理無衝突資料，有衝突才挑選。不要還原成手動刷新預覽的舊流程。
