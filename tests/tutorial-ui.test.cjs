const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Features = require('../src/features.js');
const P = require('../src/core.js');
const context = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../data/tutorial/steps.js'), 'utf8'), context);
function fixture() {
  const nodes = Object.fromEntries(['tut-dots', 'tut-prev', 'tut-next', 'tut-title', 'tut-text'].map((id) => [id, {}]));
  const state = {};
  let cells;
  const tutorial = Features.tutorial({ document: { getElementById: (id) => nodes[id] }, audio: { sfx() {} },
    state, steps: context.PicrossTutorial.steps, ui: { icon: (name) => '<svg data-icon="' + name + '"></svg>' },
    board: { openBoard(rows, preset = []) {
      state.cells = P.parseRows(rows).map((row) => row.map(() => 0));
      for (const [r, c, value] of preset) state.cells[r][c] = value;
      cells = state.cells.map((row) => row.map(() => ({ classList: { toggle() {} } })));
    }, setToolUI() {}, refreshClues() {}, elements: () => ({ cells }) },
    actions: { configureUI(mode) { state.mode = mode; }, setTitle() {}, showMenu() {} },
  });
  return { tutorial, nodes, state };
}

test('真实教程控制器可初始化、前进并绘制翻页图标', () => {
  const f = fixture();
  assert.doesNotThrow(() => f.tutorial.startTutorial());
  assert.equal(f.nodes['tut-title'].textContent, '欢迎');
  assert.equal(f.nodes['tut-prev'].disabled, true);
  assert.ok(f.nodes['tut-next'].innerHTML.includes('right'));
  f.tutorial.tutorialMove(1);
  assert.equal(f.nodes['tut-title'].textContent, '数字的含义');
});

test('练习完成后允许下一步，重置保留当前教程步骤并清空盘面', () => {
  const f = fixture();
  f.tutorial.startTutorial();
  f.tutorial.tutorialMove(1);
  f.tutorial.tutorialMove(1);
  assert.equal(f.nodes['tut-next'].disabled, true);
  f.state.cells[2].fill(1);
  f.tutorial.checkTutorialGoal();
  assert.equal(f.nodes['tut-next'].disabled, false);
  f.tutorial.restartTutorialStep();
  assert.equal(f.state.stepIndex, 2);
  assert.equal(f.state.cells[2].every((v) => v === 0), true);
  assert.equal(f.nodes['tut-next'].disabled, true);
});
