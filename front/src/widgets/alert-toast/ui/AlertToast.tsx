import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, X, Zap } from "lucide-react";
import { getStompClient } from "@/shared/lib/stomp";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useAlertHistoryStore } from "@/entities/alert/model/historyStore";
import { useAlertToastStore, type AlertToastItem } from "../model/store";

const AUTO_DISMISS_MS = 8000;

interface WsAlert {
  locomotiveId: string;
  trainId: string | null;
  code: string;
  severity: string;
  title: string;
  message: string;
  ts: string;
}

let subscribed = false;

export function useFleetAlertSubscription() {
  useEffect(() => {
    if (subscribed) return;
    subscribed = true;

    const stomp = getStompClient();

    const trySubscribe = () => {
      stomp.subscribe("/topic/fleet-alerts", (msg) => {
        try {
          const alert: WsAlert = JSON.parse(msg.body);
          useAlertToastStore.getState().push({
            locomotiveId: alert.locomotiveId,
            trainId: alert.trainId,
            code: alert.code,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            ts: alert.ts,
          });
          useAlertHistoryStore.getState().push({
            locomotiveId: alert.locomotiveId,
            trainId: alert.trainId,
            code: alert.code,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            ts: alert.ts,
          });
        } catch {
          /* ignore malformed frames */
        }
      });
    };

    if (stomp.connected) {
      trySubscribe();
    } else {
      const orig = stomp.onConnect;
      stomp.onConnect = (frame) => {
        orig?.(frame);
        trySubscribe();
      };
    }
  }, []);
}

function ToastCard({
  toast,
  onDismiss,
  onNavigate,
}: {
  toast: AlertToastItem;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const tid = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(tid);
  }, [onDismiss]);

  const displayName = toast.trainId ?? toast.locomotiveId;

  return (
    <div
      className="relative flex gap-3 p-3 rounded-lg border animate-in slide-in-from-right"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "rgba(244,63,94,0.35)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 0 12px rgba(244,63,94,0.15)",
        maxWidth: 360,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="w-0.5 rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: "#f43f5e" }}
      />

      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Zap size={12} style={{ color: "#f43f5e" }} />
            <span
              className="text-[9px] font-bold tracking-wider uppercase"
              style={{ color: "#f43f5e" }}
            >
              {t("alerts.severityCritical")}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-0.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={12} />
          </button>
        </div>

        <span
          className="text-xs font-bold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {displayName}
        </span>

        <span
          className="text-[10px] leading-tight"
          style={{ color: "var(--text-secondary)" }}
        >
          {toast.title}
        </span>

        <span
          className="text-[9px] leading-tight"
          style={{ color: "var(--text-muted)" }}
        >
          {toast.message}
        </span>

        <button
          type="button"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded self-start transition-all hover:opacity-80"
          style={{
            backgroundColor: "rgba(244,63,94,0.15)",
            color: "#f43f5e",
            border: "1px solid rgba(244,63,94,0.3)",
          }}
        >
          <ExternalLink size={9} />
          {t("alerts.openTwin")}
        </button>
      </div>
    </div>
  );
}

export function AlertToastContainer() {
  const toasts = useAlertToastStore((s) => s.toasts);
  const dismiss = useAlertToastStore((s) => s.dismiss);
  const navigate = useTrainSelectionStore((s) => s.setSelectedTrain);

  useFleetAlertSubscription();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto"
      style={{ minWidth: 280 }}
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => dismiss(toast.id)}
          onNavigate={() => {
            dismiss(toast.id);
            navigate(toast.trainId ?? toast.locomotiveId);
          }}
        />
      ))}
    </div>
  );
}
