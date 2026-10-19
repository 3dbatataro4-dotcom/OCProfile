const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('character cards and export settings expose the archive',()=>{
  assert.match(read('app.js'),/OCCharacterArchive\.open\('/);
  assert.match(read('index.html'),/value="character_archive"/);
  assert.match(read('app.js'),/OCCharacterArchive\?\.exportText\(targetChars\)/);
  assert.match(read('index.html'),/character-archive\.js/);
});

test('archive export includes only checked characters and their complete chapter text',()=>{
  const context={window:{},characters:[]};
  vm.runInNewContext(read('character-archive.js'),context);
  const selected=[{id:'a',name:'奧拉',englishName:'Ora',archiveBook:{title:'奧拉記事',description:'屬於她的記憶',chapters:[{id:'one',title:'初遇',content:'第一段\n第二段'},{id:'two',title:'離別',content:'完整內容'}]}}];
  const result=context.window.OCCharacterArchive.exportText(selected);
  assert.match(result,/奧拉 \(Ora\)/);
  assert.match(result,/01 初遇\n第一段\n第二段/);
  assert.match(result,/02 離別\n完整內容/);
  assert.doesNotMatch(result,/薩利歐/);
});
