/**
 * The two layouts a fitting list can take.
 *
 * `table` is the classic killboard row: one item per full-width line. On a
 * card about 1200px wide that spends roughly 760px of every row on nothing —
 * the fixed columns need ~300px and an item name takes ~130px of what is
 * left. `grid` flows the same cells left to right instead.
 */
export type FittingView = 'grid' | 'table';

/** Which items the fitting list shows. */
export type FittingScope = 'all' | 'destroyed' | 'dropped';
