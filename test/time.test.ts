import { parseTargetTime, formatDisplayCountdown } from "../shared/time";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error("Assertion failed: " + msg);
}

// 1. Relative duration tests
{
  const now = new Date("2025-01-01T12:00:00Z");
  const res1 = parseTargetTime("10s", now);
  assert(res1.valid === true, "10s should be valid");
  if (res1.valid) {
    assert(res1.delayMs === 10000, "10s should be 10000ms");
    assert(res1.targetDate.getTime() === now.getTime() + 10000, "target date should match");
  }

  const res2 = parseTargetTime("+5m", now);
  assert(res2.valid === true, "+5m should be valid");
  if (res2.valid) {
    assert(res2.delayMs === 300000, "5m should be 300000ms");
  }

  const res3 = parseTargetTime("1h", now);
  assert(res3.valid === true, "1h should be valid");
  if (res3.valid) {
    assert(res3.delayMs === 3600000, "1h should be 3600000ms");
  }
}

// 2. Same-day clock time tests
{
  const now = new Date();
  now.setHours(10, 0, 0, 0);

  // Set 11:30 (future time today)
  const resFuture = parseTargetTime("11:30", now);
  assert(resFuture.valid === true, "11:30 should be valid");
  if (resFuture.valid) {
    assert(resFuture.targetDate.getHours() === 11, "should be 11 hours");
    assert(resFuture.targetDate.getMinutes() === 30, "should be 30 minutes");
    assert(resFuture.targetDate.getDate() === now.getDate(), "should be today");
  }

  // Set 09:00 (past time today, automatically roll over to tomorrow)
  const resPast = parseTargetTime("09:00", now);
  assert(resPast.valid === true, "09:00 should roll over to tomorrow");
  if (resPast.valid) {
    assert(resPast.targetDate.getHours() === 9, "should be 9 hours");
    assert(resPast.targetDate.getDate() === now.getDate() + 1, "should be tomorrow");
  }
}

// 3. Invalid format and overflow tests
{
  const resEmpty = parseTargetTime("");
  assert(resEmpty.valid === false, "empty string should fail");

  const resInvalid = parseTargetTime("abc");
  assert(resInvalid.valid === false, "invalid string should fail");

  // 30d exceeds Node's 24.8-day timer limit
  const resOverflow = parseTargetTime("30d");
  assert(resOverflow.valid === false, "30d should fail due to timer limit");
}

console.log("All time tests passed successfully!");
