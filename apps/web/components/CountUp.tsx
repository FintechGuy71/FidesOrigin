"use client";

import { useEffect, useRef, useState } from "react";

/* ================================================================
   COUNT-UP — 数字滚动计数（进入视口触发一次）。
   仅处理纯数字（可含千分位）；"<50ms"、"24/7" 等原样直出。
   尊重 prefers-reduced-motion：直接显示终值。
   ================================================================ */

export default function CountUp({ value, className, style }: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const m = value.match(/^([\d,]+)(.*)$/);
  const target = m ? parseInt(m[1].replace(/,/g, ""), 10) : NaN;
  const suffix = m ? m[2] : "";
  const fmt = (n: number) => n.toLocaleString("en-US") + suffix;

  const ref = useRef<HTMLSpanElement>(null);
  /* 初始即终值：IO 未触发（后台标签/未滚动到）时永远显示正确数字；
     仅当确认进入视口且允许动效时才回零播放 count-up。 */
  const [text, setText] = useState(value);
  // [AUDIT FIX 2026-09-18 R3] value 在元素不可见时变更会无限期显示旧数值
  // （IO 未触发不执行 setText）。prop 变更时立即同步为最新终值。
  useEffect(() => { setText(value); }, [value]);

  useEffect(() => {
    if (Number.isNaN(target)) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const dur = 1400;
      const t0 = performance.now();
      setText(fmt(0));
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        /* ease-out-expo，与全站 --ease-out 同源气质 */
        const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        setText(fmt(Math.round(target * e)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      /* 保底：后台标签页 rAF 被节流时，定时器也会把终值落定 */
      fallback = setTimeout(() => setText(fmt(target)), dur + 1200);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (fallback) clearTimeout(fallback);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [value]);

  return (
    <span ref={ref} className={className} style={style}>
      {Number.isNaN(target) ? value : text}
    </span>
  );
}
