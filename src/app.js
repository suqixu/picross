/* 应用入口：页面编排、棋盘交互与单局生命周期。其他功能通过控制器组合。 */
(function () {
  'use strict';

  const P = window.Picross;
  const A = window.PicrossAudio;
  const Round = P.Round;
  const Confirm = window.PicrossUI.createConfirm(document);
  const LEVELS = window.PicrossLevels;
  const TIERS = window.PicrossTiers;
  const PALETTES = window.PicrossPalettes;
  const TUT = window.PicrossTutorial.steps;
  const $ = (id) => document.getElementById(id);

  const Persistence = window.PicrossStorage.create();
  const { custom: CUSTOM_KEY, done: DONE_KEY, progress: PROGRESS_KEY,
    last: LAST_KEY, results: RESULTS_KEY } = Persistence.keys;
  const { saveJSON } = Persistence;
  const store = Persistence.state;
  const catalog = P.createCatalog({ levels: LEVELS, tiers: TIERS, palettes: PALETTES });
  const ui = window.PicrossUI.createArt({ document, core: P, palettes: PALETTES });
  const { icon, makeDiv, makeArt, mixColor } = ui;
  const { formatTime } = P;
  const TOOL_STATE = { fill: 1, cross: 2, mark: 3 };
  const PAGE_TITLES = { home: 'Picross', menu: '谜题', gallery: '画廊' };
  const PAGE_SIZE = { menu: 15, gallery: 15 };
  const collections = { menu: { tier: 0, page: 0 }, gallery: { tier: 0, page: 0 } };
  const allPuzzles = () => catalog.list(store.custom);
  const levelNumber = catalog.number;
  const paletteOf = catalog.palette;

  function isPlayMode() {
    return S.mode === 'play' || S.mode === 'editor' || S.mode === 'tutorial';
  }

  /* ---------- 继续游戏：保存 / 读取盘面 ---------- */
  function saveProgress() {
    if (S.mode !== 'play' || !S.key) return;
    if (!S.round) return;
    if (S.won || S.failed) delete store.progress[S.key];
    else store.progress[S.key] = { cells: S.cells, wrong: S.wrong, ...S.round.snapshot() };
    saveJSON(PROGRESS_KEY, store.progress);
  }

  function clearProgress(key) {
    if (!store.progress[key]) return;
    delete store.progress[key];
    saveJSON(PROGRESS_KEY, store.progress);
  }

  /* 单元格状态：0 空，1 涂色，2 打叉，3 标记 */
  const S = {
    mode: 'menu', // menu | play | editor | tutorial
    key: null,
    clues: null,
    R: 0,
    C: 0,
    cells: null,
    solution: null, // 正确图案，用于判定失误
    tool: 'fill',
    undo: [],
    redo: [],
    won: false,
    failed: false,
    mistakes: 0,
    maxMistakes: Infinity,
    round: null,
    paused: false,
    wrong: {}, // 已判失误的格子
    palette: 0,
    name: '',
    tier: -1, // 难度序号，-1 表示自制谜题
    stepIndex: 0,
    stepDone: false,
    lineState: null,
  };

  let els = { cells: [], rows: [], cols: [] };
  let winTimer = null;
  let mistakeJustNow = false;
  let lastClockSave = 0;

  function renderRound() {
    if (S.mode !== 'play' || !S.round) return;
    const elapsed = S.round.elapsed();
    $('round-time').textContent = formatTime(elapsed);
    $('round-time').dateTime = 'PT' + Math.floor(elapsed / 1000) + 'S';
  }

  function syncRoundClock() {
    if (S.mode !== 'play' || !S.round || S.won || S.failed) return;
    if (document.hidden || S.paused) S.round.pause();
    else S.round.resume();
    renderRound();
  }

  function tickRound() {
    if (S.mode !== 'play' || !S.round || S.won || S.failed) return;
    const failure = S.round.failure();
    if (failure) { gameOver(failure); return; }
    renderRound();
    if (Date.now() - lastClockSave >= 5000) {
      lastClockSave = Date.now();
      saveProgress();
    }
  }

  function zeros(R, C) {
    return Array.from({ length: R }, () => new Array(C).fill(0));
  }

  function hasContent() {
    return !!S.cells && S.cells.some((row) => row.some((v) => v !== 0));
  }

  function setTitle(text) {
    $('top-title').textContent = text;
  }

  function showWin(on) {
    $('win').classList.toggle('hidden', !on);
    resizeBoard();
    if (!on) return;
    const all = allPuzzles();
    const idx = all.findIndex((p) => p.key === S.key);
    $('btn-win-next').classList.toggle('hidden', idx < 0 || idx >= all.length - 1);
  }

  /* ---------- 失误次数 ---------- */
  function renderLives() {
    const box = $('lives');
    const limited = S.mode === 'play' && isFinite(S.maxMistakes);
    box.classList.toggle('hidden', !limited);
    if (!limited) return;
    const left = Math.max(0, S.maxMistakes - S.mistakes);
    const label = '剩余 ' + left + ' 次失误机会';
    if (box.getAttribute('aria-label') === label) return;
    box.innerHTML = '';
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', label);
    for (let i = 0; i < left; i++) {
      const heart = makeDiv('life');
      heart.textContent = '💗';
      heart.setAttribute('aria-hidden', 'true');
      box.appendChild(heart);
    }
  }

  function registerMistake(r, c) {
    S.round.mistake();
    S.mistakes = S.round.snapshot().mistakes;
    S.wrong[r + ',' + c] = true;
    els.cells[r][c].classList.add('wrong');
    mistakeJustNow = true;
    A.sfx('error');
    const board = $('board');
    board.classList.remove('shake');
    void board.offsetWidth; // 强制重排，让抖动动画可以重复播放
    board.classList.add('shake');
    renderLives();
    renderRound();
    if (S.mistakes >= S.maxMistakes) gameOver('mistakes');
  }

  function isWrongFill(r, c) {
    return S.mode === 'play' && !S.won && !S.failed && !!S.solution && S.solution[r][c] !== 1;
  }

  function gameOver(reason) {
    if (S.won || S.failed) return;
    if (S.round) S.round.pause();
    S.failed = true;
    updateGameActions();
    $('fail-text').textContent = reason === 'timeout' ? '已达到 30 分钟' : '已失误 3 次';
    if (reason === 'timeout') A.sfx('error');
    renderRound();
    saveProgress();
    showFail(true);
  }

  function showFail(on) {
    $('fail').classList.toggle('hidden', !on);
    resizeBoard();
    if (on) $('btn-reset').focus();
  }

  /* ---------- 通关动画：先波浪点亮，再去掉格子变成彩色画 ---------- */
  function paintArtColors() {
    const pal = PALETTES[S.palette] || PALETTES[0];
    for (let r = 0; r < S.R; r++) {
      for (let c = 0; c < S.C; c++) {
        if (S.cells[r][c] !== 1) continue;
        const tr = S.R > 1 ? r / (S.R - 1) : 0;
        const tc = S.C > 1 ? c / (S.C - 1) : 0;
        const el = els.cells[r][c];
        el.style.setProperty('--c', mixColor(pal[0], pal[1], tr * 0.65 + tc * 0.35));
        el.style.setProperty('--d', (r + c) * 38 + 'ms');
      }
    }
  }

  function celebrate(withPanel) {
    const board = $('board');
    const cells = S.cells;
    S.wrong = {};
    for (let r = 0; r < S.R; r++) for (let c = 0; c < S.C; c++) els.cells[r][c].classList.remove('wrong');
    paintArtColors();
    board.classList.add('won');
    requestAnimationFrame(() => {
      if (S.cells !== cells || !S.won) return;
      board.classList.add('reveal');
    });
    clearTimeout(winTimer);
    winTimer = setTimeout(() => {
      if (S.cells !== cells || !S.won) return;
      // 保留线索占位，只隐藏外观，彩色格子保持原坐标。
      board.classList.add('art');
      if (withPanel) showWin(true);
    }, 420 + (S.R + S.C) * 38 + 520);
  }

  /* ---------- 棋盘渲染 ---------- */
  function resultSpaceFor() {
    // 从开局起预留相同的结果区高度，显示结果时不挤动棋盘。
    return S.mode === 'play' ? $('board-results').offsetHeight + 12 : 0;
  }

  /* 根据屏幕宽高和线索长度，算出能完整放下棋盘的格子大小 */
  function cellSizeFor() {
    const stage = document.querySelector('.board-stage');
    const editor = S.mode === 'editor';
    const maxLen = (list) => list.reduce((m, cl) => Math.max(m, cl.length), 1);
    const rowUnits = editor ? Math.ceil(S.C / 2) * 0.47 + 0.4
      : Math.max(...S.clues.rows.map((cl) => cl.reduce((n, v) => n + String(v).length * 0.27 + 0.14, 0))) + 0.4;
    const colUnits = (editor ? Math.ceil(S.R / 2) : maxLen(S.clues.cols)) * 0.46 + 0.3;
    const availW = stage.clientWidth - 24;
    const resultSpace = resultSpaceFor();
    const availH = stage.clientHeight - 30 - resultSpace;
    return Math.max(5, Math.min(44, Math.floor(Math.min(availW / (S.C + rowUnits), availH / (S.R + colUnits)))));
  }

  function resizeBoard() {
    if (!isPlayMode() || !S.cells) return;
    const board = $('board');
    let size = cellSizeFor();
    board.style.setProperty('--cell', size + 'px');
    // 使用实际线索宽高再校验一次，长数字和小屏幕也不裁切。
    const stage = document.querySelector('.board-stage');
    const resultSpace = resultSpaceFor();
    while (size > 5 && (board.offsetWidth > stage.clientWidth - 20 || board.offsetHeight + resultSpace > stage.clientHeight - 26)) {
      board.style.setProperty('--cell', --size + 'px');
    }
  }

  function fillClue(el, clue) {
    el.innerHTML = '';
    clue.forEach((n) => {
      const s = document.createElement('span');
      s.textContent = n;
      el.appendChild(s);
    });
  }

  function buildBoard() {
    const board = $('board');
    board.innerHTML = '';
    board.className = 'board';
    board.style.setProperty('--cell', cellSizeFor() + 'px');
    board.style.gridTemplateColumns = 'auto repeat(' + S.C + ', var(--cell))';
    board.style.gridTemplateRows = '';
    els = { cells: [], rows: [], cols: [] };

    const frag = document.createDocumentFragment();
    frag.appendChild(makeDiv('corner'));
    for (let c = 0; c < S.C; c++) {
      const el = makeDiv('clue ccol');
      fillClue(el, S.clues.cols[c]);
      els.cols.push(el);
      frag.appendChild(el);
    }
    for (let r = 0; r < S.R; r++) {
      const rowEl = makeDiv('clue crow');
      fillClue(rowEl, S.clues.rows[r]);
      els.rows.push(rowEl);
      frag.appendChild(rowEl);
      els.cells.push([]);
      for (let c = 0; c < S.C; c++) {
        let cls = 'cell';
        if ((c + 1) % 5 === 0 && c < S.C - 1) cls += ' gr';
        if ((r + 1) % 5 === 0 && r < S.R - 1) cls += ' gb';
        const el = makeDiv(cls);
        el.dataset.r = r;
        el.dataset.c = c;
        els.cells[r].push(el);
        frag.appendChild(el);
      }
    }
    board.appendChild(frag);
    for (let r = 0; r < S.R; r++) for (let c = 0; c < S.C; c++) paintCell(r, c);
    resizeBoard();
  }

  function paintCell(r, c) {
    const v = S.cells[r][c];
    const el = els.cells[r][c];
    el.classList.toggle('fill', v === 1);
    el.classList.toggle('cross', v === 2);
    el.classList.toggle('mark', v === 3);
    el.classList.toggle('wrong', v === 1 && !!S.wrong[r + ',' + c]);
  }

  /* ---------- 线索状态：吻合变灰，矛盾变红 ---------- */
  function sameClue(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  function lineStatus(clue, line) {
    const known = line.map((v) => (v === 1 ? 1 : v === 2 ? 0 : -1));
    if (!P.solveLine(clue, known)) return 'err';
    const fill = line.map((v) => (v === 1 ? 1 : 0));
    return sameClue(P.lineClues(fill), clue) ? 'done' : '';
  }

  function refreshClues(silent) {
    const next = { rows: [], cols: [] };
    for (let r = 0; r < S.R; r++) next.rows.push(lineStatus(S.clues.rows[r], S.cells[r]));
    for (let c = 0; c < S.C; c++) {
      next.cols.push(lineStatus(S.clues.cols[c], S.cells.map((row) => row[c])));
    }
    const prev = S.lineState;
    let gotDone = false;
    let gotErr = false;
    const apply = (list, elList, prevList) => {
      list.forEach((st, i) => {
        elList[i].classList.toggle('done', st === 'done');
        elList[i].classList.toggle('err', st === 'err');
        const before = prevList ? prevList[i] : '';
        if (st === 'done' && before !== 'done') gotDone = true;
        if (st === 'err' && before !== 'err') gotErr = true;
      });
    };
    apply(next.rows, els.rows, prev && prev.rows);
    apply(next.cols, els.cols, prev && prev.cols);
    S.lineState = next;
    if (silent || !prev) return;
    if (gotErr && !mistakeJustNow) A.sfx('error');
    else if (gotDone) A.sfx('lineDone');
    mistakeJustNow = false;
  }

  /* ---------- 交互：点击、拖动、三种工具 ---------- */
  let drag = null;

  function setCell(r, c, v) {
    S.cells[r][c] = v;
    paintCell(r, c);
  }

  function toolFromEvent(e) {
    if (S.mode === 'editor') return 'fill';
    if (e.button === 2) return 'cross';
    if (e.shiftKey) return 'mark';
    return S.tool;
  }

  function dragApply(cell) {
    if (drag.blocked) return;
    const r = +cell.dataset.r;
    const c = +cell.dataset.c;
    const cur = S.cells[r][c];
    const first = drag.changes.length === 0;
    const can = first || (drag.value !== 0 ? cur === 0 : cur === drag.target);
    if (!can || cur === drag.value) return;
    drag.changes.push([r, c, cur, drag.value]);
    setCell(r, c, drag.value);
    if (drag.value === 1 && isWrongFill(r, c)) {
      registerMistake(r, c);
      drag.blocked = true; // 一次涂错只扣一次机会，并停住这一笔
      return;
    }
    if (drag.value === 0) A.sfx('erase');
    else if (drag.tool === 'fill') A.sfx('fill', { n: drag.changes.length - 1 });
    else A.sfx(drag.tool);
  }

  function onPointerDown(e) {
    if (e.button > 2 || S.won || S.failed || S.paused) return;
    if (S.mode === 'play' && S.round && S.round.failure()) { gameOver(S.round.failure()); return; }
    const cell = e.target.closest('.cell');
    if (!cell) return;
    e.preventDefault();
    const tool = toolFromEvent(e);
    const target = TOOL_STATE[tool];
    const cur = S.cells[+cell.dataset.r][+cell.dataset.c];
    drag = { tool, target, value: cur === target ? 0 : target, changes: [] };
    dragApply(cell);
  }

  function onPointerMove(e) {
    if (!drag || S.won || S.failed || S.paused) return;
    if (S.mode === 'play' && S.round && S.round.failure()) { gameOver(S.round.failure()); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest ? el.closest('.cell') : null;
    if (cell && $('board').contains(cell)) dragApply(cell);
  }

  function onPointerUp() {
    if (!drag) return;
    const changes = drag.changes;
    drag = null;
    if (!changes.length) return;
    S.undo.push(changes);
    S.redo = [];
    afterChange(false);
  }

  function afterChange(silent) {
    updateGameActions();
    if (S.mode === 'editor') {
      editorChanged();
      return;
    }
    refreshClues(silent);
    checkWin();
    if (S.mode === 'tutorial') checkTutorialGoal();
    saveProgress();
  }

  function updateGameActions() {
    $('btn-tool-cycle').disabled = S.won || S.failed || S.paused;
    $('btn-pause').disabled = S.won || S.failed;
    $('btn-pause').setAttribute('aria-pressed', String(S.paused));
    $('btn-pause').setAttribute('aria-label', S.paused ? '继续' : '暂停');
    $('btn-pause').title = S.paused ? '继续' : '暂停';
    const pauseIcon = S.paused ? 'play' : 'pause';
    if ($('btn-pause').querySelector('use').getAttribute('href') !== '#i-' + pauseIcon) {
      $('btn-pause').innerHTML = icon(pauseIcon);
    }
    $('board').inert = S.paused || S.failed;
    $('board').classList.toggle('failed', S.failed);
    $('board').classList.toggle('is-paused', S.paused);
  }

  function togglePause() {
    if (S.mode !== 'play' || !S.round || S.won || S.failed) return;
    if (S.round.failure()) { gameOver(S.round.failure()); return; }
    S.paused = !S.paused;
    syncRoundClock();
    updateGameActions();
    saveProgress();
    A.sfx('ui');
  }

  function undo() {
    if (!S.undo.length || S.won || S.failed || S.paused) return;
    const changes = S.undo.pop();
    for (let i = changes.length - 1; i >= 0; i--) setCell(changes[i][0], changes[i][1], changes[i][2]);
    S.redo.push(changes);
    A.sfx('undo');
    afterChange(true);
  }

  function redo() {
    if (!S.redo.length || S.won || S.failed || S.paused) return;
    const changes = S.redo.pop();
    changes.forEach((ch) => setCell(ch[0], ch[1], ch[3]));
    S.undo.push(changes);
    A.sfx('redo');
    afterChange(true);
  }

  function resetBoard() {
    if (!S.cells) return;
    if (S.mode === 'tutorial') {
      restartTutorialStep();
      return;
    }
    if (S.mode === 'play') {
      S.paused = false;
      if (S.round) S.round.pause();
      S.round = Round.create();
      clearProgress(S.key);
      setToolUI('fill');
    }
    S.cells = zeros(S.R, S.C);
    S.undo = [];
    S.redo = [];
    S.won = false;
    S.failed = false;
    S.mistakes = 0;
    S.wrong = {};
    S.lineState = null;
    clearTimeout(winTimer);
    showWin(false);
    showFail(false);
    buildBoard();
    refreshClues(true);
    updateGameActions();
    renderLives();
    syncRoundClock();
    saveProgress();
  }

  function checkWin() {
    if (S.won || !P.isSolved(S.cells, S.clues)) return;
    let result = null;
    if (S.mode === 'play') {
      result = S.round.finish();
      if (!result) { gameOver(S.round.failure()); return; }
    }
    if (S.mode === 'tutorial') {
      const goal = TUT[S.stepIndex].goal;
      if (!goal || !goal.solved) return;
    }
    S.won = true;
    A.sfx('win');
    if (S.mode === 'play') {
      store.done[S.key] = true;
      store.results[S.key] = Round.recordResult(store.results[S.key], result);
      saveJSON(DONE_KEY, store.done);
      saveJSON(RESULTS_KEY, store.results);
      setTitle(S.name); // 解出来后才揭晓名字
      $('win-name').textContent = S.name;
      $('win-stars').innerHTML = [1, 2, 3].map((n) => '<span class="' + (n <= result.stars ? 'earned' : '') + '">' + icon('star') + '</span>').join('');
      $('win-stars').setAttribute('aria-label', result.stars + ' 星');
      $('win-time').textContent = formatTime(result.elapsedMs);
      renderRound();
    }
    celebrate(S.mode === 'play');
    updateGameActions();
  }

  function selectTool(tool) {
    setToolUI(tool);
    A.sfx('ui');
  }

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (!$('about-dialog').classList.contains('hidden')) { closeAbout(); return; }
      closeSettings();
      closeViewer();
    }
    if (isTyping(e) || !$('settings').classList.contains('hidden') || !$('viewer').classList.contains('hidden') || !$('fail').classList.contains('hidden') || !$('about-dialog').classList.contains('hidden')) return;
    if (!isPlayMode()) {
      if ((S.mode === 'menu' || S.mode === 'gallery') && !e.target.closest('[role=tablist]') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        moveCollection(S.mode, e.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    if (S.mode === 'play' && S.paused) return;
    if (S.mode === 'play' && S.round && S.round.failure()) { gameOver(S.round.failure()); return; }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      redo();
    } else if (!mod && S.mode !== 'editor') {
      if (key === '1') selectTool('fill');
      else if (key === '2') selectTool('cross');
      else if (key === '3') selectTool('mark');
    }
  }

  /* ---------- 视图切换 ---------- */
  function configureUI(mode) {
    if (S.round) S.round.pause();
    saveProgress(); // 离开当前谜题前存盘（只在 play 模式下生效）
    S.round = null;
    S.paused = false;
    S.mode = mode;
    const playing = isPlayMode();
    ['home', 'menu', 'gallery'].forEach((v) => {
      $('view-' + v).classList.toggle('hidden', mode !== v);
    });
    $('view-play').classList.toggle('hidden', !playing);
    $('editor-bar').classList.toggle('hidden', mode !== 'editor');
    $('editor-status').classList.toggle('hidden', mode !== 'editor');
    $('tutorial-box').classList.toggle('hidden', mode !== 'tutorial');
    $('round-stats').classList.toggle('hidden', mode !== 'play');
    const editor = mode === 'editor';
    ['btn-tool-cycle', 'btn-reset'].forEach((id) => $(id).classList.toggle('hidden', !playing || editor));
    $('btn-pause').classList.toggle('hidden', mode !== 'play');
    ['btn-editor-clear', 'btn-editor-share', 'btn-editor-save'].forEach((id) => $(id).classList.toggle('hidden', !editor));
    updateGameActions();
    $('phone-shell').dataset.mode = mode;
    $('screen-controls').classList.toggle('hidden', !playing);
    $('play-topbar').classList.toggle('hidden', !playing);
    clearTimeout(winTimer);
    showWin(false);
    showFail(false);
    renderLives();
    if (!playing) setTitle(mode === 'home' ? 'Picross' : PAGE_TITLES[mode]);
    document.querySelector('main').scrollTop = 0;
  }

  function openBoard(rows, preset) {
    clearTimeout(winTimer);
    winTimer = null;
    const grid = Array.isArray(rows[0]) ? rows : P.parseRows(rows);
    S.R = grid.length;
    S.C = grid[0].length;
    S.solution = grid;
    S.clues = P.gridClues(grid);
    S.cells = zeros(S.R, S.C);
    (preset || []).forEach((p) => { S.cells[p[0]][p[1]] = p[2]; });
    S.undo = [];
    S.redo = [];
    S.won = false;
    S.failed = false;
    S.mistakes = 0;
    S.wrong = {};
    S.lineState = null;
    buildBoard();
    updateGameActions();
  }

  function setToolUI(tool) {
    S.tool = tool;
    const button = $('btn-tool-cycle');
    const names = { fill: '涂色', cross: '打叉', mark: '旗帜标记' };
    const next = { fill: 'cross', cross: 'mark', mark: 'fill' };
    button.dataset.tool = tool;
    const icons = { fill: 'feather', cross: 'cross', mark: 'flag' };
    button.innerHTML = icon(icons[tool]);
    button.setAttribute('aria-label', '当前工具：' + names[tool] + '，点击切换为' + names[next[tool]]);
    button.title = names[tool] + ' · 点击切换';
  }

  async function deleteCustom(pz) {
    A.sfx('ui');
    if (!await Confirm.ask({ title: '删除谜题', message: '确认删除“' + pz.name + '”？删除后无法恢复。', confirmLabel: '删除' })) return;
    store.custom = store.custom.filter((x) => x.id !== pz.id);
    delete store.done['C' + pz.id];
    delete store.results['C' + pz.id];
    clearProgress('C' + pz.id);
    saveJSON(CUSTOM_KEY, store.custom);
    saveJSON(DONE_KEY, store.done);
    saveJSON(RESULTS_KEY, store.results);
    A.sfx('erase');
    renderMenu();
    $('menu-tabs').querySelector('[aria-selected="true"]').focus();
  }

  function showMenu() {
    configureUI('menu');
    renderMenu();
  }

  /* ---------- 主页：开始 / 继续 / 谜题 / 画廊 / 关于 ---------- */
  /* 继续游戏：最近一次玩到一半的谜题 */
  function resumeTarget() {
    const keys = Object.keys(store.progress).filter((k) => allPuzzles().some((p) => p.key === k));
    if (!keys.length) return null;
    return keys.indexOf(store.last) >= 0 ? store.last : keys[0];
  }

  function openPuzzleByKey(key) {
    const pz = allPuzzles().find((p) => p.key === key);
    if (pz) startPuzzle(pz.key, pz.name, pz.rows, pz.tier);
  }

  function showHome() {
    configureUI('home');
    $('btn-home-continue').disabled = !resumeTarget();
  }

  function homeStart() {
    A.sfx('ui');
    showMenu();
  }

  function homeContinue() {
    const key = resumeTarget();
    if (!key) return;
    A.sfx('ui');
    openPuzzleByKey(key);
  }

  function goBack() {
    A.sfx('ui');
    if (S.mode === 'play' || S.mode === 'editor') showMenu();
    else showHome();
  }

  /* ---------- 画廊：通关后的彩色作品 ---------- */

  function showGallery() {
    configureUI('gallery');
    renderGallery();
  }

  let viewerReturnFocus = null;
  function openViewer(lv) {
    viewerReturnFocus = document.activeElement;
    const stage = $('viewer-stage');
    stage.innerHTML = '';
    stage.appendChild(makeArt(lv.rows, lv.palette, false));
    $('viewer-name').textContent = lv.name;
    $('viewer').classList.remove('hidden');
    document.querySelector('main').inert = true;
    $('btn-viewer-close').focus();
  }

  function closeViewer() {
    if ($('viewer').classList.contains('hidden')) return;
    $('viewer').classList.add('hidden');
    document.querySelector('main').inert = false;
    if (viewerReturnFocus && viewerReturnFocus.isConnected) viewerReturnFocus.focus();
  }

  /* ---------- 关于 ---------- */
  function showAbout() {
    $('about-dialog').classList.remove('hidden');
    $('btn-about-close').focus();
  }

  function closeAbout() {
    $('about-dialog').classList.add('hidden');
    openSettings();
    $('set-about').focus();
  }

  async function clearAllData() {
    if (!await Confirm.ask({ title: '清除存档', message: '通关记录、进行中的关卡和自制谜题都将被删除，且无法恢复。', confirmLabel: '清除' })) return;
    closeSettings();
    Persistence.clearGameData();
    store.custom = [];
    store.done = {};
    store.results = {};
    store.progress = {};
    store.last = null;
    A.sfx('erase');
    showHome();
    $('btn-home-start').focus();
  }

  /* 内置关卡未解出前只显示“难度 · 第 N 关”，解出后才显示名字 */

  function displayName(key, name, tier) {
    if (tier == null || store.done[key]) return name;
    return TIERS[tier].name + ' · 第 ' + levelNumber(key) + ' 关';
  }

  /* 普通关卡和自制试玩均限制三次失误、三十分钟。 */
  function startPuzzle(key, name, rows, tier) {
    configureUI('play');
    collections.menu.tier = tier == null ? TIERS.length : tier;
    const index = catalog.group(collections.menu.tier, store.custom).findIndex((pz) => pz.key === key);
    collections.menu.page = Math.max(0, Math.floor(index / PAGE_SIZE.menu));
    S.key = key;
    S.name = name;
    S.tier = tier == null ? -1 : tier;
    S.maxMistakes = Round.MAX_MISTAKES;
    S.mistakes = 0;
    S.wrong = {};
    S.failed = false;
    S.palette = paletteOf(key);
    setTitle(displayName(key, name, tier));
    setToolUI('fill');
    openBoard(rows);
    const saved = store.progress[key];
    const validSaved = saved && Array.isArray(saved.cells) && saved.cells.length === S.R && saved.cells.every((row) => Array.isArray(row) && row.length === S.C);
    S.round = Round.create(validSaved ? saved : null);
    if (validSaved) {
      S.cells = saved.cells;
      S.mistakes = S.round.snapshot().mistakes;
      S.wrong = saved.wrong || {};
      buildBoard();
    }
    store.last = key;
    saveJSON(LAST_KEY, key);
    refreshClues(true);
    updateGameActions();
    renderLives();
    syncRoundClock();
    tickRound();
    saveProgress();
  }

  function importCode() {
    const msg = $('import-msg');
    try {
      const pz = P.decodePuzzle($('import-code').value);
      const rows = P.stringifyRows(pz.grid);
      store.custom.push({ id: Date.now().toString(36), name: pz.name, rows });
      saveJSON(CUSTOM_KEY, store.custom);
      $('import-code').value = '';
      $('import-row').classList.add('hidden');
      msg.textContent = '';
      collections.menu.tier = TIERS.length;
      collections.menu.page = Math.floor((store.custom.length - 1) / PAGE_SIZE.menu);
      A.sfx('save');
      renderMenu();
    } catch (err) {
      msg.textContent = '无效代码';
      msg.className = 'msg bad';
      A.sfx('error');
    }
  }

  function toggleImport() {
    const row = $('import-row');
    row.classList.toggle('hidden');
    $('import-msg').textContent = '';
    if (!row.classList.contains('hidden')) $('import-code').focus();
  }

  /* ---------- 初始化 ---------- */
  function updateAudioButtons(st) {
    $('set-music').setAttribute('aria-checked', String(st.music));
    $('set-sfx').setAttribute('aria-checked', String(st.sfx));
    $('set-music').querySelector('use').setAttribute('href', '#i-music' + (st.music && st.musicVolume > 0 ? '' : '-off'));
    $('set-sfx').querySelector('use').setAttribute('href', '#i-sound' + (st.sfx && st.sfxVolume > 0 ? '' : '-off'));
    ['music', 'sfx'].forEach((kind) => {
      const value = Math.round(st[kind + 'Volume'] * 100);
      $('volume-' + kind).value = value;
      $('volume-' + kind).style.setProperty('--volume', value + '%');
      $('volume-' + kind).setAttribute('aria-valuetext', value + '%');
    });
  }

  function openSettings() {
    A.sfx('ui');
    $('settings').classList.remove('hidden');
  }

  function closeSettings() {
    $('settings').classList.add('hidden');
  }

  function openNext() {
    const all = allPuzzles();
    const idx = all.findIndex((p) => p.key === S.key);
    if (idx >= 0 && idx < all.length - 1) {
      const nx = all[idx + 1];
      startPuzzle(nx.key, nx.name, nx.rows, nx.tier);
    }
  }

  function init() {
    const fitDevice = () => {
      const scale = Math.min(1, (window.innerWidth - 32) / 414, (window.innerHeight - 32) / 850);
      $('phone-shell').style.setProperty('--device-scale', Math.max(0.1, scale));
    };
    fitDevice();
    window.addEventListener('resize', fitDevice);

    const board = $('board');
    board.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    board.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', () => { syncRoundClock(); saveProgress(); });
    window.addEventListener('pagehide', () => { if (S.round) S.round.pause(); saveProgress(); });
    window.addEventListener('pageshow', syncRoundClock);
    window.setInterval(tickRound, 250);

    $('btn-tool-cycle').addEventListener('click', () => {
      const next = { fill: 'cross', cross: 'mark', mark: 'fill' };
      selectTool(next[S.tool]);
    });
    $('btn-reset').addEventListener('click', resetBoard);
    $('btn-pause').addEventListener('click', togglePause);

    ['menu', 'gallery'].forEach((kind) => {
      $(kind + '-prev').addEventListener('click', () => moveCollection(kind, -1));
      $(kind + '-next').addEventListener('click', () => moveCollection(kind, 1));
    });
    $('btn-back').addEventListener('click', goBack);
    $('btn-menu-back').addEventListener('click', goBack);
    $('btn-gallery-back').addEventListener('click', goBack);
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-settings-close').addEventListener('click', () => { A.sfx('ui'); closeSettings(); });
    $('settings').addEventListener('click', (e) => { if (e.target === $('settings')) closeSettings(); });
    $('set-music').addEventListener('click', () => A.toggleMusic());
    $('set-sfx').addEventListener('click', () => A.toggleSfx());
    $('volume-music').addEventListener('input', (e) => A.setMusicVolume(+e.target.value / 100));
    $('volume-sfx').addEventListener('input', (e) => A.setSfxVolume(+e.target.value / 100));
    $('volume-sfx').addEventListener('change', () => A.sfx('ui'));
    $('set-tutorial').addEventListener('click', () => { closeSettings(); A.sfx('ui'); startTutorial(); });
    $('set-clear').addEventListener('click', clearAllData);

    $('btn-home-start').addEventListener('click', homeStart);
    $('btn-home-continue').addEventListener('click', homeContinue);
    $('btn-home-gallery').addEventListener('click', () => { A.sfx('ui'); showGallery(); });
    $('set-about').addEventListener('click', () => { closeSettings(); A.sfx('ui'); showAbout(); });
    $('btn-about-close').addEventListener('click', closeAbout);
    $('about-dialog').addEventListener('click', (e) => { if (e.target === $('about-dialog')) closeAbout(); });
    $('viewer').addEventListener('click', (e) => {
      if (e.target === $('viewer') || e.target.closest('#btn-viewer-close')) { A.sfx('ui'); closeViewer(); }
    });
    $('btn-win-next').addEventListener('click', () => { A.sfx('ui'); openNext(); });

    $('btn-import-toggle').addEventListener('click', () => { A.sfx('ui'); toggleImport(); });
    $('btn-import').addEventListener('click', importCode);
    $('import-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') importCode(); });
    $('btn-editor-clear').addEventListener('click', editorClear);
    $('btn-editor-save').addEventListener('click', editorSave);
    $('btn-editor-share').addEventListener('click', editorShare);
    const limitEditorName = (e) => {
      if (!e.isComposing) e.target.value = P.limitName(e.target.value);
    };
    $('editor-name').addEventListener('input', limitEditorName);
    $('editor-name').addEventListener('compositionend', limitEditorName);
    document.querySelectorAll('#editor-size button').forEach((b) => {
      b.addEventListener('click', () => editorResize(+b.dataset.size));
    });

    $('btn-new').addEventListener('click', () => { A.sfx('ui'); startEditor(5); });

    $('tut-prev').addEventListener('click', () => tutorialMove(-1));
    $('tut-next').addEventListener('click', () => tutorialMove(1));

    A.onChange(updateAudioButtons);

    if (window.ResizeObserver) {
      new ResizeObserver(resizeBoard).observe(document.querySelector('.board-stage'));
    } else {
      window.addEventListener('resize', resizeBoard);
    }
    document.querySelectorAll('button[aria-label]').forEach((button) => {
      if (!button.title) button.title = button.getAttribute('aria-label');
      const use = button.querySelector('use');
      const symbol = use && document.querySelector(use.getAttribute('href'));
      if (symbol && symbol.querySelector('image')) button.classList.add('art-button');
    });

    showHome();

  }

  const { renderMenu, renderGallery, moveCollection } = window.PicrossFeatures.collections({
    document, audio: A, catalog, store, collections, pageSize: PAGE_SIZE, ui, formatTime,
    actions: { startPuzzle, deleteCustom, startEditor: (size) => startEditor(size), openViewer },
  });
  const { startEditor, editorChanged, editorSave, editorShare, editorClear, editorResize, setEditorStatus } = window.PicrossFeatures.editor({
    document, core: P, audio: A, confirm: Confirm, state: S, store, storage: Persistence,
    board: { zeros, openBoard, fillClue, elements: () => els },
    actions: { configureUI, startPuzzle, setTitle, hasContent },
  });
  const { startTutorial, checkTutorialGoal, tutorialMove, restartTutorialStep } = window.PicrossFeatures.tutorial({
    document, audio: A, state: S, steps: TUT, ui,
    board: { openBoard, setToolUI, refreshClues, elements: () => els },
    actions: { configureUI, setTitle, showMenu },
  });

  init();
})();
