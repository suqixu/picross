/* 页面功能控制器：选关与画廊、编辑器、教程。通过显式服务和回调组合。 */
(function (root) {
  'use strict';
  function createCollections({ document, audio: A, catalog, store, collections, pageSize: PAGE_SIZE, ui, formatTime, actions }) {
    const $ = (id) => document.getElementById(id);
    const TIERS = catalog.tiers;
    const { icon, makeDiv, makeThumb, makeArt } = ui;
    const levelNumber = catalog.number;
    const paletteOf = catalog.palette;
    const { startPuzzle, deleteCustom, startEditor, openViewer } = actions;
    function makeCard(key, name, rows, onOpen, onDelete, showRecord = true) {
      const done = !!store.done[key];
      const secret = key[0] === 'L' && !done;
      const card = makeDiv('card' + (done ? ' completed' : store.progress[key] ? ' in-progress' : ''));
      const button = document.createElement('button');
      button.className = 'card-open';
      button.setAttribute('aria-label', (key[0] === 'L' ? '第 ' + levelNumber(key) + ' 关' : name) + (done ? '，已完成' : store.progress[key] ? '，进行中' : '，未完成'));
      const number = makeDiv('card-number');
      number.textContent = key[0] === 'L' ? String(levelNumber(key)).padStart(2, '0') : '✦';
      const heading = makeDiv('card-heading');
      heading.appendChild(number);
      if (!secret) {
        const title = makeDiv('name');
        title.textContent = name;
        heading.appendChild(title);
      }
      button.appendChild(heading);
      const artwork = makeDiv('card-art');
      if (secret) {
        const question = makeDiv('card-question');
        question.textContent = '?';
        question.setAttribute('aria-hidden', 'true');
        artwork.appendChild(question);
      } else {
        const preview = done ? makeArt(rows, paletteOf(key), false) : makeThumb(rows, true);
        artwork.appendChild(preview);
      }
      button.appendChild(artwork);
      const record = store.results[key];
      const elapsed = record && (record.bestElapsedMs ?? record.elapsedMs);
      const stars = record && (record.bestStars ?? record.stars);
      if (showRecord && done && stars === 3) card.classList.add('three-stars');
      if (showRecord && done && Number.isFinite(elapsed) && Number.isInteger(stars) && stars >= 1 && stars <= 3) {
        const footer = makeDiv('card-record');
        const rating = makeDiv('card-record-stars');
        rating.innerHTML = Array.from({ length: stars }, () => icon('star')).join('');
        const time = document.createElement('time');
        time.textContent = formatTime(elapsed);
        time.dateTime = 'PT' + Math.floor(elapsed / 1000) + 'S';
        footer.append(rating, time);
        footer.setAttribute('aria-hidden', 'true');
        button.classList.add('has-record');
        button.setAttribute('aria-label', button.getAttribute('aria-label') + '，' + stars + ' 星，最短用时 ' + formatTime(elapsed));
        button.appendChild(footer);
      }
      button.addEventListener('click', () => { A.sfx('ui'); onOpen(); });
      card.appendChild(button);
      if (onDelete) {
        const del = document.createElement('button');
        del.className = 'del';
        del.setAttribute('aria-label', '删除' + name);
        del.innerHTML = icon('trash');
        del.addEventListener('click', onDelete);
        card.appendChild(del);
      }
      return card;
    }

    function collectionItems(kind) {
      return catalog.group(collections[kind].tier, store.custom);
    }

    function renderTabs(kind) {
      const box = $(kind + '-tabs');
      box.innerHTML = '';
      const state = collections[kind];
      const tiers = kind === 'menu' ? TIERS.concat({ name: '自制', size: null }) : TIERS;
      tiers.forEach((tier, i) => {
        const button = document.createElement('button');
        button.className = 'size-tab' + (state.tier === i ? ' active' : '');
        button.setAttribute('role', 'tab');
        button.title = tier.name + (tier.size ? ' · ' + tier.size + '×' + tier.size : '谜题');
        button.setAttribute('aria-label', tier.name + (tier.size ? '，' + tier.size + '乘' + tier.size : '谜题'));
        button.setAttribute('aria-selected', String(state.tier === i));
        button.tabIndex = state.tier === i ? 0 : -1;
        button.innerHTML = tier.size ? tier.name : icon('feather');
        const select = () => {
          state.tier = i;
          state.page = 0;
          $('import-row').classList.add('hidden');
          $('import-msg').textContent = '';
          A.sfx('ui');
          renderCollection(kind);
          $(kind + '-tabs').children[i].focus();
        };
        button.addEventListener('click', select);
        button.addEventListener('keydown', (e) => {
          let index = i;
          if (e.key === 'ArrowRight') index = (i + 1) % tiers.length;
          else if (e.key === 'ArrowLeft') index = (i + tiers.length - 1) % tiers.length;
          else if (e.key === 'Home') index = 0;
          else if (e.key === 'End') index = tiers.length - 1;
          else return;
          e.preventDefault();
          state.tier = index;
          state.page = 0;
          renderCollection(kind);
          $(kind + '-tabs').children[index].focus();
        });
        box.appendChild(button);
      });
    }

    function renderPagination(kind, total) {
      const state = collections[kind];
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE[kind]));
      state.page = Math.max(0, Math.min(state.page, pages - 1));
      $(kind + '-prev').disabled = state.page === 0;
      $(kind + '-next').disabled = state.page === pages - 1;
      $(kind + '-page').textContent = (state.page + 1) + ' / ' + pages;
      const dotStart = Math.max(0, Math.min(state.page - 2, pages - 5));
      $(kind + '-dots').innerHTML = Array.from({ length: Math.min(pages, 5) }, (_, i) => '<i class="' + (i + dotStart === state.page ? 'active' : '') + '"></i>').join('');
    }

    function fillPageSlots(box, count, kind) {
      for (let i = count; i < PAGE_SIZE[kind]; i++) {
        const placeholder = makeDiv('card-placeholder');
        placeholder.setAttribute('aria-hidden', 'true');
        box.appendChild(placeholder);
      }
    }

    function moveCollection(kind, delta) {
      const state = collections[kind];
      const pages = Math.max(1, Math.ceil(collectionItems(kind).length / PAGE_SIZE[kind]));
      const next = Math.max(0, Math.min(state.page + delta, pages - 1));
      if (next === state.page) return;
      state.page = next;
      A.sfx('ui');
      renderCollection(kind);
    }

    function renderCollection(kind) {
      if (kind === 'menu') renderMenu();
      else renderGallery();
    }

    function renderMenu() {
      const state = collections.menu;
      const custom = state.tier === TIERS.length;
      const group = collectionItems('menu');
      const stats = catalog.stats(group, store);
      $('menu-stars-count').textContent = stats.stars;
      $('menu-stars').setAttribute('aria-label', '已获得 ' + stats.stars + ' 颗星星');
      renderTabs('menu');
      renderPagination('menu', group.length);
      $('custom-actions').classList.toggle('hidden', !custom);
      $('view-menu').querySelector('.collection-panel').classList.toggle('custom', custom);
      if (!custom) $('import-row').classList.add('hidden');
      $('level-list').classList.toggle('hidden', custom);
      $('custom-list').classList.toggle('hidden', !custom);
      const list = $(custom ? 'custom-list' : 'level-list');
      list.innerHTML = '';
      if (!group.length) {
        const tip = document.createElement('button');
        tip.className = 'empty-tip';
        tip.innerHTML = icon('plus') + '<span>创作你的第一个谜题</span>';
        tip.addEventListener('click', () => { A.sfx('ui'); startEditor(5); });
        list.appendChild(tip);
        return;
      }
      const page = group.slice(state.page * PAGE_SIZE.menu, (state.page + 1) * PAGE_SIZE.menu);
      page.forEach((pz) => list.appendChild(makeCard(pz.key, pz.name, pz.rows,
        () => startPuzzle(pz.key, pz.name, pz.rows, custom ? null : state.tier),
        custom ? () => deleteCustom(pz.custom) : null)));
      fillPageSlots(list, page.length, 'menu');
    }

    function renderGallery() {
      const box = $('gallery-list');
      box.innerHTML = '';
      const state = collections.gallery;
      const group = collectionItems('gallery');
      renderTabs('gallery');
      renderPagination('gallery', group.length);
      const stats = catalog.stats(group, store);
      $('gallery-count').textContent = stats.completed + ' / ' + stats.total;
      const page = group.slice(state.page * PAGE_SIZE.gallery, (state.page + 1) * PAGE_SIZE.gallery);
      page.forEach((lv) => {
        const unlocked = !!store.done[lv.key];
        const card = makeCard(lv.key, lv.name, lv.rows, () => openViewer(lv), null, false);
        const button = card.querySelector('.card-open');
        button.disabled = !unlocked;
        button.setAttribute('aria-label', '第 ' + levelNumber(lv.key) + ' 件作品，' + (unlocked ? lv.name : '未解锁'));
        card.classList.remove('in-progress');
        card.classList.toggle('locked', !unlocked);
        if (!unlocked) card.querySelector('.card-art').innerHTML = '<span class="gallery-lock" aria-hidden="true">' + icon('lock') + '</span>';
        box.appendChild(card);
      });
      fillPageSlots(box, page.length, 'gallery');
    }
    return { renderMenu, renderGallery, moveCollection };
  }

  function createEditor({ document, core: P, audio: A, confirm: Confirm, state: S, store, storage, board, actions }) {
    const $ = (id) => document.getElementById(id);
    const { saveJSON } = storage;
    const CUSTOM_KEY = storage.keys.custom;
    const { zeros, openBoard, fillClue } = board;
    const { configureUI, startPuzzle, setTitle, hasContent } = actions;
    let analyzeTimer = null;

    function currentGrid() {
      return S.cells.map((row) => row.map((v) => (v === 1 ? 1 : 0)));
    }

    const EDITOR_MSG = {
      empty: ['', ''],
      logic: ['唯一解', 'ok'],
      guess: ['需试探', 'warn'],
      multiple: ['多解', 'bad'],
      unknown: ['未确认', 'warn'],
    };

    function setEditorStatus(text, cls) {
      const box = $('editor-status');
      box.className = 'estatus ' + (cls || '');
      box.querySelector('span').textContent = text;
      box.classList.toggle('hidden', !text || S.mode !== 'editor');
    }

    function editorChanged() {
      const grid = currentGrid();
      S.clues = P.gridClues(grid);
      const els = board.elements();
      S.clues.rows.forEach((cl, i) => fillClue(els.rows[i], cl));
      S.clues.cols.forEach((cl, i) => fillClue(els.cols[i], cl));
      clearTimeout(analyzeTimer);
      analyzeTimer = setTimeout(() => {
        const info = EDITOR_MSG[P.analyze(grid).status];
        setEditorStatus(info[0], info[1]);
      }, 150);
    }

    function syncSizeButtons(size) {
      document.querySelectorAll('#editor-size button').forEach((b) => {
        b.classList.toggle('on', +b.dataset.size === size);
      });
    }

    function startEditor(size) {
      configureUI('editor');
      S.key = null;
      setTitle('创作谜题');
      syncSizeButtons(size);
      setEditorStatus('', '');
      openBoard(zeros(size, size));
      editorChanged();
    }

    function editorSave() {
      if (!currentGrid().some((r) => r.some((v) => v === 1))) {
        A.sfx('error');
        return;
      }
      const name = P.puzzleName($('editor-name').value);
      const rows = P.stringifyRows(currentGrid());
      const id = Date.now().toString(36);
      store.custom.push({ id, name, rows });
      saveJSON(CUSTOM_KEY, store.custom);
      A.sfx('save');
      startPuzzle('C' + id, name, rows, null);
    }

    function editorShare() {
      const name = P.puzzleName($('editor-name').value);
      const grid = currentGrid();
      if (!grid.some((r) => r.some((v) => v === 1))) {
        A.sfx('error');
        return;
      }
      const code = P.encodePuzzle(name, grid);
      const done = () => { setEditorStatus('已复制', 'ok'); A.sfx('save'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, () => window.prompt('复制分享码：', code));
      } else {
        window.prompt('复制分享码：', code);
      }
    }

    async function editorClear() {
      if (hasContent() && !await Confirm.ask({ title: '清空图案', message: '确认清空当前图案？', confirmLabel: '清空' })) return;
      setEditorStatus('', '');
      openBoard(zeros(S.R, S.C));
      editorChanged();
    }

    async function editorResize(size) {
      if (size === S.R) return;
      if (hasContent() && !await Confirm.ask({ title: '切换尺寸', message: '切换尺寸会清空当前图案，是否继续？', confirmLabel: '继续' })) return;
      A.sfx('ui');
      startEditor(size);
    }
    return { startEditor, editorChanged, editorSave, editorShare, editorClear, editorResize, setEditorStatus };
  }

  function createTutorial({ document, audio: A, state: S, steps: TUT, board, actions, ui }) {
    const { icon } = ui;
    const $ = (id) => document.getElementById(id);
    const { openBoard, setToolUI, refreshClues } = board;
    const { configureUI, setTitle, showMenu } = actions;
    function goalMet(goal) {
      if (!goal) return true;
      if (goal.solved) return S.won;
      if (goal.cells) return goal.cells.every((g) => S.cells[g[0]][g[1]] === g[2]);
      if (goal.any) return S.cells.some((row) => row.some((v) => v === goal.any));
      return true;
    }

    function updateTutorialUI() {
      const step = TUT[S.stepIndex];
      const goal = step.goal;
      S.stepDone = goalMet(goal);
      $('tut-dots').innerHTML = TUT.map((_, i) => {
        return '<i class="' + (i === S.stepIndex ? 'on' : i < S.stepIndex ? 'past' : '') + '"></i>';
      }).join('');
      $('tut-prev').disabled = S.stepIndex === 0;
      $('tut-next').disabled = !S.stepDone;
      const last = S.stepIndex === TUT.length - 1;
      $('tut-next').innerHTML = icon(last ? 'check' : 'right');
      const els = board.elements();
      const targets = goal && goal.cells ? goal.cells : [];
      const hint = step.hint || [];
      hint.forEach((h) => {
        const t = targets.find((g) => g[0] === h[0] && g[1] === h[1]);
        const met = t && S.cells[h[0]][h[1]] === t[2];
        els.cells[h[0]][h[1]].classList.toggle('hint', !met);
      });
    }

    function checkTutorialGoal() {
      const was = S.stepDone;
      updateTutorialUI();
      if (S.stepDone && !was && TUT[S.stepIndex].goal) A.sfx('lineDone');
    }

    function loadTutorialStep(i) {
      S.stepIndex = i;
      const step = TUT[i];
      $('tut-title').textContent = step.title;
      $('tut-text').textContent = step.text;
      setTitle('游戏教程');
      openBoard(step.rows, step.preset);
      setToolUI(step.tool || 'fill');
      refreshClues(true);
      updateTutorialUI();
    }

    function startTutorial() {
      configureUI('tutorial');
      S.key = null;
      loadTutorialStep(0);
    }

    function tutorialMove(delta) {
      const next = S.stepIndex + delta;
      if (delta > 0 && !S.stepDone) return;
      A.sfx('ui');
      if (next >= TUT.length) {
        showMenu();
        return;
      }
      if (next >= 0) loadTutorialStep(next);
    }
    return { startTutorial, checkTutorialGoal, tutorialMove, restartTutorialStep: () => loadTutorialStep(S.stepIndex) };
  }

  const api = { collections: createCollections, editor: createEditor, tutorial: createTutorial };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PicrossFeatures = api;
})(typeof window !== 'undefined' ? window : globalThis);
