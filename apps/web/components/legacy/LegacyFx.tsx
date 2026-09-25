"use client";

import { useEffect } from "react";
/* [AUDIT FIX] 未使用的 Dict 类型导入已删（组件 props 只用 string） */

/* ================================================================
   LEGACY FX — scroll-reveal IntersectionObserver + scroll-to-top
   button for legacy-styled pages (replaces index-scripts.js /
   blog-scripts.js).
   ================================================================ */

export default function LegacyFx({ scrollTopLabel }: { scrollTopLabel: string }) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { /* [R11-G2] 预热 240px：元素进入视口前即开始淡入，快速滚动时用户
           看到的是已落定内容（原 -40px 延迟触发在快滚下产生空白闪现） */
        threshold: 0.08, rootMargin: "0px 0px 240px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    const btn = document.createElement("button");
    btn.className = "scroll-top";
    btn.innerHTML = "&uarr;";
    btn.setAttribute("aria-label", scrollTopLabel);
    document.body.appendChild(btn);
    const onScroll = () => btn.classList.toggle("visible", window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    const onClick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    btn.addEventListener("click", onClick);

    /* [R11-M6] 合约地址点击复制（docs 页 .copyable[data-copy]）：
       事件委托挂在 document 上，零逐元素绑定；复制成功后短暂追加
       ✓ 反馈（CSS ::after）。 */
    const onCopyClick = async (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-copy]");
      if (!el) return;
      const value = el.getAttribute("data-copy");
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        el.classList.add("copied");
        setTimeout(() => el.classList.remove("copied"), 1200);
      } catch {
        /* 剪贴板权限被拒时静默（title 提示仍在） */
      }
    };
    document.addEventListener("click", onCopyClick);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      btn.removeEventListener("click", onClick);
      document.removeEventListener("click", onCopyClick);
      btn.remove();
    };
  }, [scrollTopLabel]);

  return null;
}
