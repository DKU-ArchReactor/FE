import React from "react";

export type PlaybackFeedbackType = "play" | "pause" | "reset" | "trash" | "check";

export interface PlaybackFeedbackState {
  type: PlaybackFeedbackType;
  id: number;
}

interface PlaybackFeedbackOverlayProps {
  feedback: PlaybackFeedbackState | null;
}

const FEEDBACK_CONFIGS: Record<
  PlaybackFeedbackType,
  { bgClass: string; icon: React.ReactNode }
> = {
  check: {
    bgClass: "bg-emerald-700/85",
    icon: (
      <svg
        className="w-12 h-12 stroke-white fill-none drop-shadow-md"
        viewBox="0 0 24 24"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  play: {
    bgClass: "bg-blue-700/85",
    icon: (
      <svg
        className="w-12 h-12 fill-white translate-x-1 drop-shadow-md"
        viewBox="0 0 24 24"
      >
        <path d="M6 4.5l14 7.5-14 7.5v-15z" />
      </svg>
    ),
  },
  pause: {
    bgClass: "bg-amber-700/85",
    icon: (
      <svg
        className="w-12 h-12 fill-white drop-shadow-md"
        viewBox="0 0 24 24"
      >
        <rect x="5.5" y="4.5" width="4" height="15" rx="1.5" />
        <rect x="14.5" y="4.5" width="4" height="15" rx="1.5" />
      </svg>
    ),
  },
  trash: {
    bgClass: "bg-rose-700/85",
    icon: (
      <svg
        className="w-12 h-12 fill-white drop-shadow-md"
        viewBox="0 0 24 24"
      >
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
      </svg>
    ),
  },
  reset: {
    bgClass: "bg-slate-800/90",
    icon: (
      <svg
        className="w-10 h-10 fill-white drop-shadow-md"
        viewBox="0 0 24 24"
      >
        <rect x="5" y="5" width="14" height="14" rx="2.5" />
      </svg>
    ),
  },
};

export const PlaybackFeedbackOverlay: React.FC<PlaybackFeedbackOverlayProps> = ({
  feedback,
}) => {
  if (!feedback) return null;

  const config = FEEDBACK_CONFIGS[feedback.type];

  return (
    <div
      key={feedback.id}
      className={`playback-indicator-overlay fixed inset-0 m-auto w-24 h-24 rounded-3xl ${config.bgClass} backdrop-blur-md shadow-2xl flex items-center justify-center pointer-events-none z-50 text-white border border-white/20 transition-colors`}
    >
      {config.icon}
    </div>
  );
};

export default PlaybackFeedbackOverlay;

