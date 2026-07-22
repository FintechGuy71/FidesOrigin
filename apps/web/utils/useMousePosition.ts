"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface MousePosition {
  x: number;
  y: number;
}

/**
 * Simple hook to track global mouse position
 * Used by Spotlight component
 */
export default function useMousePosition(): MousePosition {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return position;
}
