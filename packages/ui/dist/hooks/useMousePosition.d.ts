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
export declare function useMousePosition(options?: UseMousePositionOptions): MousePosition;
export default useMousePosition;
