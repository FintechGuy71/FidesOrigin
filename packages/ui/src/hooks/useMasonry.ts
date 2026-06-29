import { useState, useEffect, useRef, useCallback } from 'react';

export interface MasonryItem {
  id: string;
  height: number;
  [key: string]: unknown;
}

export interface UseMasonryOptions<T extends MasonryItem> {
  /** Items to arrange in masonry layout */
  items: T[];
  /** Number of columns */
  columns: number;
  /** Gap between items in pixels */
  gap?: number;
  /** Container width in pixels */
  containerWidth?: number;
  /** Whether to animate layout changes */
  animate?: boolean;
}

export interface MasonryLayout {
  /** Column assignments for each item */
  columns: Array<Array<{ id: string; top: number; height: number }>>;
  /** Total height of each column */
  columnHeights: number[];
  /** Maximum height across all columns */
  maxHeight: number;
}

/**
 * useMasonry - Arrange items in a Pinterest-style masonry layout
 *
 * Distributes items across columns to minimize total height difference.
 * Returns column assignments and calculated positions for each item.
 *
 * @example
 * ```tsx
 * const items = [
 *   { id: '1', height: 200 },
 *   { id: '2', height: 300 },
 *   { id: '3', height: 150 },
 * ];
 * const layout = useMasonry({ items, columns: 3, gap: 16 });
 *
 * return (
 *   <div style={{ display: 'flex', gap: 16 }}>
 *     {layout.columns.map((col, i) => (
 *       <div key={i} style={{ flex: 1 }}>
 *         {col.map((item) => (
 *           <div key={item.id} style={{ height: item.height, marginBottom: 16 }}>
 *             Item {item.id}
 *           </div>
 *         ))}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useMasonry<T extends MasonryItem>(
  options: UseMasonryOptions<T>
): MasonryLayout {
  const { items, columns, gap = 16, animate = true } = options;

  const layout = useRef<MasonryLayout>({
    columns: Array.from({ length: columns }, () => []),
    columnHeights: Array(columns).fill(0),
    maxHeight: 0,
  });

  const [result, setResult] = useState<MasonryLayout>(layout.current);

  const calculateLayout = useCallback(() => {
    const cols: Array<Array<{ id: string; top: number; height: number }>> =
      Array.from({ length: columns }, () => []);
    const heights = Array(columns).fill(0);

    items.forEach((item) => {
      // Find the shortest column
      const shortestCol = heights.indexOf(Math.min(...heights));
      const top = heights[shortestCol];

      cols[shortestCol].push({
        id: item.id,
        top,
        height: item.height,
      });

      heights[shortestCol] += item.height + gap;
    });

    // Remove trailing gap from heights
    const finalHeights = heights.map((h) => Math.max(0, h - gap));
    const maxHeight = Math.max(...finalHeights);

    return {
      columns: cols,
      columnHeights: finalHeights,
      maxHeight,
    };
  }, [items, columns, gap]);

  useEffect(() => {
    const newLayout = calculateLayout();
    layout.current = newLayout;

    if (animate) {
      // Use requestAnimationFrame for smooth updates
      const raf = requestAnimationFrame(() => {
        setResult(newLayout);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setResult(newLayout);
    }
  }, [calculateLayout, animate]);

  return result;
}

export default useMasonry;
