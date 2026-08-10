export const STICKERS: Record<string, JSX.Element> = {
  happy: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#F5A742" />
      <circle cx="21" cy="24" r="3.5" fill="#4A1B0C" />
      <circle cx="39" cy="24" r="3.5" fill="#4A1B0C" />
      <path
        d="M17 36 Q30 48 43 36"
        stroke="#4A1B0C"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  love: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#E85D8A" />
      <path
        d="M20 22 Q20 15 27 15 Q30 15 30 20 Q30 15 33 15 Q40 15 40 22 Q40 30 30 38 Q20 30 20 22 Z"
        fill="#FFFBF8"
      />
    </svg>
  ),
  laugh: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#FF6F59" />
      <path
        d="M14 22 Q21 14 28 22"
        stroke="#4A1B0C"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 22 Q39 14 46 22"
        stroke="#4A1B0C"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M15 33 Q30 52 45 33 Z"
        fill="#4A1B0C"
      />
      <rect x="20" y="33" width="20" height="6" fill="#FF9A8C" />
    </svg>
  ),
  thumbsUp: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#2A9D8F" />
      <path
        d="M22 28 L22 42 L18 42 L18 28 Z"
        fill="#FFFBF8"
      />
      <path
        d="M22 28 L27 15 Q30 15 30 19 L28 28 L38 28 Q41 28 40 32 L37 41 Q36 42 34 42 L22 42 Z"
        fill="#FFFBF8"
      />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#4A1B0C" />
      <path
        d="M30 12 Q38 22 34 28 Q40 26 40 34 Q40 46 30 48 Q20 46 20 34 Q20 28 24 26 Q22 32 26 32 Q24 22 30 12 Z"
        fill="#FF6F59"
      />
      <path
        d="M30 30 Q34 34 32 38 Q36 37 36 41 Q36 46 30 47 Q24 46 24 41 Q24 38 27 37 Q26 41 28 41 Q26 35 30 30 Z"
        fill="#F5A742"
      />
    </svg>
  ),
  clap: (
    <svg viewBox="0 0 60 60" width="100%" height="100%">
      <circle cx="30" cy="30" r="26" fill="#FBE3EC" />
      <path d="M20 20 L27 27 L20 34 Z" fill="#E85D8A" />
      <path d="M40 20 L33 27 L40 34 Z" fill="#E85D8A" />
      <circle cx="30" cy="27" r="2.5" fill="#E85D8A" />
    </svg>
  ),
};

export type StickerId = keyof typeof STICKERS;