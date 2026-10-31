/* 入门 5×5，30道。id是存档标识，新增题目不可重编号。 */
(function (root) {
  const puzzles = [
    {"id": "L0", "name": "十字", "pattern": "..#../..#../#####/..#../..#..", "palette": 0},
    {"id": "L1", "name": "爱心", "pattern": ".#.#./#####/#####/.###./..#..", "palette": 1},
    {"id": "L2", "name": "字母T", "pattern": "#####/..#../..#../..#../..#..", "palette": 2},
    {"id": "L3", "name": "箭头", "pattern": "..#../.###./#.#.#/..#../..#..", "palette": 3},
    {"id": "L4", "name": "小房子", "pattern": "..#../.###./#####/#.#.#/#.#.#", "palette": 4},
    {"id": "L5", "name": "沙漏", "pattern": "#####/.#.#./..#../.#.#./#####", "palette": 5},
    {"id": "L6", "name": "方框", "pattern": "#####/#...#/#...#/#...#/#####", "palette": 6},
    {"id": "L7", "name": "棋盘格", "pattern": "#.#.#/.#.#./#.#.#/.#.#./#.#.#", "palette": 7},
    {"id": "L8", "name": "金字塔", "pattern": "..#../.###./#####/#####/#####", "palette": 8},
    {"id": "L9", "name": "楼梯", "pattern": "....#/...##/..###/.####/#####", "palette": 9},
    {"id": "L10", "name": "闪电", "pattern": "#..##/..##./.###./##.../#....", "palette": 10},
    {"id": "L11", "name": "笑脸", "pattern": ".###./#.#.#/#.#.#/#...#/.###.", "palette": 11},
    {"id": "L12", "name": "小树", "pattern": "..#../.###./#####/..#../..#..", "palette": 0},
    {"id": "L13", "name": "高脚杯", "pattern": "#####/..#../..#../.###./#####", "palette": 1},
    {"id": "L14", "name": "小旗", "pattern": "..###/..##./..#../..#../..#..", "palette": 2},
    {"id": "L15", "name": "星星", "pattern": "..#../#####/.###./.#.#./#...#", "palette": 3},
    {"id": "L16", "name": "月亮", "pattern": "###../#..#./#..../#..#./.##..", "palette": 4},
    {"id": "L17", "name": "太阳", "pattern": "#.#.#/.###./#####/.###./#.#.#", "palette": 5},
    {"id": "L18", "name": "云朵", "pattern": ".###./#####/#####/.###./.....", "palette": 6},
    {"id": "L19", "name": "奖杯", "pattern": "#####/.###./..#../.###./..#..", "palette": 7},
    {"id": "L20", "name": "帆船", "pattern": "..#../..#../#####/.###./#####", "palette": 8},
    {"id": "L21", "name": "火箭", "pattern": "..#../.###./.###./#####/#.#.#", "palette": 9},
    {"id": "L22", "name": "雨伞", "pattern": ".###./#####/..#../..#../.###.", "palette": 10},
    {"id": "L23", "name": "蘑菇", "pattern": ".###./#####/#####/..#../..#..", "palette": 11},
    {"id": "L24", "name": "礼物盒", "pattern": "#####/#...#/#####/#...#/#####", "palette": 0},
    {"id": "L100", "name": "钻石", "pattern": "..#../.###./#####/.###./..#..", "palette": 1},
    {"id": "L101", "name": "字母H", "pattern": "#...#/#...#/#####/#...#/#...#", "palette": 2},
    {"id": "L102", "name": "字母L", "pattern": "#..../#..../#..../#..../#####", "palette": 3},
    {"id": "L103", "name": "钥匙", "pattern": ".##../##.#./.###./..#../..###", "palette": 4},
    {"id": "L104", "name": "音符", "pattern": "..###/..#.#/..#.#/.##.#/.##..", "palette": 5},
  ];
  if (typeof module !== "undefined" && module.exports) module.exports = puzzles;
  else (root.PicrossPuzzleGroups ||= {}).beginner = puzzles;
})(typeof window !== "undefined" ? window : globalThis);
