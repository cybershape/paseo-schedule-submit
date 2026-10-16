import { getI18n, type I18nDictionary } from "./i18n";

export interface ParsedTimeResult {
  valid: true;
  targetDate: Date;
  delayMs: number;
  displayText: string;
}

export interface ParsedTimeError {
  valid: false;
  error: string;
}

export type ParsedTime = ParsedTimeResult | ParsedTimeError;

export function parseTargetTime(input: string, now = new Date(), dict = getI18n()): ParsedTime {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: dict.timeRequiredError };
  }

  // 1. 相对时长：如 10s, 5m, 1h, 2.5h, +5m, +30s
  const relativeMatch = trimmed.match(/^\+?(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|d|days?)$/i);
  if (relativeMatch) {
    const value = parseFloat(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    let ms = 0;
    if (unit.startsWith("s")) ms = value * 1000;
    else if (unit.startsWith("m")) ms = value * 60 * 1000;
    else if (unit.startsWith("h")) ms = value * 3600 * 1000;
    else if (unit.startsWith("d")) ms = value * 86400 * 1000;

    if (ms <= 0) return { valid: false, error: dict.invalidTimePrefix };
    const targetDate = new Date(now.getTime() + ms);
    return {
      valid: true,
      targetDate,
      delayMs: ms,
      displayText: formatDisplayCountdown(targetDate, ms, dict),
    };
  }

  // 2. 当天时刻：如 14:30 或 14:30:00
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return { valid: false, error: dict.invalidTimePrefix };
    }
    const targetDate = new Date(now);
    targetDate.setHours(hour, minute, second, 0);
    // 如果今天已经过了这个点，顺延到明天该时刻
    if (targetDate.getTime() <= now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const delayMs = targetDate.getTime() - now.getTime();
    return {
      valid: true,
      targetDate,
      delayMs,
      displayText: formatDisplayCountdown(targetDate, delayMs, dict),
    };
  }

  // 3. 绝对日期时间：如 2025-05-01 14:30 或 2025/05/01 14:30:00
  const parsed = Date.parse(trimmed.replace(/-/g, "/"));
  if (!Number.isNaN(parsed)) {
    const targetDate = new Date(parsed);
    const delayMs = targetDate.getTime() - now.getTime();
    if (delayMs <= 0) {
      return { valid: false, error: dict.invalidTimePrefix };
    }
    return {
      valid: true,
      targetDate,
      delayMs,
      displayText: formatDisplayCountdown(targetDate, delayMs, dict),
    };
  }

  return { valid: false, error: dict.invalidTimePrefix };
}

export function formatDisplayCountdown(targetDate: Date, delayMs: number, dict = getI18n()): string {
  if (delayMs <= 0) {
    return dict.triggering;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}:${pad(targetDate.getSeconds())}`;

  const totalSeconds = Math.max(0, Math.round(delayMs / 1000));
  let countdown = "";
  if (totalSeconds < 60) {
    countdown = `${totalSeconds} ${dict.timeUnitSeconds}`;
  } else if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    countdown = s > 0 ? dict.timeUnitMinutesSeconds(m, s) : `${m} ${dict.timeUnitMinutes}`;
  } else {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    countdown = dict.timeUnitHoursMinutes(h, m);
  }

  const isToday = new Date().toDateString() === targetDate.toDateString();
  const datePrefix = isToday ? dict.today : dict.monthDay(targetDate.getMonth() + 1, targetDate.getDate());
  return `${datePrefix} ${timeStr} (${countdown})`;
}
