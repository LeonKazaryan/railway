import {
  useCallback,
  useId,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import type { TelemetrySnapshot } from "@/entities/train/model/types";
import {
  getSystemZoneStatus,
  serverParameterZoneToStatus,
  SYSTEM_ZONE_STATUS_COLORS,
  type ServerParameterZone,
  type SystemZoneConfig,
} from "@/entities/train/model/config";
import type { SystemZoneId } from "@/entities/train/model/systemZoneAnchors";

export interface UseTwinLeaderLinesParams {
  diagramRef: RefObject<HTMLDivElement | null>;
  imageRef: RefObject<HTMLDivElement | null>;
  zoneRefs: RefObject<Partial<Record<SystemZoneId, HTMLDivElement | null>>>;
  anchors: Record<SystemZoneId, { x: number; y: number }>;
  snapshot: TelemetrySnapshot;
  zoneConfigs: SystemZoneConfig[];
  parameterZones: Record<string, ServerParameterZone> | null;
}

const ZONE_ATTACHMENT: Record<SystemZoneId, "left" | "right" | "bottom"> = {
  engine: "left",
  electrical: "left",
  traction: "bottom",
  bogies: "bottom",
  brakes: "right",
  air: "right",
};

export type LeaderLineDraw = {
  id: SystemZoneId;
  d: string;
  color: string;
  dotX: number;
  dotY: number;
};

export type LeaderOverlayMetrics = {
  extendLeft: number;
  extendRight: number;
  width: number;
  height: number;
};

function orthLeftPath(
  sx: number,
  sy: number,
  imL: number,
  imT: number,
  imB: number,
  ex: number,
  ey: number,
): string {
  if (sy < imT) {
    return `M ${sx} ${sy} L ${sx} ${imT} L ${imL} ${imT} L ${ex} ${imT} L ${ex} ${ey}`;
  }
  if (sy > imB) {
    return `M ${sx} ${sy} L ${sx} ${imB} L ${imL} ${imB} L ${ex} ${imB} L ${ex} ${ey}`;
  }
  return `M ${sx} ${sy} L ${ex} ${sy} L ${ex} ${ey}`;
}

function orthRightPath(
  sx: number,
  sy: number,
  imR: number,
  imT: number,
  imB: number,
  ex: number,
  ey: number,
): string {
  if (sy < imT) {
    return `M ${sx} ${sy} L ${sx} ${imT} L ${imR} ${imT} L ${ex} ${imT} L ${ex} ${ey}`;
  }
  if (sy > imB) {
    return `M ${sx} ${sy} L ${sx} ${imB} L ${imR} ${imB} L ${ex} ${imB} L ${ex} ${ey}`;
  }
  return `M ${sx} ${sy} L ${ex} ${sy} L ${ex} ${ey}`;
}

function orthBottomPath(
  sx: number,
  sy: number,
  imT: number,
  imB: number,
  ex: number,
  ey: number,
  id: SystemZoneId,
): string {
  if (sy > imB) {
    const runOffset =
      id === "traction" ? 18 : id === "bogies" ? 5 : 0;
    let runY = imB - runOffset;
    runY = Math.max(imT + 6, Math.min(runY, imB));
    return `M ${sx} ${sy} L ${sx} ${runY} L ${ex} ${runY} L ${ex} ${ey}`;
  }
  return `M ${sx} ${sy} L ${sx} ${ey} L ${ex} ${ey}`;
}

function toOverlayPath(
  dDiagram: string,
  originX: number,
  originY: number,
): string {
  return dDiagram.replace(
    /([ML])\s+([\d.-]+)\s+([\d.-]+)/g,
    (_, cmd: string, x: string, y: string) => {
      const nx = Number(x) - originX;
      const ny = Number(y) - originY;
      return `${cmd} ${nx} ${ny}`;
    },
  );
}

export function useTwinLeaderLines({
  diagramRef,
  imageRef,
  zoneRefs,
  anchors,
  snapshot,
  zoneConfigs,
  parameterZones,
}: UseTwinLeaderLinesParams): {
  lines: LeaderLineDraw[];
  overlay: LeaderOverlayMetrics;
} {
  const [lines, setLines] = useState<LeaderLineDraw[]>([]);
  const [overlay, setOverlay] = useState<LeaderOverlayMetrics>({
    extendLeft: 0,
    extendRight: 0,
    width: 0,
    height: 0,
  });

  const measure = useCallback(() => {
    const diagram = diagramRef.current;
    const img = imageRef.current;
    if (!diagram || !img) return;
    const rootRect = diagram.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();

    const imL = imageRect.left - rootRect.left;
    const imT = imageRect.top - rootRect.top;
    const imR = imageRect.right - rootRect.left;
    const imB = imageRect.bottom - rootRect.top;
    const imW = imageRect.width;
    const imH = imageRect.height;

    let minX = imL;
    let maxX = imR;

    const rawPaths: { id: SystemZoneId; d: string; ex: number; ey: number }[] =
      [];

    for (const z of zoneConfigs) {
      const id = z.id as SystemZoneId;
      const el = zoneRefs.current?.[id];
      if (!el) continue;
      const anchor = anchors[id];
      if (!anchor) continue;

      const rect = el.getBoundingClientRect();
      const ex = imL + anchor.x * imW;
      const ey = imT + anchor.y * imH;
      const att = ZONE_ATTACHMENT[id];

      let d: string;
      if (att === "left") {
        const sx = rect.right - rootRect.left;
        const sy = rect.top + rect.height / 2 - rootRect.top;
        d = orthLeftPath(sx, sy, imL, imT, imB, ex, ey);
        minX = Math.min(minX, sx, ex);
        maxX = Math.max(maxX, ex);
      } else if (att === "right") {
        const sx = rect.left - rootRect.left;
        const sy = rect.top + rect.height / 2 - rootRect.top;
        d = orthRightPath(sx, sy, imR, imT, imB, ex, ey);
        minX = Math.min(minX, ex);
        maxX = Math.max(maxX, sx, ex);
      } else {
        const sx = rect.left + rect.width / 2 - rootRect.left;
        const sy = rect.top - rootRect.top;
        d = orthBottomPath(sx, sy, imT, imB, ex, ey, id);
        minX = Math.min(minX, sx, ex);
        maxX = Math.max(maxX, sx, ex);
      }
      rawPaths.push({ id, d, ex, ey });
    }

    const extendLeft = Math.max(0, imL - minX);
    const extendRight = Math.max(0, maxX - imR);
    const originX = imL - extendLeft;
    const originY = imT;

    const zoneById = Object.fromEntries(zoneConfigs.map((z) => [z.id, z]));
    const next: LeaderLineDraw[] = rawPaths.map(({ id, d, ex, ey }) => {
      const cfg = zoneById[id];
      const raw = snapshot[cfg.metricKey] as number;
      const serverZone = parameterZones?.[cfg.metricKey];
      const status = serverZone
        ? serverParameterZoneToStatus(serverZone)
        : getSystemZoneStatus(cfg, raw);
      const color = SYSTEM_ZONE_STATUS_COLORS[status];
      const dOverlay = toOverlayPath(d, originX, originY);
      return {
        id,
        d: dOverlay,
        color,
        dotX: ex - originX,
        dotY: ey - originY,
      };
    });

    setOverlay({
      extendLeft,
      extendRight,
      width: imW + extendLeft + extendRight,
      height: imH,
    });
    setLines(next);
  }, [diagramRef, imageRef, zoneRefs, anchors, snapshot, zoneConfigs, parameterZones]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    const el = diagramRef.current;
    if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return { lines, overlay };
}

export function TwinLeaderOverlaySvg({
  lines,
  overlay,
}: {
  lines: LeaderLineDraw[];
  overlay: LeaderOverlayMetrics;
}) {
  const glowFilterId = `twin-zone-glow-${useId().replace(/:/g, "")}`;
  const { extendLeft, width, height } = overlay;
  if (width <= 0 || height <= 0) return null;

  return (
    <svg
      className="absolute top-0 z-[5] pointer-events-none overflow-visible"
      style={{
        left: -extendLeft,
        width: width,
        height: height,
      }}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <defs>
        <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {lines.map(({ d, color, id, dotX, dotY }) => (
        <g key={id}>
          <path
            d={d}
            fill="none"
            stroke="rgba(15, 23, 42, 0.55)"
            strokeOpacity={1}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={1}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={dotX}
            cy={dotY}
            r={9}
            fill="rgba(15, 23, 42, 0.35)"
          />
          <circle
            cx={dotX}
            cy={dotY}
            r={7}
            fill={color}
            fillOpacity={0.28}
            filter={`url(#${glowFilterId})`}
          />
          <circle cx={dotX} cy={dotY} r={4.5} fill={color} fillOpacity={1} />
        </g>
      ))}
    </svg>
  );
}
