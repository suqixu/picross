/* 难度尺寸、主题色及通关配色。 */
(function (root) {
  const data = {
  "tiers": [
    {
      "name": "入门",
      "size": 5,
      "color": "#2e7d4f"
    },
    {
      "name": "简单",
      "size": 7,
      "color": "#2f6f8f"
    },
    {
      "name": "普通",
      "size": 10,
      "color": "#b5651d"
    },
    {
      "name": "困难",
      "size": 12,
      "color": "#b3372f"
    },
    {
      "name": "专家",
      "size": 15,
      "color": "#6d3f9c"
    }
  ],
  "palettes": [
    [
      "#f3722c",
      "#f9c74f"
    ],
    [
      "#2f6f8f",
      "#90be6d"
    ],
    [
      "#e63946",
      "#ffb703"
    ],
    [
      "#6a4c93",
      "#8ac926"
    ],
    [
      "#118ab2",
      "#06d6a0"
    ],
    [
      "#ef476f",
      "#ffd166"
    ],
    [
      "#073b4c",
      "#118ab2"
    ],
    [
      "#9d4edd",
      "#ff9e00"
    ],
    [
      "#3a86ff",
      "#ffbe0b"
    ],
    [
      "#d62828",
      "#f77f00"
    ],
    [
      "#2a9d8f",
      "#e9c46a"
    ],
    [
      "#8338ec",
      "#3a86ff"
    ]
  ]
};
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.PicrossPuzzleMetadata = data;
})(typeof window !== "undefined" ? window : globalThis);
