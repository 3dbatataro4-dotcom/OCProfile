const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Hogwarts remains a default Paro with a four-house room planner', () => {
  assert.match(read('data.js'), /id: "paro_hogwarts"/);
  assert.match(read('index.html'), /hogwarts-dorm\.js/);
  assert.match(read('index.html'), /hogwarts-dorm\.css/);
  assert.match(read('app.js'), /OCHogwartsDorm\?\.mount\(currentParo\)/);
});

test('room assignment and house changes keep roommate export symmetrical', () => {
  const context = {
    window: {},
    paros: [{id:'paro_hogwarts', name:'霍格華茲魔法學校 (Hogwarts Paro)', description:'魔法世界觀。每個人物隸屬於四大學院。', members:['a','b'], fields:[], dormRooms:[
      {id:'s1',house:'Slytherin',name:'翡翠地窖 · 01 室',capacity:2,members:['a']},
      {id:'r1',house:'Ravenclaw',name:'星空高塔 · 01 室',capacity:2,members:[]}
    ]}],
    characters: [
      {id:'a',name:'厄瑞斯',hogwartsHouse:'Slytherin',paroValues:{paro_hogwarts:{house:'Slytherin'}}},
      {id:'b',name:'薩利歐',hogwartsHouse:'Slytherin',paroValues:{paro_hogwarts:{house:'Slytherin'}}}
    ],
    saveStateToLocalStorage() {},
    renderParoList() {},
  };
  vm.runInNewContext(read('hogwarts-dorm.js'), context);
  context.window.OCHogwartsDorm.assignRoom('b','s1');
  let output=context.window.OCHogwartsDorm.exportText(context.paros[0],context.characters);
  assert.match(output, /角色 厄瑞斯:[\s\S]*宿舍同房人: 薩利歐/);
  assert.match(output, /角色 薩利歐:[\s\S]*宿舍同房人: 厄瑞斯/);
  context.window.OCHogwartsDorm.setHouse('b','Ravenclaw');
  output=context.window.OCHogwartsDorm.exportText(context.paros[0],context.characters);
  assert.match(output, /角色 薩利歐:[\s\S]*學院分院: 鷹院Ravenclaw/);
  assert.equal(context.paros[0].dormRooms[0].members.length,1);
});

test('existing manually entered roommate text survives unrelated dorm edits', () => {
  const context = {
    window: {},
    paros: [{id:'paro_hogwarts',name:'霍格華茲魔法學校 (Hogwarts Paro)',description:'',members:['a','b','c'],fields:[],dormRooms:[
      {id:'s1',house:'Slytherin',name:'翡翠地窖',capacity:2,members:[]}
    ]}],
    characters: [
      {id:'a',name:'舊角色',paroValues:{paro_hogwarts:{house:'Slytherin',roommate:'舊同房人'}}},
      {id:'b',name:'新角色',paroValues:{paro_hogwarts:{house:'Slytherin'}}},
      {id:'c',name:'另一角色',paroValues:{paro_hogwarts:{house:'Slytherin'}}}
    ],
    saveStateToLocalStorage() {},
    renderParoList() {},
  };
  vm.runInNewContext(read('hogwarts-dorm.js'), context);
  context.window.OCHogwartsDorm.assignRoom('b','s1');
  context.window.OCHogwartsDorm.assignRoom('c','s1');
  assert.equal(context.characters[0].paroValues.paro_hogwarts.roommate,'舊同房人');
  assert.equal(context.characters[1].paroValues.paro_hogwarts.roommate,'另一角色');
  context.window.OCHogwartsDorm.setHouse('c','Ravenclaw');
  assert.equal(context.characters[2].paroValues.paro_hogwarts.roommate,'');
});

test('assigned character avatars render inside rooms as draggable items', () => {
  const root = {innerHTML:'',onclick:null,onchange:null,ondragstart:null,ondragover:null,ondragleave:null,ondrop:null,onpointerdown:null,onpointermove:null,onpointerup:null,onpointercancel:null};
  const context = {
    window: {},
    document: {getElementById:id=>id==='hogwartsDormMount'?root:null},
    paros: [{id:'paro_hogwarts',name:'霍格華茲魔法學校 (Hogwarts Paro)',description:'',members:['a'],fields:[],dormRooms:[
      {id:'g1',house:'Gryffindor',name:'緋紅塔樓',capacity:2,members:['a']}
    ]}],
    characters: [{id:'a',name:'奧拉',avatar:'https://example.test/avatar.png',paroValues:{paro_hogwarts:{house:'Gryffindor'}}}],
    saveStateToLocalStorage() {},
    renderParoList() {},
  };
  vm.runInNewContext(read('hogwarts-dorm.js'), context);
  context.window.OCHogwartsDorm.mount(context.paros[0]);
  assert.match(root.innerHTML,/class="hgd-room-person" draggable="true" data-drag-char="a"/);
  assert.match(root.innerHTML,/src="https:\/\/example\.test\/avatar\.png"/);
  assert.match(root.innerHTML,/data-drop-room="g1"/);
  assert.match(root.innerHTML,/data-open-room="g1"/);
  assert.doesNotMatch(root.innerHTML,/data-auto-pairs/);
  assert.equal(typeof root.ondrop,'function');
  assert.equal(typeof root.onpointermove,'function');
});

test('pool checkbox changes no longer rebuild the scrolled card list', () => {
  const source=read('lottery.js');
  const handler=source.slice(source.indexOf('function handleChange('),source.indexOf('window.OCLottery='));
  const branch=handler.slice(handler.indexOf('if(target.dataset.poolId)'),handler.indexOf("if(target.id==='lotteryAllowRepeat')"));
  assert.match(branch,/classList\.toggle\('is-selected'/);
  assert.doesNotMatch(branch,/render\(\)/);
});
