# paseo-schedule-submit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Paseo 插件：在 Agent 对话输入框上方添加定时发送按钮（Composer Pill），支持点击弹出浮层设置发送时间点和内容，并支持 `/schedule` 斜杠命令。

---

## 功能特性

1. **Composer 操作栏按钮 (Pill)**：
   - 位于 Agent 输入框上方（与 `Prompts` 等按钮处于同一操作栏）。
   - 图标为 `Clock` 时钟图标，点击即可展开配置浮层。

2. **直观便捷的弹出浮层 (Popover UI)**：
   - **快捷预设**：一键选择 `+1m`、`+5m`、`+15m`、`+30m`、`+1h`、`+2h` 等常用时长。
   - **智能时间解析**：
     - 相对时长：如 `10s`、`5m`、`2h`。
     - 具体时刻：如 `14:30` 或 `18:00:00`（若今天已过则自动顺延至明天）。
     - 完整日期时间：如 `2025-05-01 10:00`。
   - **实时反馈**：输入时间时实时预览计算后的执行时刻（例如：`✓ 预计：今天 16:35:00 (5分钟后)`）。
   - **多行消息输入**：支持换行、粘贴详细 Prompt 提示词。
   - **任务管理**：当前 Agent 的未触发任务列表清晰可见，支持一键取消。

3. **守护进程后台调度**：
   - 定时调度由 Paseo 后端服务进程（Daemon）托管，关闭弹窗、切换 Agent 或离开界面不会中断计时。
   - 时间到达时自动将内容作为真实用户消息提交给目标 Agent，并自动触发 Agent 执行。

4. **Slash Command（斜杠命令）**：
   - 键盘流用户可以直接在对话框中输入命令：
     - `/schedule in 5m 请检查测试用例运行状态`
     - `/schedule at 18:00 总结今天已完成的工作`
     - `/schedule list`（查看当前任务）
     - `/schedule cancel <id>`（取消任务）

---

## 安装方法

进入插件项目所在目录并执行安装命令：

```bash
# 1. 安装开发依赖（用于本地类型检查）
pnpm install

# 2. 安装插件到 Paseo
paseo plugin install /Users/hu/src/agents/paseo-schedule-submit

# 3. 查看安装状态
paseo plugin ls
```

如果插件已处于运行状态并做过代码修改，执行重载即可生效：

```bash
paseo plugin reload paseo-schedule-submit
```

---

## 目录结构

```text
paseo-schedule-submit/
├── paseo-plugin.json      # Paseo 插件元数据清单
├── package.json           # 项目配置与开发依赖
├── tsconfig.json          # TypeScript 编译配置
├── index.client.tsx       # 客户端入口（注册 Pill 按钮与 /schedule 命令）
├── index.server.ts        # 服务端入口（注册后台调度 RPC）
├── client/
│   ├── pill.ts            # Composer Pill 按钮绑定与生命周期订阅
│   ├── popover.tsx        # 弹出浮层界面（时间预设、实时回显、内容输入、任务列表）
│   └── ui.ts              # 共享样式与组件工具
├── server/
│   └── scheduler.ts       # 任务调度器（定时器管理与 Paseo Agent 消息发送）
├── shared/
│   ├── contracts.ts       # RPC 通信契约与 Zod 数据结构
│   └── time.ts            # 时间解析算法与倒计时格式化
└── test/
    ├── time.test.ts       # 时间解析单元测试
    └── scheduler.test.ts  # 调度器逻辑单元测试
```

---

## 许可证

[MIT](LICENSE)
