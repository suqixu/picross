/* 统一管理游戏存档键及JSON容错，保留原有localStorage格式。 */
(function (root) {
  'use strict';
  const keys = Object.freeze({ custom: 'picross.custom', done: 'picross.done',
    progress: 'picross.progress', last: 'picross.last', results: 'picross.results' });
  function create(storage) {
    if (arguments.length === 0) {
      try { storage = root.localStorage; } catch { /* 浏览器可能禁止访问存储。 */ }
    }
    function loadJSON(key, fallback) {
      try { return JSON.parse(storage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    }
    function saveJSON(key, value) {
      try { storage.setItem(key, JSON.stringify(value)); }
      catch { /* 存储不可用时仍允许当前会话游玩。 */ }
    }
    const dictionary = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const custom = loadJSON(keys.custom, []);
    const state = {
      custom: Array.isArray(custom) ? custom : [],
      done: dictionary(loadJSON(keys.done, {})),
      progress: dictionary(loadJSON(keys.progress, {})),
      last: loadJSON(keys.last, null),
      results: dictionary(loadJSON(keys.results, {})),
    };
    function clearGameData() {
      if (!storage) return;
      Object.keys(storage).filter((key) => key.startsWith('picross.')
        && key !== 'picross.audio' && key !== 'picross.tutorialSeen')
        .forEach((key) => storage.removeItem(key));
    }
    return { keys, state, loadJSON, saveJSON, clearGameData };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PicrossStorage = api;
})(typeof window !== 'undefined' ? window : globalThis);
