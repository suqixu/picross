/* 按稳定ID组装题库。目录顺序决定难度，id决定存档身份，两者相互独立。 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./metadata.js'), [
      require('./beginner.js'), require('./easy.js'), require('./normal.js'),
      require('./hard.js'), require('./expert.js'),
    ]);
  } else {
    const groups = root.PicrossPuzzleGroups;
    const data = factory(root.PicrossPuzzleMetadata, [
      groups.beginner, groups.easy, groups.normal, groups.hard, groups.expert,
    ]);
    root.PicrossLevels = data.levels;
    root.PicrossTiers = data.tiers;
    root.PicrossPalettes = data.palettes;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (metadata, groups) {
  'use strict';
  const entries = groups.flatMap((group, tier) => group.map((puzzle) => ({ ...puzzle, tier })));
  entries.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  entries.forEach((puzzle, i) => {
    if (puzzle.id !== 'L' + i) throw new Error('谜题ID重复或缺失：' + puzzle.id);
  });
  return {
    tiers: metadata.tiers,
    palettes: metadata.palettes,
    levels: entries.map((puzzle) => ({
      name: puzzle.name, rows: puzzle.pattern.split('/'), tier: puzzle.tier, palette: puzzle.palette,
    })),
  };
});
