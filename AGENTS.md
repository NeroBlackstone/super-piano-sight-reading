# AGENTS.md

## 包管理

- 用 **bun** 管理依赖，不要用 npm / pnpm / yarn：
  - 安装依赖：`bun install`
  - 运行脚本：`bun run <script>`（如 `bun run dev`、`bun run check`）
  - 执行 CLI 工具：`bun x <tool>`
- 不要生成 `package-lock.json` 等非 bun 的锁文件，锁文件只有 `bun.lock`。

## 工作方式

- 要求做什么就做什么，不要做额外的多余事情。
- 改代码时闷头一次改完、跑完 `bun run check`，再一次性汇报改了什么、为什么这么改；不要把分析过程一条条挤进对话、每条都停下来等反应。需要查证的（第三方库 API、版面坐标计算）在心里查完直接写进代码。
