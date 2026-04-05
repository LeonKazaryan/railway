import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight, ExternalLink, LayoutGrid, LayoutList, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  useFleetLiveStore,
  useFleetTrains,
  type WsTrainState,
} from "@/features/fleet-live/model/store";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import {
  EMPTY_ALERT_HISTORY,
  useAlertHistoryStore,
} from "@/entities/alert/model/historyStore";
import { TRAIN_MODEL_ASSETS, TRAIN_STATUS_CONFIG } from "@/entities/train/model/config";
import type { Train, TrainStatus, TrainModel } from "@/entities/train/model/types";
import { HealthGauge } from "./HealthGauge";

type ViewMode = "table" | "cards";

const STATUS_ORDER: Record<TrainStatus, number> = {
  critical: 0,
  warning: 1,
  no_signal: 2,
  normal: 3,
};

export function TrainListPage() {
  const { t } = useTranslation();
  const trains = useFleetTrains();
  const wsMap = useFleetLiveStore((s) => s.trains);
  const setSelectedTrain = useTrainSelectionStore((s) => s.setSelectedTrain);

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TrainStatus | "all">("all");
  const [filterModel, setFilterModel] = useState<TrainModel | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = [...trains];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.route.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q),
      );
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }
    if (filterModel !== "all") {
      result = result.filter((t) => t.model === filterModel);
    }

    result.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    return result;
  }, [trains, search, filterStatus, filterModel]);

  const selectedWs = selectedId ? wsMap.get(selectedId) : undefined;
  const selectedTrain = selectedId
    ? trains.find((t) => t.id === selectedId)
    : undefined;

  const models = useMemo(
    () => [...new Set(trains.map((t) => t.model))] as TrainModel[],
    [trains],
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0 flex-wrap gap-y-2"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("trainList.searchPlaceholder")}
          className="h-8 px-3 rounded-lg border text-xs outline-none w-48 transition-colors"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TrainStatus | "all")}
          className="h-8 px-2 rounded-lg border text-xs outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          <option value="all">{t("trainList.filterAllStatuses")}</option>
          <option value="normal">{t("trainStatus.normal")}</option>
          <option value="warning">{t("trainStatus.warning")}</option>
          <option value="critical">{t("trainStatus.critical")}</option>
          <option value="no_signal">{t("trainStatus.no_signal")}</option>
        </select>

        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value as TrainModel | "all")}
          className="h-8 px-2 rounded-lg border text-xs outline-none cursor-pointer"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-primary)",
          }}
        >
          <option value="all">{t("trainList.filterAllModels")}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <span
          className="text-xs ml-1"
          style={{ color: "var(--text-muted)" }}
        >
          {t("trainList.showing", { count: filtered.length, total: trains.length })}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              viewMode === "table"
                ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <LayoutList size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              viewMode === "cards"
                ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {viewMode === "table" ? (
            <TrainTable
              trains={filtered}
              wsMap={wsMap}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <TrainCards
              trains={filtered}
              wsMap={wsMap}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {selectedId && selectedTrain && (
          <TrainQuickView
            train={selectedTrain}
            ws={selectedWs}
            onClose={() => setSelectedId(null)}
            onOpenTwin={() => setSelectedTrain(selectedId)}
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TrainStatus }) {
  const { t } = useTranslation();
  const cfg = TRAIN_STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: `var(${cfg.cssVar})`,
        backgroundColor: `color-mix(in srgb, var(${cfg.cssVar}) 14%, transparent)`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
        style={{ backgroundColor: `var(${cfg.cssVar})` }}
      />
      {t(`trainStatus.${status}`)}
    </span>
  );
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--danger)";
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold border-2"
      style={{ color, borderColor: color }}
    >
      {score}
    </span>
  );
}

function LastAlertCell({ ws }: { ws: WsTrainState | undefined }) {
  const { t } = useTranslation();
  const alerts = useAlertHistoryStore((s) =>
    ws
      ? (s.byTrain.get(ws.locomotiveId) ?? EMPTY_ALERT_HISTORY)
      : EMPTY_ALERT_HISTORY,
  );

  const faultCode = ws?.faultCodes?.[0] ?? null;
  const historyAlert = alerts[0] ?? null;

  if (faultCode) {
    const label =
      faultCode in (t("faultCodes", { returnObjects: true }) as Record<string, string>)
        ? t(`faultCodes.${faultCode}`)
        : faultCode;
    return (
      <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--warning)" }}>
        <AlertTriangle size={10} />
        <span className="truncate max-w-[160px]">{label}</span>
      </span>
    );
  }

  if (historyAlert) {
    const severityColor =
      historyAlert.severity === "critical"
        ? "var(--danger)"
        : historyAlert.severity === "warning"
          ? "var(--warning)"
          : "var(--text-muted)";
    return (
      <span
        className="flex items-center gap-1 text-[11px] truncate max-w-[160px]"
        style={{ color: severityColor }}
      >
        <AlertTriangle size={10} />
        <span className="truncate">{historyAlert.title}</span>
      </span>
    );
  }

  return <span style={{ color: "var(--text-muted)" }}>—</span>;
}

