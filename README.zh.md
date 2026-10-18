# 钢琴视奏练习器

一个网页版钢琴视奏（sight-reading）练习工具。通过自定义调号、谱号、音域、节奏与速度等参数生成视奏题目，帮助钢琴学习者练习快速读谱。

[English](./README.md) | **简体中文**

## 当前状态

> 目前处于**原型阶段**：配置页控件可交互，右侧摘要与钢琴键盘高亮会实时跟随，但**尚未接入出题与练习逻辑**，「开始练习」按钮暂不跳转。

## 页面规划

| 页面 | 说明 | 状态 |
| --- | --- | --- |
| 配置页 `/` | 纯配置：谱号、调号、音域、拍号、速度、时值、休止符/变音记号/附点/三连音、每题小节数 | ✅ 前端原型（`src/routes/+page.svelte`） |
| 练习页 | 展示生成的谱面、倒计时、判定与结果反馈 | ⬜ 待开发 |

## 配置项一览（当前原型）

- **谱号**：高音谱号（右手）/ 低音谱号（左手）
- **调号**：12 个调多选，练习时随机抽取；可选是否包含临时变音记号，并带概率调节
- **音域**：MIDI 21–108（A0–C8）双滑块调节，带钢琴键盘高亮预览与快捷预设（中央C附近 / 常用音域 / 宽音域 / 全键盘）
- **拍号**：4/4、3/4、2/4、6/8 —— 分母决定默认时值，也决定 BPM 的一拍单位
- **速度**：40–208 BPM；切换拍号时等比换算，保持绝对速度不变
- **时值**：多选全音符、二分、四分、八分、十六分
- **休止符 / 临时变音记号 / 附点 / 三连音**：各自独立开关 + 概率滑块（0–100%）；关掉后再开保留上次概率
- **每题小节数**：4–32，步长 4
- **配置摘要**：右侧栏实时汇总当前配置，给出难度提示（入门 / 进阶 / 挑战）并做校验（至少选 1 个调号与时值）

原型尚未包含（规划中）：大谱表（双手）、调式（大调 / 小调）、织体（单音 / 双音 / 三和弦）、每次题数、每题限时。

## 练习配置数据结构

所有练习前参数集中在一份带类型的 `PracticeConfig` 里，定义见 [`src/lib/practice/config.ts`](src/lib/practice/config.ts)：

- 配置页只持有唯一的 `$state<PracticeConfig>` 作为唯一真源；派生展示（难度、摘要、一拍单位）留在组件层 `$derived`，不入配置
- 开关与概率合并为 `OptionalFeature { enabled, probability }`
- `createDefaultConfig()` 每次调用返回全新对象（重置按钮也用它）
- 边界常量统一导出：`KEYBOARD_MIN/MAX`、`TEMPO_MIN/MAX`、`MEASURES_MIN/MAX/STEP`
- 为后续 localStorage 持久化做准备（届时加 `version` 字段做迁移）

## 技术栈

- [SvelteKit 3](https://svelte.dev/docs/kit)（Svelte 5 runes）+ TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn-svelte](https://shadcn-svelte.com)（`src/lib/components/ui`）
- [@lucide/svelte](https://lucide.dev) 图标
- [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) 国际化（英语 / 中文，页头可切换）
- [Biome](https://biomejs.dev) 格式化与 lint
- 包管理器：bun；构建产物：`@sveltejs/adapter-static`（静态站点）

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
│   ├── +layout.svelte     # 全局布局（引入样式与 favicon）
│   ├── +page.svelte       # 配置页（当前原型）
│   └── layout.css         # Tailwind 主题与 shadcn 设计令牌
└── lib/
    ├── components/ui/     # shadcn-svelte 组件（button、card、slider…）
    ├── practice/
    │   └── config.ts      # PracticeConfig 类型、默认值、边界常量
    └── utils.ts           # cn() 等工具函数
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
- [x] 配置页原型
- [x] 练习配置数据结构（`PracticeConfig`）
- [ ] 练习页原型（谱面展示、计时、结果反馈）
- [ ] 出题逻辑（按配置生成题目数据）
- [ ] 谱面渲染（五线谱绘制）
- [ ] 答题判定与成绩记录
- [ ] 配置持久化（localStorage）与难度推荐
