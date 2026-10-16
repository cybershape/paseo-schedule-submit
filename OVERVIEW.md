# Schedule Submit

Schedule user messages to agents in Paseo with a composer pill button, an intuitive popover UI, and a slash command.

## Features

- **Composer Pill**: A dedicated `Schedule` button right above the agent input box (alongside Prompts and Subagents).
- **Popover UI**: Click to open a scheduling panel with:
  - Preset delay buttons (`+1m`, `+5m`, `+15m`, `+30m`, `+1h`, `+2h`).
  - Flexible time inputs: relative durations (e.g. `10s`, `5m`, `2h`) or specific clock times (e.g. `14:30`, `18:00`).
  - Real-time time calculation preview (e.g., "Expected: Today 16:30:00 (5 minutes later)").
  - Multi-line message composer.
  - Active scheduled jobs list with one-click cancellation.
- **Background Execution**: Timers run inside the Paseo daemon process. Closing the popover or switching workspaces will not interrupt scheduled jobs.
- **Slash Command**: Use `/schedule in 5m <message>` or `/schedule list` directly from the chat box.
