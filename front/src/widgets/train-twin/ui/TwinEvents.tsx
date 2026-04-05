import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { getStompClient } from "@/shared/lib/stomp";
export interface TrainAlertEvent {
  id: string;
  code: string;
  severity: string;
  title: string;
  message: string;
  ts: string;
  trainId: string | null;
}

const MAX_EVENTS = 200;

function severityLevel(
  sev: string,
): "critical" | "warning" | "info" {
  const u = sev.toUpperCase();
  if (u === "CRITICAL" || u === "ERROR") return "critical";
  if (u === "WARNING" || u === "WARN") return "warning";
  return "info";
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function TwinEvents({
  locomotiveId,
}: {
  locomotiveId: string | undefined;
}) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TrainAlertEvent[]>([]);

  const pushEvent = useCallback((raw: {
    code?: string;
    severity?: string;
    title?: string;
    message?: string;
    ts?: string;
    trainId?: string | null;
  }) => {
    const ts = raw.ts ?? new Date().toISOString();
    const id = `${ts}-${raw.code ?? "evt"}-${Math.random().toString(36).slice(2, 9)}`;
    setEvents((prev) => {
      const next: TrainAlertEvent[] = [
        {
          id,
          code: raw.code ?? "—",
          severity: raw.severity ?? "INFO",
          title: raw.title ?? "",
          message: raw.message ?? "",
          ts,
          trainId: raw.trainId ?? null,
        },
        ...prev,
      ];
      if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!locomotiveId) return;

    const stomp = getStompClient();
    const topic = `/topic/train/${locomotiveId}/alerts`;

    let sub: { unsubscribe: () => void } | null = null;

    const handler = (msg: { body: string }) => {
      try {
        const raw = JSON.parse(msg.body) as Record<string, unknown>;
        pushEvent({
          code: typeof raw.code === "string" ? raw.code : undefined,
          severity: typeof raw.severity === "string" ? raw.severity : undefined,
          title: typeof raw.title === "string" ? raw.title : undefined,
          message: typeof raw.message === "string" ? raw.message : undefined,
          ts:
            typeof raw.ts === "string"
              ? raw.ts
              : typeof raw.ts === "number" && Number.isFinite(raw.ts)
                ? new Date(raw.ts).toISOString()
                : undefined,
          trainId:
            typeof raw.trainId === "string"
              ? raw.trainId
              : raw.trainId === null
                ? null
                : undefined,
        });
      } catch {
        /* ignore */
      }
    };

    sub = stomp.subscribe(topic, handler);

    return () => {
      sub?.unsubscribe();
    };
  }, [locomotiveId, pushEvent]);

  if (!locomotiveId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 min-h-0">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("twin.events.noTrain")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div
        className="flex items-center gap-2 px-5 py-3 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}
      >
        <Activity size={16} style={{ color: "var(--accent-primary)" }} />
        <div className="flex flex-col min-w-0 gap-0.5">
          <span
            className="text-[9px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {t("twin.events.title")}
          </span>
          <span className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
            {t("twin.events.subtitle")}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-16 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="text-sm">{t("twin.events.empty")}</span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((ev) => {
              const level = severityLevel(ev.severity);
              const color =
                level === "critical"
                  ? "var(--danger)"
                  : level === "warning"
                    ? "var(--warning)"
                    : "var(--info)";
              return (
                <li
                  key={ev.id}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--border-subtle)",
                    backgroundColor: "var(--bg-panel)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 gap-y-1 flex-wrap">
                    <span
                      className="text-[10px] font-mono tabular-nums shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatEventTime(ev.ts)}
                    </span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded shrink-0"
                      style={{
                        color,
                        backgroundColor: `${color}18`,
                      }}
                    >
                      {ev.severity}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {ev.title || ev.code}
                  </div>
                  {ev.message ? (
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {ev.message}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                    <span>
                      {t("twin.events.code")}: {ev.code}
                    </span>
                    {ev.trainId ? (
                      <span>
                        {t("twin.events.trainId")}: {ev.trainId}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
