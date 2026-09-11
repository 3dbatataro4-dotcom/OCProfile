const test = require('node:test');
const assert = require('node:assert/strict');
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
