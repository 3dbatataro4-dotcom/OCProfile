const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('advanced visual novel module preserves the classic player by default', () => {
  const calls = [];
  const context = {
    window: { startVisualNovel: (...args) => calls.push(args) },
    document: { addEventListener() {} },
    books: [],
    documents: [{ id: 'chapter-1', visualNovel: { scriptText: '旁白｜開始' } }],
    mediaLibrary: [],
    characters: [],
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'vn-page.js'), 'utf8'), context);
  assert.equal(typeof context.window.OCVnPage.openFromBook, 'function');
  assert.equal(typeof context.window.OCVnPage.analyze, 'function');
  context.window.startVisualNovel('chapter-1', false, true);
  assert.deepEqual(calls, [['chapter-1', false, true]]);
});

test('advanced player keeps existing sprite images and spaces AI music changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'vn-page.js'), 'utf8');
  const render = source.slice(source.indexOf('async function renderSprites('), source.indexOf('function closePlayer('));
  assert.match(render, /image\.dataset\.source!==row\.url/);
  assert.doesNotMatch(render, /box\.innerHTML\s*=/);
  assert.match(source, /dialogueCount-lastMusicChangeAt>=8/);
  assert.match(source, /ordinal-lastMusicOrdinal>=10/);
});

test('layout studio is loaded and script commands use orange highlighting', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '..', 'vn-layout.js'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'vn-page.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'vn-page.css'), 'utf8');
  assert.match(index, /vn-layout\.js/);
  assert.match(index, /vn-layout\.css/);
  assert.match(index, /id="vnpAnnotations"/);
  assert.match(layout, /kind:'vn-layout-template'/);
  assert.match(layout, /storeFile\(assetId,file\)/);
  assert.match(layout, /function onPointerMove\(/);
  assert.match(page, /renderAnnotations/);
  assert.match(page, /renderCommandColors/);
  assert.match(page, /materializeAiCommands/);
  assert.match(styles, /\.vnp-command-color/);
});

test('new system directives parse alongside legacy media commands', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const helpers = source.slice(source.indexOf('function cleanLegacyVisualNovelScript('), source.indexOf('function migrateVisualNovelEventIndex('));
  const parser = source.slice(source.indexOf('function parseVisualNovelScript('), source.indexOf('function buildVerifiedVisualNovelEvents('));
  const context = { stripInvisibleFormatting: value => value };
  vm.runInNewContext(`${helpers}\n${parser}\nthis.parse=parseVisualNovelScript`, context);
  const rows = context.parse('@bg asset:scene_1\n\nsys(hide:all)\n\nsys(move:c:20:-10:1)\n\nsys(flip:r:on)\n\n角色｜「你好」');
  assert.deepEqual([...rows.map(row => row.type)], ['bg', 'sys', 'sys', 'sys', 'dialogue']);
  assert.equal(rows[1].command, 'hide');
  assert.deepEqual([...rows[2].args], ['c', '20', '-10', '1']);
  assert.equal(rows[4].speaker, '角色');
});

test('AI scene commands move existing emotion cues with their dialogue', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'vn-page.js'), 'utf8');
  const helpers = app.slice(app.indexOf('function cleanLegacyVisualNovelScript('), app.indexOf('function migrateVisualNovelEventIndex('));
  const parser = app.slice(app.indexOf('function parseVisualNovelScript('), app.indexOf('function buildVerifiedVisualNovelEvents('));
  const materialize = page.slice(page.indexOf('function materializeAiCommands('), page.indexOf('async function analyze('));
  const editor = { value: '甲｜「早安」\n\n乙｜「你好」' };
  const context = { stripInvisibleFormatting: value => value, editor };
  vm.runInNewContext(`${helpers}\n${parser}\nconst $=()=>editor;${materialize}\nthis.materialize=materializeAiCommands`, context);
  const doc = { visualNovelPage: {} };
  const cues = { 0: { emotion: '喜', sceneId: 'school' }, 1: { emotion: '驚' } };
  const remapped = context.materialize(doc, cues, ['scene']);
  assert.match(editor.value, /^@bg asset:school\n\n甲/);
  assert.equal(remapped[1].emotion, '喜');
  assert.equal(remapped[2].emotion, '驚');
  assert.equal(remapped[1].sceneId, undefined);
});

