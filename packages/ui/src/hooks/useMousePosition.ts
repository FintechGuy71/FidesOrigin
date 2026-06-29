import { useState, useEffect, useCallback, useRef } from 'react';

export interface MousePosition {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  isInside: boolean;
}

export interface UseMousePositionOptions {
  /** Target element ref. If null, tracks window mouse position */
  ref?: React.RefObject<HTMLElement | null>;
  /** Whether to normalize coordinates to 0-1 range */
  normalize?: boolean;
  /** Update interval in ms (0 for every frame) */
  throttleMs?: number;
}

/**
 * useMousePosition - Track mouse position relative to an element or window
 *
 * Returns current mouse coordinates, optionally normalized to the element's
 * bounding box. Useful for interactive visualizations and hover effects.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const { x, y, normalizedX, normalizedY } = useMousePosition({ ref, normalize: true });
 *
 * return <div ref={ref}>Mouse at {x}, {y}</div>;
 * ```
 */
export function useMousePosition(options: UseMousePositionOptions = {}): MousePosition {
  const { ref, normalize = false, throttleMs = 0 } = options;
  const [position, setPosition] = useState<MousePosition>({
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
    isInside: false,
  });

  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number>(0);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      if (throttleMs > 0 && now - lastUpdateRef.current < throttleMs) {
        return;
      }
      lastUpdateRef.current = now;

      if (ref?.current) {
        const rect = ref.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const isInside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;

        setPosition({
          x,
          y,
          normalizedX: normalize ? x / rect.width : x,
          normalizedY: normalize ? y / rect.height : y,
          isInside,
        });
      } else {
        setPosition({
          x: clientX,
          y: clientY,
          normalizedX: normalize ? clientX / window.innerWidth : clientX,
          normalizedY: normalize ? clientY / window.innerHeight : clientY,
          isInside: true,
        });
      }
    },
    [ref, normalize, throttleMs]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (throttleMs > 0) {
        updatePosition(e.clientX, e.clientY);
      } else {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          updatePosition(e.clientX, e.clientY);
        });
      }
    };

    const handleMouseLeave = () => {
      setPosition((prev) => ({ ...prev, isInside: false }));
    };

    const handleMouseEnter = () => {
      setPosition((prev) => ({ ...prev, isInside: true }));
    };

    const target = ref?.current || window;
    target.addEventListener('mousemove', handleMouseMove as EventListener);
    target.addEventListener('mouseleave', handleMouseLeave as EventListener);
    target.addEventListener('mouseenter', handleMouseEnter as EventListener);

    return () => {
      target.removeEventListener('mousemove', handleMouseMove as EventListener);
      target.removeEventListener('mouseleave', handleMouseLeave as EventListener);
      target.removeEventListener('mouseenter', handleMouseEnter as EventListener);
      cancelAnimationFrame(rafRef.current);
    };
  }, [ref, updatePosition, throttleMs]);

  return position;
}

export default useMousePosition;
