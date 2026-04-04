import type { TrainModel } from '@/entities/train/model/types'
import { TRAIN_MODEL_ASSETS } from '@/entities/train/model/config'

interface TrainImageViewProps {
  model: TrainModel
}

export function TrainImageView({ model }: TrainImageViewProps) {
  const { image, label } = TRAIN_MODEL_ASSETS[model]

  return (
    <div className="relative flex items-center justify-center flex-1 min-w-0 py-2">
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(56,189,248,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <img
        src={image}
        alt={label}
        className="relative z-10 object-contain w-full"
        style={{
          maxHeight: 180,
          filter: 'drop-shadow(0 0 24px rgba(56,189,248,0.25)) drop-shadow(0 4px 16px rgba(0,0,0,0.6))',
        }}
        draggable={false}
      />
    </div>
  )
}
