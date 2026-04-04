import { X, Zap, Radio, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

const NETWORK_ITEMS = [
  { icon: Zap, value: "25kV", subKey: "power" as const },
  { icon: Radio, value: "OK", subKey: "signals" as const },
  { icon: Wifi, value: "99%", subKey: "network" as const },
];

interface NetworkStatusOverlayProps {
  onClose?: () => void;
}

export function NetworkStatusOverlay({ onClose }: NetworkStatusOverlayProps) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-xl p-3 min-w-[200px]"
      style={{
        backgroundColor: "var(--bg-overlay)",
        border: "1px solid var(--border-subtle)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--success)" }}
          />
          <span
            className="text-[9px] font-bold tracking-wider uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {t("network.title")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-semibold"
            style={{ color: "var(--success)" }}
          >
            {t("network.allGood")}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ color: "var(--text-muted)" }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {NETWORK_ITEMS.map(({ icon: Icon, value, subKey }) => (
          <div key={subKey} className="flex flex-col items-center gap-0.5">
            <Icon size={14} style={{ color: "var(--success)" }} />
            <span
              className="text-xs font-bold font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </span>
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              {t(`network.${subKey}`)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
