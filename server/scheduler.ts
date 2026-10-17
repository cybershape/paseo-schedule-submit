import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { ScheduledTask } from "../shared/contracts";
import { parseTargetTime } from "../shared/time";

type PaseoApi = PluginHandlerContext["paseo"];

interface ActiveJob {
  task: ScheduledTask;
  timer: NodeJS.Timeout;
}

export interface TaskSchedulerOptions {
  baseDir?: string;
  gracePeriodMs?: number;
  workspaceLabelSetter?: (workspaceId: string, assigned: boolean) => Promise<void> | void;
}

export class TaskScheduler {
  private jobs = new Map<string, ActiveJob>();
  private pendingDispatches: ScheduledTask[] = [];
  private counter = 0;
  private paseoClient: PaseoApi | null = null;
  private agentsDir: string;
  private gracePeriodMs: number;
  private customWorkspaceLabelSetter?: (workspaceId: string, assigned: boolean) => Promise<void> | void;
  public onTasksChange?: (agentId?: string) => void;

  constructor(options?: TaskSchedulerOptions) {
    const paseoHome = process.env.PASEO_HOME || path.join(os.homedir(), ".paseo");
    this.agentsDir = options?.baseDir || path.join(paseoHome, "plugins-data", "paseo-schedule-submit", "agents");
    this.gracePeriodMs = options?.gracePeriodMs ?? 5 * 60 * 1000;
    this.customWorkspaceLabelSetter = options?.workspaceLabelSetter;
  }

  setPaseoClient(client: PaseoApi) {
    this.paseoClient = client;
    this.flushPendingDispatches();
  }

  getAgentsDir(): string {
    return this.agentsDir;
  }

  private getAgentFilePath(agentId: string): string {
    return path.join(this.agentsDir, `${encodeURIComponent(agentId)}.json`);
  }

