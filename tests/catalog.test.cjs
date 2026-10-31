const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../data/puzzles/index.js');
function catalog() {
  const file = path.join(__dirname, '../src/core.js');
  assert.ok(fs.existsSync(file), '题库查询应独立于页面');
  return require(file).createCatalog(data);
}

test('题库列表按难度排序并保留稳定ID，自制题排在最后', () => {
  const c = catalog();
  const list = c.list([{ id: 'user', name: '自制', rows: ['#'] }]);
  assert.equal(list[0].key, 'L0');
  assert.equal(list[25].key, 'L100');
  assert.equal(list[29].tier, 0);
  assert.equal(list[30].key, 'L25');
  assert.equal(list[149].tier, 4);
  assert.equal(list[150].key, 'Cuser');
  assert.equal(c.number('L104'), 30);
  assert.equal(c.number('L149'), 30);
  for (let tier = 0; tier < 5; tier++) assert.equal(c.group(tier).length, 30);
  assert.equal(c.group(5, [{ id: 'user', rows: ['#'] }])[0].key, 'Cuser');
});

test('题库配色不随页面排序改变，自制图案使用稳定配色', () => {
  const c = catalog();
  data.levels.forEach((lv, i) => assert.equal(c.palette('L' + i), lv.palette));
  assert.equal(c.palette('Cuser'), c.palette('Cuser'));
  assert.ok(c.palette('Cuser') >= 0 && c.palette('Cuser') < data.palettes.length);
});

test('当前分组只累加已完成关卡的最高星级，旧完成标记不虚构成绩', () => {
  const c = catalog();
  const group = ['L0', 'L1', 'L2', 'L3'].map((key) => ({ key }));
  const store = { done: { L0: true, L1: true, L3: true, L99: true }, results: {
    L0: { stars: 1, bestStars: 3 }, L1: { stars: 2 }, L2: { stars: 3 }, L99: { stars: 3 },
  } };
  assert.deepEqual(c.stats(group, store), { completed: 3, total: 4, stars: 5 });
  assert.deepEqual(c.stats([], store), { completed: 0, total: 0, stars: 0 });
});
