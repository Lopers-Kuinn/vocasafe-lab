"use client";

import { useEffect, useRef } from "react";

const GRID_SPACING = 42;
const GRID_SAMPLE_STEP = 12;
const POINTER_RADIUS = 155;
const WAVE_INTERVAL_MS = 8000;
const WAVE_DURATION_MS = 6000;
const WAVE_MARGIN = 220;

type GridOrientation = "horizontal" | "vertical";

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

export default function ScrollAmbientBackground() {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!layer || !canvas || !context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

    let width = 1;
    let height = 1;
    let animationFrameId: number | null = null;
    let scrollFrameId: number | null = null;
    let lastFrameAt = performance.now();
    let lastDrawAt = 0;
    let pointerX = width / 2;
    let pointerY = height / 2;
    let pointerMovedAt = 0;
    let pointerStrength = 0;

    const updateScrollMotion = () => {
      const scrollY = Math.min(window.scrollY, 2400);
      layer.style.setProperty("--scroll-drift-slow", `${scrollY * -0.035}px`);
      layer.style.setProperty("--scroll-drift-medium", `${scrollY * 0.075}px`);
      layer.style.setProperty("--scroll-drift-fast", `${scrollY * -0.12}px`);
      layer.style.setProperty("--scroll-drift-side", `${scrollY * 0.025}px`);
      layer.style.setProperty(
        "--scroll-drift-side-reverse",
        `${scrollY * -0.025}px`,
      );
      scrollFrameId = null;
    };

    const handleScroll = () => {
      if (scrollFrameId !== null) return;
      scrollFrameId = window.requestAnimationFrame(updateScrollMotion);
    };

    const getGridPoint = (
      originalX: number,
      originalY: number,
      orientation: GridOrientation,
      waveCenter: number,
      waveActive: boolean,
    ) => {
      let x = originalX;
      let y = originalY;

      if (waveActive) {
        const horizontalDistance = originalX - waveCenter;
        if (Math.abs(horizontalDistance) < WAVE_MARGIN) {
          const waveDistance = horizontalDistance / WAVE_MARGIN;
          const waveInfluence = Math.exp(
            -(waveDistance * waveDistance) * 2.4,
          );

          if (orientation === "horizontal") {
            y +=
              Math.sin(horizontalDistance * 0.045) * waveInfluence * 11;
          } else {
            x +=
              Math.sin(originalY * 0.052 + waveCenter * 0.018) *
              waveInfluence *
              8;
          }
        }
      }

      if (pointerStrength > 0.005) {
        const deltaX = x - pointerX;
        const deltaY = y - pointerY;
        if (
          Math.abs(deltaX) < POINTER_RADIUS &&
          Math.abs(deltaY) < POINTER_RADIUS
        ) {
          const distance = Math.hypot(deltaX, deltaY);

          if (distance > 0 && distance < POINTER_RADIUS) {
            const proximity = 1 - distance / POINTER_RADIUS;
            const bend = proximity * proximity * pointerStrength * 28;
            x += (deltaX / distance) * bend;
            y += (deltaY / distance) * bend;
          }
        }
      }

      return { x, y };
    };

    const drawGrid = (now: number, motionEnabled: boolean) => {
      context.clearRect(0, 0, width, height);

      const cycleTime = now % WAVE_INTERVAL_MS;
      const waveActive = motionEnabled && cycleTime < WAVE_DURATION_MS;
      const waveProgress = waveActive
        ? smoothStep(cycleTime / WAVE_DURATION_MS)
        : 0;
      const waveCenter =
        -WAVE_MARGIN + waveProgress * (width + WAVE_MARGIN * 2);

      context.beginPath();

      for (
        let baseY = -GRID_SPACING;
        baseY <= height + GRID_SPACING;
        baseY += GRID_SPACING
      ) {
        for (
          let baseX = -GRID_SAMPLE_STEP;
          baseX <= width + GRID_SAMPLE_STEP;
          baseX += GRID_SAMPLE_STEP
        ) {
          const point = getGridPoint(
            baseX,
            baseY,
            "horizontal",
            waveCenter,
            waveActive,
          );
          if (baseX === -GRID_SAMPLE_STEP) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
      }

      for (
        let baseX = -GRID_SPACING;
        baseX <= width + GRID_SPACING;
        baseX += GRID_SPACING
      ) {
        for (
          let baseY = -GRID_SAMPLE_STEP;
          baseY <= height + GRID_SAMPLE_STEP;
          baseY += GRID_SAMPLE_STEP
        ) {
          const point = getGridPoint(
            baseX,
            baseY,
            "vertical",
            waveCenter,
            waveActive,
          );
          if (baseY === -GRID_SAMPLE_STEP) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
      }

      context.lineWidth = 1;
      context.strokeStyle = "rgba(8, 119, 90, 0.15)";
      context.stroke();

      if (waveActive) {
        const waveGradient = context.createLinearGradient(
          waveCenter - WAVE_MARGIN,
          0,
          waveCenter + WAVE_MARGIN,
          0,
        );
        waveGradient.addColorStop(0, "rgba(16, 185, 129, 0)");
        waveGradient.addColorStop(0.34, "rgba(16, 185, 129, 0.18)");
        waveGradient.addColorStop(0.5, "rgba(5, 150, 105, 0.9)");
        waveGradient.addColorStop(0.66, "rgba(16, 185, 129, 0.18)");
        waveGradient.addColorStop(1, "rgba(16, 185, 129, 0)");
        context.lineWidth = 1.35;
        context.strokeStyle = waveGradient;
        context.stroke();
      }
    };

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        hasFinePointer ? 1.5 : 1,
      );

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      if (reduceMotion) drawGrid(0, false);
    };

    const drawFrame = (now: number) => {
      const pointerIsRecent =
        hasFinePointer && now - pointerMovedAt < 650;
      const waveIsActive = now % WAVE_INTERVAL_MS < WAVE_DURATION_MS;
      const sceneIsActive =
        waveIsActive || pointerIsRecent || pointerStrength > 0.005;
      const activeFrameRate = hasFinePointer ? 60 : 30;
      const minimumFrameDuration = sceneIsActive
        ? 1000 / activeFrameRate
        : 1000 / 8;

      if (now - lastDrawAt >= minimumFrameDuration) {
        const elapsedSeconds = Math.min((now - lastFrameAt) / 1000, 0.1);
        const targetStrength = pointerIsRecent ? 1 : 0;
        const smoothing = 1 - Math.exp(-elapsedSeconds * 8);
        pointerStrength += (targetStrength - pointerStrength) * smoothing;

        drawGrid(now, true);
        lastFrameAt = now;
        lastDrawAt = now;
      }

      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerMovedAt = performance.now();
    };

    const handlePointerLeave = () => {
      pointerMovedAt = 0;
    };

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const startAnimation = () => {
      if (reduceMotion || animationFrameId !== null) return;
      lastFrameAt = performance.now();
      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation();
      } else {
        startAnimation();
      }
    };

    resizeCanvas();
    updateScrollMotion();
    startAnimation();

    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (hasFinePointer && !reduceMotion) {
      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      document.documentElement.addEventListener(
        "mouseleave",
        handlePointerLeave,
      );
      window.addEventListener("blur", handlePointerLeave);
    }

    return () => {
      stopAnimation();
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener(
        "mouseleave",
        handlePointerLeave,
      );
      window.removeEventListener("blur", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (scrollFrameId !== null) window.cancelAnimationFrame(scrollFrameId);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="scroll-ambient pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-70 sm:opacity-75"
      />
      <div className="scroll-ambient-orb scroll-ambient-orb-left absolute -left-32 top-24 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-right absolute -right-36 -top-20 h-96 w-96 rounded-full bg-violet-200/25 blur-3xl" />
      <div className="scroll-ambient-orb scroll-ambient-orb-center absolute left-[36%] top-[58%] h-72 w-72 rounded-full bg-cyan-100/25 blur-3xl" />
    </div>
  );
}
