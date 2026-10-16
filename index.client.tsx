import type { PluginClientContext } from "@getpaseo/plugin/client";
import { contributeComposerPills } from "./client/pill";
import { cancelTaskRpc, createTaskRpc, listTasksRpc } from "./shared/contracts";
import { getI18n } from "./shared/i18n";
import { formatDisplayCountdown, parseTargetTime } from "./shared/time";

export default function contribute(client: PluginClientContext) {
  const dict = getI18n();

  // 1. Register Composer Pill button and popover panel
  const cleanupPills = contributeComposerPills(client);

  // 2. Register Slash Command: /schedule for keyboard workflows
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

      // Subcommand: list scheduled tasks
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

      // Subcommand: cancel task
      if (trimmed.startsWith("cancel ") || trimmed.startsWith("rm ")) {
        const id = trimmed.split(/\s+/)[1];
        if (!id) throw new Error("ID required. Example: /schedule cancel sched_123");
        const res = await rpc(cancelTaskRpc, { taskId: id });
        if (!res.success) throw new Error(`Not found: [${id}]`);
        return;
      }

      // Add task: in <duration> <message> or at <time> <message>
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
