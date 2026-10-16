import { TaskScheduler } from "../server/scheduler";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error("Assertion failed: " + msg);
}

async function testScheduler() {
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

  const scheduler = new TaskScheduler();
  scheduler.setPaseoClient(mockPaseo);

  // 1. 创建即时任务（100ms）
  const task = scheduler.create("agent_1", "1s", "你好，这是定时测试");
  assert(task.agentId === "agent_1", "agentId 应一致");
  assert(task.content === "你好，这是定时测试", "content 应一致");

  // 2. 检查 list
  const list1 = scheduler.list("agent_1");
  assert(list1.length === 1, "任务列表应为 1");

  // 3. 取消任务
  const cancelled = scheduler.cancel(task.id);
  assert(cancelled === true, "取消应成功");
  const list2 = scheduler.list("agent_1");
  assert(list2.length === 0, "取消后列表应为 0");

  scheduler.dispose();
  console.log("Scheduler tests passed successfully!");
}

testScheduler().catch(console.error);
