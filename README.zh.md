# 钢琴视奏练习器

一个网页版钢琴视奏（sight-reading）练习工具。通过调号、谱号、音域、节奏与速度等参数生成视奏题目，在 MIDI 键盘上跟弹，实时判定并统计正确率。

[English](./README.md) | **简体中文**

## 当前状态

核心闭环已完整可用：**配置 → 出题 → 渲染谱面 → MIDI 跟弹判定 → 成绩统计**。尚缺长期配置持久化（localStorage）、大谱表（双手）与更多练习模式，见下方路线图。

在线试用：<https://neroblackstone.github.io/super-piano-sight-reading/>（每次推送到 `master` 由 GitHub Pages 自动部署）

> 判定基于 **Web MIDI API**，需使用 Chromium 系浏览器（Chrome / Edge）。Firefox 默认不支持——仍可浏览并查看生成的谱面，但跟弹不会被记录。

## 页面

| 页面                 | 说明                                                                                                             | 状态                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 配置页 `/`           | 纯配置：谱号、调号、音域、旋律模式、拍号、速度、时值、休止符/变音记号/附点/三连音、每题小节数                      | ✅（`src/routes/+page.svelte`）  |
| 练习页 `/practice`   | 生成谱面 + 倒计时、节拍器、MIDI 判定（演奏 / 练习两种模式）、全屏、成绩覆盖层                                      | ✅（`src/routes/practice/+page.svelte`） |

## 配置项一览

- **谱号**：高音谱号（右手）/ 低音谱号（左手）
- **调号**：12 个调单选（悬停提示升降号数量）
- **音域**：MIDI 21–108（A0–C8）双滑块调节，带钢琴键盘高亮预览；八度预设（C1–C2 … C7–C8，可叠加）与谱表快捷预设（高音 / 高音扩展 / 低音 / 低音扩展）
- **旋律模式** —— 决定下一个音怎么来：
  - **随机取音**：每个音独立随机；也是唯一可能出现随机临时变音记号的模式
  - **音程**：每个音从上一个音按多选的度数（同度–八度）移动，方向随机
  - **分解和弦**：连续分解和弦进行 —— *顺阶*（所选调的调内各级三和弦 / 七和弦，谱表上方标注和弦代号）或 *自定义*（手动选类型：大 / 小 / 减 / 增 / 属七 / 大七 / 小七 / 半减七 / 减七），支持转位（第三转位仅七和弦）与上行 / 下行
- **拍号**：4/4、3/4、2/4、6/8 —— 分母决定默认时值，也决定 BPM 的一拍单位
- **速度**：40–208 BPM；切换拍号时等比换算，保持绝对速度不变
- **时值**：多选全音符、二分、四分、八分、十六分，每个时值可单独勾选附点版；「频率自然化」按真实出现频率加权抽取，而非等概率
- **休止符 / 临时变音记号 / 三连音**：各自独立开关 + 概率滑块（0–100%）；关掉后再开保留上次概率。附点按勾选的时值生效；临时变音记号仅随机取音模式可用
- **每题小节数**：4–32，步长 4
- **配置摘要**：右侧栏实时汇总当前配置，做校验（至少选 1 个时值），附「开始练习 / 重置」按钮与练习提示

## 练习流程

- 配置页把配置存入 `sessionStorage`，练习页挂载时读取（直接访问或会话过期会退回配置页）；「换一题」用同一配置换随机种子重新出题
- **倒计时**：一小节节拍器点击声，由 Web Audio 合成（不引入音频资源），提前排入音频时钟
- **演奏模式**：游标按时钟推进；允许小幅提前量命中；弹错不阻塞；时值窗口走完仍未弹的音记为 *漏弹*
- **练习模式**：事件驱动 —— 弹对当前音才前进，不考虑节奏，休止符直接跳过
- 判定来自所有已连接 MIDI 输入设备的 note-on 事件；页头有实时连接指示（设备名 / 数量）
- 谱面由 **VexFlow 5** 渲染（浏览器端按需加载）：多行版面、按拍符杠分组、跨小节提示记号、顺阶模式标注和弦代号；另有三条只改记谱不改演奏的规则保证可读性 —— 不小于一拍的音必须从拍点开始（拆开并连音线）、两等级规则在必标拍点处断开音符、连续休止符按拍点重组且不跨节拍
- 演奏中当前音高亮并在五线谱下方画游标条，游标越出视野时整页滚动；支持全屏
- 全曲结束弹出成绩覆盖层：判对 / 弹错 / 漏弹数量与正确率，可「换一题」或「再来一次」

## 练习配置数据结构

所有练习前参数集中在一份带类型的 `PracticeConfig` 里，定义见 [`src/lib/practice/config.ts`](src/lib/practice/config.ts)：

