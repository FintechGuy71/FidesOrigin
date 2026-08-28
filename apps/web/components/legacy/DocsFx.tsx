"use client";

import { useEffect } from "react";

/* ================================================================
   DOCS FX — docs-page interactions ported from the legacy inline
   scripts: mobile sidebar toggle + code-block copy buttons.
   ================================================================ */

type Props = { copyLabel: string; copiedLabel: string };

export default function DocsFx({ copyLabel, copiedLabel }: Props) {
  useEffect(() => {
    const sidebar = document.getElementById("docsSidebar");
    const toggle = document.getElementById("sidebarToggle");
    const onToggle = () => {
      if (!sidebar || !toggle) return;
      const active = sidebar.classList.toggle("active");
      toggle.setAttribute("aria-expanded", active ? "true" : "false");
    };
    toggle?.addEventListener("click", onToggle);

    const timers = new Map<Element, ReturnType<typeof setTimeout>>();

    // Localize the initial (hardcoded) labels coming from converted HTML
    document.querySelectorAll(".docs-code-copy").forEach((btn) => {
      btn.textContent = copyLabel;
    });

    const onCopy = (e: Event) => {
      const btn = (e.target as Element).closest(".docs-code-copy");
      if (!btn) return;
      const block = btn.closest(".docs-code-block");
      const code = block?.querySelector("pre");
      if (!code) return;
      navigator.clipboard.writeText(code.textContent || "").then(() => {
        btn.textContent = copiedLabel;
        btn.classList.add("copied");
        clearTimeout(timers.get(btn));
        timers.set(
          btn,
          setTimeout(() => {
            btn.textContent = copyLabel;
            btn.classList.remove("copied");
          }, 2000)
        );
      });
    };
    document.addEventListener("click", onCopy);

    return () => {
      toggle?.removeEventListener("click", onToggle);
      document.removeEventListener("click", onCopy);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [copyLabel, copiedLabel]);

  return null;
}
