const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Storage = require('../src/storage.js');
const { readFunction } = require('./helpers/source.cjs');

function action(name, overrides = {}) {
  let resolve;
  const confirmation = new Promise((r) => { resolve = r; });
  const store = { custom: [{ id: 'remove', name: '测试谜题' }, { id: 'keep', name: '保留谜题' }],
    done: { Cremove: true, Ckeep: true }, results: { Cremove: { stars: 3 }, Ckeep: { stars: 2 } },
    progress: { Cremove: { elapsedMs: 1000 }, Ckeep: { elapsedMs: 2000 } }, last: 'Cremove' };
  const saves = [];
  const focuses = [];
  const scope = { store, Confirm: { ask: () => confirmation }, A: { sfx() {} },
    CUSTOM_KEY: 'picross.custom', DONE_KEY: 'picross.done', RESULTS_KEY: 'picross.results',
    Persistence: { clearGameData() { Storage.create(scope.localStorage).clearGameData(); } },
    saveJSON: (key, value) => saves.push([key, value]), clearProgress: (key) => { delete store.progress[key]; },
    renderMenu() {}, $: (id) => ({ focus() { focuses.push(id); }, querySelector: () => ({ focus() {} }) }), closeSettings() {}, showHome() {}, ...overrides };
  const file = name.startsWith('editor') ? 'src/features.js' : 'src/app.js';
  const fn = readFunction(file, name);
  return { run: vm.runInNewContext('(' + fn + ')', scope), store, saves, resolve, focuses };
}

test('删除自制谜题等待确认；取消不更改存档，确认只删除目标谜题', async () => {
  for (const confirmed of [false, true]) {
    const fixture = action('deleteCustom');
    const before = JSON.stringify(fixture.store);
    const pending = fixture.run(fixture.store.custom[0]);
    assert.equal(JSON.stringify(fixture.store), before);
    assert.equal(fixture.saves.length, 0);
    fixture.resolve(confirmed); await pending;
    if (!confirmed) assert.equal(JSON.stringify(fixture.store), before);
    else {
      assert.equal(fixture.store.custom.length, 1);
      assert.equal(fixture.store.custom[0].id, 'keep');
      assert.equal(fixture.store.done.Cremove, undefined);
      assert.equal(fixture.store.results.Cremove, undefined);
      assert.equal(fixture.store.progress.Cremove, undefined);
      assert.equal(fixture.store.done.Ckeep, true);
      assert.equal(fixture.store.results.Ckeep.stars, 2);
      assert.equal(fixture.store.progress.Ckeep.elapsedMs, 2000);
    }
  }
});

test('清除存档等待确认；取消不删除任何数据，确认保留音量和教程偏好', async () => {
  for (const confirmed of [false, true]) {
    const storage = { 'picross.custom': 'custom', 'picross.done': 'done', 'picross.results': 'results',
      'picross.progress': 'progress', 'picross.audio': 'audio', 'picross.tutorialSeen': 'seen', outside: 'keep' };
    Object.defineProperty(storage, 'removeItem', { value(key) { delete this[key]; } });
    const fixture = action('clearAllData', { localStorage: storage });
    const before = JSON.stringify(storage);
    const pending = fixture.run();
    assert.equal(JSON.stringify(storage), before);
    fixture.resolve(confirmed); await pending;
    if (!confirmed) assert.equal(JSON.stringify(storage), before);
    else {
      assert.equal(storage['picross.custom'], undefined);
      assert.equal(storage['picross.done'], undefined);
      assert.equal(storage['picross.results'], undefined);
      assert.equal(storage['picross.progress'], undefined);
      assert.equal(storage['picross.audio'], 'audio');
      assert.equal(storage['picross.tutorialSeen'], 'seen');
      assert.equal(storage.outside, 'keep');
      assert.equal(fixture.store.custom.length, 0);
      assert.equal(fixture.store.last, null);
      assert.equal(fixture.focuses.at(-1), 'btn-home-start');
    }
  }
});

test('编辑器清空图案使用同一确认流程，取消保留原图案', async () => {
  for (const confirmed of [false, true]) {
    let cleared = 0;
    const fixture = action('editorClear', { S: { R: 5, C: 5 }, hasContent: () => true,
      setEditorStatus() {}, zeros: () => 'empty-grid', openBoard(grid) { assert.equal(grid, 'empty-grid'); cleared++; }, editorChanged() {} });
    const pending = fixture.run();
    assert.equal(cleared, 0);
    fixture.resolve(confirmed); await pending;
    assert.equal(cleared, confirmed ? 1 : 0);
  }
});

test('有图案时切换编辑尺寸先确认，取消不切换尺寸', async () => {
  for (const confirmed of [false, true]) {
    let newSize = 5;
    const fixture = action('editorResize', { S: { R: 5 }, hasContent: () => true, startEditor(size) { newSize = size; } });
    const pending = fixture.run(10);
    assert.equal(newSize, 5);
    fixture.resolve(confirmed); await pending;
    assert.equal(newSize, confirmed ? 10 : 5);
  }
});
