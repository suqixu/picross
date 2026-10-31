const fs = require('node:fs');
const path = require('node:path');

// 仅供仍位于应用闭包内的生命周期回归测试使用；支持模块重排和缩进变化。
function readFunction(file, name) {
  const source = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
  const match = source.match(new RegExp('^([ \\t]*)(?:async )?function ' + name + '\\([^]*?\\n\\1\\}', 'm'));
  if (!match) throw new Error('找不到待测函数：' + file + ' / ' + name);
  return match[0].trim();
}
module.exports = { readFunction };
