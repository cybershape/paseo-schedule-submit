import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const scheduledTaskSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  workspaceId: z.string().optional(),
  content: z.string(),
  createdAt: z.string(),
  triggerAt: z.string(), // ISO string
  rawTimeInput: z.string(),
});

export type ScheduledTask = z.infer<typeof scheduledTaskSchema>;

// Create scheduled task
export const createTaskRpc = defineRpc({
  name: "schedule.create",
  input: z.object({
    agentId: z.string().min(1),
    workspaceId: z.string().optional(),
    delayOrTime: z.string().min(1),
    content: z.string().min(1),
  }),
  output: scheduledTaskSchema,
});

// List scheduled tasks
export const listTasksRpc = defineRpc({
  name: "schedule.list",
  input: z.object({
    agentId: z.string().optional(),
  }),
  output: z.array(scheduledTaskSchema),
});

// Cancel scheduled task
export const cancelTaskRpc = defineRpc({
  name: "schedule.cancel",
  input: z.object({
    taskId: z.string().min(1),
  }),
  output: z.object({
    success: z.boolean(),
  }),
});
