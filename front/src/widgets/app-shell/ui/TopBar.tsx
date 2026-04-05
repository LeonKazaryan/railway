import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Settings } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useFleetLayoutStore } from "@/features/fleet-layout/model/store";
import { useNavStore, type TopNavTab } from "@/features/nav/model/store";
import { useLocaleStore } from "@/features/locale/model/store";
import { SettingsMenu } from "@/widgets/settings-menu/ui/SettingsMenu";
import logoUrl from "../../../../assets/logo.png";

const NAV_TABS: { id: TopNavTab; labelKey: string }[] = [
  { id: "fleet", labelKey: "topBar.fleetView" },
  { id: "trainList", labelKey: "topBar.trainList" },
];

function localeToBcp47(locale: string) {
  if (locale === "kk") return "kk-KZ";
  if (locale === "ru") return "ru-RU";
  return "en-US";
}

export function TopBar() {
  const { t } = useTranslation();
  const appLocale = useLocaleStore((s) => s.locale);
  const activeTab = useNavStore((s) => s.activeTab);
  const setActiveTab = useNavStore((s) => s.setActiveTab);
  const [time, setTime] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const priorityFeedOpen = useFleetLayoutStore((s) => s.priorityFeedOpen);
  const togglePriorityFeed = useFleetLayoutStore((s) => s.togglePriorityFeed);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString(localeToBcp47(appLocale), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <header
      className="flex items-center h-12 px-4 gap-6 border-b"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 min-w-[140px]">
        <img
          src={logoUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
          decoding="async"
        />
        <span
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: "var(--text-primary)" }}
        >
          {t("topBar.brand")}
        </span>
      </div>

      <nav className="flex items-center gap-1">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 h-12 text-xs font-semibold tracking-wider transition-all border-b-2",
              activeTab === tab.id
                ? "border-b-[var(--accent-primary)] text-[var(--accent-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <button
          type="button"
          onClick={togglePriorityFeed}
          aria-expanded={priorityFeedOpen}
          aria-controls="priority-feed-panel"
          aria-label={
            priorityFeedOpen
              ? t("topBar.ariaHideFeed")
              : t("topBar.ariaShowFeed")
          }
          className={cn(
            "relative rounded-lg p-1.5 transition-colors",
            priorityFeedOpen && "bg-[rgba(56,189,248,0.12)]",
          )}
          style={{
            color: priorityFeedOpen
              ? "var(--accent-primary)"
              : "var(--text-secondary)",
          }}
        >
          <Bell size={16} />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--danger)" }}
          />
        </button>
        <div className="relative">
          <button
            ref={settingsRef}
            type="button"
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen((o) => !o)}
            style={{ color: "var(--text-secondary)" }}
          >
            <Settings size={15} />
          </button>
          <SettingsMenu
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            anchorRef={settingsRef}
          />
        </div>
        <div
          className="flex items-center gap-2 pl-4 border-l"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--success)" }}
          />
          <span
            className="text-xs font-mono font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {formattedTime}
          </span>
          <span
            className="text-xs font-semibold tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "rgba(34,211,160,0.12)",
              color: "var(--success)",
            }}
          >
            {t("topBar.live")}
          </span>
        </div>
      </div>
    </header>
  );
}
