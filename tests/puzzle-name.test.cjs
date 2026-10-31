const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/core.js');

test('名称最多保留8个字符，中文和emoji不会被截断', () => {
  assert.equal(P.limitName('一二三四五六七八九'), '一二三四五六七八');
  assert.equal(P.limitName('😀😀😀😀😀😀😀😀😀'), '😀😀😀😀😀😀😀😀');
  assert.equal(P.limitName('  房子'), '  房子');
});

test('保存和分享使用相同的名称规范，空名称有默认值', () => {
  assert.equal(P.puzzleName('  一二三四五六七八九  '), '一二三四五六七八');
  assert.equal(P.puzzleName('   '), '未命名');
  const code = P.encodePuzzle('  一二三四五六七八九  ', [[1]]);
  const payload = JSON.parse(Buffer.from(code.slice(9), 'base64').toString('utf8'));
  assert.equal(payload.n, '一二三四五六七八');
});

test('导入旧分享码也限制名称长度并保留谜题内容', () => {
  const code = 'PICROSS1:' + Buffer.from(JSON.stringify({ n: '😀😀😀😀😀😀😀😀😀', d: ['#.'] })).toString('base64');
  assert.deepEqual(P.decodePuzzle(code), { name: '😀😀😀😀😀😀😀😀', grid: [[1, 0]] });
});
