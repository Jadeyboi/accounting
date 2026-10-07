/**
 * CuteLoader — a full-screen animated loading overlay.
 *
 * Shows a bouncing peso coin with an orbiting ring, floating coins,
 * and an animated message with cycling dots. Used for long-running
 * operations like backfills/recalculations.
 */

import { createPortal } from "react-dom";

export default function CuteLoader({
  show,
  message = "Working on it",
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
    >
      <style>{cuteStyles}</style>
      <div className="cute-pop flex w-[320px] max-w-[90vw] flex-col items-center gap-6 rounded-3xl bg-white px-8 py-10 shadow-2xl ring-1 ring-black/5">
        {/* Coin + orbit */}
        <div className="relative h-24 w-24">
          {/* orbiting ring */}
          <div className="cute-orbit absolute inset-0 rounded-full border-4 border-dashed border-blue-200" />
          {/* floating mini coins */}
          <span className="cute-float-a absolute -right-1 -top-1 text-lg">🪙</span>
          <span className="cute-float-b absolute -left-2 top-6 text-sm">💸</span>
          <span className="cute-float-c absolute bottom-0 right-2 text-sm">✨</span>
          {/* main bouncing coin */}
          <div className="cute-bounce absolute inset-0 flex items-center justify-center">
            <div className="cute-coin flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-2xl font-black text-amber-900 shadow-lg ring-4 ring-amber-200/60">
              ₱
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">
            {message}
            <span className="cute-dot">.</span>
            <span className="cute-dot cute-dot-2">.</span>
            <span className="cute-dot cute-dot-3">.</span>
          </p>
          {submessage && <p className="mt-1 text-xs text-slate-400">{submessage}</p>}
        </div>

        {/* progress shimmer bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="cute-bar h-full w-1/3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
        </div>
      </div>
    </div>
  );

  // Render into document.body via a portal so the overlay escapes any
  // ancestor with transform/filter/backdrop-filter and stays locked to the
  // viewport, centered, regardless of page scroll.
  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : overlay;
}

const cuteStyles = `
@keyframes cuteBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-14px) scale(1.05); }
}
@keyframes cuteOrbit {
  to { transform: rotate(360deg); }
}
@keyframes cuteCoinFlip {
  0%, 100% { transform: rotateY(0deg); }
  50%      { transform: rotateY(180deg); }
}
@keyframes cuteFloatA { 0%,100%{ transform: translateY(0); opacity:.9 } 50%{ transform: translateY(-8px); opacity:1 } }
@keyframes cuteFloatB { 0%,100%{ transform: translateY(0); opacity:.7 } 50%{ transform: translateY(-6px); opacity:1 } }
@keyframes cuteFloatC { 0%,100%{ transform: scale(.9); opacity:.6 } 50%{ transform: scale(1.2); opacity:1 } }
@keyframes cuteDots { 0%,20%{ opacity:0 } 50%,100%{ opacity:1 } }
@keyframes cuteBar {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(400%); }
}
@keyframes cuteFade { from { opacity:0 } to { opacity:1 } }
@keyframes cutePop  { from { opacity:0; transform: scale(.9) translateY(10px) } to { opacity:1; transform:none } }

.cute-fade   { animation: cuteFade .2s ease-out; }
.cute-pop    { animation: cutePop .3s cubic-bezier(.2,.9,.3,1.3); }
.cute-bounce { animation: cuteBounce 1s ease-in-out infinite; }
.cute-coin   { animation: cuteCoinFlip 1.6s ease-in-out infinite; }
.cute-orbit  { animation: cuteOrbit 3s linear infinite; }
.cute-float-a { animation: cuteFloatA 1.8s ease-in-out infinite; }
.cute-float-b { animation: cuteFloatB 2.2s ease-in-out infinite; }
.cute-float-c { animation: cuteFloatC 1.5s ease-in-out infinite; }
.cute-bar    { animation: cuteBar 1.1s ease-in-out infinite; }
.cute-dot    { animation: cuteDots 1.4s infinite; }
.cute-dot-2  { animation-delay: .2s; }
.cute-dot-3  { animation-delay: .4s; }
`;
