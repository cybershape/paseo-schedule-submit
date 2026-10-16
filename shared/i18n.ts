export interface I18nDictionary {
  pillTitle: string;
  pillLabel: string;
  dialogTitle: string;
  close: string;
  timeLabel: string;
  messageLabel: string;
  timePlaceholder: string;
  timeHint: string;
  contentPlaceholder: string;
  submitBtn: string;
  submitting: string;
  scheduledTasksHeader: (count: number) => string;
  agentContextError: string;
  emptyContentError: string;
  timeRequiredError: string;
  timeoutOverflowError: string;
  invalidTimePrefix: string;
  createdSuccess: string;
  cancelledSuccess: string;
  cancelFail: string;
  triggering: string;
  slashHelp: string;
  noTasks: string;
  taskFormat: (id: string, time: string, content: string) => string;
  expectedPrefix: string;
  timeUnitSeconds: string;
  timeUnitMinutes: string;
  timeUnitMinutesSeconds: (m: number, s: number) => string;
  timeUnitHoursMinutes: (h: number, m: number) => string;
  today: string;
  monthDay: (month: number, day: number) => string;
}

export const zhDict: I18nDictionary = {
  pillTitle: "定时发送用户输入",
  pillLabel: "定时发送",
  dialogTitle: "定时发送用户输入",
  close: "完成",
  timeLabel: "时间",
  messageLabel: "消息",
  timePlaceholder: "输入时间，例如 5m 或 14:30",
  timeHint: "相对时长 (如 10s, 5m, 1h) 或 时刻 (如 14:30)",
  contentPlaceholder: "输入到达设定时间后提交给 Agent 的内容...",
  submitBtn: "确认定时发送",
  submitting: "正在添加…",
  scheduledTasksHeader: (count: number) => `已计划的任务 (${count})`,
  agentContextError: "请在 Agent 对话界面中打开定时发送。",
  emptyContentError: "请输入要发送的消息内容",
  timeRequiredError: "请输入发送时间",
  timeoutOverflowError: "定时时长不能超过 24 天 (超出定时器上限)",
  invalidTimePrefix: '格式不符 (支持 "5m", "30s", "14:30" 等)',
  createdSuccess: "已成功设置定时任务",
  cancelledSuccess: "已取消该定时任务",
  cancelFail: "取消失败",
  triggering: "触发中…",
  slashHelp: "用法: /schedule in 5m <内容> 或 /schedule at 18:00 <内容> 或 /schedule list",
  noTasks: "当前 Agent 无待执行的定时任务。",
  taskFormat: (id, time, content) => `⏰ [${id}] ${time}: "${content}"`,
  expectedPrefix: "预计：",
  timeUnitSeconds: "秒后",
  timeUnitMinutes: "分钟后",
  timeUnitMinutesSeconds: (m, s) => `${m}分${s}秒后`,
  timeUnitHoursMinutes: (h, m) => `${h}小时${m}分钟后`,
  today: "今天",
  monthDay: (month, day) => `${month}月${day}日`,
};

export const enDict: I18nDictionary = {
  pillTitle: "Schedule user message",
  pillLabel: "Schedule",
  dialogTitle: "Schedule Message",
  close: "Done",
  timeLabel: "Time",
  messageLabel: "Message",
  timePlaceholder: "e.g. 5m or 14:30",
  timeHint: "duration (10s, 5m, 1h) or time (14:30)",
  contentPlaceholder: "Enter message to send to the agent when time arrives...",
  submitBtn: "Schedule Message",
  submitting: "Scheduling…",
  scheduledTasksHeader: (count: number) => `Scheduled Tasks (${count})`,
  agentContextError: "Please open from an agent conversation.",
  emptyContentError: "Please enter a message to send",
  timeRequiredError: "Please enter scheduled time",
  timeoutOverflowError: "Delay cannot exceed 24 days (timer limit)",
  invalidTimePrefix: 'Invalid format (use e.g. "5m", "30s", "14:30")',
  createdSuccess: "Scheduled task created successfully",
  cancelledSuccess: "Scheduled task cancelled",
  cancelFail: "Failed to cancel task",
  triggering: "Triggering…",
  slashHelp: "Usage: /schedule in 5m <message> or /schedule at 18:00 <message> or /schedule list",
  noTasks: "No active scheduled tasks for this agent.",
  taskFormat: (id, time, content) => `⏰ [${id}] ${time}: "${content}"`,
  expectedPrefix: "Expected: ",
  timeUnitSeconds: "s later",
  timeUnitMinutes: "m later",
  timeUnitMinutesSeconds: (m, s) => `${m}m ${s}s later`,
  timeUnitHoursMinutes: (h, m) => `${h}h ${m}m later`,
  today: "Today",
  monthDay: (month, day) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[month - 1]} ${day}`;
  },
};

/**
 * Determine whether the current runtime environment uses a Chinese locale
 * (safe across Browser, React Native, and Node environments).
 */
export function isChineseLocale(): boolean {
  const g = globalThis as Record<string, any>;

  try {
    // 1. Try reading Paseo's language preference from localStorage
    if (g.window?.localStorage) {
      const raw = g.window.localStorage.getItem("@paseo:app-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.language) {
          const lang = String(parsed.language).toLowerCase();
          if (lang.startsWith("zh")) {
            return true;
          }
          if (lang !== "system") {
            return false;
          }
        }
      }
    }
  } catch {
    // Ignore error
  }

  // 2. Check DOM document element lang attribute
  if (g.document?.documentElement?.lang) {
    if (String(g.document.documentElement.lang).toLowerCase().startsWith("zh")) {
      return true;
    }
  }

  // 3. Check navigator language settings
  if (g.navigator) {
    if (Array.isArray(g.navigator.languages) && g.navigator.languages.length > 0) {
      const first = String(g.navigator.languages[0]).toLowerCase();
      if (first.startsWith("zh")) return true;
    }
    if (g.navigator.language && String(g.navigator.language).toLowerCase().startsWith("zh")) {
      return true;
    }
  }

  return false;
}

export function getI18n(): I18nDictionary {
  return isChineseLocale() ? zhDict : enDict;
}
