import type { PluginButtonContentProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Icon, ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { cancelTaskRpc, createTaskRpc, listTasksRpc } from "../shared/contracts";
import { getI18n } from "../shared/i18n";
import { formatDisplayCountdown, parseTargetTime } from "../shared/time";
import { inputStyle, radius } from "./ui";

const PRESETS = ["1m", "5m", "15m", "30m", "1h", "2h"];

export function SchedulePopover({ theme, layout, close, ...target }: PluginButtonContentProps) {
  const colors = theme.colors;
  const toast = useToast();
  const queryClient = useQueryClient();
  const dict = useMemo(() => getI18n(), []);

  if (target.context !== "agent") {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: colors.statusDanger, fontSize: 13 }}>
          {dict.agentContextError}
        </Text>
      </View>
    );
  }

  const agentId = target.agentId;

  const listTasks = useRpc(listTasksRpc);
  const createTask = useRpc(createTaskRpc);
  const cancelTask = useRpc(cancelTaskRpc);

  // 1. 打开时默认不选中任何 preset，输入框为空
  const [delayInput, setDelayInput] = useState("");
  const [content, setContent] = useState("");

  // 2. 每秒刷新当前时间戳，驱动已存在任务的倒计时每秒更新
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 查询当前 Agent 待执行的任务
  const tasksQuery = useQuery({
    queryKey: ["scheduled-tasks", agentId],
    queryFn: () => listTasks({ agentId }),
    refetchInterval: 3000,
  });

  // 实时解析时间输入并展示预览
  const timePreview = useMemo(() => {
    if (!delayInput.trim()) return null;
    return parseTargetTime(delayInput, new Date(now), dict);
  }, [delayInput, now, dict]);

  // 创建定时任务
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error(dict.emptyContentError);
      if (!timePreview || !timePreview.valid) {
        throw new Error(timePreview ? timePreview.error : dict.timeRequiredError);
      }
      return await createTask({
        agentId,
        delayOrTime: delayInput.trim(),
        content: content.trim(),
      });
    },
    onSuccess: () => {
      toast.show(dict.createdSuccess, { variant: "success" });
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks", agentId] });
    },
    onError: (err: any) => {
      toast.show(err.message || dict.cancelFail, { variant: "error" });
    },
  });

  // 取消任务
  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await cancelTask({ taskId });
    },
    onSuccess: () => {
      toast.show(dict.cancelledSuccess, { variant: "info" });
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks", agentId] });
    },
  });

  const tasks = tasksQuery.data ?? [];

  return (
    <View
      style={{
        width: layout.compact ? "100%" : 320,
        maxHeight: layout.compact ? undefined : 480,
        gap: 10,
        padding: 4,
      }}
    >
      {/* 头部标题与关闭按钮 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="Clock" size={15} color={colors.accent} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
            {dict.dialogTitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dict.close}
          onPress={close}
          style={({ pressed }) => ({
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: 4,
            backgroundColor: pressed ? colors.surface2 : "transparent",
          })}
        >
          <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>{dict.close}</Text>
        </Pressable>
      </View>

      {/* 快捷预设按钮组（打开时不默认选中任何一项） */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {PRESETS.map((p) => {
          const selected = delayInput.trim() === p;
          return (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={`+${p}`}
              onPress={() => setDelayInput(p)}
              style={({ pressed }) => ({
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: radius - 2,
                backgroundColor: selected ? colors.accent : pressed ? colors.surface2 : colors.surface1,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
              })}
            >
              <Text
                style={{
                  color: selected ? colors.accentForeground : colors.foreground,
                  fontSize: 12,
                  fontWeight: selected ? "600" : "400",
                }}
              >
                +{p}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 时间输入与提示 */}
      <View style={{ gap: 3 }}>
        <TextInput
          accessibilityLabel="Schedule time"
          value={delayInput}
          onChangeText={setDelayInput}
          placeholder={dict.timePlaceholder}
          placeholderTextColor={colors.foregroundMuted}
          style={{ ...inputStyle(colors), paddingVertical: 6, fontSize: 12 }}
        />

        {/* 输入格式提示：位于输入框下方，字体稍小 (fontSize: 10) */}
        <Text style={{ color: colors.foregroundMuted, fontSize: 10, paddingHorizontal: 2 }}>
          {dict.timeHint}
        </Text>

        {/* 预计触发时间或错误提示 */}
        {timePreview && (
          timePreview.valid ? (
            <Text style={{ color: colors.statusSuccess, fontSize: 11, paddingHorizontal: 2 }}>
              ✓ {dict.expectedPrefix}{timePreview.displayText}
            </Text>
          ) : (
            <Text style={{ color: colors.statusDanger, fontSize: 11, paddingHorizontal: 2 }}>
              ⚠ {timePreview.error}
            </Text>
          )
        )}
      </View>

      {/* 内容多行输入框 */}
      <View style={{ gap: 4 }}>
        <TextInput
          accessibilityLabel="Schedule content"
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={3}
          placeholder={dict.contentPlaceholder}
          placeholderTextColor={colors.foregroundMuted}
          style={{
            ...inputStyle(colors),
            minHeight: 70,
            paddingVertical: 6,
            fontSize: 12,
            textAlignVertical: "top",
          }}
        />
      </View>

      {/* 提交添加按钮 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dict.submitBtn}
        disabled={createMutation.isPending || !timePreview?.valid || !content.trim()}
        onPress={() => createMutation.mutate()}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          borderRadius: radius - 2,
          paddingVertical: 7,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 6,
          opacity: createMutation.isPending || !timePreview?.valid || !content.trim() ? 0.45 : pressed ? 0.8 : 1,
        })}
      >
        <Icon name="Send" size={13} color={colors.accentForeground} />
        <Text style={{ color: colors.accentForeground, fontWeight: "600", fontSize: 12 }}>
          {createMutation.isPending ? dict.submitting : dict.submitBtn}
        </Text>
      </Pressable>

      {/* 当前 Agent 的定时任务列表：每秒基于 now 刷新剩余时间 */}
      {tasks.length > 0 && (
        <View style={{ marginTop: 4, gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <Text style={{ color: colors.foregroundMuted, fontSize: 11, fontWeight: "600" }}>
            {dict.scheduledTasksHeader(tasks.length)}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 150, minHeight: 0 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {tasks.map((task) => {
              const targetDate = new Date(task.triggerAt);
              const remainingMs = targetDate.getTime() - now;
              const timeDisplay = formatDisplayCountdown(targetDate, remainingMs, dict);

              return (
                <View
                  key={task.id}
                  style={{
                    backgroundColor: colors.surface1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius - 2,
                    padding: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: colors.accent, fontSize: 11, fontWeight: "600" }}>
                      ⏰ {timeDisplay}
                    </Text>
                    <Text numberOfLines={2} style={{ color: colors.foreground, fontSize: 12 }}>
                      {task.content}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel task"
                    onPress={() => cancelMutation.mutate(task.id)}
                    disabled={cancelMutation.isPending}
                    style={({ pressed }) => ({
                      padding: 4,
                      borderRadius: 4,
                      backgroundColor: pressed ? colors.surface2 : "transparent",
                    })}
                  >
                    <Icon name="Trash2" size={13} color={colors.statusDanger} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