interface ListProps {
  trains: Train[];
  wsMap: Map<string, WsTrainState>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function TrainTable({ trains, wsMap, selectedId, onSelect }: ListProps) {
  const { t } = useTranslation();

  const cols = [
    t("trainList.colTrain"),
    t("trainList.colModel"),
    t("trainList.colStatus"),
    t("trainList.colHealth"),
    t("trainList.colSpeed"),
    t("trainList.colRoute"),
    t("trainList.colLastAlert"),
    t("trainList.colUpdated"),
  ];

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr
          className="sticky top-0 z-10"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {cols.map((col) => (
            <th
              key={col}
              className="text-left px-4 py-2.5 font-semibold tracking-wider uppercase text-[10px] whitespace-nowrap"
              style={{ color: "var(--text-muted)" }}
            >
              {col}
            </th>
          ))}
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {trains.map((train) => {
          const ws = wsMap.get(train.id);
          const isSelected = selectedId === train.id;
          return (
            <tr
              key={train.id}
              onClick={() => onSelect(isSelected ? null : train.id)}
              className="cursor-pointer transition-colors"
              style={{
                backgroundColor: isSelected
                  ? "var(--accent-soft)"
                  : undefined,
                borderBottom: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  (e.currentTarget as HTMLElement).style.backgroundColor = "";
              }}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <img
                    src={TRAIN_MODEL_ASSETS[train.model].image}
                    alt={train.model}
                    className="h-8 w-14 object-contain shrink-0"
                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
                  />
                  <span
                    className="font-semibold text-xs"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {train.label}
                  </span>
                </div>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {train.model}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={train.status} />
              </td>
              <td className="px-4 py-2.5">
                <HealthBadge score={train.healthScore} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                {train.speed} {t("trainList.kmh")}
              </td>
              <td className="px-4 py-2.5 max-w-[180px]">
                <span
                  className="block truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {train.route || "—"}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <LastAlertCell ws={ws} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {train.lastSeen}
              </td>
              <td className="px-3 py-2.5">
                <ChevronRight
                  size={14}
                  style={{
                    color: isSelected
                      ? "var(--accent-primary)"
                      : "var(--text-muted)",
                  }}
                />
              </td>
            </tr>
          );
        })}
        {trains.length === 0 && (
          <tr>
            <td
              colSpan={9}
              className="text-center py-12 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {t("trainList.noTrains")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TrainCards({ trains, wsMap, selectedId, onSelect }: ListProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-4">
      {trains.map((train) => {
        const ws = wsMap.get(train.id);
        const isSelected = selectedId === train.id;
        const cfg = TRAIN_STATUS_CONFIG[train.status];

        return (
          <button
            key={train.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : train.id)}
            className="text-left rounded-xl border p-4 transition-all flex flex-col gap-3"
            style={{
              backgroundColor: isSelected ? "var(--accent-soft)" : "var(--bg-elevated)",
              borderColor: isSelected ? "var(--accent-primary)" : "var(--border-subtle)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <div className="flex items-center justify-between">
              <StatusBadge status={train.status} />
              <HealthBadge score={train.healthScore} />
            </div>

            <div className="flex items-center gap-3">
              <img
                src={TRAIN_MODEL_ASSETS[train.model].image}
                alt={train.model}
                className="h-12 w-20 object-contain shrink-0"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
              />
              <div className="min-w-0">
                <div
                  className="font-bold text-sm truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {train.label}
                </div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {train.model}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <MetricPill label={t("trainList.colSpeed")} value={`${train.speed} ${t("trainList.kmh")}`} />
              <MetricPill
                label={t("trainList.colRoute")}
                value={train.route || "—"}
                truncate
              />
            </div>

            <div className="pt-1 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <LastAlertCell ws={ws} />
              <div
                className="text-[10px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {t("trainList.updated")}: {train.lastSeen}
              </div>
            </div>

            <div
              className="flex items-center gap-1 text-[10px] font-semibold"
              style={{ color: `var(${cfg.cssVar})` }}
            >
              <span>{t("trainList.quickView")}</span>
              <ChevronRight size={10} />
            </div>
          </button>
        );
      })}
      {trains.length === 0 && (
        <div
          className="col-span-full text-center py-12 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {t("trainList.noTrains")}
        </div>
      )}
    </div>
  );
}

function MetricPill({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-2 py-1.5"
      style={{ backgroundColor: "var(--bg-panel)" }}
    >
      <div
        className="text-[9px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className={cn("text-xs font-semibold mt-0.5", truncate && "truncate")}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

interface QuickViewProps {
  train: Train;
  ws: WsTrainState | undefined;
  onClose: () => void;
  onOpenTwin: () => void;
}

function TrainQuickView({ train, ws, onClose, onOpenTwin }: QuickViewProps) {
  const { t } = useTranslation();
  const alerts = useAlertHistoryStore(
    (s) => s.byTrain.get(train.id) ?? EMPTY_ALERT_HISTORY,
  );

  const faultCodes = ws?.faultCodes ?? [];

  const allAlerts = useMemo(() => {
    const fromFaults: Array<{ code: string; label: string; severity: "critical" | "warning" }> =
      faultCodes.map((code) => ({
        code,
        label:
          code in (t("faultCodes", { returnObjects: true }) as Record<string, string>)
            ? t(`faultCodes.${code}`)
            : code,
        severity: "warning" as const,
      }));
    return fromFaults;
  }, [faultCodes, t]);

  return (
    <aside
      className="flex flex-col border-l shrink-0 overflow-y-auto"
      style={{
        width: 280,
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--bg-elevated)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div>
          <div
            className="text-xs font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {t("trainList.quickViewTitle")}
          </div>
          <div
            className="text-sm font-bold mt-0.5"
            style={{ color: "var(--text-primary)" }}
          >
            {train.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pt-4 flex flex-col items-center gap-1">
        <img
          src={TRAIN_MODEL_ASSETS[train.model].image}
          alt={train.model}
          className="h-16 w-full object-contain"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}
        />
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge status={train.status} />
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {train.model}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col items-center gap-1">
        <HealthGauge score={train.healthScore} />
      </div>

      <div className="px-4 pt-4 grid grid-cols-2 gap-2">
        <MetricPill label={t("trainList.colSpeed")} value={`${train.speed} ${t("trainList.kmh")}`} />
        <MetricPill label={t("trainList.colRoute")} value={train.route || "—"} truncate />
        {ws?.engineTempC != null && (
          <MetricPill
            label={t("trainList.engineTemp")}
            value={`${Math.round(ws.engineTempC)} °C`}
          />
        )}
        {ws?.fuelLevelPct != null && (
          <MetricPill
            label={t("trainList.fuelLevel")}
            value={`${Math.round(ws.fuelLevelPct)} %`}
          />
        )}
        {ws?.brakePipePressureKpa != null && (
          <MetricPill
            label={t("trainList.brakePressure")}
            value={`${(ws.brakePipePressureKpa / 100).toFixed(1)} bar`}
          />
        )}
        {ws?.currentA != null && (
          <MetricPill
            label={t("trainList.current")}
            value={`${Math.round(ws.currentA)} A`}
          />
        )}
      </div>

      <div className="px-4 pt-4 flex-1">
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          {t("trainList.recentAlerts")}
        </div>

        {allAlerts.length === 0 && alerts.length === 0 ? (
          <div
            className="text-[11px] py-2"
            style={{ color: "var(--text-muted)" }}
          >
            {t("trainList.noAlerts")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {allAlerts.map((a) => (
              <div
                key={a.code}
                className="flex items-start gap-2 rounded-lg px-2 py-2"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeft: "2px solid var(--warning)",
                }}
              >
                <AlertTriangle
                  size={11}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--warning)" }}
                />
                <div>
                  <div
                    className="text-[10px] font-bold uppercase"
                    style={{ color: "var(--warning)" }}
                  >
                    {a.code}
                  </div>
                  <div
                    className="text-[11px] leading-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {a.label}
                  </div>
                </div>
              </div>
            ))}
            {alerts.map((a) => {
              const color =
                a.severity === "critical"
                  ? "var(--danger)"
                  : a.severity === "warning"
                    ? "var(--warning)"
                    : "var(--text-muted)";
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-2"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderLeft: `2px solid ${color}`,
                  }}
                >
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color }} />
                  <div>
                    <div
                      className="text-[10px] font-bold"
                      style={{ color }}
                    >
                      {a.code}
                    </div>
                    <div
                      className="text-[11px] leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.title}
                    </div>
                    <div
                      className="text-[10px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.ts ? new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={onOpenTwin}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all hover:opacity-90"
          style={{
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
          }}
        >
          <ExternalLink size={13} />
          {t("trainList.openTwin")}
        </button>
      </div>
    </aside>
  );
}
