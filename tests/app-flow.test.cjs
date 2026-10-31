const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFunction } = require('./helpers/source.cjs');
const P = require('../src/core.js');
const data = require('../data/puzzles/index.js');

test('选关后通过独立题库查询定位分页，并正常初始化棋盘和计时', () => {
  const S = {};
  const store = { progress: {} };
  let opened;
  const scope = { S, store, collections: { menu: { tier: 0, page: 0 } }, PAGE_SIZE: { menu: 15 }, TIERS: data.tiers,
    catalog: P.createCatalog(data), Round: P.Round,
    configureUI(mode) { S.mode = mode; }, setTitle() {}, displayName: (key, name) => name,
    setToolUI() {}, openBoard(rows) { opened = rows; S.R = rows.length; S.C = rows[0].length; },
    paletteOf: () => 0, saveJSON() {}, saveProgress() {}, LAST_KEY: 'picross.last', refreshClues() {}, updateGameActions() {},
    renderLives() {}, syncRoundClock() {}, tickRound() {},
  };
  const start = vm.runInNewContext('(' + readFunction('src/app.js', 'startPuzzle') + ')', scope);
  assert.doesNotThrow(() => start('L104', data.levels[104].name, data.levels[104].rows, 0));
  assert.equal(S.key, 'L104');
  assert.equal(S.mode, 'play');
  assert.equal(scope.collections.menu.page, 1);
  assert.equal(opened.length, 5);
  assert.equal(typeof S.round.elapsed, 'function');
});

test('教程重置通过教程控制器重新载入当前步骤', () => {
  let resets = 0;
  const reset = vm.runInNewContext('(' + readFunction('src/app.js', 'resetBoard') + ')', {
    S: { mode: 'tutorial', cells: [[1]], stepIndex: 7 },
    restartTutorialStep() { resets++; },
  });
  assert.doesNotThrow(() => reset());
  assert.equal(resets, 1);
});

test('解题重置立即清空当前盘面、计时与失误，保留历史成绩和其他关卡', () => {
  const S = { mode: 'play', key: 'L0', R: 2, C: 2, cells: [[1, 2], [3, 1]],
    paused: true, won: false, failed: false, mistakes: 2, wrong: { '0,0': true }, undo: [[1]], redo: [[2]],
    round: P.Round.create({ elapsedMs: 12345, mistakes: 2 }) };
  const store = { done: { L0: true }, results: { L0: { bestElapsedMs: 3000, bestStars: 3 } },
    progress: { L0: { cells: S.cells }, L1: { elapsedMs: 5000 } } };
  let rebuilt = false;
  const scope = vm.createContext({ S, store, Round: P.Round, winTimer: null,
    window: { confirm() { throw new Error('重置不应再确认'); } }, hasContent: () => true,
    clearProgress(key) { delete store.progress[key]; }, setToolUI() {},
    zeros: (r, c) => Array.from({ length: r }, () => Array(c).fill(0)), clearTimeout() {},
    showWin() {}, showFail() {}, buildBoard() { rebuilt = true; }, refreshClues() {},
    updateGameActions() {}, renderLives() {}, syncRoundClock() {}, saveJSON() {}, PROGRESS_KEY: 'picross.progress',
  });
  vm.runInContext(readFunction('src/app.js', 'saveProgress'), scope);
  vm.runInContext(readFunction('src/app.js', 'resetBoard'), scope);
  assert.doesNotThrow(() => scope.resetBoard());
  assert.equal(rebuilt, true);
  assert.deepEqual(S.cells, [[0, 0], [0, 0]]);
  assert.equal(S.round.elapsed(), 0);
  assert.equal(S.mistakes, 0);
  assert.equal(S.paused, false);
  assert.equal(store.progress.L1.elapsedMs, 5000);
  assert.equal(store.results.L0.bestStars, 3);
  assert.equal(store.results.L0.bestElapsedMs, 3000);
  assert.equal(store.done.L0, true);
});
