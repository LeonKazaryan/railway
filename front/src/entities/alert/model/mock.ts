import type { Alert } from "./types";

export const MOCK_ALERTS: Alert[] = [
  {
    id: "alert-1",
    trainId: "TE33A-047",
    severity: "critical",
    messageKey: "a1",
    minutesAgo: 24,
    time: "11:18",
    isNew: true,
  },
  {
    id: "alert-2",
    trainId: "KZ8A-019",
    severity: "warning",
    messageKey: "a2",
    minutesAgo: 33,
    time: "11:37",
  },
  {
    id: "alert-3",
    trainId: "TE33A-031",
    severity: "warning",
    messageKey: "a3",
    minutesAgo: 41,
    time: "11:38",
  },
  {
    id: "alert-4",
    trainId: "TE33A-018",
    severity: "info",
    messageKey: "a4",
    minutesAgo: 0,
    time: "11:35",
  },
  {
    id: "alert-5",
    trainId: "KZ8A-007",
    severity: "info",
    messageKey: "a5",
    minutesAgo: 30,
    time: "11:30",
  },
];

export const ALERT_SEVERITY_STYLE = {
  critical: { color: "#f43f5e", bgColor: "rgba(244,63,94,0.12)" },
  warning: { color: "#f59e0b", bgColor: "rgba(245,158,11,0.10)" },
  info: { color: "#38bdf8", bgColor: "rgba(56,189,248,0.08)" },
} as const;
