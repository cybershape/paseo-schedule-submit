# paseo-schedule-submit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Paseo plugin that adds a scheduled submission button (Composer Pill) above the agent conversation input box, supports an intuitive popover UI for scheduling time and content, and provides a `/schedule` slash command.

---

## Features

1. **Composer Pill Button**:
   - Located directly above the agent composer input box (alongside `Prompts` and other action buttons).
   - Features a `Clock` icon; click to expand the scheduling popover.

2. **Intuitive Popover UI**:
   - **Quick Presets**: One-click delay options like `+1m`, `+5m`, `+15m`, `+30m`, `+1h`, `+2h`.
   - **Smart Time Parsing**:
     - Relative duration: e.g. `10s`, `5m`, `2h`.
     - Clock time: e.g. `14:30` or `18:00:00` (automatically rolls over to tomorrow if today's time has already passed).
     - Full date-time: e.g. `2025-05-01 10:00`.
   - **Real-Time Preview**: Shows computed execution time dynamically while typing (e.g. `✓ Expected: Today 16:35:00 (5m later)`).
   - **Clean Form Layout**: Aligned Time and Message inputs with format hints strictly confined to the input area.
   - **Task Management**: Clear overview of pending scheduled tasks for the current agent, with one-click cancellation.

3. **Background Daemon Execution**:
   - Tasks are managed by the Paseo backend daemon. Closing the popover, switching agents, or navigating away will not interrupt the timers.
   - When the scheduled time arrives, the content is submitted as a real user message to the target agent and execution triggers automatically.

4. **Slash Command**:
   - Keyboard-friendly users can type commands directly in the composer box:
     - `/schedule in 5m Check the latest test suite results`
     - `/schedule at 18:00 Summarize the work completed today`
     - `/schedule list` (view active scheduled tasks for current agent)
     - `/schedule cancel <id>` (cancel a specific scheduled task)

---

## Installation

Run the installation commands in the plugin project directory:

```bash
# 1. Install development dependencies (for local typechecking and tests)
pnpm install

# 2. Install the plugin into Paseo
paseo plugin install .

# 3. Verify installation status
paseo plugin ls
```

If the plugin is already running and modifications have been made, reload it to apply changes:

```bash
paseo plugin reload paseo-schedule-submit
```

---

## Directory Structure

```text
paseo-schedule-submit/
├── paseo-plugin.json      # Paseo plugin manifest
├── package.json           # Project metadata and dependencies
├── tsconfig.json          # TypeScript compiler configuration
├── index.client.tsx       # Client entry point (registers Composer Pill & /schedule command)
├── index.server.ts        # Server entry point (registers backend scheduling RPCs)
├── client/
│   ├── pill.ts            # Composer Pill button binding and lifecycle subscriptions
│   ├── popover.tsx        # Popover interface (presets, preview, form layout, tasks list)
│   └── ui.ts              # Shared styles and UI utilities
├── server/
│   └── scheduler.ts       # Task scheduler (timer management & Paseo agent messaging)
├── shared/
│   ├── contracts.ts       # RPC communication contracts and Zod schemas
│   ├── i18n.ts            # Internationalization dictionary (English & Chinese)
│   └── time.ts            # Time parsing algorithms and countdown formatters
└── test/
    ├── time.test.ts       # Time parsing unit tests
    └── scheduler.test.ts  # Scheduler logic unit tests
```

---

## License

[MIT](LICENSE)
