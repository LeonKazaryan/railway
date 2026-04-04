import type { Train } from "@/entities/train/model/types";
import { TRAIN_STATUS_CONFIG } from "@/entities/train/model/config";
import { i18n } from "@/shared/config/i18n/instance";

export function createTrainMarkerElement(
  train: Train,
  isSelected: boolean,
): HTMLElement {
  const config = TRAIN_STATUS_CONFIG[train.status];
  const color = config.color;
  const isNoSignal = train.status === "no_signal";

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: relative;
    cursor: pointer;
    transform-origin: center;
    transition: transform 0.15s ease;
  `;

  if (isSelected) {
    const ring = document.createElement("div");
    ring.style.cssText = `
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      border: 1.5px solid ${color};
      opacity: 0.5;
      animation: pulse-ring 2s infinite;
      pointer-events: none;
    `;
    wrapper.appendChild(ring);
  }

  const marker = document.createElement("div");
  marker.style.cssText = `
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  `;

  const badge = document.createElement("div");
  badge.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 4px;
    border: 1px solid ${color}55;
    backdrop-filter: blur(8px);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: ${color};
    white-space: nowrap;
    background: rgba(10, 13, 20, 0.88);
    box-shadow: 0 0 8px ${color}30, inset 0 0 8px ${color}08;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${color};
    flex-shrink: 0;
    ${!isNoSignal ? `box-shadow: 0 0 4px ${color};` : ""}
  `;

  const idSpan = document.createElement("span");
  idSpan.textContent = train.id;

  badge.appendChild(dot);
  badge.appendChild(idSpan);

  if (!isNoSignal && train.speed > 0) {
    const speedSpan = document.createElement("span");
    speedSpan.style.cssText = `
      font-size: 9px;
      font-weight: 400;
      color: rgba(255,255,255,0.5);
      margin-left: 2px;
    `;
    speedSpan.textContent = `${train.speed}`;
    badge.appendChild(speedSpan);
  }

  marker.appendChild(badge);

  const scoreEl = document.createElement("div");
  scoreEl.style.cssText = `
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: ${isNoSignal ? "rgba(255,255,255,0.3)" : color};
    text-align: center;
  `;
  scoreEl.textContent = isNoSignal
    ? i18n.t("map.noSignal")
    : String(train.healthScore);
  marker.appendChild(scoreEl);

  wrapper.appendChild(marker);

  return wrapper;
}
