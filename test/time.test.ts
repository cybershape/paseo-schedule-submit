import { parseTargetTime, formatDisplayCountdown } from "../shared/time";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error("Assertion failed: " + msg);
}

// 1. 相对时长测试
{
  const now = new Date("2025-01-01T12:00:00Z");
  const res1 = parseTargetTime("10s", now);
  assert(res1.valid === true, "10s 应该有效");
  if (res1.valid) {
    assert(res1.delayMs === 10000, "10s 应该为 10000ms");
    assert(res1.targetDate.getTime() === now.getTime() + 10000, "目标时间应正确");
  }

  const res2 = parseTargetTime("+5m", now);
  assert(res2.valid === true, "+5m 应该有效");
  if (res2.valid) {
    assert(res2.delayMs === 300000, "5m 应该为 300000ms");
  }

  const res3 = parseTargetTime("1h", now);
  assert(res3.valid === true, "1h 应该有效");
  if (res3.valid) {
    assert(res3.delayMs === 3600000, "1h 应该为 3600000ms");
  }
}

// 2. 当天时刻测试
{
  const now = new Date();
  now.setHours(10, 0, 0, 0);

  // 设置 11:30（今天未来）
  const resFuture = parseTargetTime("11:30", now);
  assert(resFuture.valid === true, "11:30 应该有效");
  if (resFuture.valid) {
    assert(resFuture.targetDate.getHours() === 11, "应为 11 点");
    assert(resFuture.targetDate.getMinutes() === 30, "应为 30 分");
    assert(resFuture.targetDate.getDate() === now.getDate(), "应为今天");
  }

  // 设置 09:00（今天已过，自动顺延到明天）
  const resPast = parseTargetTime("09:00", now);
  assert(resPast.valid === true, "09:00 应该顺延有效");
  if (resPast.valid) {
    assert(resPast.targetDate.getHours() === 9, "应为 9 点");
    assert(resPast.targetDate.getDate() === now.getDate() + 1, "应为明天");
  }
}

// 3. 错误格式测试
{
  const resEmpty = parseTargetTime("");
  assert(resEmpty.valid === false, "空字符串应报错");

  const resInvalid = parseTargetTime("abc");
  assert(resInvalid.valid === false, "abc 应报错");
}

console.log("All time tests passed successfully!");
