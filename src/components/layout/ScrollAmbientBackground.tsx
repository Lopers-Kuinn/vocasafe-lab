"use client";

import { useEffect, useRef } from "react";

export default function ScrollAmbientBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const cursor = cursorRef.current;
    if (!layer || !cursor) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) return;

    let scrollFrameId: number | null = null;
    let pointerFrameId: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let lastPointerMoveAt = 0;

    const updateMotion = () => {
      const scrollY = Math.min(window.scrollY, 2400);
      layer.style.setProperty("--scroll-drift-slow", `${scrollY * -0.035}px`);
      layer.style.setProperty("--scroll-drift-medium", `${scrollY * 0.075}px`);
      layer.style.setProperty("--scroll-drift-fast", `${scrollY * -0.12}px`);
      layer.style.setProperty("--scroll-drift-side", `${scrollY * 0.025}px`);
      layer.style.setProperty("--scroll-drift-side-reverse", `${scrollY * -0.025}px`);
      scrollFrameId = null;
    };

    const handleScroll = () => {
      if (scrollFrameId !== null) return;
      scrollFrameId = window.requestAnimationFrame(updateMotion);
    };

    const setPointerIdle = () => {
      cursor.classList.remove("is-pointer-active");
      cursor.classList.add("is-pointer-idle");
      idleTimer = null;
    };

    const checkPointerIdle = () => {
      const remaining = 480 - (performance.now() - lastPointerMoveAt);
      if (remaining > 0) {
        idleTimer = setTimeout(checkPointerIdle, remaining);
        return;
      }
      setPointerIdle();
    };

    const updatePointerMotion = () => {
      cursor.style.setProperty("--cursor-x", `${pointerX}px`);
      cursor.style.setProperty("--cursor-y", `${pointerY}px`);
      cursor.classList.remove("is-pointer-idle");
      cursor.classList.add("is-pointer-active");
      pointerFrameId = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      pointerX = event.clientX;
      pointerY = event.clientY;
      lastPointerMoveAt = performance.now();

      if (pointerFrameId === null) {
        pointerFrameId = window.requestAnimationFrame(updatePointerMotion);
      }

      if (idleTimer === null) {
        idleTimer = setTimeout(checkPointerIdle, 480);
      }
    };

    updateMotion();
    window.addEventListener("scroll", handleScroll, { passive: true });

    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (hasFinePointer) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("blur", setPointerIdle);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", setPointerIdle);
      if (scrollFrameId !== null) window.cancelAnimationFrame(scrollFrameId);
      if (pointerFrameId !== null) window.cancelAnimationFrame(pointerFrameId);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="scroll-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="scroll-ambient-grid ambient-grid absolute -inset-24 opacity-55" />
      <div className="scroll-ambient-orb scroll-ambient-orb-left absolute -left-32 top-24 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-right absolute -right-36 -top-20 h-96 w-96 rounded-full bg-violet-200/25 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-center absolute left-[36%] top-[58%] h-72 w-72 rounded-full bg-cyan-100/25 blur-3xl" />
      <div ref={cursorRef} className="cursor-ambient is-pointer-idle">
        <span className="cursor-ambient-glow" />
        <span className="cursor-orbit cursor-orbit-primary">
          <span className="cursor-particle cursor-particle-a" />
          <span className="cursor-particle cursor-particle-c" />
          <span className="cursor-particle cursor-particle-e" />
        </span>
        <span className="cursor-orbit cursor-orbit-secondary">
          <span className="cursor-particle cursor-particle-b" />
          <span className="cursor-particle cursor-particle-d" />
          <span className="cursor-particle cursor-particle-f" />
        </span>
      </div>
    </div>
  );
}
