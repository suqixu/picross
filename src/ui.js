/* 公共DOM绘图与确认弹窗。 */
(function (root) {
  'use strict';
  function createConfirm(document) {
    const $ = (id) => document.getElementById(id);
    const dialog = $('confirm-dialog');
    const cancel = $('confirm-cancel');
    const accept = $('confirm-accept');
    let pending = null;

    function close(confirmed) {
      if (!pending) return;
      const current = pending;
      pending = null;
      dialog.classList.add('hidden');
      current.background.forEach(({ element, inert, hide }) => {
        element.inert = inert;
        if (hide) element.classList.remove('hidden');
      });
      if (current.focus && current.focus.isConnected) current.focus.focus();
      current.resolve(confirmed);
    }

    function ask(options) {
      if (pending) return Promise.resolve(false);
      $('confirm-title').textContent = options.title;
      $('confirm-message').textContent = options.message;
      accept.textContent = options.confirmLabel || '确认';
      return new Promise((resolve) => {
        const background = Array.from(dialog.parentElement.children)
          .filter((element) => element !== dialog)
          .map((element) => ({ element, inert: element.inert, hide: element.classList.contains('viewer') && !element.classList.contains('hidden') }));
        pending = { resolve, background, focus: document.activeElement };
        background.forEach(({ element, hide }) => {
          element.inert = true;
          if (hide) element.classList.add('hidden');
        });
        dialog.classList.remove('hidden');
        cancel.focus();
      });
    }

    cancel.addEventListener('click', () => close(false));
    accept.addEventListener('click', () => close(true));
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(false); });
    document.addEventListener('keydown', (event) => {
      if (!pending) return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(false); }
      else if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = [cancel, accept];
        const index = buttons.indexOf(document.activeElement);
        const step = event.shiftKey ? -1 : 1;
        const next = index < 0 ? (event.shiftKey ? 1 : 0) : (index + step + buttons.length) % buttons.length;
        buttons[next].focus();
      }
    }, true);
    return { ask, close, isOpen: () => !!pending };
  }

  function createArt({ document, core: P, palettes: PALETTES }) {

    function hex2rgb(h) {
      const n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function mixColor(a, b, t) {
      const x = hex2rgb(a);
      const y = hex2rgb(b);
      const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
      return 'rgb(' + c.join(',') + ')';
    }

    function icon(name) {
      return '<svg><use href="#i-' + name + '"/></svg>';
    }

    function makeDiv(cls) {
      const d = document.createElement('div');
      d.className = cls;
      return d;
    }

    function makeThumb(rows, reveal) {
      const grid = Array.isArray(rows[0]) ? rows : P.parseRows(rows);
      const t = makeDiv('thumb' + (reveal ? '' : ' hidden-art'));
      t.style.gridTemplateColumns = 'repeat(' + grid[0].length + ', 1fr)';
      t.style.gridTemplateRows = 'repeat(' + grid.length + ', 1fr)';
      grid.forEach((row) => row.forEach((v) => {
        t.appendChild(document.createElement('i')).className = v === 1 ? 'on' : '';
      }));
      return t;
    }

    function makeArt(rows, paletteIdx, locked) {
      const grid = Array.isArray(rows[0]) ? rows : P.parseRows(rows);
      const R = grid.length;
      const C = grid[0].length;
      const pal = PALETTES[paletteIdx] || PALETTES[0];
      const art = makeDiv('art-thumb' + (locked ? ' locked' : ''));
      art.style.gridTemplateColumns = 'repeat(' + C + ', 1fr)';
      art.style.gridTemplateRows = 'repeat(' + R + ', 1fr)';
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const i = document.createElement('i');
          if (grid[r][c] === 1) {
            i.className = 'on';
            if (!locked) {
              const tr = R > 1 ? r / (R - 1) : 0;
              const tc = C > 1 ? c / (C - 1) : 0;
              i.style.background = mixColor(pal[0], pal[1], tr * 0.65 + tc * 0.35);
            }
          }
          art.appendChild(i);
        }
      }
      return art;
    }
    return { icon, makeDiv, makeThumb, makeArt, mixColor };
  }

  const api = { createConfirm, createArt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PicrossUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
