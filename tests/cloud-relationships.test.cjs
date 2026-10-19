const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../cloud-sync-core.js');

function save(relationships=[],targets=[]){return C.snapshot('workshop',{characters:[{id:'speaker',name:'說話人',relationships}],perspectiveTargets:{speaker:targets}});}
const relation=(targetName,callName,opinion='')=>({targetName,callName,opinion,isMainline:true});

test('different devices can add different relationship targets to the same character',()=>{
  const base=save(),local=save([relation('甲','小甲')],['甲']),remote=save([relation('乙','小乙')],['乙']);
  const changes=C.plan(local,remote,base,'upload');
  assert.equal(changes.filter(row=>row.conflict).length,0);
  const merged=C.source(C.merge(local,remote,changes,{}));
  assert.deepEqual(merged.characters[0].relationships.map(row=>row.targetName).sort(),['乙','甲']);
  assert.deepEqual(merged.perspectiveTargets.speaker.sort(),['乙','甲']);
});

test('separate relationship additions also merge when no baseline is available',()=>{
  const local=save([relation('甲','小甲')],['甲']),remote=save([relation('乙','小乙')],['乙']);
  const changes=C.plan(local,remote,null,'download');
  assert.equal(changes.some(row=>row.conflict),false);
  const merged=C.source(C.merge(local,remote,changes,{}));
  assert.deepEqual(merged.characters[0].relationships.map(row=>row.targetName).sort(),['乙','甲']);
});

test('different fields on the same relationship merge without a prompt',()=>{
  const base=save([relation('甲','甲','原看法')]);
  const local=save([relation('甲','小甲','原看法')]);
  const remote=save([relation('甲','甲','新看法')]);
  const changes=C.plan(local,remote,base,'download');
  assert.equal(changes.filter(row=>row.conflict).length,0);
  const merged=C.source(C.merge(local,remote,changes,{}));
  assert.equal(merged.characters[0].relationships[0].callName,'小甲');
  assert.equal(merged.characters[0].relationships[0].opinion,'新看法');
});

test('same relationship field conflict asks for a choice',()=>{
  const base=save([relation('甲','原稱呼')]);
  const local=save([relation('甲','本機稱呼')]);
  const remote=save([relation('甲','雲端稱呼')]);
  const changes=C.plan(local,remote,base,'upload');
  const pair=changes.find(row=>row.kind==='characterRelationship');
  assert.equal(pair.conflict,true);
  assert.match(pair.status,/稱呼/);
  const merged=C.source(C.merge(local,remote,changes,{[pair.key]:'remote'}));
  assert.equal(merged.characters[0].relationships[0].callName,'雲端稱呼');
});

test('remote deletion of a single relationship asks whether to keep the local row',()=>{
  const base=save([relation('甲','小甲')],['甲']);
  const local=save([relation('甲','小甲')],['甲']);
  const remote=save([],[]);
  const changes=C.plan(local,remote,base,'download');
  const pair=changes.find(row=>row.kind==='characterRelationship');
  assert.equal(pair.conflict,true);
  assert.equal(C.source(C.merge(local,remote,changes,{})).characters[0].relationships.length,1);
  const decisions=Object.fromEntries(changes.filter(row=>row.conflict).map(row=>[row.key,'remote']));
  const deleted=C.source(C.merge(local,remote,changes,decisions));
  assert.equal(deleted.characters[0].relationships.length,0);
  assert.deepEqual(deleted.perspectiveTargets.speaker,[]);
});
