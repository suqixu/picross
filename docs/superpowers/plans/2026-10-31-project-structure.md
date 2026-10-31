# 项目结构整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将当前数织项目整理为职责清晰的源码、谜题数据、资源、测试与文档目录，并保持现有表现、玩法和存档兼容。

**Architecture:** 保持无运行时框架的静态页面，使用仅开发依赖esbuild生成发布包。核心规则、存储、公共绘图、选关画廊、编辑器、教程分别成为有明确输入输出的模块；应用入口负责棋盘交互与页面编排。题库按五档拆分，使用显式稳定ID，数据入口按原ID顺序组装。

**Tech Stack:** HTML、CSS、JavaScript（浏览器脚本与CommonJS测试）、Node内置测试。

**Spec:** 用户本轮目录及实现整理要求，以及现有页面/43项测试所描述的行为。

## Global Constraints

- 继续使用原目录中的feat/picross-mobile-ui，不创建worktree，不提交或推送。
- 保留L0～L149、全部localStorage键、每档30题、每页15题、三星/计时规则和现有美术表现。
- 不引入运行时框架或运行时依赖；发布通过esbuild合并压缩，原有静态HTTP启动方式可用。
- 不删除用户存档或未使用的美术原稿；旧素材移入文档归档。

## Review Focus

- 五档拆分后ID顺序、配色和既有存档对应关系完全一致。
- 页面、样式、音频路径均有效，缓存版本可自动检查与更新。
- 工厂模块的回调在初始化后可用，异步编辑分析及教程动画不会污染其他视图。
- 删除/清空确认、音量存档、暂停与通关记录行为保持一致。
- 样式拆分保持原级联顺序，仅移除已不存在元素的规则。

### Task 1: 数据与资源目录

**Files:** data/puzzles/{metadata,beginner,easy,normal,hard,expert,index}.js；data/tutorial/steps.js；assets/{images,audio}；docs/artwork/{archive,prompts}。

**Interfaces:** 数据入口输出levels/tiers/palettes；每条题目使用稳定id、name、pattern、palette。保留浏览器已有PicrossLevels等接口到后续应用入口整理。

- [x] 固定全部150题数据指纹及每档数量、唯一解验证。
- [x] 拆题库、移动资源、更新所有路径及测试加载方式。
- [x] 运行数据/音频测试，并检查全部相对资源引用。

### Task 2: 职责模块

**Files:** src/{app,core,features,ui,storage,audio}.js。

**Interfaces:** Picross.createCatalog(data)提供list/group/number/palette/stats；PicrossStorage.create(storage)提供keys/state/loadJSON/saveJSON；PicrossUI.createArt提供DOM及图案绘制。各feature.create显式接收state、store、actions及所用服务并返回事件/渲染方法，不改写数据文件。

- [x] 为catalog与storage写失败测试；保留当前业务回归测试。
- [x] 提取公用逻辑、选关画廊、编辑器和教程控制器，移除入口中的对应重复代码。
- [x] 更新测试位置与模块依赖，运行全部测试。

### Task 3: 样式与开发入口

**Files:** styles/{base,components,theme}.css；scripts/{build,check-project}.cjs；.github/workflows/pages.yml；package.json；README.md。

- [x] 按现有级联顺序拆分样式，移除已废弃的dock/旧关于页/旧结果弹窗等选择器。
- [x] 自动更新及校验脚本/样式缓存版本，检查本地资源和JavaScript语法。
- [x] 编写项目目录、启动、测试、加题与维护资源的说明。

### Task 4: 验证与复查

- [x] 运行全套测试、语法、路径、缓存版本检查。
- [x] 浏览器验证首页、五档分页、画廊预览、帮助/关于、教程、编辑器和游戏暂停。
- [x] 由一位独立只读reviewer复查；重要发现用回归测试验证后修复。
- [x] 保留未提交改动，报告完成内容和验证结果。

## 执行记录

