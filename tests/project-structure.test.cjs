const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

test('题库按难度独立维护，组装后全部150题与重构前一致', () => {
  const entry = path.join(root, 'data/puzzles/index.js');
  assert.ok(fs.existsSync(entry), '应提供独立题库入口');
  const data = require(entry);
  assert.equal(data.levels.length, 150);
  for (const name of ['beginner', 'easy', 'normal', 'hard', 'expert']) {
    const puzzles = require(path.join(root, 'data/puzzles', name + '.js'));
    assert.equal(puzzles.length, 30, name);
    assert.equal(new Set(puzzles.map((p) => p.id)).size, 30);
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(data.levels)).digest('hex');
  assert.equal(hash, '3aeea39787fc2f4e5425e6d85d5f5f7222dbb2df15cd010d67e6843029817b56');
});

test('运行素材与创作原稿分离，图片和音频目录均有实际资源', () => {
  for (const file of ['assets/images/backgrounds/pixel-sky.png', 'assets/images/illustrations/pixel-mascot.png',
    'assets/images/icons/pixel-ui-atlas-core.png',
    'assets/images/branding/zzy-seal.webp', 'assets/audio/molihua-synth.mp3']) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  assert.ok(fs.existsSync(path.join(root, 'docs/artwork/prompts/star-clean.prompt.txt')));
  assert.deepEqual(fs.readdirSync(path.join(root, 'assets/images/icons')).filter((name) => name.endsWith('.png')), ['pixel-ui-atlas-core.png']);
  assert.equal(fs.existsSync(path.join(root, 'docs/artwork/archive/pixel-ui-atlas.png')), false);
  const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const star = html.match(/<symbol id="i-star"[^]*?<\/symbol>/)[0];
  assert.ok(star.includes('pixel-ui-atlas-core.png'), '星星应共用主图集');
});
