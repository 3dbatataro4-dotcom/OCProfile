const test=require('node:test'),a=require('node:assert/strict'),C=require('../cloud-sync-core.js'),S=require('../sync-collaboration.js');
const snap=value=>C.snapshot('workshop',value);

test('a pure tag reorder is not reported as a change',()=>{const local=snap({characters:[{id:'a',name:'甲',tags:['『教會』','一般區民','學生會']}]}),remote=snap({characters:[{id:'a',name:'甲',tags:['學生會','『教會』','一般區民']}]});a.deepEqual(C.compare(local,remote),[]);});

test('adding or removing a tag is still a change',()=>{const local=snap({characters:[{id:'a',name:'甲',tags:['甲','乙','丙']}]}),remote=snap({characters:[{id:'a',name:'甲',tags:['甲','乙']}]});const changes=C.compare(local,remote);a.equal(changes.length,1);a.deepEqual(changes[0].path,['tags']);});

test('document character lists compare as memberships',()=>{const local=snap({documents:[{id:'d',title:'章',charIds:['x','y']}]}),remote=snap({documents:[{id:'d',title:'章',charIds:['y','x']}]});a.deepEqual(C.compare(local,remote),[]);});

test('upload baseline acknowledges reordered tags so they stop showing as pending',()=>{const old=snap({characters:[{id:'a',name:'甲',tags:['乙','甲']}]}),current=snap({characters:[{id:'a',name:'甲',tags:['甲','乙']}]}),published=snap({characters:[{id:'a',name:'甲',tags:['乙','甲']}]});const anchor=S.anchor(current,old,published);a.deepEqual(C.compare(current,anchor),[]);});

test('character order inside the save is untouched by merging remote edits',()=>{const local=snap({characters:[{id:'b',name:'乙'},{id:'a',name:'甲',bio:'舊'}]}),remote=snap({characters:[{id:'a',name:'甲',bio:'新'},{id:'b',name:'乙'}]});const changes=C.compare(local,remote);for(const d of changes)d.choice='remote';const merged=C.merge(local,remote,changes,{});a.deepEqual(merged.data.characters.map(c=>c.id),['b','a']);});
