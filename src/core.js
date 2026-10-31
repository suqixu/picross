/* 数织规则、计时评分、题库查询与格式化；无DOM或存储依赖。 */
(function (root) {
  'use strict';


  function lineClues(line) {
    const res = [];
    let run = 0;
    for (const v of line) {
      if (v === 1) {
        run++;
      } else if (run) {
        res.push(run);
        run = 0;
      }
    }
    if (run) res.push(run);
    return res.length ? res : [0];
  }

  function gridClues(grid) {
    const rows = grid.map(lineClues);
    const cols = [];
    const w = grid.length ? grid[0].length : 0;
    for (let c = 0; c < w; c++) cols.push(lineClues(grid.map((r) => r[c])));
    return { rows, cols };
  }

  function normClue(clue) {
    return clue.length === 1 && clue[0] === 0 ? [] : clue;
  }

  /*
   * 单行求解。line 元素：-1 未知，0 空，1 黑。
   * 返回推理后的新行（-1 表示仍不确定），矛盾时返回 null。
   */
  function solveLine(clueRaw, line) {
    const clue = normClue(clueRaw);
    const n = line.length;
    const k = clue.length;
    const W = k + 1;

    const fits = (i, len) => {
      if (i + len > n) return false;
      for (let x = i; x < i + len; x++) if (line[x] === 0) return false;
      return i + len === n || line[i + len] !== 1;
    };
    const next = (i, len) => Math.min(i + len + 1, n);

    const pre = new Uint8Array((n + 1) * W);
    const suf = new Uint8Array((n + 1) * W);

    pre[0] = 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= k; j++) {
        if (!pre[i * W + j]) continue;
        if (line[i] !== 1) pre[(i + 1) * W + j] = 1;
        if (j < k && fits(i, clue[j])) pre[next(i, clue[j]) * W + j + 1] = 1;
      }
    }

    suf[n * W + k] = 1;
    for (let i = n - 1; i >= 0; i--) {
      for (let j = 0; j <= k; j++) {
        let ok = line[i] !== 1 && suf[(i + 1) * W + j] === 1;
        if (!ok && j < k && fits(i, clue[j]) && suf[next(i, clue[j]) * W + j + 1]) ok = true;
        suf[i * W + j] = ok ? 1 : 0;
      }
    }
    if (!suf[0]) return null;

    const canFill = new Uint8Array(n);
    const canEmpty = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= k; j++) {
        if (!pre[i * W + j]) continue;
        if (line[i] !== 1 && suf[(i + 1) * W + j]) canEmpty[i] = 1;
        if (j < k) {
          const len = clue[j];
          if (fits(i, len) && suf[next(i, len) * W + j + 1]) {
            for (let x = i; x < i + len; x++) canFill[x] = 1;
            if (i + len < n) canEmpty[i + len] = 1;
          }
        }
      }
    }

    const res = new Array(n);
    for (let x = 0; x < n; x++) {
      if (!canFill[x] && !canEmpty[x]) return null;
      res[x] = canFill[x] && canEmpty[x] ? -1 : canFill[x] ? 1 : 0;
    }
    return res;
  }

  /* 反复按行列推理直到不再变化。会原地修改 g，矛盾返回 false。 */
  function propagate(clues, g) {
    const R = g.length;
    const C = g[0].length;
    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < R; r++) {
        const res = solveLine(clues.rows[r], g[r]);
        if (!res) return false;
        for (let c = 0; c < C; c++) {
          if (res[c] !== g[r][c]) {
            g[r][c] = res[c];
            changed = true;
          }
        }
      }
      for (let c = 0; c < C; c++) {
        const res = solveLine(clues.cols[c], g.map((row) => row[c]));
        if (!res) return false;
        for (let r = 0; r < R; r++) {
          if (res[r] !== g[r][c]) {
            g[r][c] = res[r];
            changed = true;
          }
        }
      }
    }
    return true;
  }

  function search(clues, g, st) {
    if (st.count >= st.limit || st.nodes > st.maxNodes) return;
    st.nodes++;
    if (!propagate(clues, g)) return;
    let pr = -1;
    let pc = -1;
    for (let r = 0; r < g.length && pr < 0; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === -1) {
          pr = r;
          pc = c;
          break;
        }
      }
    }
    if (pr < 0) {
      st.count++;
      return;
    }
    for (const v of [1, 0]) {
      const copy = g.map((row) => row.slice());
      copy[pr][pc] = v;
      search(clues, copy, st);
    }
  }

  /*
   * 分析一幅图案作为谜题的质量。
   * status: empty | logic（纯逻辑可解且唯一）| guess（唯一但需试探）| multiple | unknown
   */
  function analyze(grid) {
    const filled = grid.some((row) => row.some((v) => v === 1));
    if (!filled) return { status: 'empty' };
    const clues = gridClues(grid);
    const g0 = grid.map((row) => row.map(() => -1));
    if (propagate(clues, g0) && g0.every((row) => row.every((v) => v !== -1))) {
      return { status: 'logic' };
    }
    const st = { count: 0, nodes: 0, limit: 2, maxNodes: 20000 };
    search(clues, grid.map((row) => row.map(() => -1)), st);
    if (st.count >= 2) return { status: 'multiple' };
    if (st.nodes > st.maxNodes) return { status: 'unknown' };
    if (st.count === 1) return { status: 'guess' };
    return { status: 'unknown' };
  }

  /* cells 为玩家状态（1 = 涂色，其余忽略），判断每行每列是否都满足线索 */
  function isSolved(cells, clues) {
    const fill = cells.map((row) => row.map((v) => (v === 1 ? 1 : 0)));
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    for (let r = 0; r < fill.length; r++) {
      if (!same(lineClues(fill[r]), clues.rows[r])) return false;
    }
    for (let c = 0; c < fill[0].length; c++) {
      if (!same(lineClues(fill.map((row) => row[c])), clues.cols[c])) return false;
    }
    return true;
  }

  function parseRows(strings) {
    return strings.map((s) => Array.from(s).map((ch) => (ch === '#' ? 1 : 0)));
  }

  function stringifyRows(grid) {
    return grid.map((row) => row.map((v) => (v === 1 ? '#' : '.')).join(''));
  }

  function limitName(value) {
    return Array.from(String(value ?? '')).slice(0, 8).join('');
  }

  function puzzleName(value) {
    return limitName(String(value ?? '').trim()) || '未命名';
  }

  /* 分享码：PICROSS1: + base64(JSON) */
  function encodePuzzle(name, grid) {
    const json = JSON.stringify({ n: puzzleName(name), d: stringifyRows(grid) });
    return 'PICROSS1:' + btoa(unescape(encodeURIComponent(json)));
  }

  function decodePuzzle(code) {
    const text = String(code || '').trim();
    if (!text.startsWith('PICROSS1:')) throw new Error('不是有效的谜题代码');
    const obj = JSON.parse(decodeURIComponent(escape(atob(text.slice(9)))));
    if (!Array.isArray(obj.d) || !obj.d.length) throw new Error('谜题数据为空');
    const w = obj.d[0].length;
    const ok = obj.d.length <= 25 && w >= 1 && w <= 25 && obj.d.every((s) => /^[#.]+$/.test(s) && s.length === w);
    if (!ok) throw new Error('谜题数据格式错误');
    return { name: puzzleName(obj.n), grid: parseRows(obj.d) };
  }


  const Round = (() => {
    const LIMIT_MS = 30 * 60 * 1000;
    const MAX_MISTAKES = 3;

    function create(saved, clock) {
      saved = saved || {};
      const now = clock || Date.now;
      let accumulated = Number.isFinite(saved.elapsedMs) ? Math.max(0, Math.min(LIMIT_MS, saved.elapsedMs)) : 0;
      let mistakes = Number.isFinite(saved.mistakes) ? Math.max(0, Math.floor(saved.mistakes)) : 0;
      let started = null;
      let result = null;

      function elapsed() {
        return Math.min(LIMIT_MS, accumulated + (started === null ? 0 : Math.max(0, now() - started)));
      }
      function pause() {
        accumulated = elapsed();
        started = null;
      }
      function failure() {
        if (result) return null;
        if (mistakes >= MAX_MISTAKES) return 'mistakes';
        return elapsed() >= LIMIT_MS ? 'timeout' : null;
      }
      function resume() {
        if (!result && !failure() && started === null) started = now();
      }
      function mistake() {
        if (result || failure()) return;
        mistakes++;
        if (failure()) pause();
      }
      function snapshot() {
        return { elapsedMs: elapsed(), mistakes };
      }
      function finish() {
        if (result) return result;
        if (failure()) { pause(); return null; }
        pause();
        result = Object.freeze({ elapsedMs: accumulated, mistakes, stars: 3 - mistakes });
        return result;
      }
      return { elapsed, pause, resume, failure, mistake, snapshot, finish };
    }
    function recordResult(previous, result) {
      const times = [result.elapsedMs, previous && previous.bestElapsedMs, previous && previous.elapsedMs]
        .filter((ms) => Number.isFinite(ms) && ms >= 0);
      const stars = [result.stars, previous && previous.bestStars, previous && previous.stars]
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 3);
      return { ...result, bestElapsedMs: Math.min(...times), bestStars: Math.max(...stars) };
    }
    return { create, recordResult, LIMIT_MS, MAX_MISTAKES };
  })();

  function createCatalog({ levels, tiers, palettes }) {
    const counts = tiers.map(() => 0);
    const numbers = new Map();
    const builtin = levels.map((level, i) => {
      const key = 'L' + i;
      numbers.set(key, ++counts[level.tier]);
      return { ...level, key };
    });
    const ordered = builtin.slice().sort((a, b) => a.tier - b.tier);
    const customItems = (custom) => custom.map((puzzle) => ({
      key: 'C' + puzzle.id, name: puzzle.name, rows: puzzle.rows, tier: null, custom: puzzle,
    }));
    function list(custom = []) { return ordered.concat(customItems(custom)); }
    function group(tier, custom = []) {
      return tier === tiers.length ? customItems(custom) : builtin.filter((puzzle) => puzzle.tier === tier);
    }
    function number(key) { return numbers.get(key) || 0; }
    function palette(key) {
      const id = String(key || 'x');
      if (id[0] === 'L') return levels[Number(id.slice(1))]?.palette ?? 0;
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 9973;
      return hash % palettes.length;
    }
    function stats(items, store) {
      const completed = items.filter((puzzle) => store.done[puzzle.key]);
      const stars = completed.reduce((sum, puzzle) => {
        const record = store.results[puzzle.key];
        const best = record && (record.bestStars ?? record.stars);
        return sum + (Number.isInteger(best) && best >= 1 && best <= 3 ? best : 0);
      }, 0);
      return { completed: completed.length, total: items.length, stars };
    }
    return { tiers, palettes, list, group, number, palette, stats };
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  const api = { lineClues, gridClues, solveLine, propagate, analyze, isSolved,
    parseRows, stringifyRows, limitName, puzzleName, encodePuzzle, decodePuzzle,
    Round, createCatalog, formatTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Picross = api;
})(typeof window !== 'undefined' ? window : globalThis);
