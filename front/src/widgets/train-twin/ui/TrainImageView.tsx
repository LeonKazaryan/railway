import { forwardRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TrainModel } from "@/entities/train/model/types";
import { TRAIN_MODEL_ASSETS } from "@/entities/train/model/config";

interface TrainImageViewProps {
  model: TrainModel;
  className?: string;
  children?: ReactNode;
}

export const TrainImageView = forwardRef<HTMLDivElement, TrainImageViewProps>(
  function TrainImageView({ model, className = "", children }, ref) {
    const { t } = useTranslation();
    const { image } = TRAIN_MODEL_ASSETS[model];
    const alt = t(`trainModels.${model}`);

    return (
      <div
        ref={ref}
        className={`relative flex-1 min-h-[210px] rounded-xl overflow-visible ${className}`}
      >
        <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
          <img
            src={image}
            alt={alt}
            draggable={false}
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: "center 48%",
            }}
          />
        </div>
        {children}
      </div>
    );
  },
);
