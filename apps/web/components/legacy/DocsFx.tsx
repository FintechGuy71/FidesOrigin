"use client";

import { useEffect } from "react";

type Props = { copyLabel: string; copiedLabel: string; sidebarLabel: string };

export default function DocsFx({ copyLabel, copiedLabel, sidebarLabel }: Props) {
  useEffect(() => {
    const sidebar = document.getElementById("docsSidebar");
    const toggle = document.getElementById("sidebarToggle");
    if (toggle) {
      const visible = toggle.textContent?.trim() || "Documentation Menu";
      toggle.setAttribute("aria-label", `${sidebarLabel}: ${visible}`);
    }
    const onToggle = () => {
      if (!sidebar || !toggle) return;
      const active = sidebar.classList.toggle("active");
      toggle.setAttribute("aria-expanded", active ? "true" : "false");
    };
    toggle?.addEventListener("click", onToggle);

    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    document.querySelectorAll(".docs-code-copy").forEach((btn) => { btn.textContent = copyLabel; });

    document.querySelectorAll<HTMLElement>(".docs-code-block > pre").forEach((pre) => {
      if (pre.scrollWidth > pre.clientWidth && !pre.hasAttribute("tabindex")) pre.setAttribute("tabindex", "0");
    });

    const onCopy = (event: Event) => {
      const btn = (event.target as Element).closest(".docs-code-copy");
      if (!btn) return;
      const code = btn.closest(".docs-code-block")?.querySelector("pre");
      if (!code) return;
      navigator.clipboard.writeText(code.textContent || "").then(() => {
        btn.textContent = copiedLabel;
        btn.classList.add("copied");
        clearTimeout(timers.get(btn));
        timers.set(btn, setTimeout(() => {
          btn.textContent = copyLabel;
          btn.classList.remove("copied");
        }, 2000));
      }).catch(() => {
        btn.textContent = copyLabel;
        btn.classList.remove("copied");
      });
    };
    document.addEventListener("click", onCopy);

    return () => {
      toggle?.removeEventListener("click", onToggle);
      document.removeEventListener("click", onCopy);
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [copyLabel, copiedLabel, sidebarLabel]);

  return null;
}
