"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/* ================================================================
   REVEAL — 克制的企业级滚动进入动效。
   - IntersectionObserver 触发一次即断开（不反复进出）
   - prefers-reduced-motion：直接终态渲染，零动画
   - 初始不可见由 CSS 类 .fio-reveal 承担；JS 失败时
     useEffect 兜底把 is-in 加上，内容永不丢失
   ================================================================ */

export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  /** 秒，级联错峰用（0 / 0.1 / 0.2 …） */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay
    ? { ["--fio-reveal-delay" as string]: `${delay}s` }
    : undefined;

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`fio-reveal ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