  async init(client?: PaseoApi): Promise<void> {
    if (client) {
      this.setPaseoClient(client);
    }

    try {
      await fs.mkdir(this.agentsDir, { recursive: true });
      const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
      const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

      for (const file of jsonFiles) {
        const filePath = path.join(this.agentsDir, file.name);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const tasks: ScheduledTask[] = JSON.parse(raw);
          if (!Array.isArray(tasks) || tasks.length === 0) {
            await fs.unlink(filePath).catch(() => {});
            continue;
          }

          const agentId = tasks[0].agentId;
          let hasExpired = false;

          for (const task of tasks) {
            const targetTime = new Date(task.triggerAt).getTime();
            const now = Date.now();
            const remainingMs = targetTime - now;

            if (remainingMs > 0) {
              this.scheduleJob(task, remainingMs);
            } else if (now - targetTime <= this.gracePeriodMs) {
              console.log(`[paseo-schedule-submit] Task [${task.id}] in grace period, dispatching immediately`);
              await this.executeOrQueue(task);
              hasExpired = true;
            } else {
              console.warn(`[paseo-schedule-submit] Task [${task.id}] expired during downtime (> ${this.gracePeriodMs}ms), skipping`);
              hasExpired = true;
            }
          }

          if (hasExpired) {
            await this.persistAgentTasks(agentId);
          }
        } catch (fileErr) {
          console.error(`[paseo-schedule-submit] Failed to load agent task file [${file.name}]:`, fileErr);
        }
      }

      // 恢复完成后同步所有涉及到的工作区标签
      const allWorkspaces = new Set<string>();
      for (const job of this.jobs.values()) {
        if (job.task.workspaceId) allWorkspaces.add(job.task.workspaceId);
      }
      for (const task of this.pendingDispatches) {
        if (task.workspaceId) allWorkspaces.add(task.workspaceId);
      }
      for (const wsId of allWorkspaces) {
        await this.updateWorkspaceLabel(wsId);
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error("[paseo-schedule-submit] Failed to initialize task storage:", err);
      }
    }
  }

  private scheduleJob(task: ScheduledTask, delayMs: number) {
    const timer = setTimeout(async () => {
      this.jobs.delete(task.id);
      await this.persistAgentTasks(task.agentId);
      this.onTasksChange?.(task.agentId);
      if (task.workspaceId) {
        await this.updateWorkspaceLabel(task.workspaceId);
      }
      await this.executeOrQueue(task);
    }, delayMs);

    this.jobs.set(task.id, { task, timer });
  }

  private async executeOrQueue(task: ScheduledTask): Promise<void> {
    if (this.paseoClient) {
      await this.dispatchTask(task, this.paseoClient);
    } else {
      console.log(`[paseo-schedule-submit] Paseo client not ready, queuing task [${task.id}] for agent [${task.agentId}]`);
      this.pendingDispatches.push(task);
    }
  }

  private async flushPendingDispatches(): Promise<void> {
    if (!this.paseoClient || this.pendingDispatches.length === 0) return;
    const tasksToDispatch = [...this.pendingDispatches];
    this.pendingDispatches = [];
    for (const task of tasksToDispatch) {
      await this.dispatchTask(task, this.paseoClient);
    }
  }

  private async dispatchTask(task: ScheduledTask, client: PaseoApi): Promise<void> {
    try {
      console.log(`[paseo-schedule-submit] Triggered task [${task.id}] for agent [${task.agentId}]`);
      await client.agents.ref(task.agentId).send(task.content);
    } catch (err: any) {
      console.error(`[paseo-schedule-submit] Task [${task.id}] execution failed:`, err?.message || err);
    }
  }

  private async persistAgentTasks(agentId: string): Promise<void> {
    const activeTasks = Array.from(this.jobs.values())
      .filter((j) => j.task.agentId === agentId)
      .map((j) => j.task);

    const filePath = this.getAgentFilePath(agentId);
    if (activeTasks.length === 0) {
      try {
        await fs.unlink(filePath);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          console.error(`[paseo-schedule-submit] Failed to remove empty task file for agent [${agentId}]:`, err);
        }
      }
      return;
    }

    try {
      await fs.mkdir(this.agentsDir, { recursive: true });
      const tempPath = `${filePath}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(activeTasks, null, 2), "utf-8");
      await fs.rename(tempPath, filePath);
    } catch (err) {
      console.error(`[paseo-schedule-submit] Failed to write task file for agent [${agentId}]:`, err);
    }
  }

  async archiveAgent(agentId: string): Promise<void> {
    const affectedWorkspaces = new Set<string>();

    for (const [id, job] of this.jobs.entries()) {
      if (job.task.agentId === agentId) {
        clearTimeout(job.timer);
        this.jobs.delete(id);
        if (job.task.workspaceId) {
          affectedWorkspaces.add(job.task.workspaceId);
        }
      }
    }

    this.pendingDispatches = this.pendingDispatches.filter((t) => {
      if (t.agentId === agentId) {
        if (t.workspaceId) affectedWorkspaces.add(t.workspaceId);
        return false;
      }
      return true;
    });

    const filePath = this.getAgentFilePath(agentId);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error(`[paseo-schedule-submit] Failed to delete task file for archived agent [${agentId}]:`, err);
      }
    }

    this.onTasksChange?.(agentId);
    for (const wsId of affectedWorkspaces) {
      await this.updateWorkspaceLabel(wsId);
    }
  }

  async create(agentId: string, delayOrTime: string, content: string, workspaceId?: string, paseoOverride?: PaseoApi): Promise<ScheduledTask> {
    const parsed = parseTargetTime(delayOrTime);
    if (!parsed.valid) {
      throw new Error(parsed.error);
    }

    if (paseoOverride) {
      this.setPaseoClient(paseoOverride);
    }

    // 若未传入 workspaceId，尝试通过 PaseoClient 自动解析
    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId && this.paseoClient) {
      try {
        const refreshed = await this.paseoClient.agents.ref(agentId).refresh();
        resolvedWorkspaceId = refreshed?.agent.workspaceId ?? undefined;
      } catch (err: any) {
        console.warn(`[paseo-schedule-submit] Could not resolve workspaceId for agent [${agentId}]:`, err?.message || err);
      }
    }

    const id = `sched_${Date.now()}_${++this.counter}`;
    const task: ScheduledTask = {
      id,
      agentId,
      workspaceId: resolvedWorkspaceId,
      content,
      createdAt: new Date().toISOString(),
      triggerAt: parsed.targetDate.toISOString(),
      rawTimeInput: delayOrTime,
    };

    this.scheduleJob(task, parsed.delayMs);
    await this.persistAgentTasks(agentId);
    this.onTasksChange?.(agentId);

    if (resolvedWorkspaceId) {
      await this.updateWorkspaceLabel(resolvedWorkspaceId);
    }

    return task;
  }

  list(agentId?: string): ScheduledTask[] {
    const allJobs = Array.from(this.jobs.values()).map((j) => j.task);
    const allPending = this.pendingDispatches;
    const combined = [...allJobs, ...allPending];
    if (!agentId) return combined;
    return combined.filter((t) => t.agentId === agentId);
  }

  async cancel(taskId: string): Promise<boolean> {
    let cancelledTask: ScheduledTask | undefined;

    const job = this.jobs.get(taskId);
    if (job) {
      clearTimeout(job.timer);
      this.jobs.delete(taskId);
      cancelledTask = job.task;
    }

    const pendingIndex = this.pendingDispatches.findIndex((t) => t.id === taskId);
    if (pendingIndex !== -1) {
      cancelledTask = this.pendingDispatches[pendingIndex];
      this.pendingDispatches.splice(pendingIndex, 1);
    }

    if (!cancelledTask) return false;

    await this.persistAgentTasks(cancelledTask.agentId);
    this.onTasksChange?.(cancelledTask.agentId);

    if (cancelledTask.workspaceId) {
      await this.updateWorkspaceLabel(cancelledTask.workspaceId);
    }

    return true;
  }

  getActiveTaskCountForWorkspace(workspaceId: string): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.task.workspaceId === workspaceId) count++;
    }
    for (const task of this.pendingDispatches) {
      if (task.workspaceId === workspaceId) count++;
    }
    return count;
  }

  async updateWorkspaceLabel(workspaceId: string): Promise<void> {
    const count = this.getActiveTaskCountForWorkspace(workspaceId);
    const assigned = count > 0;
    await this.setWorkspaceLabel(workspaceId, assigned);
  }

  async setWorkspaceLabel(workspaceId: string, assigned: boolean): Promise<void> {
    console.log(`[paseo-schedule-submit] Setting workspace label: workspaceId=${workspaceId}, assigned=${assigned}`);

    if (this.customWorkspaceLabelSetter) {
      await this.customWorkspaceLabelSetter(workspaceId, assigned);
      return;
    }

    if (typeof process !== "undefined" && typeof process.send === "function") {
      try {
        const payload = {
          type: "session",
          message: {
            type: "workspace.label.assignment.set.request",
            requestId: `req_label_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            workspaceId,
            label: {
              name: "schedule",
              color: "blue",
            },
            assigned,
          },
        };
        process.send({
          type: "paseo_frame",
          data: JSON.stringify(payload),
          isBinary: false,
        });
        console.log(`[paseo-schedule-submit] Dispatched workspace label frame for [${workspaceId}] (assigned=${assigned})`);
      } catch (err) {
        console.error(`[paseo-schedule-submit] Failed to send workspace label frame for workspace [${workspaceId}]:`, err);
      }
    } else {
      console.warn(`[paseo-schedule-submit] process.send is not available in current environment`);
    }
  }

  dispose() {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
    }
    this.jobs.clear();
    this.pendingDispatches = [];
  }
}
