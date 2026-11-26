import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface FileNameModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  defaultValue: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export const FileNameModal: React.FC<FileNameModalProps> = ({
  isOpen,
  title,
  description,
  defaultValue,
  placeholder,
  confirmLabel = "저장",
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(defaultValue);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px] p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-4 shadow-2xl"
      >
        <h3 className="text-sm font-bold text-[var(--ar-text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-[var(--ar-text-muted)]">
            {description}
          </p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-3 w-full rounded-lg border border-[var(--ar-border)] bg-[var(--ar-header-bg)] px-3 py-2 font-mono text-xs text-[var(--ar-text-primary)] outline-none focus:border-[var(--ar-accent)]"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)] cursor-pointer transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-lg bg-[var(--ar-accent)] hover:bg-[var(--ar-accent-hover)] disabled:opacity-40 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

interface SaveAuthNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: () => void;
}

export const SaveAuthNoticeModal: React.FC<SaveAuthNoticeModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px] p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="로그인 안내"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-4 shadow-2xl"
      >
        <h3 className="text-sm font-bold text-[var(--ar-text-primary)]">
          로그인이 필요합니다
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ar-text-muted)]">
          파일 저장 기능은 로그인 후 이용할 수 있습니다.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ar-text-muted)] hover:text-[var(--ar-text-primary)] cursor-pointer transition-colors"
          >
            닫기
          </button>
          {onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg bg-[var(--ar-accent)] hover:bg-[var(--ar-accent-hover)] px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer transition-colors"
            >
              로그인하기
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
