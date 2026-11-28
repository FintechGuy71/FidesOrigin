"use client";

import { useEffect, useRef } from "react";

type Point3 = { x: number; y: number; z: number };
type Route = { from: [number, number]; to: [number, number]; color: "sun" | "sky" };

const ROUTES: Route[] = [
  { from: [1.29, 103.85], to: [22.32, 114.17], color: "sun" },
  { from: [51.51, -0.13], to: [40.71, -74.0], color: "sky" },
  { from: [35.68, 139.69], to: [1.29, 103.85], color: "sun" },
  { from: [50.11, 8.68], to: [22.32, 114.17], color: "sky" },
];

function latLon(lat: number, lon: number): Point3 {
  const p = (lat * Math.PI) / 180;
  const t = (lon * Math.PI) / 180;
  return { x: Math.cos(p) * Math.cos(t), y: Math.sin(p), z: Math.cos(p) * Math.sin(t) };
}

function rotate(point: Point3, angle: number, tilt: number): Point3 {
  const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
  const z = point.x * Math.sin(angle) + point.z * Math.cos(angle);
  return { x, y: point.y * Math.cos(tilt) - z * Math.sin(tilt), z: point.y * Math.sin(tilt) + z * Math.cos(tilt) };
}

function routePoint(route: Route, progress: number): Point3 {
  const a = latLon(...route.from);
  const b = latLon(...route.to);
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega) || 1;
  const u = Math.sin((1 - progress) * omega) / sinOmega;
  const v = Math.sin(progress * omega) / sinOmega;
  const lift = 1 + Math.sin(progress * Math.PI) * 0.24;
  return { x: (a.x * u + b.x * v) * lift, y: (a.y * u + b.y * v) * lift, z: (a.z * u + b.z * v) * lift };
}

export default function OriginField({ label, detail }: { label: string; detail: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const white = styles.getPropertyValue("--p-white").trim();
    const sun = styles.getPropertyValue("--p-sun").trim();
    const sky = styles.getPropertyValue("--p-sky").trim();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4;
    let width = 0;
    let height = 0;
    let raf = 0;
    let inView = true;
    const angle = -0.5;
    let pointerX = 0;
    let pointerY = 0;
    let started = performance.now();

    const points: Point3[] = [];
    const count = lowPower ? 780 : 1500;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
    }

    const resize = () => {
      const rect = frame.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const project = (point: Point3) => {
      const radius = Math.min(width, height) * (width < 640 ? 0.37 : 0.39);
      const perspective = 2.8 / (3.25 - point.z);
      return {
        x: width * 0.5 + point.x * radius * perspective,
        y: height * 0.49 - point.y * radius * perspective,
        z: point.z,
        scale: perspective,
      };
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = reduced ? 0 : (now - started) / 1000;
      const currentAngle = angle + elapsed * 0.055 + pointerX * 0.16;
      const tilt = -0.18 + pointerY * 0.08;
      const rotated = points.map((point) => project(rotate(point, currentAngle, tilt)));

      /* Rear hemisphere first: a dim but readable field, never a black canvas. */
      for (const point of rotated) {
        const front = point.z > 0;
        ctx.globalAlpha = front ? 0.24 + point.z * 0.6 : 0.055 + (point.z + 1) * 0.045;
        ctx.fillStyle = white;
        const size = (front ? 0.65 + point.z * 0.65 : 0.5) * point.scale;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(0.3, size), 0, Math.PI * 2);
        ctx.fill();
      }

      ROUTES.forEach((route, routeIndex) => {
        ctx.beginPath();
        let drawing = false;
        for (let step = 0; step <= 72; step += 1) {
          const progress = step / 72;
          const point = project(rotate(routePoint(route, progress), currentAngle, tilt));
          if (point.z < -0.18) {
            drawing = false;
            continue;
          }
          if (!drawing) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
          drawing = true;
        }
        ctx.globalAlpha = 0.82;
        ctx.strokeStyle = route.color === "sun" ? sun : sky;
        ctx.lineWidth = 1.15;
        ctx.stroke();

        for (const endpoint of [0, 1]) {
          const point = project(rotate(routePoint(route, endpoint), currentAngle, tilt));
          if (point.z < -0.1) continue;
          const pulse = reduced ? 0 : Math.sin(elapsed * 2 + routeIndex) * 1.2;
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = route.color === "sun" ? sun : sky;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 8 + pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }

        const travel = reduced ? 0.55 : (elapsed * 0.09 + routeIndex * 0.23) % 1;
        const packet = project(rotate(routePoint(route, travel), currentAngle, tilt));
        if (packet.z > -0.1) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = white;
          ctx.beginPath();
          ctx.arc(packet.x, packet.y, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (inView && !document.hidden) draw(now);
      raf = requestAnimationFrame(loop);
    };
    const onPointer = (event: PointerEvent) => {
      const rect = frame.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onLeave = () => { pointerX = 0; pointerY = 0; };
    const observer = new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; });
    const resizeObserver = new ResizeObserver(() => { resize(); draw(performance.now()); });

    resize();
    observer.observe(frame);
    resizeObserver.observe(frame);
    frame.addEventListener("pointermove", onPointer, { passive: true });
    frame.addEventListener("pointerleave", onLeave);
    if (reduced) draw(performance.now());
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resizeObserver.disconnect();
      frame.removeEventListener("pointermove", onPointer);
      frame.removeEventListener("pointerleave", onLeave);
      started = 0;
    };
  }, []);

  return (
    <div ref={frameRef} className="origin-field">
      <canvas ref={canvasRef} aria-hidden="true" className="origin-field-canvas" />
      <div className="origin-field-top">
        <span>{label}</span>
        <span className="origin-field-cross" aria-hidden="true">+</span>
      </div>
      <div className="origin-field-axis origin-field-axis-x" aria-hidden="true" />
      <div className="origin-field-axis origin-field-axis-y" aria-hidden="true" />
      <div className="origin-field-bottom">
        <span>{detail}</span>
        <span>11155111</span>
      </div>
    </div>
  );
}
