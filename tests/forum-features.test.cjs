const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ForumCore = require('../forum-core.js');
const CloudSyncCore = require('../cloud-sync-core.js');

test('index loads the forum entry program for direct file use', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /<script src="forum\.js\?v=[^"]+"><\/script>/);
  assert.ok(html.indexOf('forum-chat.js') < html.indexOf('forum.js'), 'forum chat must load before forum UI');
});

test('new character wizard supports AI text conversion with reviewed CP and call-name data', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(html, /AI 文字轉人設/);
  assert.match(html, /id="aiCharacterSourceText"/);
  assert.match(app, /async function parseAiCharacterText/);
  assert.match(app, /existingCharacterNames/);
  assert.match(app, /wizardAiRelations/);
  assert.match(app, /perspectiveTargets\[charData\.id\]/);
  assert.match(app, /cps\.push\(\{id:`cp_/);
  assert.match(styles, /\.wiz-ai-text-entry/);
});

test('AI character import creates linked draft placeholders and later promotes matching drafts', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function createAiPlaceholderCharacter/);
  assert.match(app, /isAiPlaceholder:true/);
  assert.match(app, /isHidden:true/);
  assert.match(app, /wizardAiMatchedCharacterId/);
  assert.match(app, /function findExistingCharacterMatch/);
  assert.match(app, /characters\[characters\.indexOf\(matchedRecord\)\]=charData/);
  assert.match(app, /\(!c\.isHidden \|\| c\.isAiPlaceholder\)/);
});

test('AI character import safely merges existing character, relationship and CP records', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function mergeUniqueText/);
  assert.match(app, /function mergeRelationshipRows/);
  assert.match(app, /matchedExistingName/);
  assert.match(app, /targetMatchedExistingName/);
  assert.match(app, /partnerMatchedExistingName/);
  assert.match(app, /existingCp=normalized\.find/);
  assert.match(app, /member\.r18=mergeUniqueText/);
});

test('AI Paro text import previews and merges fields without clearing existing values', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(html, /AI 文字整合到此 Paro/);
  assert.match(html, /id="aiParoSourceText"/);
  assert.match(app, /async function parseAiParoText/);
  assert.match(app, /function applyAiParoImport/);
  assert.match(app, /characterDirectory/);
  assert.match(app, /characterNameAliases/);
  assert.match(app, /character\.paroValues\[paro\.id\]\[field\.id\]=cell\.value/);
  assert.match(app, /if\(!character\.paroValues\[paro\.id\]\)character\.paroValues\[paro\.id\]=\{\}/);
});

test('library character cards use the themed cover and character-derived controls', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /class="char-theme-cover"/);
  assert.match(app, /--char-theme-secondary:\$\{theme\.secondary\}/);
  assert.match(app, /char-edit-btn/);
  assert.match(styles, /\.char-theme-cover\s*\{/);
  assert.match(styles, /\.char-avatar-wrapper::before/);
  assert.match(styles, /\.char-field-label[^}]*var\(--char-theme-primary\)/s);
  assert.match(styles, /\.tag-pill[^}]*var\(--char-theme-primary\)/s);
  assert.match(styles, /\.char-edit-btn[^}]*var\(--char-theme-secondary\)/s);
});

test('legacy forum data migrates to scoped forums without losing records', () => {
  const legacy = ForumCore.initial();
  delete legacy.activeBoardId;
  delete legacy.loreEntries;
  delete legacy.boards[0].englishName;
  delete legacy.boards[0].slogan;
  delete legacy.boards[0].kind;
  legacy.users.push({id:'legacy-user',name:'舊同好',charIds:[],history:[],links:[]});
  legacy.tagCatalog.push({id:'legacy-tag',name:'舊標籤'});
  const migrated = ForumCore.validate(legacy);
  assert.equal(migrated.activeBoardId, migrated.boards[0].id);
  assert.deepEqual(migrated.loreEntries, []);
  assert.deepEqual(migrated.users[0].forumIds, [migrated.boards[0].id]);
  assert.equal(migrated.tagCatalog[0].boardId, migrated.boards[0].id);
});

test('selecting a forum for backup carries its independent management data', () => {
  const data = ForumCore.initial();
  const board = data.boards[0], userId='world-user', postId='world-post';
  data.loreEntries.push({id:'lore-1',boardId:board.id,title:'校規',content:'鐘響後不得離校。'});
  data.users.push({id:userId,name:'二年級生',owned:false,charIds:[],forumIds:[board.id],forumRoles:{[board.id]:'二年 A 班學生'},history:[],links:[]});
  data.posts.push({id:postId,boardId:board.id,authorId:userId,title:'放學鐘',content:'今天的鐘聲很怪。',tags:[],charIds:[]});
  const subset = ForumCore.subset(ForumCore.validate(data), ['boards:'+board.id]);
  assert.equal(subset.loreEntries.length, 1);
  assert.equal(subset.users.length, 1);
  assert.equal(subset.posts.length, 1);
});

test('cloud forum snapshots include custom lore entries and forum roles', () => {
  const data = ForumCore.initial(), board = data.boards[0];
  data.loreEntries.push({id:'lore-cloud',boardId:board.id,title:'貨幣',content:'使用星砂。'});
  data.users.push({id:'cloud-user',name:'居民',owned:false,charIds:[],forumIds:[board.id],forumRoles:{[board.id]:'商店店員'},history:[],links:[]});
  const cloud = CloudSyncCore.snapshot('forum', data);
  assert.equal(cloud.data.loreEntries[0].title, '貨幣');
  assert.equal(cloud.data.users[0].forumRoles[board.id], '商店店員');
});

test('large cloud payloads split into small UTF-8-safe chunks', () => {
  const source = JSON.stringify({scope:'forum',text:'星霧學園🌟'.repeat(40000)});
  const chunks = CloudSyncCore.encodeUtf8Chunks(source);
  assert.ok(chunks.length > 10);
  assert.ok(chunks.every(chunk => chunk.length <= 49152));
  const restored = Buffer.concat(chunks.map(chunk => Buffer.from(chunk, 'base64'))).toString('utf8');
  assert.equal(restored, source);
});

test('cloud snapshots replace PostgreSQL-invalid Unicode without damaging emoji', () => {
  const data = ForumCore.initial(), board = data.boards[0];
  data.users.push({id:'unicode-user',name:'完整🌟表情',owned:false,charIds:[],forumIds:[board.id],forumRoles:{[board.id]:'學生'},history:[{note:'截斷字元\uD83E'}],links:[]});
  const cloud = CloudSyncCore.snapshot('forum', data);
  assert.equal(cloud.data.users[0].name, '完整🌟表情');
  assert.equal(cloud.data.users[0].history[0].note, '截斷字元\uFFFD');
  assert.doesNotMatch(JSON.stringify(cloud), /\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})/i);
});

test('invalid Supabase refresh tokens return to login without clearing local saves', () => {
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  assert.match(cloud, /function isInvalidRefreshToken/);
  assert.match(cloud, /refresh token not found/);
  assert.match(cloud, /function clearExpiredCloudLogin/);
  assert.match(cloud, /localStorage\.removeItem\(SESSION\)/);
  assert.match(cloud, /本機人物與論壇資料均已保留/);
  assert.doesNotMatch(cloud, /clearExpiredCloudLogin[\s\S]{0,300}localStorage\.clear/);
});

test('board mode, displayName, theme, and aiInstruction migrate and persist properly', () => {
  const data = ForumCore.initial();
  data.boards[0].mode = 'world';
  data.boards[0].displayName = '校園論壇';
  data.boards[0].theme = { primary: '#123456', secondary: '#654321', surfaceTint: '' };
  data.boards[0].aiInstruction = '請扮演學生發言';
  const validated = ForumCore.validate(data);
  assert.equal(validated.boards[0].mode, 'world');
  assert.equal(validated.boards[0].displayName, '校園論壇');
  assert.equal(validated.boards[0].theme.primary, '#123456');
  assert.equal(validated.boards[0].aiInstruction, '請扮演學生發言');
});

test('AI throttle defaults to eco and persists with the local lore digest', () => {
  const initial = ForumCore.initial();
  assert.equal(initial.aiThrottleMode, 'eco');
  assert.equal(initial.aiThrottleModel, 'deepseek-v4-flash');
  initial.aiThrottleMode = 'eco';
  initial.boards[0].loreDigest = { text: '精簡世界資料', updatedAt: 123 };
  const validated = ForumCore.validate(initial);
  const portable = ForumCore.portable(validated);
  assert.equal(validated.aiThrottleMode, 'eco');
  assert.equal(validated.boards[0].loreDigest.text, '精簡世界資料');
  assert.equal(portable.aiThrottleMode, 'eco');
  assert.equal(portable.aiThrottleModel, 'deepseek-v4-flash');
  assert.equal(portable.boards[0].loreDigest.updatedAt, 123);
  initial.aiThrottleMode = 'invalid';
  assert.equal(ForumCore.validate(initial).aiThrottleMode, 'eco');
});

test('standard and eco modes can automatically use the cheaper official DeepSeek model', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(forum, /deepseek-v4-flash/);
  assert.match(forum, /ff-ai-throttle-model/);
  assert.match(forum, /isOfficialDeepSeek/);
  assert.match(forum, /aiThrottleMode\|\|'eco'\)!==['"]full['"]/);
  assert.doesNotMatch(forum, /model:'deepseek-chat'/);
});

test('AI throttle uses compact lore, shorter history and mode-aware response length', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'forum-chat.js'), 'utf8');
  assert.match(forum, /function buildLoreDigest/);
  assert.match(forum, /function lengthPolicy/);
  assert.match(forum, /約 60%/);
  assert.match(forum, /約 80%/);
  assert.match(forum, /buildLoreDigest\(b\.id\)/);
  assert.match(forum, /throttle!==['"]full['"]/);
  assert.match(chat, /historyLimit=throttle===['"]eco['"]\?8/);
  assert.match(chat, /約 80% 回覆應簡短自然/);
});

test('saving forum settings rebuilds lore digest only after worldview changes', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(forum, /previousWorldview=b\.worldview/);
  assert.match(forum, /!b\.loreDigest\?\.text\|\|b\.worldview!==previousWorldview/);
  assert.match(forum, /懶人包沒有重複生成/);
});

test('board subset extraction isolates single board data for deletion backup', () => {
  const data = ForumCore.initial();
  const board1 = data.boards[0].id;
  const board2 = 'board-2';
  data.boards.push({ id: board2, name: 'PARO 世界', mode: 'world', displayName: 'PARO 大廳' });
  data.posts.push({ id: 'post-b2', boardId: board2, authorId: data.accounts[0].id, title: 'PARO 文章', content: '內容', tags: [], charIds: [] });
  const subset2 = ForumCore.subset(ForumCore.validate(data), ['boards:' + board2]);
  assert.equal(subset2.boards.length, 1);
  assert.equal(subset2.boards[0].id, board2);
  assert.equal(subset2.posts.length, 1);
  assert.equal(subset2.posts[0].id, 'post-b2');
});

test('getHot15Tags isolates hot tags per board and calculates counts correctly', () => {
  const data = ForumCore.initial();
  const board1 = data.boards[0].id;
  const board2 = 'board-custom-2';
  data.boards.push({ id: board2, name: '獨立同人論壇', mode: 'fandom', subBoards: ['綜合交流', '作品A', '作品B'] });

  data.tagCatalog.push({ id: 'tag-hidden', name: '隱藏TAG', boardId: board1, showInSearch: false });

  data.posts.push(
    { id: 'p1', boardId: board1, title: '文章1', content: '內容', tags: ['熱門TAG', '通用TAG', '隱藏TAG'], charIds: [] },
    { id: 'p2', boardId: board1, title: '文章2', content: '內容', tags: ['熱門TAG'], charIds: [] },
    { id: 'p3', boardId: board2, title: '文章3', content: '內容', tags: ['板塊2TAG'], charIds: [] }
  );

  const hot1 = ForumCore.getHot15Tags(data, board1);
  const hot2 = ForumCore.getHot15Tags(data, board2);

  assert.equal(hot1[0].name, '熱門TAG');
  assert.equal(hot1[0].postCount, 2);
  assert.equal(hot1.some(t => t.name === '隱藏TAG'), false);
  assert.equal(hot2[0].name, '板塊2TAG');
  assert.equal(hot2[0].postCount, 1);
});

test('default and custom forums use structured child boards', () => {
  const data = ForumCore.initial();
  assert.ok(Array.isArray(data.boards[0].subBoards));
  assert.ok(data.boards[0].subBoards.some(x => x.name === '綜合交流' && x.id));

  data.boards.push({ id: 'new-independent-forum', name: '新獨立論壇', mode: 'fandom' });
  const validated = ForumCore.validate(data);
  const newBoard = validated.boards.find(b => b.id === 'new-independent-forum');
  assert.ok(Array.isArray(newBoard.subBoards));
  assert.ok(newBoard.subBoards.some(x => x.name === '綜合交流' && x.id));
});

test('legacy relationships without isMainline migrate to true by default', () => {
  const data = ForumCore.initial();
  const bId = data.boards[0].id;
  data.relationships.push({ id: 'rel-legacy', boardId: bId, char1Id: 'c1', char2Id: 'c2', callName: '阿寶', opinion: '好友' });
  const validated = ForumCore.validate(data);
  const rel = validated.relationships.find(r => r.id === 'rel-legacy');
  assert.equal(rel.isMainline !== false, true);
});

test('selective backup and snapshot carry isMainline relationship status', () => {
  const data = ForumCore.initial();
  const bId = data.boards[0].id;
  data.relationships.push(
    { id: 'rel-main', boardId: bId, char1Id: 'c1', char2Id: 'c2', isMainline: true },
    { id: 'rel-extra', boardId: bId, char1Id: 'c1', char2Id: 'c3', isMainline: false }
  );
  const cloud = CloudSyncCore.snapshot('forum', ForumCore.validate(data));
  const mainRel = cloud.data.relationships.find(r => r.id === 'rel-main');
  const extraRel = cloud.data.relationships.find(r => r.id === 'rel-extra');
  assert.equal(mainRel.isMainline, true);
  assert.equal(extraRel.isMainline, false);
});

test('resetToInitial returns clean initial state with zero custom boards or posts', () => {
  const custom = ForumCore.initial();
  custom.boards.push({ id: 'custom-b', name: '自訂論壇' });
  custom.posts.push({ id: 'custom-p', boardId: 'custom-b', title: '貼文' });
  const reset = ForumCore.initial();
  assert.equal(reset.boards.length, 1);
  assert.equal(reset.posts.length, 0);
});

test('full forum backup preserves active identity, AI profiles, board settings and every collection', () => {
  const data = ForumCore.initial();
  data.activeUser = data.accounts[0].id;
  data.activeProfile = 'profile-test';
  data.profiles.push({id:'profile-test',name:'Test AI',type:'openai',baseUrl:'https://example.com/v1',model:'model',apiKey:'secret'});
  data.boards[0].theme = {preset:'purple',primary:'',secondary:'',surfaceTint:''};
  data.boards[0].terminology.home = '故事廣場';
  data.loreEntries.push({id:'lore-test',boardId:data.boards[0].id,title:'設定',content:'內容'});
  const backup = ForumCore.portable(data);
  const restored = ForumCore.validate(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.activeUser, data.accounts[0].id);
  assert.equal(restored.activeProfile, 'profile-test');
  assert.equal(restored.profiles[0].apiKey, 'secret');
  assert.equal(restored.boards[0].theme.preset, 'purple');
  assert.equal(restored.boards[0].terminology.home, '故事廣場');
  assert.equal(restored.loreEntries[0].content, '內容');
  for (const key of ForumCore.groups) assert.ok(Array.isArray(restored[key]), key);
});

test('structured subBoards preserve englishName, slogan, and description', () => {
  const initial = ForumCore.initial();
  const board = initial.boards[0];
  board.subBoards = [
    { id: 'sb-1', name: '綜合交流', englishName: 'ALL DISCUSSIONS', slogan: 'Speak your mind.', description: '交流子版塊' }
  ];
  const validated = ForumCore.validate(initial);
  const validatedBoard = initial.boards[0];
  assert.equal(validatedBoard.subBoards[0].name, '綜合交流');
  assert.equal(validatedBoard.subBoards[0].englishName, 'ALL DISCUSSIONS');
  assert.equal(validatedBoard.subBoards[0].slogan, 'Speak your mind.');
  assert.equal(validatedBoard.subBoards[0].description, '交流子版塊');
});

test('mergeBoard migrates standalone board posts and characters into target subBoard', () => {
  const state = ForumCore.initial();
  const b1 = state.boards[0];
  const b2 = {
    id: 'b2-id',
    name: '咒術迴戰專區',
    englishName: 'JUJUTSU ARCHIVE',
    slogan: 'Curse and Love',
    description: '咒術作品討論',
    kind: 'fandom',
    mode: 'fandom',
    subBoards: [{ id: 'sb-b2', name: '綜合交流', description: '' }]
  };
  state.boards.push(b2);

  state.posts.push({
    id: 'post-b2',
    boardId: 'b2-id',
    subBoardId: 'sb-b2',
    subBoard: '綜合交流',
    title: '五條悟討論帖',
    content: '正文'
  });

  state.characters.push({
    id: 'char-b2',
    boardId: 'b2-id',
    name: '五條悟'
  });

  const res = ForumCore.mergeBoard(state, 'b2-id', b1.id, '咒術迴戰');

  assert.equal(state.boards.length, 1);
  assert.equal(res.newSubBoard.name, '咒術迴戰');
  assert.equal(res.newSubBoard.englishName, 'JUJUTSU ARCHIVE');
  
  const movedPost = state.posts.find(p => p.id === 'post-b2');
  assert.equal(movedPost.boardId, b1.id);
  assert.equal(movedPost.subBoard, '咒術迴戰');

  const movedChar = state.characters.find(c => c.id === 'char-b2');
  assert.equal(movedChar.boardId, b1.id);
});

test('C.tags deduplicates tags case-insensitively and removes extra spaces', () => {
  const result = ForumCore.tags(['同人', ' 同人 ', 'taga', 'TAGA', 'cp文']);
  assert.deepEqual(result, ['同人', 'taga', 'cp文']);
});

test('forum UI keeps the shared live-status helper required by every AI action', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(source, /function\s+note\s*\(message\)/);
  assert.match(source, /function job\(task,label='AI 請求'\)/);
  assert.match(source, /note\('AI 正在處理：'\+item\.label/);
});

test('AI discussion replies cannot select the comment author as the responder', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(source, /candidates\(lore,targetId,excludedAuthorId=''/);
  assert.match(source, /x\.id!==excludedAuthorId/);
  assert.match(source, /x\.authorId===excludedAuthorId/);
  assert.match(source, /const counterpartId=previous\?\.authorId\|\|p\.authorId/);
  assert.match(source, /if\(counterpartId===current\.authorId\)return null/);
});

test('forum AI jobs expose a persistent animated loading state', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(script, /ff-status-spinner/);
  assert.match(script, /classList\.toggle\('is-loading', busy\)/);
  assert.match(styles, /\.ff-status\.is-loading \.ff-status-spinner/);
});

test('user home updates become an internal scroller after four items', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(script, /updates\.length>4\?' has-scroll'/);
  assert.match(styles, /\.ff-status-feed\.has-scroll\{[^}]*overflow-y:auto/);
});

test('AI resident invitation accepts count, type, and optional instructions', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(source, /id='ff-invite-users-dialog'/);
  assert.match(source, /ff-invite-count/);
  assert.match(source, /ff-invite-type/);
  assert.match(source, /ff-invite-instruction/);
  assert.match(source, /seedUsers\(count,boardId,request\)/);
});

test('mobile forum search uses a compact icon control and preserves position for drawer tags', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(script, /class="ff-search-btn-icon"/);
  assert.match(script, /function renderPreservingPosition\(\)/);
  assert.match(script, /a==='toggle-drawer-tag'\?renderPreservingPosition\(\):render\(\)/);
  assert.match(styles, /\.ff-search-btn-label\{display:none\}/);
  assert.match(styles, /\.ff-search-bar-wrap\{width:min\(100%,330px\)/);
});

test('thread title is smaller and the mobile forum mark cannot be squeezed', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(styles, /\.ff-post-heading h3\{font-size:20px!important/);
  assert.match(styles, /#forum-root \.ff-brand-mark\{flex:0 0 31px;width:31px;min-width:31px/);
  assert.match(styles, /#forum-root \.ff-top\{flex-wrap:nowrap;display:grid/);
});

test('forum logo star mask uses exactly the same solid color as the themed header', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(styles, /#forum-root \.ff-top\{background:var\(--bg-primary\)\}/);
  assert.match(styles, /#forum-root \.ff-brand-mark>span\{background:var\(--bg-primary\)\}/);
});

test('fandom boards cannot retain a linked PARO source', () => {
  const data = ForumCore.initial();
  data.boards[0].mode = 'fandom';
  data.boards[0].linkedParoSourceId = 'paro-source';
  const validated = ForumCore.validate(data);
  assert.equal(validated.boards[0].linkedParoSourceId, null);
});

test('forum AI prompts strictly separate fandom audiences from in-world residents', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  assert.match(source, /【同人社區模式】這是現實網路上的大型 IP 同好社區/);
  assert.match(source, /嚴禁用戶把自己寫成作品世界居民/);
  assert.match(source, /【世界／PARO 模式】這是世界內部的真實社群/);
  assert.match(source, /forumRole:isWorld\?/);
  assert.match(source, /mode==='world'\?\(val\('ff-edit-board-linked-paro'\)/);
});

test('mobile management drawer and horizontal navigation retain usable state', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(script, /mobileManageClickTimer/);
  assert.match(script, /mobileManageDrawerOpen=true;render\(\)/);
  assert.match(script, /preservedNavScroll/);
  assert.match(script, /restoredSidebar\.scrollLeft=preservedNavScroll/);
  assert.match(styles, /\.ff-manage-drawer\{display:block/);
});

test('mobile comments expose reply controls and AI posts are distributed safely', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(styles, /data-action\^="reply:"/);
  assert.match(script, /function generatedPostIsDuplicate/);
  assert.match(script, /function chooseGeneratedSubBoard/);
  assert.match(script, /subBoardId:section\?\.id/);
});

test('live AI updates preserve the current reading and private-chat state', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'forum-chat.js'), 'utf8');
  assert.match(forum, /requestAnimationFrame\(\(\)=>\{liveRefreshFrame=0;if\(view==='dm'\)chatUI\.refresh\(\);else renderPreservingReadingState\(\);\}\)/);
  assert.match(forum, /querySelectorAll\('details'\).*\.open/);
  assert.match(chat, /pending=chatId;if\(h\.view\(\)==='dm'\)refresh\(\)/);
  assert.match(chat, /return \{view,afterRender,refresh,action/);
});

test('group chat can be created directly from characters or forum users', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'forum-chat.js'), 'utf8');
  assert.match(chat, /data-contact-kind=/);
  assert.match(chat, /data-source-id=/);
  assert.match(chat, /el\.value\|\|addContact\(el\.dataset\.contactKind,el\.dataset\.sourceId\)\.id/);
});

test('mobile orientation follows the operating system and back exits only from card library', () => {
  const manifest = fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(manifest, /"orientation"\s*:/);
  assert.match(app, /window\.addEventListener\('pageshow',\(\)=>ensureBackGuard\(\)\)/);
  assert.match(app, /active.*visualNovelPlayerModal/s);
  assert.match(app, /document\.body\.classList\.contains\('forum-open'\)/);
  assert.match(app, /querySelector\('\.tab-content\.active'\)\?\.id!=='tab-cards'/);
  assert.match(app, /candidate!==\'tab-forum\'/);
});

test('chat avatars load immediately and local refresh never animates from the top', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'forum-chat.js'), 'utf8');
  assert.match(chat, /replace\('loading="lazy"','loading="eager"'\)/);
  assert.match(chat, /log\.style\.scrollBehavior='auto';log\.scrollTop=log\.scrollHeight/);
  assert.match(chat, /next\.style\.scrollBehavior='auto';next\.scrollTop=oldTop/);
});

test('each mobile app launch creates a real same-document back guard', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /const appBackSessionId = Date\.now\(\)\.toString\(36\)/);
  assert.match(app, /ensureBackGuard\(true\)/);
  assert.match(app, /baseUrl\+'#oc-app'/);
  assert.match(app, /history\.pushState\(\{ocGuard:true,sessionId:appBackSessionId\},'',guardUrl\)/);
  assert.match(app, /visibilitychange/);
});

test('mobile reply drawer stays above navigation and targeted AI replies are resilient', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(styles, /\.ff-reply-drawer\{z-index:2400/);
  assert.match(styles, /max-height:calc\(100dvh/);
  assert.match(styles, /\.ff-reply-drawer-actions\{position:sticky/);
  assert.match(styles, /\.ff-reply-drawer-row\{display:grid;grid-template-columns:1fr/);
  assert.match(forum, /targetId&&x&&typeof x\.content==='string'\?\{\.\.\.x,authorId:targetId\}/);
  assert.match(forum, /raw\.comments\?\.\[0\]\?\.content/);
  assert.match(forum, /commentPages\.set\(pageKey\(\),Math\.floor\(rootIndex\/15\)\+1\)/);
  assert.match(forum, /\$\('ff-comment-'\+c\.id\)\?\.scrollIntoView/);
});

test('AI requests queue up to ten jobs with status, cancellation, retry and result links', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const chat = fs.readFileSync(path.join(__dirname, '..', 'forum-chat.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(forum, /length>=10\)throw new Error/);
  assert.match(forum, /status:'queued'/);
  assert.match(forum, /queueMicrotask\(runNextAIJob\)/);
  assert.match(forum, /queue-cancel/);
  assert.match(forum, /queue-stop/);
  assert.match(forum, /queue-retry/);
  assert.match(forum, /queue-open-post/);
  assert.match(forum, /生成程序結束但沒有新增文章/);
  assert.match(chat, /'私訊 AI 回覆'/);
  assert.doesNotMatch(chat, /if\(h\.busy\(\)\)throw new Error\('正在生成回覆/);
  assert.match(styles, /\.ff-ai-queue-item\.is-running/);
});

test('search drawer is not trapped by a transformed page animation', () => {
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(styles, /#forum-root \.ff-main\{animation:ff-view-shift \.14s ease-out\}/);
  assert.match(styles, /@keyframes ff-view-shift\{from\{opacity:\.72\}to\{opacity:1\}\}/);
  assert.doesNotMatch(styles, /#forum-root \.ff-main\{animation:ff-view-shift[^}]*both/);
});

test('post deletion dialog handles its own actions on mobile top layer', () => {
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'forum.css'), 'utf8');
  assert.match(forum, /dialog\.addEventListener\('click'/);
  assert.match(forum, /delete-keep:\|delete-hard:/);
  assert.match(forum, /typeof dialog\.showModal==='function'/);
  assert.match(styles, /\.ff-delete-dialog\.ff-dialog-fallback/);
});

test('storage quota recovery removes disposable copies but preserves primary data', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const forum = fs.readFileSync(path.join(__dirname, '..', 'forum.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  assert.match(app, /window\.ocSafeSetLocalStorage/);
  assert.match(app, /oc_cloud_before_/);
  assert.match(app, /oc_forum_backup_before_delete_/);
  assert.match(app, /finally \{ renderDocumentsModule\(\); \}/);
  assert.match(forum, /window\.ocSafeSetLocalStorage/);
  assert.match(cloud, /const recoveryCopies=new Map\(\)/);
  assert.match(cloud, /rememberRecovery\(row\.scope,row\.local\)/);
  assert.doesNotMatch(cloud, /localStorage\.setItem\('oc_cloud_before_'/);
});

test('cloud delta contains only changed rows and explicit deletions', () => {
  const local = CloudSyncCore.snapshot('workshop', {characters:[{id:'a',name:'舊'},{id:'gone',name:'刪除'}],paros:[],factions:[],rankings:[],cps:[],books:[],documents:[],visualNovelTemplates:[],collapsedBooks:{},perspectiveTargets:{}});
  const next = CloudSyncCore.snapshot('workshop', {characters:[{id:'a',name:'新'},{id:'added',name:'新增'}],paros:[],factions:[],rankings:[],cps:[],books:[],documents:[],visualNovelTemplates:[],collapsedBooks:{},perspectiveTargets:{}});
  const delta = CloudSyncCore.delta(local,next,'測試');
  assert.equal(delta.format,'oc-cloud-delta');
  assert.deepEqual(delta.changes.map(change=>[change.id,change.value?.name??null]).sort(),[['a','新'],['added','新增'],['gone',null]]);
  assert.deepEqual(delta.orders.characters,['a','added']);
});

test('cloud upload prefers server-side delta with full snapshot fallback', () => {
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'setup.sql'), 'utf8');
  assert.match(cloud, /async function pushEfficientSnapshot/);
  assert.match(cloud, /rpc\/oc_push_delta/);
  assert.match(cloud, /patchSize<fullSize/);
  assert.match(cloud, /return pushSnapshot\(scope,revision,next,note\)/);
  assert.match(sql, /create function public\.oc_push_delta/);
  assert.match(sql, /for update/);
  assert.match(sql, /raise exception 'SYNC_CONFLICT'/);
});

test('visual novel system lines and in-player sentence editor are supported', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /isSystem:\/\^【/);
  assert.match(app, /if\(segment\.isSystem\)return '系統'/);
  assert.match(app, /bindVnSentenceEditorTarget\(row,row\)/);
  assert.match(app, /bindVnSentenceEditorTarget\(card,row\)/);
  assert.match(html, /id="vnSpeakerTextInput"/);
  assert.match(html, /deleteVnCurrentSentence\(\)/);
  assert.match(app, /function replaceVisualNovelScriptEvent/);
  assert.match(app, /function refreshVnEditedSentence/);
  assert.match(app, /function deleteVnCurrentSentence/);
  assert.match(styles, /\.vn-feed-system[^}]*background:#fff/);
  assert.match(styles, /data-theme="light"[^}]*\.vn-feed-system[^}]*background:#17130f/);
});

test('visual novel safely renders paired asterisks as bold without typing markers', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /function parseVisualNovelInlineTokens/);
  assert.match(app, /document\.createElement\("strong"\)/);
  assert.match(app, /strong\.className = "vn-inline-bold"/);
  assert.match(app, /const visibleText = parseVisualNovelInlineTokens/);
  assert.match(app, /renderVisualNovelInlineText\(dialogueTextElement, event\.text\)/);
  assert.doesNotMatch(app, /dialogueTextElement\.innerHTML/);
  assert.match(styles, /\.vn-inline-bold \{ color:inherit; font-weight:800; \}/);
});

test('visual novel preloads CGs, crossfades layers and waits at chapter endings', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(html, /id="vnCg"[^>]*><div class="vn-cg-layer active"><\/div><div class="vn-cg-layer"><\/div>/);
  assert.match(app, /function preloadVisualNovelCgs/);
  assert.match(app, /preloadVisualNovelCgs\(events\)/);
  assert.match(app, /async function transitionVisualNovelCg/);
  assert.match(app, /visualNovelAwaitingNextChapterId=nextChapter\?\.id\|\|'__end__'/);
  assert.doesNotMatch(app, /visualNovelChapterTimer = setTimeout/);
  assert.match(styles, /\.vn-cg-layer\.active/);
  assert.match(styles, /mask-image:linear-gradient\(to bottom/);
  assert.match(styles, /\.vn-player\.vn-chapter-leaving/);
});

test('visual novel preloads only the current chapter audio and character avatars', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function preloadVisualNovelChapterMedia/);
  assert.match(app, /preloadVisualNovelChapterMedia\(doc, currentVisualNovelEvents, settings\)/);
  assert.match(app, /event\.type === "bgm" \|\| event\.type === "se"/);
  assert.match(app, /audio\.preload = "auto"/);
  assert.match(app, /function preloadVisualNovelAvatar/);
  assert.match(app, /profiles\.find\(item => item\.charId === character\?\.id\)/);
  assert.match(app, /avatarSources\.forEach\(preloadVisualNovelAvatar\)/);
});

test('cloud and JSON restore require per-book and per-chapter review', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  assert.match(html, /id="advancedImportModeToggle"[^>]*checked/);
  assert.match(app, /detected\.kind==='workshop'\|\|detected\.kind==='complete'/);
  assert.match(app, /pendingReview:true/);
  assert.match(cloud, /change\.group!=='books'&&change\.group!=='documents'/);
  assert.match(cloud, /change\.choice=change\.remote\?'remote':'local'/);
  assert.match(cloud, /本機缺少、雲端仍存在（請確認是否真的刪除）/);
});

test('in-player visual novel edits keep stable script positions and inline line breaks', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function getVisualNovelScriptLines/);
  assert.match(app, /filter\(line => line\.trim\(\) !== ""\)/);
  assert.match(app, /function encodeVisualNovelInlineLineBreaks/);
  assert.match(app, /replace\(\/\\n\/g, "\\u2028"\)/);
  assert.match(app, /function decodeVisualNovelInlineLineBreaks/);
  assert.match(app, /const lines=getVisualNovelScriptLines\(doc\.visualNovel\.scriptText\)/);
  assert.match(app, /eventIndexVersion=2/);
  assert.match(app, /migrateVisualNovelEventIndex\(doc\)/);
  assert.match(app, /encodeVisualNovelInlineLineBreaks\(text\)/);
});

test('visual novel edits rebuild runtime events and cloud restore normalizes scripts', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  assert.match(app, /function rebuildVisualNovelPlaybackAfterScriptEdit/);
  assert.match(app, /currentVisualNovelEvents=buildVerifiedVisualNovelEvents\(doc\.visualNovel\.scriptText\)/);
  assert.match(app, /rebuildVisualNovelPlaybackAfterScriptEdit\(currentVisualNovelIndex\)/);
  assert.match(app, /function normalizeVisualNovelDocuments/);
  assert.match(cloud, /assign\(data\);normalizeVisualNovelDocuments\(\);saveStateToLocalStorage\(\)/);
});

test('chapter playback waits for transitions and verifies every script line', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /function buildVerifiedVisualNovelEvents/);
  assert.match(app, /events\.length!==lines\.length/);
  assert.match(app, /function alignVisualNovelBookmarkToScript/);
  assert.match(app, /currentVisualNovelEvents = buildVerifiedVisualNovelEvents/);
  assert.match(app, /if \(!waitingForBookmarkChoice\)/);
  assert.match(app, /visualNovelOpeningTimer=setTimeout/);
  assert.match(app, /if \(visualNovelChapterTimer\|\|visualNovelOpeningTimer\) return/);
  assert.match(styles, /\.vn-player\.vn-opening-transition[^}]*pointer-events:none/);
});

test('mobile typewriter audio is unlocked, resumed and audible over BGM', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function installVisualNovelMobileAudioUnlock/);
  assert.match(app, /document\.addEventListener\('pointerdown',unlock/);
  assert.match(app, /document\.addEventListener\('touchend',unlock/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /function synthesizeVisualNovelTypeBeep/);
  assert.match(app, /context\.resume\(\)\.then/);
  assert.match(app, /function duckVisualNovelBgmForTypeSound/);
  assert.match(app, /target\*0\.72/);
});

test('visual novel runtime audits and repairs missing rendered dialogue rows', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(html, /diagnoseCurrentVisualNovelScript\(event\)/);
  assert.match(html, /檢查並修復本章劇本/);
  assert.match(app, /function getMissingVisualNovelDialogueIndexes/);
  assert.match(app, /function repairMissingVisualNovelDialogueRows/);
  assert.match(app, /feed\.insertBefore\(inserted,next\)/);
  assert.match(app, /oldTop\+\(feed\.scrollHeight-oldHeight\)/);
  assert.match(app, /const index=missing\[0\]/);
  assert.match(app, /currentVisualNovelSettings\.typewriterEnabled=typewriter/);
  assert.doesNotMatch(app, /已補回第 \$\{index\+1\} 句/);
  assert.doesNotMatch(app, /function repairMissingVisualNovelDialogueRows[^}]*rebuildVisualNovelPlaybackAfterScriptEdit/);
  assert.match(app, /if\(repairMissingVisualNovelDialogueRows\(currentVisualNovelIndex,true\)\)return/);
  assert.match(app, /if\(repairMissingVisualNovelDialogueRows\(currentVisualNovelEvents\.length-1,true\)\)return/);
});

test('visual novel autoplay has one cancellable schedule and cannot overlap', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function cancelVisualNovelAutoAdvance/);
  assert.match(app, /function scheduleVisualNovelAutoAdvance/);
  assert.match(app, /const token=visualNovelAutoScheduleToken/);
  assert.match(app, /if\(token!==visualNovelAutoScheduleToken\)return/);
  assert.doesNotMatch(app, /visualNovelAutoTimer = setTimeout/);
  assert.doesNotMatch(app, /visualNovelAutoTimer=setTimeout\(\(\) => advanceVisualNovel/);
});
test('視覺小說 CG 切換不會被預載卡死，且音效可以重疊播放', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /let visualNovelCgRequestToken = 0/);
  assert.match(app, /await Promise\.race\(\[/);
  assert.match(app, /requestToken !== visualNovelCgRequestToken/);
  assert.match(app, /function acquireVisualNovelSeChannel\(\)/);
  assert.match(app, /channels\.length < 12/);
  assert.match(app, /function stopVisualNovelSoundEffects\(\)/);
  assert.doesNotMatch(app, /se\.pause\(\); se\.src = source/);
});

test('每句台詞前都會依劇本校正 CG，不重播過去音效', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /let visualNovelActiveCgSource = ""/);
  assert.match(app, /function ensureVisualNovelCgMatchesScript\(upToIndex = currentVisualNovelIndex\)/);
  assert.match(app, /visualNovelActiveCgSource === normalizedExpected \|\| visualNovelPendingCgSource === normalizedExpected/);
  assert.match(app, /ensureVisualNovelCgMatchesScript\(currentVisualNovelIndex\)/);
  assert.doesNotMatch(app, /ensureVisualNovelCgMatchesScript[\s\S]{0,800}playVisualNovelAudio\("se"/);
});

test('視覺小說支援全域由上往下閱讀並原地保存單句編輯', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(html, /id="vnTopDownCheck" onchange="toggleVisualNovelTopDown\(event\)"/);
  assert.match(app, /localStorage\.getItem\("oc_visual_novel_top_down"\)/);
  assert.match(app, /put\("oc_visual_novel_top_down", String\(visualNovelTopDown\)\)/);
  assert.match(app, /function insertVisualNovelFeedNode\(feed, node\)/);
  assert.match(app, /function replaceRenderedVisualNovelDialogue\(eventIndex\)/);
  assert.match(app, /replaceRenderedVisualNovelDialogue\(eventIndex\)/);
  assert.match(html, /id="vnScriptRepairTools" hidden/);
  assert.match(styles, /\.vn-speaker-editor-form textarea/);
  assert.match(app, /visualNovelTemplates,visualNovelTopDown,customPresetAvatars/);
});

test('每句視覺小說對話以卡片頂端為閱讀錨點', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function focusVisualNovelEntryTop\(feed, row\)/);
  assert.match(app, /feed\.scrollTop \+= rowRect\.top - feedRect\.top - 10/);
  assert.match(app, /insertVisualNovelFeedNode\(feed, row\);\s*focusVisualNovelEntryTop\(feed, row\)/);
  assert.match(app, /visualNovelSuppressEntryScroll=true;executeVisualNovelEvent/);
  assert.doesNotMatch(app, /renderVisualNovelInlineText\(element, state\.text\);\s*if \(feed\) feed\.scrollTop/);
});

test('打字換行會維持完整對話可見，修復台詞在定位後才進場', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /function keepVisualNovelEntryFullyVisible\(feed, row\)/);
  assert.match(app, /renderVisualNovelInlineText\(element, state\.text, state\.index\);\s*keepVisualNovelEntryFullyVisible\(feed, state\.row\)/);
  assert.match(app, /inserted\.style\.animation='none'/);
  assert.match(app, /inserted\.classList\.add\('vn-feed-recovered'\)/);
  assert.match(styles, /@keyframes vnRecoveredFeedEnter/);
});

test('文章與書籍顯示不含視覺小說腳本的正文總字數', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /function countDocumentBodyCharacters\(doc\)/);
  assert.match(app, /String\(doc\?\.content \|\| ""\)\.replace\(\/\\s\/g, ""\)\.length/);
  assert.match(app, /formatDocumentCharacterCount\(bookCharacterCount\)/);
  assert.match(app, /formatDocumentCharacterCount\(countDocumentBodyCharacters\(doc\)\)/);
});

test('CP 展示卡混合最多三位成員主題色並允許手動覆寫', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /gradientColors: Array\.isArray\(cp\.gradientColors\)/);
  assert.match(app, /function resolveCpGradientColors\(cp, memberChars\)/);
  assert.match(app, /\.slice\(0, 3\)/);
  assert.match(app, /--cp-gradient:\$\{gradientCss\}/);
  assert.match(html, /id="cpUseCustomGradient"/);
  assert.match(html, /id="cpGradientColor3"/);
  assert.match(app, /gradientColors: document\.getElementById\("cpUseCustomGradient"\)\.checked/);
  assert.match(styles, /\.cp-theme-cover/);
  assert.match(styles, /color-mix\(in srgb,var\(--cp-color-1\) 68%,var\(--text-main\)\)/);
});

test('CP 編輯器可調整成員展示與自動漸層的先後順序', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /function moveCpMemberEditor\(button, direction\)/);
  assert.match(app, /function syncCpMemberEditorOrder\(\)/);
  assert.match(app, /checkedBoxes\.sort\(/);
  assert.match(app, /#cpMemberDetailsContainer \.cp-member-editor/);
  assert.match(app, /moveCpMemberEditor\(this,-1\)/);
  assert.match(app, /moveCpMemberEditor\(this,1\)/);
  assert.match(styles, /@keyframes cpMemberMoved/);
});

test('CP 手動漸層可選擇一色、二色或三色', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(html, /id="cpGradientColorCount"/);
  assert.match(html, /<option value="1">1 色<\/option>/);
  assert.match(html, /<option value="2">2 色<\/option>/);
  assert.match(app, /safeColors\.length === 2/);
  assert.ok(app.includes('`${safeColors[0]} 0%, ${safeColors[0]} 100%`'));
  assert.match(app, /inputs\.slice\(0,colorCount\)/);
  assert.match(app, /\.slice\(0,Math\.max\(1,Math\.min\(3,Number\(document\.getElementById\("cpGradientColorCount"\)\.value\)\|\|3\)\)\)/);
});

test('視覺小說只在 CG 與 BGM 真正成功後提交狀態並可自動補載', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /const loaded = await Promise\.race/);
  assert.match(app, /visualNovelActiveCgSource = loaded \? url : ""/);
  assert.match(app, /function ensureVisualNovelBgmMatchesScript\(upToIndex = currentVisualNovelIndex\)/);
  assert.match(app, /active\?\.dataset\.source === normalizedExpected && !active\.paused && active\.readyState >= 2/);
  assert.match(app, /await playPromise;\s*if \(token !== visualNovelBgmFadeToken\) return;\s*visualNovelBgmChannelIndex = nextIndex/);
  assert.match(app, /ensureVisualNovelCgMatchesScript\(currentVisualNovelIndex\);\s*ensureVisualNovelBgmMatchesScript\(currentVisualNovelIndex\)/);
  assert.match(app, /SE 首次播放失敗，等待載入後重試/);
});

test('舊雲端工坊備份缺少視覺小說閱讀偏好時仍可讀取', () => {
  const source = {
    characters:[], paros:[], factions:[], rankings:[], cps:[], books:[], documents:[], visualNovelTemplates:[], collapsedBooks:[], perspectiveTargets:[]
  };
  const payload = {format:'oc-cloud-save',version:1,scope:'workshop',data:source};
  const validated = CloudSyncCore.validate(payload);
  assert.deepEqual(validated.data.visualNovelPreferences, []);
  assert.deepEqual(CloudSyncCore.source(payload).visualNovelPreferences, {});
});

test('視覺小說章末停留並等待再次點擊才進下一章', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(app, /let visualNovelAwaitingNextChapterId = null/);
  assert.match(app, /if\(visualNovelAwaitingNextChapterId\)/);
  assert.match(app, /<strong>本章節已結束<\/strong>/);
  assert.match(app, /visualNovelAwaitingNextChapterId=nextChapter\?\.id\|\|'__end__'/);
  assert.doesNotMatch(app, /nextChapter\.title} 即將開始/);
  assert.match(styles, /\.vn-feed-chapter-complete/);
});

test('舊 Supabase 增量函式拒絕新群組時自動改用完整上傳', () => {
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'cloud-sync.js'), 'utf8');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'setup.sql'), 'utf8');
  assert.match(cloud, /function isUnsupportedDeltaError\(error\)/);
  assert.match(cloud, /text\.includes\('INVALID_DELTA_ITEM'\)/);
  assert.match(cloud, /deltaUnsupportedScopes\.add\(scope\)/);
  assert.match(cloud, /!deltaUnsupportedScopes\.has\(scope\)/);
  assert.match(sql, /'visualNovelPreferences'/);
});
