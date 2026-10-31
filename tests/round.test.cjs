const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function round(saved) {
  const scope = {};
  const file = path.join(__dirname, '../src/core.js');
  if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope);
  assert.equal(typeof scope.Picross.Round?.create, 'function', '应提供真实的计时评分模块');
  let time = 1000;
  const game = scope.Picross.Round.create(saved, () => time);
  return { game, advance(ms) { time += ms; } };
}

test('完成时按0、1、2次失误分别授予3、2、1星', () => {
  for (const [mistakes, stars] of [[0, 3], [1, 2], [2, 1]]) {
    const { game, advance } = round();
    game.resume();
    advance(12345);
    for (let i = 0; i < mistakes; i++) game.mistake();
    const result = game.finish();
    assert.equal(result.stars, stars);
    assert.equal(result.mistakes, mistakes);
    assert.equal(result.elapsedMs, 12345);
  }
});

test('第三次失误立即失败，不能完成授星或继续增加失误', () => {
  const { game } = round();
  game.resume();
  game.mistake(); game.mistake();
  assert.equal(game.failure(), null);
  game.mistake();
  assert.equal(game.failure(), 'mistakes');
  assert.equal(game.finish(), null);
  game.mistake();
  assert.equal(game.snapshot().mistakes, 3);
});

test('30分钟之前可完成，达到30分钟则超时且不授星', () => {
  const before = round(); before.game.resume(); before.advance(1799999);
  assert.equal(before.game.finish().stars, 3);
  const boundary = round(); boundary.game.resume(); boundary.advance(1800000);
  assert.equal(boundary.game.failure(), 'timeout');
  assert.equal(boundary.game.finish(), null);
  boundary.advance(60000);
  assert.equal(boundary.game.elapsed(), 1800000);
});

test('暂停或停留后台不累计，继续后只加有效游玩时间', () => {
  const { game, advance } = round();
  game.resume(); advance(5000); game.pause();
  advance(3600000);
  assert.equal(game.elapsed(), 5000);
  game.resume(); game.resume(); advance(2000);
  assert.equal(game.elapsed(), 7000);
});

test('刷新后从保存的累计时间和失误恢复，未恢复时不计时', () => {
  const first = round(); first.game.resume(); first.advance(9000); first.game.mistake();
  const second = round(first.game.snapshot());
  second.advance(60000);
  assert.equal(second.game.elapsed(), 9000);
  assert.equal(second.game.snapshot().mistakes, 1);
  second.game.resume(); second.advance(3000);
  assert.equal(second.game.finish().elapsedMs, 12000);
  assert.equal(second.game.finish().stars, 2);
});

test('通关后的耗时和星级冻结，重新创建的局从零开始', () => {
  const { game, advance } = round(); game.resume(); advance(4000);
  const result = game.finish();
  advance(1800000); game.resume(); game.mistake();
  assert.equal(game.elapsed(), 4000);
  assert.equal(game.finish(), result);
  assert.equal(game.failure(), null);
  const next = round();
  assert.equal(next.game.elapsed(), 0);
  assert.equal(next.game.snapshot().mistakes, 0);
});

test('旧进度没有耗时也可继续，非法耗时不会造成NaN或倒计时', () => {
  for (const elapsedMs of [undefined, -10, 'bad', Infinity]) {
    const { game } = round({ elapsedMs, mistakes: 0 });
    assert.equal(game.elapsed(), 0);
    assert.equal(game.finish().stars, 3);
  }
});

test('较慢的重玩保留历史最短，新纪录才缩短最佳耗时', () => {
  const scope = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), scope);
  assert.equal(typeof scope.Picross.Round.recordResult, 'function', '应保存独立的历史最短耗时');
  const slower = scope.Picross.Round.recordResult({ elapsedMs: 4000, bestElapsedMs: 3000 }, { elapsedMs: 9000, mistakes: 1, stars: 2 });
  assert.equal(slower.elapsedMs, 9000);
  assert.equal(slower.bestElapsedMs, 3000);
  const faster = scope.Picross.Round.recordResult(slower, { elapsedMs: 2000, mistakes: 0, stars: 3 });
  assert.equal(faster.bestElapsedMs, 2000);
});

test('已有完成记录的耗时可作为初始最短，新关卡使用首次完成耗时', () => {
  const scope = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), scope);
  assert.equal(typeof scope.Picross.Round.recordResult, 'function', '应兼容已有耗时记录');
  assert.equal(scope.Picross.Round.recordResult({ elapsedMs: 3000 }, { elapsedMs: 5000, stars: 3, mistakes: 0 }).bestElapsedMs, 3000);
  assert.equal(scope.Picross.Round.recordResult(null, { elapsedMs: 5000, stars: 3, mistakes: 0 }).bestElapsedMs, 5000);
});

test('重玩较低星级不会丢失已获得的星级，较高星级会更新', () => {
  const scope = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8'), scope);
  const lower = scope.Picross.Round.recordResult({ elapsedMs: 5000, stars: 3 }, { elapsedMs: 3000, stars: 1, mistakes: 2 });
  assert.equal(lower.bestStars, 3);
  assert.equal(lower.bestElapsedMs, 3000);
  const higher = scope.Picross.Round.recordResult({ elapsedMs: 4000, bestStars: 1, stars: 1 }, { elapsedMs: 6000, stars: 2, mistakes: 1 });
  assert.equal(higher.bestStars, 2);
  assert.equal(higher.bestElapsedMs, 4000);
});
