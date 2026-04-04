import { useEffect, useRef, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { useLocaleStore, type AppLocale } from "@/features/locale/model/store";
import { useThemeStore } from "@/features/theme/model/store";

const LANGS: { locale: AppLocale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "kk", label: "KZ" },
  { locale: "ru", label: "RU" },
];

interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

export function SettingsMenu({ open, onClose, anchorRef }: SettingsMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (menuRef.current?.contains(node)) return;
      if (anchorRef.current?.contains(node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          role="dialog"
          aria-label={t("settings.title")}
          initial={{ opacity: 0, y: -10, scale: 0.97, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(2px)" }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 32,
            mass: 0.7,
          }}
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,280px)] origin-top-right overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {t("settings.title")}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span
                className="text-[9px] font-bold tracking-wider uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                {t("settings.language")}
              </span>
              <div
                className="relative flex rounded-xl p-1 gap-0.5"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {LANGS.map(({ locale: loc, label }) => {
                  const active = locale === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocale(loc)}
                      className={cn(
                        "relative z-[1] flex-1 rounded-lg py-2 text-[11px] font-bold tracking-wider transition-colors",
                        active
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="settings-lang-pill"
                          className="absolute inset-0 rounded-lg"
                          style={{
                            backgroundColor: "rgba(56,189,248,0.14)",
                            border: "1px solid rgba(56,189,248,0.28)",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 34,
                          }}
                        />
                      )}
                      <span className="relative z-[1]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span
                className="text-[9px] font-bold tracking-wider uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                {t("settings.theme")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={theme === "light"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="relative flex h-11 w-full items-center justify-between rounded-xl px-3 overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  className="text-xs font-semibold z-[1]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {theme === "dark"
                    ? t("settings.themeDark")
                    : t("settings.themeLight")}
                </span>
                <div
                  className="relative flex h-8 w-[104px] shrink-0 items-center rounded-full p-0.5"
                  style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
                >
                  <motion.div
                    className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      boxShadow: "0 0 16px rgba(56,189,248,0.35)",
                    }}
                    initial={false}
                    animate={{ x: theme === "dark" ? 2 : 50 }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                  <div className="relative z-[1] flex w-full justify-between px-2 pointer-events-none">
                    <Moon
                      size={14}
                      style={{
                        color:
                          theme === "dark"
                            ? "var(--bg-base)"
                            : "var(--text-muted)",
                      }}
                    />
                    <Sun
                      size={14}
                      style={{
                        color:
                          theme === "light"
                            ? "var(--bg-base)"
                            : "var(--text-muted)",
                      }}
                    />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
