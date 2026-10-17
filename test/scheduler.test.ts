import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TaskScheduler } from "../server/scheduler";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error("Assertion failed: " + msg);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  const testBaseDir = path.join(os.tmpdir(), `paseo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testBaseDir, { recursive: true });

  try {
    const sentMessages: Array<{ agentId: string; content: string }> = [];

    const mockPaseo: any = {
      agents: {
        ref(agentId: string) {
          return {
            send: async (content: string) => {
              sentMessages.push({ agentId, content });
            },
          };
        },
      },
    };

    console.log("--- Test 1: Basic Create, List, and File Persistence ---");
    const scheduler1 = new TaskScheduler({ baseDir: testBaseDir });
    scheduler1.setPaseoClient(mockPaseo);

    const task1 = await scheduler1.create("agent_alpha", "2h", "Message for Alpha");
    assert(task1.agentId === "agent_alpha", "agentId should match");
    assert(task1.content === "Message for Alpha", "content should match");

    const list1 = scheduler1.list("agent_alpha");
    assert(list1.length === 1, "task list length should be 1");

    // 检查是否在磁盘生成了 agent 独立文件
    const alphaFilePath = path.join(testBaseDir, `${encodeURIComponent("agent_alpha")}.json`);
    const fileExists = await fs.access(alphaFilePath).then(() => true).catch(() => false);
    assert(fileExists === true, "agent_alpha.json file should exist on disk");

    const rawFileContent = await fs.readFile(alphaFilePath, "utf-8");
    const parsedFileTasks = JSON.parse(rawFileContent);
    assert(parsedFileTasks.length === 1, "persisted file should have 1 task");
    assert(parsedFileTasks[0].id === task1.id, "persisted task ID should match");

    console.log("--- Test 2: Cancel Task and Auto-delete Empty File ---");
    const cancelled = await scheduler1.cancel(task1.id);
    assert(cancelled === true, "cancellation should succeed");
    assert(scheduler1.list("agent_alpha").length === 0, "list should be empty after cancel");

    const fileAfterCancel = await fs.access(alphaFilePath).then(() => true).catch(() => false);
    assert(fileAfterCancel === false, "file should be removed after all tasks are cancelled");
    scheduler1.dispose();

    console.log("--- Test 3: Archive Agent Deletes File and Cancels Timers ---");
    const scheduler2 = new TaskScheduler({ baseDir: testBaseDir });
    scheduler2.setPaseoClient(mockPaseo);

    const taskToArchive = await scheduler2.create("agent_to_archive", "1h", "Never to be sent");
    const archiveFilePath = path.join(testBaseDir, `${encodeURIComponent("agent_to_archive")}.json`);
    assert((await fs.access(archiveFilePath).then(() => true).catch(() => false)) === true, "file should exist before archive");

    await scheduler2.archiveAgent("agent_to_archive");
    assert(scheduler2.list("agent_to_archive").length === 0, "jobs should be cleared in memory");
    assert((await fs.access(archiveFilePath).then(() => true).catch(() => false)) === false, "file should be deleted after archive");
    scheduler2.dispose();

    console.log("--- Test 4: Daemon Restart - Auto Recovery and Execution ---");
    // 模拟 Daemon 退出前创建两个短时任务
    const preRestartScheduler = new TaskScheduler({ baseDir: testBaseDir });
    preRestartScheduler.setPaseoClient(mockPaseo);
    // 设为 200ms 后触发
    const quickTask = await preRestartScheduler.create("agent_quick", "1s", "Quick message");
    // 手工将磁盘上该任务的 triggerAt 改为 150ms 之后，便于模拟快速重启到期
    const quickFilePath = path.join(testBaseDir, `${encodeURIComponent("agent_quick")}.json`);
    const futureTime = new Date(Date.now() + 150).toISOString();
    await fs.writeFile(quickFilePath, JSON.stringify([{ ...quickTask, triggerAt: futureTime }]), "utf-8");

    // 释放旧调度器（模拟 Daemon 进程关闭）
    preRestartScheduler.dispose();

    // 启动全新调度器（模拟 Daemon 重启），并进行 init 恢复
    const restoredScheduler = new TaskScheduler({ baseDir: testBaseDir });
    await restoredScheduler.init(mockPaseo);

    // 验证任务被恢复到内存中
    const restoredList = restoredScheduler.list("agent_quick");
    assert(restoredList.length === 1, "task should be recovered into scheduler");
    assert(restoredList[0].id === quickTask.id, "recovered task id should match");

    // 等待 250ms，验证被恢复的任务是否自动触发发送
    await delay(250);
    const sentQuick = sentMessages.find((m) => m.content === "Quick message");
    assert(Boolean(sentQuick), "recovered task should automatically execute and send message");
    assert(sentQuick?.agentId === "agent_quick", "sent agentId should match");

    // 验证执行完成后磁盘文件已被自动清除
    const fileAfterExecution = await fs.access(quickFilePath).then(() => true).catch(() => false);
    assert(fileAfterExecution === false, "file should be cleaned up after execution");
    restoredScheduler.dispose();

    console.log("--- Test 5: Client Deferred Readiness (Pending Queue) ---");
    // 模拟 Daemon 启动时尚未连接 client，但任务已经到期
    const noClientScheduler = new TaskScheduler({ baseDir: testBaseDir });
    const lateTask = await noClientScheduler.create("agent_late", "0.1s", "Pending message");
    assert(noClientScheduler.list("agent_late").length === 1, "late task created");

    // 等待任务定时器触发（此时 client 仍是 null）
    await delay(180);
    // 验证此时由于没有 client，消息暂未发送
    assert(!sentMessages.some((m) => m.content === "Pending message"), "message should not be sent yet without client");

    // 模拟前端连接或生命周期触发，注入 PaseoClient
    noClientScheduler.setPaseoClient(mockPaseo);
    await delay(50);

    // 验证队列被自动排空并发送成功
    assert(sentMessages.some((m) => m.content === "Pending message"), "pending task should be flushed immediately when client is ready");
    noClientScheduler.dispose();

    console.log("--- Test 6: Expired Tasks in Downtime Handling ---");
    // 测试宽限期外丢弃，宽限期内补发
    const schedulerDowntime = new TaskScheduler({ baseDir: testBaseDir, gracePeriodMs: 5000 });
    const expiredAgentFile = path.join(testBaseDir, `${encodeURIComponent("agent_expired")}.json`);
    const veryOldTask = {
      id: "sched_very_old",
      agentId: "agent_expired",
      content: "Very old content",
      createdAt: new Date(Date.now() - 60000).toISOString(),
      triggerAt: new Date(Date.now() - 30000).toISOString(), // 30秒前（超出 5s 宽限期）
      rawTimeInput: "1s",
    };
    const graceTask = {
      id: "sched_grace",
      agentId: "agent_expired",
      content: "Grace content",
      createdAt: new Date(Date.now() - 5000).toISOString(),
      triggerAt: new Date(Date.now() - 2000).toISOString(), // 2秒前（在 5s 宽限期内）
      rawTimeInput: "1s",
    };
    await fs.writeFile(expiredAgentFile, JSON.stringify([veryOldTask, graceTask]), "utf-8");

    sentMessages.length = 0; // 清空历史
    await schedulerDowntime.init(mockPaseo);

    // 宽限期内的应补发
    assert(sentMessages.some((m) => m.content === "Grace content"), "grace task should be dispatched immediately");
    // 超期的应被丢弃
    assert(!sentMessages.some((m) => m.content === "Very old content"), "very old task should be dropped");
    schedulerDowntime.dispose();

    console.log("--- Test 7: Workspace Label Assignment & Auto-Clear When Count is 0 ---");
    const labelEvents: Array<{ workspaceId: string; assigned: boolean }> = [];
    const schedulerLabel = new TaskScheduler({
      baseDir: testBaseDir,
      workspaceLabelSetter: (wsId, assigned) => {
        labelEvents.push({ workspaceId: wsId, assigned });
      },
    });
    schedulerLabel.setPaseoClient(mockPaseo);

    // 1. 创建第一个任务 -> 打上 schedule 标签 (assigned: true)
    const wsTask1 = await schedulerLabel.create("agent_ws_1", "1h", "Task 1", "ws_100");
    assert(labelEvents.length === 1, "should emit 1 label event");
    assert(labelEvents[0].workspaceId === "ws_100" && labelEvents[0].assigned === true, "should assign schedule label to ws_100");

    // 2. 创建同一个工作区的第二个任务 -> 依然保持 assigned: true
    const wsTask2 = await schedulerLabel.create("agent_ws_2", "1h", "Task 2", "ws_100");
    assert(labelEvents.length === 2, "should emit label update for task 2");
    assert(labelEvents[1].workspaceId === "ws_100" && labelEvents[1].assigned === true, "should maintain schedule label on ws_100");

    // 3. 取消第一个任务 -> 剩余任务数 > 0，依然 assigned: true
    await schedulerLabel.cancel(wsTask1.id);
    assert(labelEvents[labelEvents.length - 1].assigned === true, "label should still be true since task 2 remains");

    // 4. 取消第二个任务（任务数归 0）-> 自动清空 schedule 标签 (assigned: false)
    await schedulerLabel.cancel(wsTask2.id);
    assert(labelEvents[labelEvents.length - 1].assigned === false, "label should be removed (assigned: false) when count reaches 0");

    // 5. 测试任务到期自动清空标签
    const wsQuickTask = await schedulerLabel.create("agent_ws_quick", "0.1s", "Quick task", "ws_200");
    assert(labelEvents[labelEvents.length - 1].workspaceId === "ws_200" && labelEvents[labelEvents.length - 1].assigned === true, "ws_200 assigned");
    await delay(180); // 等待触发
    assert(labelEvents[labelEvents.length - 1].workspaceId === "ws_200" && labelEvents[labelEvents.length - 1].assigned === false, "ws_200 label cleared after task execution");

    schedulerLabel.dispose();

    console.log("All scheduler persistence and recovery tests passed successfully!");
  } finally {
    await fs.rm(testBaseDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
