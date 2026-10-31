const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
  const scope = {};
  const file = path.join(__dirname, '../src/ui.js');
  if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope);
  assert.equal(typeof scope.PicrossUI?.createConfirm, 'function', '需要可复用的确认弹窗控制器');
  const nodes = {};
  const keyboard = [];
  const doc = { activeElement: null, getElementById(id) { return nodes[id]; }, addEventListener(type, fn) { if (type === 'keydown') keyboard.push(fn); } };
  function element(id, hidden = false) {
    const classes = new Set(hidden ? ['hidden'] : []);
    const listeners = {};
    return nodes[id] = { id, inert: false, disabled: false, isConnected: true, textContent: '',
      classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); } },
      addEventListener(type, fn) { listeners[type] = fn; },
      click(target) { listeners.click?.({ target: target || this }); },
      focus() { doc.activeElement = this; },
    };
  }
  for (const id of ['main', 'settings', 'trigger', 'confirm-title', 'confirm-message', 'confirm-cancel', 'confirm-accept']) element(id);
  const dialog = element('confirm-dialog', true);
  dialog.parentElement = { children: [nodes.main, nodes.settings, dialog] };
  nodes.settings.inert = true;
  nodes.settings.classList.add('viewer');
  doc.activeElement = nodes.trigger;
  const modal = scope.PicrossUI.createConfirm(doc);
  function key(key, shiftKey = false) {
    const event = { key, shiftKey, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
    keyboard.forEach((fn) => fn(event));
    return event;
  }
  return { modal, nodes, doc, key };
}

test('确认前不执行操作，点击确认只提交一次并恢复背景和焦点', async () => {
  const { modal, nodes, doc } = setup();
  let deleted = 0;
  const pending = modal.ask({ title: '删除谜题', message: '确认删除“测试谜题”？', confirmLabel: '删除' }).then((ok) => { if (ok) deleted++; return ok; });
  assert.equal(deleted, 0);
  assert.equal(nodes['confirm-message'].textContent, '确认删除“测试谜题”？');
  assert.equal(nodes['confirm-accept'].textContent, '删除');
  assert.equal(nodes.main.inert, true);
  assert.equal(nodes.settings.classList.contains('hidden'), true);
  assert.equal(doc.activeElement, nodes['confirm-cancel']);
  nodes['confirm-accept'].click(); nodes['confirm-accept'].click();
  assert.equal(await pending, true);
  assert.equal(deleted, 1);
  assert.equal(nodes.main.inert, false);
  assert.equal(nodes.settings.inert, true);
  assert.equal(nodes.settings.classList.contains('hidden'), false);
  assert.equal(doc.activeElement, nodes.trigger);
  assert.equal(modal.isOpen(), false);
});

test('取消、Escape和点击遮罩都取消，不触发删除', async () => {
  for (const method of ['cancel', 'escape', 'backdrop']) {
    const { modal, nodes, key } = setup();
    const pending = modal.ask({ title: '清除存档', message: '将删除全部存档', confirmLabel: '清除' });
    if (method === 'cancel') nodes['confirm-cancel'].click();
    if (method === 'escape') assert.equal(key('Escape').prevented, true);
    if (method === 'backdrop') nodes['confirm-dialog'].click();
    assert.equal(await pending, false);
    assert.equal(nodes['confirm-dialog'].classList.contains('hidden'), true);
    assert.equal(nodes.main.inert, false);
  }
});

test('Tab和Shift+Tab将焦点保持在确认弹窗内', async () => {
  const { modal, nodes, doc, key } = setup();
  const pending = modal.ask({ title: '删除谜题', message: '测试', confirmLabel: '删除' });
  assert.equal(key('Tab').prevented, true);
  assert.equal(doc.activeElement, nodes['confirm-accept']);
  key('Tab'); assert.equal(doc.activeElement, nodes['confirm-cancel']);
  key('Tab', true); assert.equal(doc.activeElement, nodes['confirm-accept']);
  nodes['confirm-cancel'].click(); await pending;
});

test('重复请求不会覆盖用户当前正在确认的删除对象', async () => {
  const { modal, nodes } = setup();
  const first = modal.ask({ title: '删除谜题', message: '谜题A', confirmLabel: '删除' });
  assert.equal(await modal.ask({ title: '清除存档', message: '全部存档', confirmLabel: '清除' }), false);
  assert.equal(nodes['confirm-message'].textContent, '谜题A');
  nodes['confirm-cancel'].click(); assert.equal(await first, false);
});
