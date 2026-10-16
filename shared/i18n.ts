export interface I18nDictionary {
  pillTitle: string;
  pillLabel: string;
  dialogTitle: string;
  close: string;
  timePlaceholder: string;
  timeHint: string;
  contentPlaceholder: string;
  submitBtn: string;
  submitting: string;
  scheduledTasksHeader: (count: number) => string;
  agentContextError: string;
  emptyContentError: string;
  timeRequiredError: string;
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
  timePlaceholder: "输入时间，例如 5m 或 14:30",
  timeHint: "支持格式：相对时长 (如 10s, 5m, 1h) 或 具体时刻 (如 14:30)",
  contentPlaceholder: "输入到达设定时间后提交给 Agent 的内容...",
  submitBtn: "确认定时发送",
  submitting: "正在添加…",
  scheduledTasksHeader: (count: number) => `已计划的任务 (${count})`,
  agentContextError: "请在 Agent 对话界面中打开定时发送。",
  emptyContentError: "请输入要发送的消息内容",
  timeRequiredError: "请输入发送时间",
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
  timePlaceholder: "e.g. 5m or 14:30",
  timeHint: "Supported: duration (e.g. 10s, 5m, 1h) or clock time (e.g. 14:30)",
  contentPlaceholder: "Enter message to send to the agent when time arrives...",
  submitBtn: "Schedule Message",
  submitting: "Scheduling…",
  scheduledTasksHeader: (count: number) => `Scheduled Tasks (${count})`,
  agentContextError: "Please open from an agent conversation.",
  emptyContentError: "Please enter a message to send",
  timeRequiredError: "Please enter scheduled time",
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
 * 判断当前运行环境是否为中文界面（支持浏览器、React Native 与 Node 安全运行）
 */
export function isChineseLocale(): boolean {
  const g = globalThis as Record<string, any>;

  try {
    // 1. 尝试从 localStorage 中读取 Paseo 的设置配置
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
    // 忽略异常
  }

  // 2. 检查 DOM 根节点的 lang 属性
  if (g.document?.documentElement?.lang) {
    if (String(g.document.documentElement.lang).toLowerCase().startsWith("zh")) {
      return true;
    }
  }

  // 3. 检查浏览器/系统语言 navigator
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
