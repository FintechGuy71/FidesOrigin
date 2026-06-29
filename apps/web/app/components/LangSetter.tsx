"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function LangSetter() {
  const pathname = usePathname();

  useEffect(() => {
    const lang = pathname?.startsWith("/cn") ? "zh-CN" : pathname?.startsWith("/tw") ? "zh-TW" : "en";
    document.documentElement.lang = lang;
  }, [pathname]);

  return null;
}
