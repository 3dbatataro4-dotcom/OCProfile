const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ForumCore = require('../forum-core.js');
const CloudSyncCore = require('../cloud-sync-core.js');

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
  assert.match(source, /async function job\(task\)[\s\S]*?note\('AI 正在閱讀作品並生成/);
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
