const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
let result;
let temporary;
function output() {
  if (result) return result;
  const file = path.join(__dirname, '../scripts/build.cjs');
  assert.ok(fs.existsSync(file), '应有可复现的发布构建入口');
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'picross-build-test-'));
  result = require(file).build({ outdir: path.join(temporary, 'site'), writePreview: false });
  return result;
}
process.on('exit', () => { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); });

test('发布页面只加载一个压缩JS和一个压缩CSS，源文件不逐个请求', () => {
  const built = output();
  const html = fs.readFileSync(path.join(built.outdir, 'index.html'), 'utf8');
  assert.equal([...html.matchAll(/<script\b[^>]*\bsrc=/g)].length, 1);
  assert.equal([...html.matchAll(/<link\b[^>]*rel="stylesheet"/g)].length, 1);
  assert.ok(built.jsBytes < built.rawJsBytes * 0.9, 'JS应实际压缩');
  assert.ok(built.cssBytes < built.rawCssBytes * 0.9, 'CSS应实际压缩');
  assert.equal(fs.existsSync(path.join(built.outdir, 'src')), false);
  assert.equal(fs.existsSync(path.join(built.outdir, 'data')), false);
});

test('发布包相对资源可在GitHub仓库子路径访问，预加载背景与CSS共用缓存URL', () => {
  const built = output();
  const html = fs.readFileSync(path.join(built.outdir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(built.outdir, 'game.css'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1]);
  const urls = [...css.matchAll(/url\(["']?([^\s)'\"]+)/g)].map((m) => m[1]);
  for (const url of [...refs, ...urls]) {
    assert.equal(url.startsWith('/'), false, url + ' 不应依赖域名根路径');
    const filename = url.split('?')[0];
    assert.ok(fs.existsSync(path.join(built.outdir, filename)), url);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(built.outdir, filename))).digest('hex').slice(0, 10);
    assert.ok(url.endsWith('?v=' + hash), url + ' 应使用内容版本');
  }
  const preload = html.match(/rel="preload"[^>]*href="([^"]+)"/)[1];
  assert.ok(urls.includes(preload), '背景预加载与CSS应指向同一URL');
  assert.equal(fs.readdirSync(path.join(built.outdir, 'assets/audio')).filter((name) => name.endsWith('.ogg')).length, 0);
  assert.deepEqual(fs.readdirSync(path.join(built.outdir, 'assets/images/icons')), ['pixel-ui-atlas-core.png']);
});

test('构建自动收录音乐目录，并随MP3内容变化更新播放列表缓存版本', () => {
  output();
  const root = path.join(temporary, 'source');
  fs.mkdirSync(root);
  for (const dir of ['src', 'styles', 'data', 'assets']) fs.cpSync(path.join(__dirname, '..', dir), path.join(root, dir), { recursive: true });
  const build = require('../scripts/build.cjs').build;
  const first = build({ root, writePreview: false });
  const before = fs.readFileSync(path.join(first.outdir, 'game.js'), 'utf8');
  const music = fs.readdirSync(path.join(root, 'assets/audio')).filter((name) => name.endsWith('.mp3'));
  for (const name of music) assert.ok(before.includes(encodeURIComponent(name) + '?v='), name + ' 应被自动加入播放列表');
  fs.appendFileSync(path.join(root, 'assets/audio/molihua-synth.mp3'), Buffer.from([0]));
  const second = build({ root, writePreview: false });
  const after = fs.readFileSync(path.join(second.outdir, 'game.js'), 'utf8');
  assert.notEqual(before, after, '更新音乐应刷新运行时URL内容版本');
});
