const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../src/core.js');
const { levels, tiers } = require('../data/puzzles/index.js');

test('五个难度各30题，共150题，每题尺寸正确且包含图案和空白', () => {
  assert.equal(levels.length, 150);
  tiers.forEach((tier, i) => {
    const group = levels.filter((lv) => lv.tier === i);
    assert.equal(group.length, 30, tier.name);
    for (const lv of group) {
      assert.equal(lv.rows.length, tier.size, lv.name);
      assert.ok(lv.rows.every((row) => row.length === tier.size && /^[#.]+$/.test(row)), lv.name);
      assert.ok(lv.rows.join('').includes('#') && lv.rows.join('').includes('.'), lv.name);
    }
  });
});

test('原100道题的编号、内容和配色保持不变，兼容现有存档', () => {
  const hash = crypto.createHash('sha256').update(JSON.stringify(levels.slice(0, 100))).digest('hex');
  assert.equal(hash, 'd9c2946b29c9a6c6cedd84afe219affee42e47020968016a0d831e45421cfc92');
});

test('新增50题不与同难度已有图案重复，且均可由逻辑推理解出唯一解', () => {
  assert.equal(levels.slice(100).length, 50);
  const seen = new Set(levels.slice(0, 100).map((lv) => lv.tier + ':' + lv.rows.join('/')));
  for (const lv of levels.slice(100)) {
    const key = lv.tier + ':' + lv.rows.join('/');
    assert.equal(seen.has(key), false, lv.name + ' 图案重复');
    seen.add(key);
    assert.equal(P.analyze(P.parseRows(lv.rows)).status, 'logic', lv.name + ' 应无需猜测');
  }
});
