import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useFleetLayoutStore } from "@/features/fleet-layout/model/store";
import { TopBar } from "./TopBar";

const PRIORITY_FEED_WIDTH_PX = 288;

interface AppShellProps {
  leftPanel: ReactNode;
  main: ReactNode;
  rightPanel: ReactNode;
}

export function AppShell({ leftPanel, main, rightPanel }: AppShellProps) {
  const priorityFeedOpen = useFleetLayoutStore((s) => s.priorityFeedOpen);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex flex-col w-64 border-r overflow-y-auto shrink-0"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {leftPanel}
        </aside>
        <main className="flex-1 relative overflow-hidden">{main}</main>
        <motion.aside
          id="priority-feed-panel"
          initial={false}
          animate={{
            width: priorityFeedOpen ? PRIORITY_FEED_WIDTH_PX : 0,
            opacity: priorityFeedOpen ? 1 : 0,
          }}
          transition={{
            duration: 0.38,
            ease: [0.32, 0.72, 0, 1],
          }}
          aria-hidden={!priorityFeedOpen}
          className="flex flex-col shrink-0 overflow-hidden border-l"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            pointerEvents: priorityFeedOpen ? "auto" : "none",
          }}
        >
          <div className="flex h-full min-h-0 w-72 flex-col overflow-y-auto">
            {rightPanel}
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
