import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock, Mail, Activity, Shield, Map as MapIcon } from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "@/features/auth/model/store";
import { useLocaleStore, type AppLocale } from "@/features/locale/model/store";
import logoUrl from "../../../../assets/logo.png";
import loginBg from "../../../../assets/login.jpg";

const LANGS: { locale: AppLocale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "kk", label: "KZ" },
  { locale: "ru", label: "RU" },
];

export function LoginPage() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = login(email.trim(), password);
    if (!ok) {
      setError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col">
        <img
          src={loginBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ filter: "brightness(0.55)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(10,13,20,0.7) 0%, rgba(10,13,20,0.3) 60%, transparent 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-10">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
            <span className="text-white text-base font-bold tracking-widest uppercase">
              RAILLENS
            </span>
          </div>

          <div className="mt-auto mb-16">
            <div
              className="inline-block text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6"
              style={{
                backgroundColor: "rgba(56,189,248,0.18)",
                color: "#38bdf8",
                border: "1px solid rgba(56,189,248,0.3)",
              }}
            >
              {t("auth.heroTag")}
            </div>
            <h1 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-4">
              {t("auth.heroTitle")}
            </h1>
            <p
              className="text-base leading-relaxed max-w-sm"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {t("auth.heroSubtitle")}
            </p>

            <div className="flex gap-4 mt-10">
              {[
                {
                  icon: Activity,
                  label: t("auth.feature1Title"),
                  desc: t("auth.feature1Desc"),
                },
                {
                  icon: Shield,
                  label: t("auth.feature2Title"),
                  desc: t("auth.feature2Desc"),
                },
                {
                  icon: MapIcon,
                  label: t("auth.feature3Title"),
                  desc: t("auth.feature3Desc"),
                },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex flex-col gap-1.5 rounded-xl px-4 py-3 flex-1"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <Icon size={16} color="#38bdf8" />
                  <span className="text-white text-xs font-semibold">
                    {label}
                  </span>
                  <span
                    className="text-[11px] leading-snug"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p
            className="text-[11px]"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            © 2026 RAILLENS. {t("auth.rights")}
          </p>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div className="flex justify-end px-6 py-4">
          <div
            className="flex rounded-xl p-1 gap-0.5"
            style={{
              backgroundColor: "var(--bg-elevated)",
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
                  className="relative px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider transition-colors"
                  style={{
                    color: active
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="login-lang-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundColor: "rgba(56,189,248,0.14)",
                        border: "1px solid rgba(56,189,248,0.28)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span className="relative z-[1]">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10">
          <motion.div
            className="w-full max-w-[420px]"
            animate={isShaking ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >
            <div
              className="rounded-2xl p-8 shadow-2xl"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="mb-7 text-center">
                <h2
                  className="text-xl font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("auth.formTitle")}
                </h2>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("auth.formSubtitle")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="login-email"
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("auth.loginLabel")}
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <input
                      id="login-email"
                      type="text"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(false);
                      }}
                      placeholder={t("auth.loginPlaceholder")}
                      className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all"
                      style={{
                        backgroundColor: "var(--bg-panel)",
                        border: `1px solid ${error ? "var(--danger)" : "var(--border-subtle)"}`,
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("auth.passwordLabel")}
                    </label>
                  </div>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(false);
                      }}
                      placeholder={t("auth.passwordPlaceholder")}
                      className="w-full rounded-xl pl-9 pr-10 py-3 text-sm outline-none transition-all"
                      style={{
                        backgroundColor: "var(--bg-panel)",
                        border: `1px solid ${error ? "var(--danger)" : "var(--border-subtle)"}`,
                        color: "var(--text-primary)",
                      }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-center"
                    style={{ color: "var(--danger)" }}
                  >
                    {t("auth.errorInvalid")}
                  </motion.p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-all mt-1"
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "#fff",
                  }}
                >
                  {t("auth.submitButton")}
                </button>
              </form>

              <p
                className="text-center text-xs mt-6"
                style={{ color: "var(--text-muted)" }}
              >
                {t("auth.noAccount")}{" "}
                <span style={{ color: "var(--accent-primary)" }}>
                  {t("auth.contactAdmin")}
                </span>
              </p>
            </div>
          </motion.div>
        </div>

        <div
          className="flex justify-center px-6 py-4 border-t text-[11px] gap-6"
          style={{
            borderColor: "var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <span>{t("auth.privacy")}</span>
          <span>{t("auth.terms")}</span>
        </div>
      </div>
    </div>
  );
}
