export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  trainId: string;
  severity: AlertSeverity;
  messageKey: string;
  minutesAgo: number;
  time: string;
  isNew?: boolean;
}
