const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

function fixture() {
  const classes = new Set();
  const frames = [];
  const timers = new Map();
  let nextTimer = 0;
  let panels = 0;
  const scope = { S: { cells: [[1]], R: 1, C: 1, won: true }, winTimer: null,
    els: { cells: [[{ classList: { remove() {} } }]] },
    $: () => ({ classList: { add: (name) => classes.add(name) } }),
    paintArtColors() {}, showWin() { panels++; },
    requestAnimationFrame(fn) { frames.push(fn); },
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    P: { gridClues: () => ({ rows: [[1]], cols: [[1]] }) },
    zeros: (r, c) => Array.from({ length: r }, () => Array(c).fill(0)),
    buildBoard() { classes.clear(); }, updateGameActions() {},
  };
  const context = vm.createContext(scope);
  for (const name of ['celebrate', 'openBoard']) {
    const match = source.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'));
    vm.runInContext(match[0], context);
  }
  return { scope, classes, frames, timers, panels: () => panels };
}

test('完成教程后立即进入颜色提示，旧通关动画不能隐藏新棋盘线索', () => {
  const f = fixture();
  f.scope.celebrate(false);
  const staleTimers = [...f.timers.values()];
  f.scope.openBoard([[1]], [[0, 0, 1]]);
  for (const callback of [...f.frames, ...staleTimers]) callback();
  assert.equal(f.classes.has('art'), false, '新教程应保留网格与线索');
  assert.equal(f.classes.has('reveal'), false, '旧动画不能改变新步骤状态');
  assert.equal(f.timers.size, 0, '切换棋盘应取消旧动画计时器');
});

test('没有切换棋盘时，通关动画和结果区仍正常显示', () => {
  const f = fixture();
  f.scope.celebrate(true);
  for (const callback of [...f.frames, ...f.timers.values()]) callback();
  assert.equal(f.classes.has('reveal'), true);
  assert.equal(f.classes.has('art'), true);
  assert.equal(f.panels(), 1);
});
