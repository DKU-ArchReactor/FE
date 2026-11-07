import React from 'react';
import { useTheme } from '@/context/ThemeContext';

export const ThemeSwitch: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      title={isDark ? "현재 다크 모드 (클릭하여 라이트 모드로 전환)" : "현재 라이트 모드 (클릭하여 다크 모드로 전환)"}
      className={`relative inline-flex h-7 w-[58px] shrink-0 cursor-pointer items-center rounded-full p-[3px] border transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005FB8] dark:focus-visible:ring-[#007ACC] shadow-2xs group ${
        isDark
          ? "bg-[#1E1E24] border-[#3E3E48] hover:border-[#52525B]"
          : "bg-[#E6E8EC] border-[#D0D7DE] hover:border-[#B1B8C0]"
      }`}
    >
      <span className="sr-only">VS Code 테마 전환</span>

      {/* 좌측 트랙 배경 아이콘: 태양 (Light Mode 아이콘) */}
      <span
        className={`absolute left-[7px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-300 pointer-events-none select-none ${
          isDark ? "opacity-30 group-hover:opacity-50" : "opacity-0"
        }`}
      >
        <svg
          className="w-3.5 h-3.5 text-amber-500/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </span>

      {/* 우측 트랙 배경 아이콘: 달 (Dark Mode 아이콘) */}
      <span
        className={`absolute right-[7px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-300 pointer-events-none select-none ${
          isDark ? "opacity-0" : "opacity-35 group-hover:opacity-55"
        }`}
      >
        <svg
          className="w-3.5 h-3.5 text-[#57606A]"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73A8.15 8.15 0 019.08 5.49a8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" />
        </svg>
      </span>

      {/* 좌우로 부드럽게 슬라이딩하는 노브 (Thumb) */}
      <span
        className={`pointer-events-none flex h-5 w-5 items-center justify-center rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isDark
            ? "translate-x-[30px] bg-[#2D2D32] border border-[#505058] text-[#82AAFF] shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
            : "translate-x-0 bg-white border border-[#E1E4E8] text-amber-500 shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
        }`}
      >
        {isDark ? (
          <svg
            className="w-3 h-3 transition-transform duration-300 rotate-0"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73A8.15 8.15 0 019.08 5.49a8.59 8.59 0 01.25-2A1 1 0 008 2.36a10.14 10.14 0 1014 11.69 1 1 0 00-.36-1.05z" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5 transition-transform duration-300 rotate-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.4}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </span>
    </button>
  );
};

export default ThemeSwitch;

