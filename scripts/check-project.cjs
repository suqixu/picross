/* 检查源码语法及所有静态资源引用，避免移动目录后遗留旧路径。 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SCRIPTS, STYLES } = require('./build.cjs');
const ROOT = path.resolve(__dirname, '..');
let errors = 0;
function requireFile(file, from) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    console.error(`资源不存在：${from} → ${file}`);
    errors++;
  }
}
const template = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
for (const match of template.matchAll(/(?:src|href)="(assets\/[^"?]+)/g)) requireFile(match[1], 'src/index.html');
for (const file of STYLES) {
  requireFile(file, '构建配置');
  const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const match of css.matchAll(/url\(["']?([^)'"\s]+)/g)) {
    requireFile(path.posix.normalize(path.posix.join('styles', match[1])), file);
  }
}
for (const file of SCRIPTS) {
  requireFile(file, '构建配置');
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const match of code.matchAll(/['"](assets\/[^'"\n]+\.(?:mp3|png|webp))['"]/g)) requireFile(match[1], file);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : /\.(?:js|cjs)$/.test(entry.name) ? [file] : [];
  });
}
const files = ['src', 'data', 'scripts', 'tests'].flatMap((dir) => walk(path.join(ROOT, dir)));
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) { console.error(check.stderr); errors++; }
}
if (errors) process.exitCode = 1;
else console.log(`检查通过：${files.length}个JavaScript文件；模板、样式和音频资源路径均有效。`);
