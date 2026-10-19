const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(lists, hiddenIds = []) {
  let saved = 0;
  const context = {
    window: {},
    document: { addEventListener() {} },
    characters: [
      { id: 'a', name: '甲' },
      { id: 'b', name: '乙' },
      { id: 'c', name: '丙' },
      { id: 'd', name: '丁' }
    ],
    rankings: lists,
    currentRankingSubjectId: lists[0]?.id,
    saveStateToLocalStorage() { saved++; }
  };
  context.characters.forEach(char => { char.isHidden = hiddenIds.includes(char.id); });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'record-policy.js'), 'utf8'), context);
  context.OCRecordPolicy = context.window.OCRecordPolicy;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'tierlist.js'), 'utf8'), context);
  return { api: context.window.OCTierList, characters: context.characters, saves: () => saved };
}

test('legacy ranking becomes tiers and preserves the equal relation', () => {
  const list = { id: 'old', subject: '外貌', items: [
    { charId: 'a', operator: '=' },
    { charId: 'b', operator: '>' },
    { charId: 'c', operator: '' }
  ], cutoffs: [{ charId: 'a', label: '美若天仙' }, { charId: 'c', label: '普通' }] };
  const { api, saves } = load([list]);
  assert.equal(api.textFor(list), '# 外貌\n【美若天仙】甲=乙\n【普通】丙');
  assert.equal(list.tiers.length, 2);
  assert.equal(list.tiers[0].entries[0].equalNext, true);
  assert.ok(list.poolIds.includes('d'));
  assert.equal(saves(), 1);
});

test('text export uses tier order and keeps equality across filtered people', () => {
  const list = { id: 'new', subject: '實力', description: '測試簡介', poolIds: ['a', 'b', 'c'], tiers: [
    { id: 's', name: 'S', color: '#b97375', entries: [
      { charId: 'a', equalNext: true }, { charId: 'b', equalNext: true }, { charId: 'c', equalNext: false }
    ] },
    { id: 'a', name: 'A', color: '#d4a36c', entries: [] }
  ] };
  const { api } = load([list]);
  assert.equal(api.textFor(list), '# 實力\n測試簡介\n【S】甲=乙=丙\n【A】');
  assert.equal(api.textFor(list, ['a', 'c']), '# 實力\n測試簡介\n【S】甲=丙\n【A】');
});

test('tier notes appear only in text export, while quadrant has no text export', () => {
  const list = { id: 'note', subject: '印象', mode: 'tier', poolIds: ['a'], tiers: [
    { id: 's', name: 'S', color: '#b97375', note: '氣質出眾', entries: [{ charId: 'a', equalNext: false }] }
  ] };
  const { api } = load([list]);
  assert.equal(api.textFor(list), '# 印象\n【S】甲\n註釋：氣質出眾');
  list.mode = 'quadrant';
  list.quadrant = { left: '冷', right: '熱', top: '強', bottom: '弱', points: [{ charId: 'a', x: 30, y: 40 }] };
  assert.equal(api.textFor(list), '');
});

test('text export omits deleted character ids and leaves no dangling operators', () => {
  const list = { id: 'missing', subject: '印象', mode: 'tier', poolIds: ['a', 'deleted', 'b'], tiers: [
    { id: 's', name: 'S', color: '#b97375', entries: [
      { charId: 'a', equalNext: false },
      { charId: 'deleted', equalNext: false },
      { charId: 'b', equalNext: false }
    ] },
    { id: 'a', name: 'A', color: '#d49b6a', entries: [{ charId: 'deleted', equalNext: false }] }
  ] };
  const { api } = load([list]);
  assert.equal(api.textFor(list), '# 印象\n【S】甲>乙\n【A】');
  assert.equal(api.visibleTierEntries(list.tiers[0]).map(item => item.person.name).join(','), '甲,乙');
  assert.equal(api.visibleTierEntries(list.tiers[1]).length, 0);
});

test('draft people are dormant in tier exports and return without losing their placement', () => {
  const list={id:'draft-test',subject:'能力',mode:'tier',tiers:[{id:'s',name:'S',entries:[{charId:'a',equalNext:false},{charId:'b',equalNext:false}]}],poolIds:['a','b']};
  const fixture=load([list],['b']);
  assert.match(fixture.api.textFor(list),/甲/);
  assert.doesNotMatch(fixture.api.textFor(list),/乙/);
  assert.equal(list.tiers[0].entries.length,2);
  fixture.characters.find(char=>char.id==='b').isHidden=false;
  assert.match(fixture.api.textFor(list),/甲>乙/);
});
