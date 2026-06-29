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
    columns: Array<Array<{
        id: string;
        top: number;
        height: number;
    }>>;
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
export declare function useMasonry<T extends MasonryItem>(options: UseMasonryOptions<T>): MasonryLayout;
export default useMasonry;
