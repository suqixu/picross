/* 发布构建：合并压缩脚本/题库和样式，生成可独立部署的dist。 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = [
  'src/core.js', 'src/audio.js',
  ...['metadata', 'beginner', 'easy', 'normal', 'hard', 'expert', 'index'].map((name) => `data/puzzles/${name}.js`),
  'data/tutorial/steps.js', 'src/storage.js', 'src/ui.js', 'src/features.js', 'src/app.js',
];
const STYLES = ['styles/base.css', 'styles/components.css', 'styles/theme.css'];
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);

function build({ root = ROOT, outdir = path.join(root, 'dist'), minify = true, writePreview = true } = {}) {
  outdir = path.resolve(outdir);
  if (outdir === path.resolve(root)) throw new Error('构建输出不能覆盖源码目录');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const sourceJs = SCRIPTS.map((file) => `/* ${file} */\n${read(file)}\n;`).join('\n');
  const rawCss = STYLES.map(read).join('\n');
  const assetVersion = (file) => file.split('/').map(encodeURIComponent).join('/') + '?v=' + hash(fs.readFileSync(path.join(root, file)));
  const musicFiles = fs.readdirSync(path.join(root, 'assets/audio')).filter((file) => /\.mp3$/i.test(file)).sort()
    .map((file) => assetVersion('assets/audio/' + file));
  const rawJs = 'window.PicrossMusicFiles = ' + JSON.stringify(musicFiles) + ';\n' + sourceJs;
  const cssInput = rawCss.replace(/url\(["']?(\.\.\/assets\/[^)'"\s]+)["']?\)/g,
    (_, file) => `url("${assetVersion(file.slice(3))}")`);
  const js = esbuild.transformSync(rawJs, { loader: 'js', minify, target: 'es2020', legalComments: 'none' }).code;
  const css = esbuild.transformSync(cssInput, { loader: 'css', minify, target: ['chrome105', 'safari16'], legalComments: 'none' }).code;
  let html = read('src/index.html')
    .replace('<!-- APP_STYLES -->', `<link rel="stylesheet" href="game.css?v=${hash(css)}">`)
    .replace('<!-- APP_SCRIPT -->', `<script defer src="game.js?v=${hash(js)}"></script>`)
    .replace(/((?:src|href)=")(assets\/[^"?]+)(?:\?[^\"]*)?(")/g, (_, a, file, b) => a + assetVersion(file) + b);
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  fs.writeFileSync(path.join(outdir, 'game.js'), js);
  fs.writeFileSync(path.join(outdir, 'game.css'), css);
  fs.writeFileSync(path.join(outdir, 'index.html'), html);
  fs.writeFileSync(path.join(outdir, '.nojekyll'), '');
  fs.cpSync(path.join(root, 'assets'), path.join(outdir, 'assets'), {
    recursive: true, filter: (file) => fs.statSync(file).isDirectory() || /\.(png|webp|mp3)$/.test(file),
  });
  if (writePreview) {
    // 根目录也可由现有静态服务器访问；所有发布资源相对于dist保持一致。
    const preview = html.replace(/((?:src|href)=")((?:assets\/|game\.(?:js|css))[^\"]*)(")/g, '$1dist/$2$3');
    fs.writeFileSync(path.join(root, 'index.html'), preview);
  }
  return { outdir, jsBytes: Buffer.byteLength(js), cssBytes: Buffer.byteLength(css),
    rawJsBytes: Buffer.byteLength(rawJs), rawCssBytes: Buffer.byteLength(rawCss) };
}

if (require.main === module) {
  const watch = process.argv.includes('--watch');
  const run = () => {
    try {
      const result = build({ minify: !watch });
      console.log(`构建完成：JS ${(result.jsBytes / 1024).toFixed(1)} KiB，CSS ${(result.cssBytes / 1024).toFixed(1)} KiB → dist/`);
    } catch (error) {
      console.error(error.message);
      if (!watch) process.exitCode = 1;
    }
  };
  run();
  if (watch) {
    let timer;
    for (const dir of ['src', 'styles', 'data', 'assets']) {
      fs.watch(path.join(ROOT, dir), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(run, 100);
      });
    }
    console.log('正在监听源码、样式、题库和资源变更。另开终端启动静态服务器即可预览。');
  }
}
module.exports = { build, SCRIPTS, STYLES };
