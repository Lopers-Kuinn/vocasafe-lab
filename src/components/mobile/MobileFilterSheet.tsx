"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";

const subscribeToNothing = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface MobileFilterSheetProps {
  open: boolean;
  title: string;
  resultCount: number;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
}

export default function MobileFilterSheet({
  open,
  title,
  resultCount,
  onClose,
  onReset,
  onApply,
  children,
}: MobileFilterSheetProps) {
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Tutup filter"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />
      <section className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[30px] bg-white shadow-[0_-24px_70px_rgba(15,23,42,0.22)]">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                Filter
              </p>
              <h2 className="text-base font-bold text-slate-950">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[calc(88dvh-9rem)] overflow-y-auto px-5 py-5 pb-32">
          <div className="grid gap-4">{children}</div>
        </div>

        <footer className="absolute inset-x-0 bottom-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-slate-100 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="min-h-12 rounded-2xl bg-[#08775a] px-4 text-sm font-bold text-white shadow-lg"
          >
            Tampilkan {resultCount} hasil
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
