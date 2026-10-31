/* 音频：Web Audio音效与构建时收录的MP3随机轮播。 */
(function (root) {
  'use strict';

  const KEY = 'picross.audio';
  const PENTA = [0, 2, 4, 7, 9];
  const MUSIC_FILES = [...new Set(root.PicrossMusicFiles || [])];

  function volumeValue(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }

  const settings = { music: true, sfx: true, musicVolume: 0.4, sfxVolume: 0.55 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved && typeof saved === 'object') {
      if (typeof saved.music === 'boolean') settings.music = saved.music;
      if (typeof saved.sfx === 'boolean') settings.sfx = saved.sfx;
      settings.musicVolume = volumeValue(saved.musicVolume, settings.musicVolume);
      settings.sfxVolume = volumeValue(saved.sfxVolume, settings.sfxVolume);
    }
  } catch (e) { /* 忽略损坏的存档 */ }

  let ctx = null;
  let sfxGain = null;
  let listener = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* 无痕模式等 */ }
    if (listener) listener({ ...settings });
  }

  function init() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    const master = ctx.createGain();
    master.gain.value = 1;
    // 密集拖动时压住叠加峰值，保留短音的清晰起音；音乐使用独立通路。
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 6;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.09;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.sfx ? settings.sfxVolume : 0;
    sfxGain.connect(master);

    return ctx;
  }

  function tone(freq, start, dur, o) {
    const opt = Object.assign({ type: 'sine', vol: 0.3, attack: 0.005, dest: sfxGain }, o);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opt.type;
    osc.frequency.setValueAtTime(freq, start);
    if (opt.slideTo) osc.frequency.exponentialRampToValueAtTime(opt.slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(opt.vol, start + opt.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(opt.dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /* ---------- 音效 ---------- */
  const SFX = {
    fill(t, o) {
      const n = (o && o.n) || 0;
      const semis = PENTA[n % PENTA.length] + 12 * Math.floor(n / PENTA.length % 2);
      const freq = mtof(72 + semis);
      tone(freq, t, 0.085, { type: 'triangle', vol: 0.4, slideTo: freq * 1.08 });
      tone(freq * 2, t + 0.018, 0.06, { vol: 0.1 });
    },
    cross(t) {
      tone(mtof(72), t, 0.04, { type: 'square', vol: 0.09, slideTo: mtof(67) });
      tone(mtof(67), t + 0.018, 0.08, { type: 'triangle', vol: 0.3 });
    },
    mark(t) {
      tone(mtof(79), t, 0.065, { type: 'triangle', vol: 0.27 });
      tone(mtof(84), t + 0.045, 0.09, { vol: 0.27 });
    },
    erase(t) {
      tone(520, t, 0.07, { type: 'triangle', vol: 0.29, slideTo: 260 });
      tone(390, t + 0.025, 0.055, { vol: 0.1, slideTo: 290 });
    },
    undo(t) {
      tone(mtof(76), t, 0.065, { type: 'triangle', vol: 0.29 });
      tone(mtof(72), t + 0.045, 0.09, { type: 'triangle', vol: 0.29 });
    },
    redo(t) {
      tone(mtof(72), t, 0.065, { type: 'triangle', vol: 0.29 });
      tone(mtof(76), t + 0.045, 0.09, { type: 'triangle', vol: 0.29 });
    },
    ui(t) {
      tone(mtof(84), t, 0.05, { type: 'triangle', vol: 0.3 });
      tone(mtof(88), t + 0.035, 0.075, { vol: 0.24 });
    },
    lineDone(t) {
      [79, 84, 88].forEach((m, i) => {
        tone(mtof(m), t + i * 0.045, 0.14, { type: 'triangle', vol: 0.27 });
      });
    },
    error(t) {
      tone(235, t, 0.09, { type: 'square', vol: 0.32, slideTo: 175 });
      tone(155, t + 0.16, 0.14, { type: 'square', vol: 0.26, slideTo: 105 });
    },
    save(t) {
      [72, 76, 79].forEach((m, i) => {
        tone(mtof(m), t + i * 0.055, 0.13, { type: 'triangle', vol: 0.28 });
      });
    },
    win(t) {
      [72, 76, 79, 84, 88].forEach((m, i) => {
        tone(mtof(m), t + i * 0.08, 0.22, { type: 'triangle', vol: 0.27 });
      });
      [84, 88, 91].forEach((m) => tone(mtof(m), t + 0.42, 0.32, { vol: 0.11 }));
    },
  };

  function sfx(name, opts) {
    if (!settings.sfx || !settings.sfxVolume || !SFX[name]) return;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    SFX[name](ctx.currentTime + 0.005, opts);
  }

  /* ---------- 背景音乐：洗牌队列，每轮播放全部曲目 ---------- */
  let player = null;
  let fileGain = null;
  let currentTrack = null;
  let musicQueue = [];
  const failedTracks = new Set();

  function nextMusic() {
    if (!musicQueue.length) {
      musicQueue = MUSIC_FILES.filter((file) => !failedTracks.has(file));
      for (let i = musicQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [musicQueue[i], musicQueue[j]] = [musicQueue[j], musicQueue[i]];
      }
      if (musicQueue.length > 1 && musicQueue[0] === currentTrack) {
        [musicQueue[0], musicQueue[1]] = [musicQueue[1], musicQueue[0]];
      }
    }
    const next = musicQueue.shift();
    if (!next) return false;
    currentTrack = next;
    player.src = next;
    return true;
  }

  function advanceMusic() {
    player.pause();
    if (settings.music && nextMusic()) {
      applyFileVolume();
      playMusic();
    }
  }

  function playMusic() {
    const pending = player.play();
    if (pending && pending.catch) pending.catch(() => { /* 等待下一次用户操作 */ });
  }

  function applyFileVolume() {
    if (!player) return;
    const volume = settings.music ? settings.musicVolume : 0;
    // iOS 不支持写入媒体元素的 volume，文件音乐通过 Web Audio 调音量。
    player.muted = volume === 0;
    if (fileGain) fade(fileGain, volume);
    else player.volume = volume;
  }

  function startMusic() {
    if (init() && ctx.state === 'suspended') ctx.resume();
    if (!player) {
      player = new Audio();
      player.preload = 'auto';
      player.loop = false;
      if (ctx && ctx.createMediaElementSource) {
        const source = ctx.createMediaElementSource(player);
        fileGain = ctx.createGain();
        fileGain.gain.value = 0;
        source.connect(fileGain);
        fileGain.connect(ctx.destination);
      }
      player.addEventListener('ended', advanceMusic);
      player.addEventListener('error', () => {
        failedTracks.add(currentTrack);
        musicQueue = musicQueue.filter((file) => !failedTracks.has(file));
        advanceMusic();
      });
    }
    if (!currentTrack || failedTracks.has(currentTrack)) {
      if (failedTracks.size === MUSIC_FILES.length) {
        failedTracks.clear();
        musicQueue = [];
      }
      if (!nextMusic()) return;
    }
    applyFileVolume();
    if (player.paused) playMusic();
  }

  function stopMusic() {
    if (player) {
      applyFileVolume();
      player.pause();
    }
  }

  function fade(gainNode, to) {
    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(to, now + 0.3);
  }

  function setMusic(on) {
    settings.music = !!on;
    save();
    if (settings.music) startMusic();
    else stopMusic();
  }

  function setSfx(on) {
    settings.sfx = !!on;
    save();
    if (init()) fade(sfxGain, on ? settings.sfxVolume : 0);
    if (on) sfx('ui');
  }

  function setMusicVolume(value) {
    settings.musicVolume = volumeValue(value, settings.musicVolume);
    save();
    applyFileVolume();
  }

  function setSfxVolume(value) {
    settings.sfxVolume = volumeValue(value, settings.sfxVolume);
    save();
    if (init()) fade(sfxGain, settings.sfx ? settings.sfxVolume : 0);
  }

  /* 浏览器要求用户操作后才能出声：首次点击或按键时启动 */
  function unlock() {
    root.removeEventListener('pointerdown', unlock, true);
    root.removeEventListener('keydown', unlock, true);
    if (init() && ctx.state === 'suspended') ctx.resume();
    if (settings.music) startMusic();
  }
  root.addEventListener('pointerdown', unlock, true);
  root.addEventListener('keydown', unlock, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (ctx) ctx.suspend();
      if (player) player.pause();
    } else {
      if (ctx) ctx.resume();
      if (player && settings.music) {
        const p = player.play();
        if (p && p.catch) p.catch(() => {});
      }
    }
  });

  root.PicrossAudio = {
    sfx,
    setMusic,
    setSfx,
    setMusicVolume,
    setSfxVolume,
    toggleMusic() { setMusic(!settings.music); },
    toggleSfx() { setSfx(!settings.sfx); },
    state() { return { ...settings }; },
    onChange(fn) { listener = fn; fn(this.state()); },
  };
})(window);
