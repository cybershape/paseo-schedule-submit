import type { PluginServerContext } from "@getpaseo/plugin/server";
import { cancelTaskRpc, createTaskRpc, listTasksRpc } from "./shared/contracts";
import { TaskScheduler } from "./server/scheduler";

export default function contribute(server: PluginServerContext) {
  const scheduler = new TaskScheduler();

  server.handle(createTaskRpc, async ({ agentId, delayOrTime, content }, context) => {
    scheduler.setPaseoClient(context.paseo);
    return scheduler.create(agentId, delayOrTime, content, context.paseo);
  });

  server.handle(listTasksRpc, async ({ agentId }, context) => {
    scheduler.setPaseoClient(context.paseo);
    return scheduler.list(agentId);
  });

  server.handle(cancelTaskRpc, async ({ taskId }, context) => {
    scheduler.setPaseoClient(context.paseo);
    const success = scheduler.cancel(taskId);
    return { success };
  });

  return () => {
    scheduler.dispose();
  };
}
