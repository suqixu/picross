const test = require('node:test');
const assert = require('node:assert/strict');
const Editor = require('../src/features.js');

function fixture(mode) {
  const text = { textContent: '' };
  let hidden;
  const box = { className: '', querySelector: () => text,
    classList: { toggle(name, value) { if (name === 'hidden') hidden = value; } } };
  const editor = Editor.editor({ document: { getElementById: () => box }, state: { mode },
    storage: { keys: {} }, board: {}, actions: {} });
  return { update: editor.setEditorStatus, hidden: () => hidden, text };
}

test('编辑器状态放到顶栏后，异步分析不能在其他页面显示状态', () => {
  for (const mode of ['play', 'menu', 'home', 'gallery', 'tutorial']) {
    const f = fixture(mode);
    f.update('唯一解', 'ok');
    assert.equal(f.hidden(), true, mode + ' 不应显示编辑器状态');
  }
});

test('编辑页显示有效状态，空状态仍隐藏', () => {
  const f = fixture('editor');
  f.update('唯一解', 'ok');
  assert.equal(f.hidden(), false);
  assert.equal(f.text.textContent, '唯一解');
  f.update('', '');
  assert.equal(f.hidden(), true);
});
