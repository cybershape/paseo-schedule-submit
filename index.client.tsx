import type { PluginClientContext } from "@getpaseo/plugin/client";
import { contributeComposerPills } from "./client/pill";
import { cancelTaskRpc, createTaskRpc, listTasksRpc } from "./shared/contracts";
import { getI18n } from "./shared/i18n";
import { formatDisplayCountdown, parseTargetTime } from "./shared/time";

export default function contribute(client: PluginClientContext) {
  const dict = getI18n();

  // 1. 注册 Composer Pill 按钮与弹出设置面板
  const cleanupPills = contributeComposerPills(client);

  // 2. 注册 Slash Command: /schedule 方便键盘快捷操作
  const cleanupSlash = client.addSlashCommand({
    name: "schedule",
    description: dict.pillTitle,
    argumentHint: dict.slashHelp,
    context: "agent",
    async onSubmit({ args, agent, rpc }) {
      const currentDict = getI18n();
      const trimmed = args.trim();
      if (!trimmed) {
        throw new Error(currentDict.slashHelp);
      }

      // 子命令: 查看任务列表
      if (trimmed === "list" || trimmed === "ls") {
        const tasks = await rpc(listTasksRpc, { agentId: agent.id });
        if (tasks.length === 0) {
          throw new Error(currentDict.noTasks);
        }
        const lines = tasks.map((t) => {
          const targetDate = new Date(t.triggerAt);
          const remainingMs = targetDate.getTime() - Date.now();
          return currentDict.taskFormat(
            t.id,
            formatDisplayCountdown(targetDate, remainingMs, currentDict),
            t.content,
          );
        });
        throw new Error(`${currentDict.scheduledTasksHeader(tasks.length)}:\n${lines.join("\n")}`);
      }

      // 子命令: 取消任务
      if (trimmed.startsWith("cancel ") || trimmed.startsWith("rm ")) {
        const id = trimmed.split(/\s+/)[1];
        if (!id) throw new Error("ID required. Example: /schedule cancel sched_123");
        const res = await rpc(cancelTaskRpc, { taskId: id });
        if (!res.success) throw new Error(`Not found: [${id}]`);
        return;
      }

      // 添加任务: in <时长> <内容> 或 at <时刻> <内容>
      const match = trimmed.match(/^(?:in|at)\s+(\S+)\s+([\s\S]+)$/i);
      let timeInput: string;
      let contentInput: string;
      if (match) {
        timeInput = match[1];
        contentInput = match[2];
      } else {
        const directMatch = trimmed.match(/^(\S+)\s+([\s\S]+)$/);
        if (!directMatch) {
          throw new Error(currentDict.slashHelp);
        }
        timeInput = directMatch[1];
        contentInput = directMatch[2];
      }

      const parsed = parseTargetTime(timeInput, new Date(), currentDict);
      if (!parsed.valid) {
        throw new Error(parsed.error);
      }

      await rpc(createTaskRpc, {
        agentId: agent.id,
        delayOrTime: timeInput,
        content: contentInput,
      });
    },
  });

  return () => {
    cleanupPills();
    cleanupSlash();
  };
}
