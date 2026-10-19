const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('trust variants select highest satisfied threshold or common dialogue',()=>{
  const context={window:{},OCCharacterArchive:{open(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../interrogation.js'),'utf8'),context);
  const text=context.window.OCInterrogation.sceneText;
  const scene={text:'common',variants:[{minTrust:3,text:'trust'},{minTrust:8,text:'secret'}]};
  assert.equal(text(scene,-2),'common');
  assert.equal(text(scene,3),'trust');
  assert.equal(text(scene,7),'trust');
  assert.equal(text(scene,8),'secret');
  assert.equal(text({text:'plain'},99),'plain');
});
