import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { getI18n } from "../shared/i18n";
import { SchedulePopover } from "./popover";

type Agent = Awaited<ReturnType<PluginClientContext["paseo"]["agents"]["list"]>>["entries"][number]["agent"];

export function contributeComposerPills(client: PluginClientContext) {
  const pills = new Map<string, PluginButtonRegistration>();
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

    pills.set(agent.id, pill);
  };

  const remove = (agentId: string) => {
    pills.get(agentId)?.remove();
    pills.delete(agentId);
  };

  const removeAll = () => {
    for (const pill of pills.values()) pill.remove();
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
