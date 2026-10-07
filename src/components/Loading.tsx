/**
 * Loading.tsx — shared loading toolkit for a consistent, cute loading UX.
 *
 * Exports:
 *  • CuteLoader   — full-screen blocking overlay (portal, viewport-fixed, centered)
 *  • Spinner      — small inline spinner
 *  • ButtonSpinner— spinner sized for buttons
 *  • BouncingDots — three bouncing dots
 *  • Skeleton     — a single shimmer block
 *  • TableSkeleton— shimmer rows for tables
 *  • CardSkeleton — shimmer cards for grids
 *  • LOADING_MESSAGES — friendly rotating messages
 *
 * All animations respect prefers-reduced-motion (handled in index.css).
 */

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export const LOADING_MESSAGES = {
  default: "Just a moment",
  fetching: "Loading your data",
  crunching: "Crunching the numbers",
  saving: "Saving your changes",
  deleting: "Removing that for you",
  recalculating: "Recalculating",
  importing: "Importing",
  exporting: "Preparing your file",
  generating: "Generating",
} as const;

/* ─── Full-screen overlay ─────────────────────────────────────────────── */
export function CuteLoader({
  show,
  message = LOADING_MESSAGES.default,
  submessage,
}: {
  show: boolean;
  message?: string;
  submessage?: string;
}) {
  if (!show) return null;

  const overlay = (
    <div
      className="fixed inset-0 top-0 left-0 z-[100] flex h-screen w-screen items-center justify-center bg-slate-900/40 backdrop-blur-sm cute-fade"
      style={{ position: "fixed" }}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="cute-pop flex w-[320px] max-w-[90vw] flex-col items-center gap-6 rounded-3xl bg-white px-8 py-10 shadow-2xl ring-1 ring-black/5">
        <div className="relative h-24 w-24">
          <div className="cute-orbit absolute inset-0 rounded-full border-4 border-dashed border-blue-200" />
          <span className="cute-float-a absolute -right-1 -top-1 text-lg">🪙</span>
          <span className="cute-float-b absolute -left-2 top-6 text-sm">💸</span>
          <span className="cute-float-c absolute bottom-0 right-2 text-sm">✨</span>
          <div className="cute-bounce absolute inset-0 flex items-center justify-center">
            <div className="cute-coin flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-2xl font-black text-amber-900 shadow-lg ring-4 ring-amber-200/60">
              ₱
            </div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">
            {message}
            <span className="cute-dot">.</span>
            <span className="cute-dot cute-dot-2">.</span>
            <span className="cute-dot cute-dot-3">.</span>
          </p>
          {submessage && <p className="mt-1 text-xs text-slate-400">{submessage}</p>}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="cute-bar h-full w-1/3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}

/* ─── Navigation loader ───────────────────────────────────────────────── */
/**
 * Shows the CuteLoader briefly whenever the route changes, giving app-wide
 * feedback on page navigation. Must be rendered inside <BrowserRouter>.
 * A short, fixed duration avoids flashing and feels snappy.
 */
export function NavigationLoader({ durationMs = 550 }: { durationMs?: number }) {
  const location = useLocation();
  const [show, setShow] = useState(false);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip the very first mount (initial load has its own screens)
    if (first.current) {
      first.current = false;
      return;
    }
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), durationMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [location.pathname, durationMs]);

  return <CuteLoader show={show} message={LOADING_MESSAGES.default} submessage="Loading the page" />;
}

/* ─── Inline spinner ──────────────────────────────────────────────────── */
export function Spinner({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={`cute-spin inline-block rounded-full border-2 border-current border-t-transparent align-[-2px] ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Spinner sized for inside buttons; inherits text color. */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return <Spinner size={14} className={`mr-1.5 ${className}`} />;
}

/* ─── Bouncing dots ───────────────────────────────────────────────────── */
export function BouncingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-end gap-1 ${className}`} role="status" aria-label="Loading">
      <span className="cute-bdot h-1.5 w-1.5 rounded-full bg-current" />
      <span className="cute-bdot cute-bdot-2 h-1.5 w-1.5 rounded-full bg-current" />
      <span className="cute-bdot cute-bdot-3 h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

/** Centered inline loading block (for panels / sections). */
export function InlineLoader({ message = LOADING_MESSAGES.fetching }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500" role="status" aria-live="polite">
      <Spinner size={18} className="text-blue-500" />
      <span>
        {message}
        <span className="cute-dot">.</span>
        <span className="cute-dot cute-dot-2">.</span>
        <span className="cute-dot cute-dot-3">.</span>
      </span>
    </div>
  );
}

/* ─── Skeletons ───────────────────────────────────────────────────────── */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`cute-skeleton rounded ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full" role="status" aria-label="Loading table">
      <div className="space-y-2 p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-5 ${c === 0 ? "w-1/4" : "flex-1"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-white p-4">
          <Skeleton className="mb-3 h-4 w-1/2" />
          <Skeleton className="mb-2 h-8 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default CuteLoader;
