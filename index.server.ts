import type { PluginServerContext } from "@getpaseo/plugin/server";
import { cancelTaskRpc, createTaskRpc, listTasksRpc } from "./shared/contracts";
import { TaskScheduler } from "./server/scheduler";

export default function contribute(server: PluginServerContext) {
  const scheduler = new TaskScheduler();

  // 1. 初始化并自动恢复尚未完成的定时任务
  scheduler.init().catch((err) => {
    console.error("[paseo-schedule-submit] Error during scheduler initialization:", err);
  });

  // 2. 监听 Agent 归档事件，自动清理该 Agent 的内存定时器与磁盘持久化数据
  const unsubArchived = server.on("agent.archived", async (event, context) => {
    scheduler.setPaseoClient(context.paseo);
    await scheduler.archiveAgent(event.agent.id);
  });

  // 3. 在生命周期中尽早捕获并更新 Paseo 客户端实例
  const unsubCreated = server.on("agent.created", (_event, context) => {
    scheduler.setPaseoClient(context.paseo);
  });

  const unsubTurnStarted = server.on("agent.turn_started", (_event, context) => {
    scheduler.setPaseoClient(context.paseo);
  });

  // 4. RPC 路由
  server.handle(createTaskRpc, async ({ agentId, workspaceId, delayOrTime, content }, context) => {
    scheduler.setPaseoClient(context.paseo);
    return await scheduler.create(agentId, delayOrTime, content, workspaceId, context.paseo);
  });

  server.handle(listTasksRpc, async ({ agentId }, context) => {
    scheduler.setPaseoClient(context.paseo);
    return scheduler.list(agentId);
  });

  server.handle(cancelTaskRpc, async ({ taskId }, context) => {
    scheduler.setPaseoClient(context.paseo);
    const success = await scheduler.cancel(taskId);
    return { success };
  });

  return () => {
    unsubArchived();
    unsubCreated();
    unsubTurnStarted();
    scheduler.dispose();
  };
}