- 基线：43/43测试通过；完整源码/测试快照位于/tmp/picross-refactor-before，供本轮对照复查。
- 决策：依用户指示继续原目录和现有feat分支，不执行技能中的worktree、commit和merge步骤。

## 用户追加要求与调整

- 项目已迁移至/Users/zhangzaiyuan/Documents/work/tool/picross；51个文件迁移时逐一SHA校验，保留目标仓库origin配置，沿用feat/picross-mobile-ui，无提交或推送。
- 用户明确允许开发拆分、要求发布合并压缩：源码收拢为app/core/features/ui/storage/audio六个JS，使用仅开发依赖esbuild构建一个JS和一个CSS；src/index.html是模板，根index.html与dist是构建产物。
- 按用户要求删除Ogg及选择格式分支；使用imagegen将无加号星星合并到主图集，移除独立星星和旧图集PNG，校准全部SVG视口。
- 用户要求新增GitHub Pages流水线：main/master推送构建并部署，PR只检查，支持手动运行；仓库首次需将Pages Source设为GitHub Actions。

## 当前验证记录

- Task 1: complete — 五档独立数据入口与完整150题指纹一致；资源按用途分目录。
- Task 2: complete — 核心查询与存储直接测试；入口从1417行降至964行，功能控制器独立。
- Task 3: complete — 移除117个废弃选择器，按原顺序拆分三份样式；构建产物为73.5KiB JS与43.2KiB CSS，自动内容版本、独立dist与开发监听已实现。
- 修复模块拆分遗漏的collectionItems和loadTutorialStep跨模块引用；app-flow测试RED→GREEN，真实浏览器开局恢复25格及10组线索。
- 自动检查：30个JS语法及所有资源引用通过；53/53测试通过。最终浏览器核验与独立复查均已完成，复查发现的3项问题已用回归测试修复。

## 最终复查修复与追加功能

- Final: fixed 教程漏传icon — tutorial-ui真实控制器初始化/前进/重置测试RED→GREEN；显式传入ui。
- Final: fixed 干净检出的测试读取生成index — 在/tmp/picross-clean-checkout确切复现ENOENT后，改为读取src/index.html；执行完整干净检出流水线验证。
- Final: fixed MP3缓存未自动更新 — build中的音乐内容变化测试RED→GREEN；构建时扫描目录并将所有MP3哈希URL写入单个JS的播放列表。
- 用户最新要求覆盖重置确认：直接清空本题盘面、错误、计时与撤销记录；保留其他关卡和历史成绩。app-flow回归RED→GREEN，无原生confirm。
- 用户新增音乐：按目录自动收录MP3，洗牌队列每轮完整播放、避免相邻重复，失效曲目跳过，全部失效停止；只用一个播放器并保留音量设置。
- 用户要求错误音效明显区分：使用235→175Hz及155→105Hz的低音双段方波蜂鸣，与普通涂色高音三角波分离；测试验证音色、频率及双段间隔。
- 当前60项测试全部通过，31个JS语法和资源路径检查通过；发布构建74.4KiB JS、43.2KiB CSS。

## 完成记录

- Task 4: complete — 临时干净检出无index/dist/node_modules，npm ci --offline、npm run check、npm test及npm run build顺序全部通过；60/60测试通过。
- 浏览器从/dist/子路径运行发布包，确认仅1个JS和1个CSS；首页、选关、帮助、教程四个页面的颜色/字号/尺寸等样式基线无差异。
- 真实页面验证：盘面25格、错误减少一颗心、直接重置无需原生或像素确认并恢复3心/00:00、暂停锁盘、历史3星/00:21保留；教程可前进和当前步重置；画廊30关与锁图标及作品预览正确；15×15编辑器225格、名称限8字符、取消清空保留图案；印章加载成功。
- 最终浏览器无JavaScript错误。未修改当前用户预览页，仅保留其原有发布包预览标签；测试标签已关闭。
- 独立复查无未处理的重要事项或延后的小问题；没有提交、推送或实际部署。
