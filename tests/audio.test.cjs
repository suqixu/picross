const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadAudio(saved = {}, options = {}) {
  const data = new Map([['picross.audio', JSON.stringify(saved)]]);
  const gains = [];
  const players = [];
  const sources = [];
  const oscillators = [];
  const compressors = [];
  const intervals = new Map();
  let intervalId = 0;
  const param = (value = 0) => ({ value,
    cancelScheduledValues() {},
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime(v) { this.value = v; },
  });
  const node = () => ({ outputs: [], connect(destination) { this.outputs.push(destination); } });
  class AudioContext {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain() { const g = { ...node(), gain: param() }; gains.push(g); return g; }
    createDynamicsCompressor() { const compressor = { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; compressors.push(compressor); return compressor; }
    createMediaElementSource(audio) { const source = { ...node(), mediaElement: audio }; sources.push(source); return source; }
    createBiquadFilter() { return { ...node(), frequency: param() }; }
    createDelay() { return { ...node(), delayTime: param() }; }
    createOscillator() { const osc = { ...node(), frequency: param(), start(t) { this.startedAt = t; }, stop(t) { this.stoppedAt = t; } }; oscillators.push(osc); return osc; }
    resume() { this.state = 'running'; }
    suspend() { this.state = 'suspended'; }
  }
  class Audio {
    volume = 0;
    paused = true;
    events = {};
    constructor() {
      if (options.immutableVolume) Object.defineProperty(this, 'volume', { get: () => 1, set() {} });
      players.push(this);
    }
    addEventListener(name, fn) { this.events[name] = fn; }
    removeAttribute() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const window = { PicrossMusicFiles: options.files ?? ['assets/audio/molihua-synth.mp3'], AudioContext, addEventListener() {}, removeEventListener() {} };
  const sandbox = { window, Audio,
    localStorage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    document: { createElement: () => ({ canPlayType: () => options.canPlayMp3 !== false }), addEventListener() {} },
    setInterval(fn) { intervals.set(++intervalId, fn); return intervalId; },
    clearInterval(id) { intervals.delete(id); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/audio.js'), 'utf8'), sandbox);
  return { audio: window.PicrossAudio, gains, players, sources, oscillators, compressors, intervals, data,
    settle() { for (let i = 0; i < 40; i++) for (const fn of [...intervals.values()]) fn(); },
  };
}

test('旧音频存档保留开关并补充默认音量', () => {
  const { audio } = loadAudio({ music: false, sfx: true });
  assert.equal(audio.state().music, false);
  assert.equal(audio.state().musicVolume, 0.4);
  assert.equal(audio.state().sfxVolume, 0.55);
});

test('音乐音量独立调节，静音时调节不会打开音乐', () => {
  const env = loadAudio();
  env.audio.setMusic(true);
  env.audio.setMusicVolume(0.25);
  env.settle();
  assert.equal(env.sources[0].outputs[0].gain.value, 0.25);
  assert.equal(env.gains[1].gain.value, 0.55);
  env.audio.setMusic(false);
  env.audio.setMusicVolume(0.8);
  env.settle();
  assert.equal(env.sources[0].outputs[0].gain.value, 0);
  assert.equal(env.players[0].paused, true);
  assert.equal(env.gains[1].gain.value, 0.55);
  assert.equal(env.audio.state().music, false);
  env.audio.setMusic(true);
  env.settle();
  assert.equal(env.sources[0].outputs[0].gain.value, 0.8);
  assert.equal(env.gains[1].gain.value, 0.55);
});

test('音效音量独立保存，重新启用后恢复设定的音量', () => {
  const env = loadAudio();
  env.audio.setSfxVolume(0.23);
  assert.equal(env.gains[1].gain.value, 0.23);
  env.audio.setSfx(false);
  env.audio.setSfxVolume(0.7);
  assert.equal(env.gains[1].gain.value, 0);
  env.audio.setSfx(true);
  assert.equal(env.gains[1].gain.value, 0.7);
  const saved = JSON.parse(env.data.get('picross.audio'));
  const restored = loadAudio(saved).audio.state();
  assert.equal(restored.sfxVolume, 0.7);
  assert.equal(restored.musicVolume, 0.4);
});

test('音量限制在 0 到 1，支持完全静音并忽略无效数值', () => {
  const { audio } = loadAudio({ musicVolume: 8, sfxVolume: -2 });
  assert.equal(audio.state().musicVolume, 1);
  assert.equal(audio.state().sfxVolume, 0);
  audio.setMusicVolume(0);
  audio.setSfxVolume(2);
  audio.setMusicVolume(NaN);
  assert.equal(audio.state().musicVolume, 0);
  assert.equal(audio.state().sfxVolume, 1);
});

test('媒体元素音量不可写时仍通过 Web Audio 静音，关闭音乐立即暂停', () => {
  const env = loadAudio({}, { immutableVolume: true });
  env.audio.setMusic(true);
  env.audio.setMusicVolume(0);
  env.settle();
  assert.equal(env.players[0].muted, true);
  assert.equal(env.sources[0].outputs[0].gain.value, 0);
  env.audio.setMusicVolume(0.6);
  assert.equal(env.players[0].muted, false);
  assert.equal(env.sources[0].outputs[0].gain.value, 0.6);
  env.audio.setMusic(false);
  assert.equal(env.players[0].paused, true);
});

test('单首音乐仍可循环播放，开关后复用播放器', () => {
  const env = loadAudio();
  env.audio.setMusic(true);
  assert.equal(env.players[0].src, 'assets/audio/molihua-synth.mp3');
  assert.equal(env.players[0].loop, false);
  env.audio.setMusic(false);
  env.audio.setMusic(true);
  assert.equal(env.players.length, 1);
  assert.equal(env.players[0].src, 'assets/audio/molihua-synth.mp3');
});

test('茉莉花加载失败时暂停，不切换其他曲目或播放后备旋律', () => {
  const env = loadAudio();
  env.audio.setMusic(true);
  for (let i = 0; i < 3; i++) env.players[0].events.error();
  env.settle();
  assert.equal(env.players[0].paused, true);
  assert.equal(env.players[0].src, 'assets/audio/molihua-synth.mp3');
  assert.equal(env.oscillators.length, 0);
  assert.equal(env.intervals.size, 0);
});

test('不论浏览器格式探测结果如何，只加载MP3', () => {
  const env = loadAudio({}, { canPlayMp3: false });
  env.audio.setMusic(true);
  assert.equal(env.players[0].src, 'assets/audio/molihua-synth.mp3');
});

test('音乐目录只发布MP3格式，并包含茉莉花', () => {
  const files = fs.readdirSync(path.join(__dirname, '../assets/audio'))
    .filter((name) => /\.(mp3|ogg)$/.test(name)).sort();
  assert.ok(files.includes('molihua-synth.mp3'));
  assert.ok(files.every((name) => name.endsWith('.mp3')));
});

test('菜单点击是短促上扬的多音提示', () => {
  const env = loadAudio();
  env.audio.sfx('ui');
  assert.ok(env.oscillators.length >= 2);
  const notes = env.oscillators;
  assert.ok(notes[1].frequency.value > notes[0].frequency.value);
  assert.ok(notes.every((note) => note.stoppedAt - note.startedAt <= 0.2));
});

test('提高音效整体响度且保留已保存的音量，音乐音量保持独立', () => {
  const env = loadAudio({ musicVolume: 0.3, sfxVolume: 0.42 });
  env.audio.setMusic(true);
  env.audio.sfx('ui');
  assert.ok(env.gains[0].gain.value > 0.8 && env.gains[0].gain.value <= 1);
  assert.equal(env.gains[1].gain.value, 0.42);
  assert.equal(env.sources[0].outputs[0].gain.value, 0.3);
});

test('音效关闭或音量为零时不产生提示音', () => {
  const muted = loadAudio({ sfx: false });
  muted.audio.sfx('ui');
  assert.equal(muted.oscillators.length, 0);
  const zero = loadAudio({ sfxVolume: 0 });
  zero.audio.sfx('fill');
  assert.equal(zero.oscillators.length, 0);
});

test('音效经过动态压缩控制密集操作的峰值，文件音乐保持独立通路', () => {
  const env = loadAudio();
  env.audio.setMusic(true);
  env.audio.sfx('fill');
  assert.equal(env.compressors.length, 1);
  assert.equal(env.gains[0].outputs[0], env.compressors[0]);
  assert.ok(env.compressors[0].ratio.value > 1);
  assert.ok(env.compressors[0].threshold.value < 0);
  assert.notEqual(env.sources[0].outputs[0].outputs[0], env.compressors[0]);
});


test('多首音乐随机轮播，每轮不重复，轮次交界不连续重复同一首', () => {
  const tracks = ['a.mp3', 'b.mp3', 'c.mp3'];
  const env = loadAudio({}, { files: tracks });
  env.audio.setMusic(true);
  const player = env.players[0];
  const played = [];
  for (let i = 0; i < 9; i++) {
    played.push(player.src);
    assert.equal(typeof player.events.ended, 'function');
    player.events.ended();
  }
  for (let i = 1; i < played.length; i++) assert.notEqual(played[i], played[i - 1]);
  for (let i = 0; i < 9; i += 3) assert.equal(new Set(played.slice(i, i + 3)).size, 3);
  assert.equal(env.players.length, 1);
  env.audio.setMusic(false);
  const stopped = player.src;
  player.events.ended();
  assert.equal(player.src, stopped);
  assert.equal(player.paused, true);
});

test('失效曲目跳到其他MP3，全部失败时停止且不无限重试', () => {
  const env = loadAudio({}, { files: ['a.mp3', 'b.mp3', 'c.mp3'] });
  env.audio.setMusic(true);
  const player = env.players[0];
  const first = player.src;
  player.events.error();
  assert.notEqual(player.src, first);
  player.events.error();
  player.events.error();
  assert.equal(player.paused, true);
  assert.equal(env.oscillators.length, 0);
  assert.equal(env.intervals.size, 0);
});

test('错误提示使用低音双段方波蜂鸣，与正常涂色的高音明显区分', () => {
  const wrong = loadAudio();
  wrong.audio.sfx('error');
  assert.equal(wrong.oscillators.length, 2);
  assert.ok(wrong.oscillators.every((note) => note.type === 'square' && note.frequency.value < 260));
  assert.ok(wrong.oscillators[1].startedAt > wrong.oscillators[0].stoppedAt);
  const normal = loadAudio();
  normal.audio.sfx('fill');
  assert.ok(normal.oscillators[0].frequency.value > 500);
  assert.notEqual(normal.oscillators[0].type, wrong.oscillators[0].type);
});
