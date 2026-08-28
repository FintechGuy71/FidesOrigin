"use client";

import { useEffect } from "react";
import type { Dict } from "@/i18n/dictionaries/en";

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
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
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

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      btn.removeEventListener("click", onClick);
      btn.remove();
    };
  }, [scrollTopLabel]);

  return null;
}
