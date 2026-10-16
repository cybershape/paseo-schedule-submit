import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { listTasksRpc } from "../shared/contracts";
import { getI18n } from "../shared/i18n";
import { SchedulePopover } from "./popover";

type Agent = Awaited<ReturnType<PluginClientContext["paseo"]["agents"]["list"]>>["entries"][number]["agent"];

export function contributeComposerPills(client: PluginClientContext) {
  const pills = new Map<string, { registration: PluginButtonRegistration; dispose: () => void }>();
  const lifetime = new AbortController();

  const register = (agent: Agent) => {
    if (lifetime.signal.aborted || !agent.workspaceId || pills.has(agent.id)) return;
    const dict = getI18n();

    const pill = client.addComposerPill({
      id: "schedule-submit",
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      button: {
        title: dict.pillTitle,
        icon: "Clock",
        label: dict.pillLabel,
        behavior: {
          kind: "popover",
          Content: SchedulePopover,
        },
      },
    });

    let disposed = false;

    // Poll task count and update pill label: "Schedule" -> "Schedule(n)" when n > 0.
    const refresh = async () => {
      try {
        const tasks = await client.rpc(listTasksRpc, { agentId: agent.id });
        if (disposed || lifetime.signal.aborted) return;
        const currentDict = getI18n();
        pill.update({
          label: tasks.length > 0 ? currentDict.pillLabelWithCount(tasks.length) : currentDict.pillLabel,
        });
      } catch {
        // Ignore transient RPC errors (server not ready, agent removed, etc.).
      }
    };

    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    // Unref the timer in Node-like runtimes so it never keeps the process alive.
    (timer as unknown as { unref?: () => void }).unref?.();

    pills.set(agent.id, {
      registration: pill,
      dispose: () => {
        disposed = true;
        clearInterval(timer);
        pill.remove();
      },
    });
  };

  const remove = (agentId: string) => {
    pills.get(agentId)?.dispose();
    pills.delete(agentId);
  };

  const removeAll = () => {
    for (const entry of pills.values()) entry.dispose();
    pills.clear();
  };

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          removeAll();
          for (const { agent } of entries) register(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "remove") {
            remove(update.agentId);
          } else {
            register(update.agent);
          }
        },
      });
      return undefined;
    })
    .catch((error: unknown) => {
      if (!lifetime.signal.aborted) {
        console.error("[paseo-schedule-submit] Failed to watch agents", error);
      }
    });

  return () => {
    lifetime.abort();
    removeAll();
  };
}
