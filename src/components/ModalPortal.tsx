/**
 * ModalPortal — renders its children into document.body via a portal.
 *
 * Why: a modal using `position: fixed` is positioned relative to the nearest
 * ancestor that has a `transform`, `filter`, or `backdrop-filter` (e.g. the
 * app's `.glass` main panel), which makes it drift with the page instead of
 * staying locked to the viewport. Portaling to <body> escapes those ancestors
 * so `fixed` is relative to the viewport again.
 *
 * It also locks background page scrolling while mounted and restores it
 * (including the previous scroll position) on unmount.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    // Lock scroll. Fixed-position technique also prevents iOS rubber-banding
    // and keeps the page from jumping.
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      // Restore the scroll position the user was at.
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
