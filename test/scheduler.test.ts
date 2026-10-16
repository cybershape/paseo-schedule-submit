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

  // 1. Create immediate task (1s)
  const task = scheduler.create("agent_1", "1s", "Hello, scheduled test");
  assert(task.agentId === "agent_1", "agentId should match");
  assert(task.content === "Hello, scheduled test", "content should match");

  // 2. Verify list
  const list1 = scheduler.list("agent_1");
  assert(list1.length === 1, "task list length should be 1");

  // 3. Cancel task
  const cancelled = scheduler.cancel(task.id);
  assert(cancelled === true, "cancellation should succeed");
  const list2 = scheduler.list("agent_1");
  assert(list2.length === 0, "task list should be 0 after cancellation");

  scheduler.dispose();
  console.log("Scheduler tests passed successfully!");
}

testScheduler().catch(console.error);
