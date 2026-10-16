import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const scheduledTaskSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  triggerAt: z.string(), // ISO string
  rawTimeInput: z.string(),
});

export type ScheduledTask = z.infer<typeof scheduledTaskSchema>;

// 创建定时任务
export const createTaskRpc = defineRpc({
  name: "schedule.create",
  input: z.object({
    agentId: z.string().min(1),
    delayOrTime: z.string().min(1),
    content: z.string().min(1),
  }),
  output: scheduledTaskSchema,
});

// 查询定时任务列表
export const listTasksRpc = defineRpc({
  name: "schedule.list",
  input: z.object({
    agentId: z.string().optional(),
  }),
  output: z.array(scheduledTaskSchema),
});

// 取消定时任务
export const cancelTaskRpc = defineRpc({
  name: "schedule.cancel",
  input: z.object({
    taskId: z.string().min(1),
  }),
  output: z.object({
    success: z.boolean(),
  }),
});
