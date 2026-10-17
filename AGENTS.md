# AGENTS.md

## 包管理

- 用 **bun** 管理依赖，不要用 npm / pnpm / yarn：
  - 安装依赖：`bun install`
  - 运行脚本：`bun run <script>`（如 `bun run dev`、`bun run check`）
  - 执行 CLI 工具：`bun x <tool>`
- 不要生成 `package-lock.json` 等非 bun 的锁文件，锁文件只有 `bun.lock`。

## 工作方式

- 要求做什么就做什么，不要做额外的多余事情。
