# 钢琴视奏练习器

一个网页版钢琴视奏（sight-reading）练习工具。通过自定义调号、谱号、音域、节奏等参数生成视奏题目，帮助钢琴学习者练习快速读谱。

## 页面规划

| 页面 | 说明 | 状态 |
| --- | --- | --- |
| 配置页 `/` | 纯配置：谱号（高音/低音/大谱表）、调号与调式、音域（含钢琴键盘可视化）、音符时值与织体、题量与限时等 | ✅ 前端原型（`src/routes/+page.svelte`） |
| 练习页 | 展示生成的谱面、倒计时、判定与结果反馈 | ⬜ 待开发 |

> 当前处于原型阶段：配置页控件可交互、摘要与键盘高亮会实时跟随，但**尚未接入出题与练习逻辑**，「开始练习」按钮暂不跳转。

## 配置项一览

- **谱号**：高音谱号（右手）、低音谱号（左手）、大谱表（双手）
- **调式**：大调 / 小调 / 两者皆可
- **调号**：12 个调多选，练习时随机抽取；可选是否包含临时变音记号
- **音域**：C2 – C6 区间双滑块调节，带钢琴键盘高亮预览与快捷预设（中央C附近 / 常用音域 / 宽音域）
- **音符与节奏**：时值多选（全、二分、四分、八分、十六分）、织体（单音 / 双音 / 三和弦）、休止符、附点与连音线
- **练习设置**：每题音符数、每次题数（10/20/30/不限）、每题限时与秒数
- **配置摘要**：右侧栏实时汇总当前配置并给出难度提示

## 技术栈

- [SvelteKit 3](https://svelte.dev/docs/kit)（Svelte 5 runes）+ TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn-svelte](https://shadcn-svelte.com)（`src/lib/components/ui`）
- [@lucide/svelte](https://lucide.dev) 图标
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
- [ ] 练习页原型（谱面展示、计时、结果反馈）
- [ ] 出题逻辑（按配置生成题目数据）
- [ ] 谱面渲染（五线谱绘制）
- [ ] 答题判定与成绩记录
- [ ] 配置持久化（localStorage）与难度推荐
