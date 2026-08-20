"use client";

import { useEffect, useRef } from "react";

export default function ScrollAmbientBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) return;

    let scrollFrameId: number | null = null;
    let pointerFrameId: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;

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
      layer.classList.remove("is-pointer-active");
      layer.classList.add("is-pointer-idle");
      layer.style.setProperty("--cursor-shift-x", "0px");
      layer.style.setProperty("--cursor-shift-x-reverse", "0px");
      layer.style.setProperty("--cursor-shift-y", "0px");
      layer.style.setProperty("--cursor-shift-y-reverse", "0px");
      idleTimer = null;
    };

    const updatePointerMotion = () => {
      const normalizedX = pointerX / window.innerWidth - 0.5;
      const normalizedY = pointerY / window.innerHeight - 0.5;
      const shiftX = normalizedX * 34;
      const shiftY = normalizedY * 26;

      layer.style.setProperty("--cursor-x", `${pointerX}px`);
      layer.style.setProperty("--cursor-y", `${pointerY}px`);
      layer.style.setProperty("--cursor-shift-x", `${shiftX}px`);
      layer.style.setProperty("--cursor-shift-x-reverse", `${shiftX * -1}px`);
      layer.style.setProperty("--cursor-shift-y", `${shiftY}px`);
      layer.style.setProperty("--cursor-shift-y-reverse", `${shiftY * -1}px`);
      layer.classList.remove("is-pointer-idle");
      layer.classList.add("is-pointer-active");
      pointerFrameId = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      pointerX = event.clientX;
      pointerY = event.clientY;

      if (pointerFrameId === null) {
        pointerFrameId = window.requestAnimationFrame(updatePointerMotion);
      }

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(setPointerIdle, 480);
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
      className="scroll-ambient is-pointer-idle pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="scroll-ambient-grid ambient-grid absolute -inset-24 opacity-55" />
      <div className="scroll-ambient-orb scroll-ambient-orb-left absolute -left-32 top-24 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-right absolute -right-36 -top-20 h-96 w-96 rounded-full bg-violet-200/25 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-center absolute left-[36%] top-[58%] h-72 w-72 rounded-full bg-cyan-100/25 blur-3xl" />
      <div className="cursor-ambient">
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
