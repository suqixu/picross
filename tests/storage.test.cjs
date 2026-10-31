const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function service(storage) {
  const file = path.join(__dirname, '../src/storage.js');
  assert.ok(fs.existsSync(file), '存储应通过独立模块访问');
  return require(file).create(storage);
}
function memory(initial = {}) {
  const values = { ...initial };
  Object.defineProperties(values, {
    getItem: { value: (key) => values[key] ?? null },
    setItem: { value: (key, value) => { values[key] = value; } },
    removeItem: { value: (key) => { delete values[key]; } },
  });
  return values;
}

test('沿用所有存档键，并读取已有自制题、成绩和未完成盘面', () => {
  const s = service(memory({ 'picross.custom': '[{"id":"abc"}]', 'picross.done': '{"L0":true}',
    'picross.progress': '{"L1":{"elapsedMs":1234}}', 'picross.last': '"L1"',
    'picross.results': '{"L0":{"bestStars":3}}' }));
  assert.deepEqual(s.state.custom, [{ id: 'abc' }]);
  assert.equal(s.state.done.L0, true);
  assert.equal(s.state.progress.L1.elapsedMs, 1234);
  assert.equal(s.state.last, 'L1');
  assert.equal(s.state.results.L0.bestStars, 3);
  assert.equal(s.keys.custom, 'picross.custom');
});

test('损坏JSON、错误数据类型或存储不可用时仍能启动和游玩', () => {
  const s = service(memory({ 'picross.custom': '{}', 'picross.done': 'invalid', 'picross.progress': '[]' }));
  assert.deepEqual(s.state.custom, []);
  assert.deepEqual(s.state.done, {});
  assert.deepEqual(s.state.progress, {});
  const blocked = service({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } });
  assert.doesNotThrow(() => blocked.saveJSON('picross.done', { L0: true }));
  assert.deepEqual(blocked.state.results, {});
});

test('写入保存为JSON，清档保留声音设置、教程偏好及其他应用数据', () => {
  const memoryStore = memory({ 'picross.audio': 'audio', 'picross.tutorialSeen': 'seen', other: 'keep' });
  const s = service(memoryStore);
  s.saveJSON(s.keys.done, { L0: true });
  assert.equal(memoryStore['picross.done'], '{"L0":true}');
  s.clearGameData();
  assert.equal(memoryStore['picross.done'], undefined);
  assert.equal(memoryStore['picross.audio'], 'audio');
  assert.equal(memoryStore['picross.tutorialSeen'], 'seen');
  assert.equal(memoryStore.other, 'keep');
});