test('repeated AI scene and music labels produce commands only at switches', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const page=fs.readFileSync(path.join(__dirname,'..','vn-page.js'),'utf8');
  const helpers=app.slice(app.indexOf('function cleanLegacyVisualNovelScript('),app.indexOf('function migrateVisualNovelEventIndex('));
  const parser=app.slice(app.indexOf('function parseVisualNovelScript('),app.indexOf('function buildVerifiedVisualNovelEvents('));
  const materialize=page.slice(page.indexOf('function materializeAiCommands('),page.indexOf('async function analyze('));
  const editor={value:'甲｜一\n\n甲｜二\n\n甲｜三\n\n甲｜四'};
  const context={stripInvisibleFormatting:value=>value,editor,mediaLibrary:[]};
  vm.runInNewContext(`${helpers}\n${parser}\nconst $=()=>editor;${materialize}\nthis.materialize=materializeAiCommands`,context);
  context.materialize({visualNovelPage:{}},{0:{sceneId:'room',musicId:'calm'},1:{sceneId:'room',musicId:'calm'},2:{sceneId:'garden',musicId:'calm'},3:{sceneId:'garden',musicId:'battle'}},['scene','music']);
  assert.equal((editor.value.match(/@bg asset:room/g)||[]).length,1);
  assert.equal((editor.value.match(/@bg asset:garden/g)||[]).length,1);
  assert.equal((editor.value.match(/@bgm asset:calm/g)||[]).length,1);
  assert.equal((editor.value.match(/@bgm asset:battle/g)||[]).length,1);
});

test('rerunning scene analysis replaces its earlier command',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const page=fs.readFileSync(path.join(__dirname,'..','vn-page.js'),'utf8');
  const helpers=app.slice(app.indexOf('function cleanLegacyVisualNovelScript('),app.indexOf('function migrateVisualNovelEventIndex('));
  const parser=app.slice(app.indexOf('function parseVisualNovelScript('),app.indexOf('function buildVerifiedVisualNovelEvents('));
  const materialize=page.slice(page.indexOf('function materializeAiCommands('),page.indexOf('async function analyze('));
  const editor={value:'甲｜一\n\n甲｜二'};
  const context={stripInvisibleFormatting:value=>value,editor,mediaLibrary:[]};
  vm.runInNewContext(`${helpers}\n${parser}\nconst $=()=>editor;${materialize}\nthis.materialize=materializeAiCommands`,context);
  const doc={visualNovelPage:{}};
  context.materialize(doc,{0:{sceneId:'old'}},['scene']);
  context.materialize(doc,{1:{sceneId:'new'}},['scene']);
  assert.doesNotMatch(editor.value,/asset:old/);
  assert.equal((editor.value.match(/@bg asset:new/g)||[]).length,1);
});

test('AI opening selection places scene and music on the first line and spaces later music',async()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const page=fs.readFileSync(path.join(__dirname,'..','vn-page.js'),'utf8');
  const helpers=app.slice(app.indexOf('function cleanLegacyVisualNovelScript('),app.indexOf('function migrateVisualNovelEventIndex('));
  const parser=app.slice(app.indexOf('function parseVisualNovelScript('),app.indexOf('function buildVerifiedVisualNovelEvents('));
  const opening=page.slice(page.indexOf('async function ensureOpeningAsset('),page.indexOf('async function analyze('));
  const context={stripInvisibleFormatting:value=>value,console,requestDeepSeek:async()=>({choices:[{message:{content:'{"id":"calm"}'}}]})};
  vm.runInNewContext(`${helpers}\n${parser}\n${opening}\nthis.choose=ensureOpeningAsset`,context);
  const script=Array.from({length:12},(_,i)=>`甲｜第${i+1}句`).join('\n\n');
  const lines=context.parseVisualNovelScript(script).filter(row=>row.type==='dialogue');
  const cues={[lines[3].sourceLineIndex]:{musicId:'battle',musicSource:'ai'}};
  const doc={visualNovelPage:{}};
  await context.choose('music',doc,script,lines,[{id:'calm'},{id:'battle'}],cues);
  assert.equal(cues[lines[0].sourceLineIndex].musicId,'calm');
  assert.equal(cues[lines[3].sourceLineIndex].musicId,undefined);
  context.requestDeepSeek=async()=>({choices:[{message:{content:'{"id":"room"}'}}]});
  await context.choose('scene',doc,script,lines,[{id:'room'}],cues);
  assert.equal(cues[lines[0].sourceLineIndex].sceneId,'room');
});

test('an existing manual opening scene remains in control',async()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const page=fs.readFileSync(path.join(__dirname,'..','vn-page.js'),'utf8');
  const helpers=app.slice(app.indexOf('function cleanLegacyVisualNovelScript('),app.indexOf('function migrateVisualNovelEventIndex('));
  const parser=app.slice(app.indexOf('function parseVisualNovelScript('),app.indexOf('function buildVerifiedVisualNovelEvents('));
  const opening=page.slice(page.indexOf('async function ensureOpeningAsset('),page.indexOf('async function analyze('));
  const context={stripInvisibleFormatting:value=>value,console,requestDeepSeek:async()=>{throw Error('manual scene should not request AI');}};
  vm.runInNewContext(`${helpers}\n${parser}\n${opening}\nthis.choose=ensureOpeningAsset`,context);
  const script='@bg asset:manual\n\n甲｜開場';
  const lines=context.parseVisualNovelScript(script).filter(row=>row.type==='dialogue');
  const cues={[lines[0].sourceLineIndex]:{sceneId:'ai-scene',sceneSource:'ai'}};
  await context.choose('scene',{visualNovelPage:{}},script,lines,[{id:'ai-scene'}],cues);
  assert.equal(cues[lines[0].sourceLineIndex].sceneId,undefined);
});
