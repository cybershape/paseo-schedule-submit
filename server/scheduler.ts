import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { ScheduledTask } from "../shared/contracts";
import { parseTargetTime } from "../shared/time";

type PaseoApi = PluginHandlerContext["paseo"];

interface ActiveJob {
  task: ScheduledTask;
  timer: NodeJS.Timeout;
}

export class TaskScheduler {
  private jobs = new Map<string, ActiveJob>();
  private counter = 0;
  private paseoClient: PaseoApi | null = null;
  public onTasksChange?: (agentId?: string) => void;

  setPaseoClient(client: PaseoApi) {
    this.paseoClient = client;
  }

  create(agentId: string, delayOrTime: string, content: string, paseoOverride?: PaseoApi): ScheduledTask {
    const parsed = parseTargetTime(delayOrTime);
    if (!parsed.valid) {
      throw new Error(parsed.error);
    }

    const client = paseoOverride || this.paseoClient;
    if (!client) {
      throw new Error("Paseo client is not ready");
    }

    const id = `sched_${Date.now()}_${++this.counter}`;
    const task: ScheduledTask = {
      id,
      agentId,
      content,
      createdAt: new Date().toISOString(),
      triggerAt: parsed.targetDate.toISOString(),
      rawTimeInput: delayOrTime,
    };

    const timer = setTimeout(async () => {
      this.jobs.delete(id);
      this.onTasksChange?.(agentId);
      try {
        console.log(`[paseo-schedule-submit] Triggered task [${id}] for agent [${agentId}]`);
        await client.agents.ref(agentId).send(content);
      } catch (err: any) {
        console.error(`[paseo-schedule-submit] Task [${id}] execution failed:`, err?.message || err);
      }
    }, parsed.delayMs);

    this.jobs.set(id, { task, timer });
    this.onTasksChange?.(agentId);
    return task;
  }

  list(agentId?: string): ScheduledTask[] {
    const all = Array.from(this.jobs.values()).map((j) => j.task);
    if (!agentId) return all;
    return all.filter((t) => t.agentId === agentId);
  }

  cancel(taskId: string): boolean {
    const job = this.jobs.get(taskId);
    if (!job) return false;
    clearTimeout(job.timer);
    this.jobs.delete(taskId);
    this.onTasksChange?.(job.task.agentId);
    return true;
  }

  dispose() {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
    }
    this.jobs.clear();
  }
}
