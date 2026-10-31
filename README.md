# Picross

手机优先的像素数织游戏，五个难度各30题。纯静态运行，无运行时框架；发布时将源码、题库和样式合并压缩。

## 启动与开发

使用 Node.js 22 或更新版本，以及 Python 3。

```sh
nvm use
npm ci
npm start
```

打开 http://127.0.0.1:4173/ 。`npm start` 先生成发布包，再启动本地预览。

修改时可在两个终端分别运行：

```sh
npm run dev
```

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

开发监听会自动重建未压缩脚本，刷新浏览器即可查看。发布构建使用 `npm run build`，生成可独立部署的 `dist/`。页面只加载一个 `game.js` 和一个 `game.css`，资源引用带内容哈希。

## 目录

```text
src/
  index.html       页面模板与SVG图标视口
  app.js           页面编排、棋盘交互和单局生命周期
  core.js          求解、计时评分、题库查询和用时格式化
  features.js      选关/画廊、编辑器、教程控制器
  ui.js            DOM绘图和确认弹窗
  storage.js       存档键、JSON容错和清档
  audio.js         随机MP3轮播与合成音效
styles/
  base.css         基础布局、首页和卡片
  components.css   棋盘、弹窗和响应式规则
  theme.css        像素主题与各页面样式
data/
  puzzles/         按难度维护的谜题及元数据
  tutorial/        教程步骤
assets/
  images/          backgrounds、illustrations、icons、branding
  audio/           随机轮播的MP3曲目
scripts/           构建、语法及资源引用检查
tests/            Node内置测试
docs/artwork/     创作提示词与未使用的美术原稿
.github/workflows/ GitHub Pages流水线
dist/             自动生成的发布目录，不直接编辑
index.html         自动生成的根目录预览入口，不直接编辑
```

脚本按职责组织；构建器按照显式顺序合并，不会把多个源文件变成多个网络请求。`esbuild` 仅作为开发依赖用于压缩，不会在浏览器中运行。

## 维护题库和资源

- 五档题库分别在 `data/puzzles/beginner.js`、`easy.js`、`normal.js`、`hard.js`、`expert.js`。
- 每条记录包含 `id`、`name`、`pattern` 和 `palette`。`pattern` 使用 `#`、`.` 和 `/` 表示涂色、空白及换行。
- `id` 对应已有存档。保留现有 `L0`～`L149`，新增题目使用新的全局编号，不因调整文件顺序而重编号。组装入口会检查ID重复或缺失。
- 难度尺寸与配色在 `data/puzzles/metadata.js`，教程内容在 `data/tutorial/steps.js`。
- 所有运行图标共用 `assets/images/icons/pixel-ui-atlas-core.png`。图集为1448×1086、4列3行，单格362×362；星星位于左上格，无外部加号装饰。SVG视口位于 `src/index.html`。
- 将MP3放入 `assets/audio/`，构建时自动收录并生成带内容版本的随机播放列表。每轮洗牌播放全部曲目，避免连续重复同一首；失效曲目会跳过。未使用的美术原稿及提示词保存在 `docs/artwork/`，不会复制到发布包。
- 修改任意源码、题库或资源后重新构建；无需手工修改缓存版本。

## 检查与发布

```sh
npm run check
npm test
npm run build
```

检查包括源码语法、资源路径、150道题数据兼容性、新题唯一解、游戏规则、确认流程、教程切换、开局初始化、随机换曲、直接重置和发布包完整性。

GitHub Pages已配置在 `.github/workflows/pages.yml`：

1. 首次在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 将修改提交并推送到 `main`（也支持 `master`），自动执行安装、检查、测试、合并压缩与部署。
3. Pull Request只构建和测试，不部署；也可在Actions中手动运行默认分支的发布流程。

流水线仅发布 `dist/`，不上传源码、测试、原稿或 `node_modules`。无需额外配置发布密钥，使用GitHub自带的令牌。部署成功后可从Actions运行记录打开站点。