- 配置页只持有唯一的 `$state<PracticeConfig>` 作为唯一真源；派生展示（摘要行、一拍单位、速度术语）留在组件层 `$derived`，不入配置
- 开关与概率合并为 `OptionalFeature { enabled, probability }`；附点改为 `DotSettings`，携带生效的时值列表
- 旋律生成由 `MelodySettings { mode, intervals, chord }` 描述，`ChordSettings` 覆盖来源 / 结构 / 类型 / 转位 / 方向
- `createDefaultConfig()` 每次调用返回全新对象（重置按钮也用它）
- 边界常量统一导出：`KEYBOARD_MIN/MAX`、`TEMPO_MIN/MAX`、`MEASURES_MIN/MAX/STEP`
- 页面间交接（`src/lib/practice/session.ts`）先做结构校验再信任数据，不匹配即清空 —— 为后续 localStorage 持久化加 `version` 字段留了余地

出题逻辑（`src/lib/practice/exercise/`）是「配置 + 可注入随机源（`mulberry32`）」的纯函数，同一随机种子可复现同一道题；生成的 `Exercise` 只描述要演奏什么（音高、时值、记号），不含任何渲染信息 —— 绘制全部在 `src/lib/components/practice/staff/`。

## 技术栈

- [SvelteKit 3](https://svelte.dev/docs/kit)（Svelte 5 runes）+ TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn-svelte](https://shadcn-svelte.com)（`src/lib/components/ui`）
- [VexFlow 5](https://vexflow.com) 谱面渲染（浏览器端动态加载）
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) 跟弹判定、[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) 倒计时点击声
- [@lucide/svelte](https://lucide.dev) 图标
- [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 国际化（英语 / 中文，页头可切换）
- [Biome](https://biomejs.dev) 格式化与 lint
- 包管理器：bun；构建产物：`@sveltejs/adapter-static`（静态站点），由 `.github/workflows/deploy.yml` 部署到 GitHub Pages

## 开发

```sh
bun install        # 安装依赖
bun run dev        # 启动开发服务器
bun run dev -- --open  # 启动并在浏览器中打开
```

## 常用脚本

```sh
bun run check      # svelte-check 类型与模板检查
bun run lint       # biome 检查
bun run lint:fix   # biome 自动修复
bun run format     # biome 格式化
bun run build      # 生产构建（输出到 build/）
bun run preview    # 预览生产构建
```

## 项目结构

```
src/
├── routes/
│   ├── +layout.svelte      # 全局布局（引入样式与 favicon）
│   ├── +layout.ts          # 全路由预渲染（静态站点）
│   ├── +page.svelte        # 配置页
│   ├── practice/
│   │   └── +page.svelte    # 练习页（谱面、倒计时、判定）
│   └── layout.css          # Tailwind 主题与 shadcn 设计令牌
└── lib/
    ├── components/
    │   ├── practice/       # 应用组件（配置卡片、页头、staff/）
    │   │   └── staff/      # VexFlow 渲染、行版面、演奏高亮
    │   └── ui/             # shadcn-svelte 组件（button、card、slider…）
    ├── practice/
    │   ├── config.ts       # PracticeConfig 类型、默认值、边界常量
    │   ├── options.ts      # 配置页选项元数据
    │   ├── session.ts      # 页面间配置交接（sessionStorage）
    │   ├── midi.svelte.ts  # Web MIDI 输入状态与音符订阅
    │   ├── exercise/       # 出题逻辑（音高、节奏、记谱规则）
    │   └── play/           # 跟弹会话：时间轴、节拍器、判定
    └── utils.ts            # cn() 等工具函数
```

## 脚手架来源

由 [`sv`](https://github.com/sveltejs/cli) 创建，可用以下命令复现同配置：

```sh
bun x sv@1.1.1 create --template minimal --types ts --add tailwindcss="plugins:none" --install bun super-piano-sight-reading
```

添加官方集成功能：

```sh
npx sv add
```

## 路线图

- [x] 项目初始化（SvelteKit + Tailwind + shadcn-svelte）
- [x] 配置页
- [x] 练习配置数据结构（`PracticeConfig`）
- [x] 出题逻辑（随机取音 / 音程 / 分解和弦）
- [x] 谱面渲染（VexFlow：多行版面、符杠分组、记谱规则、和弦代号）
- [x] 练习页（倒计时、演奏 / 练习模式、全屏）
- [x] Web MIDI 答题判定与正确率统计
- [ ] 配置持久化（localStorage）与难度推荐
- [ ] 大谱表（双手）、调式（大调 / 小调）、织体（单音 / 双音 / 三和弦）
- [ ] 练习历史与成绩记录
