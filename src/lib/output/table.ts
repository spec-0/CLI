/**
 * Table renderer. Wraps cli-table3 with a small, opinionated API:
 *
 *   renderTable(rows, [
 *     { key: "name",    header: "Name" },
 *     { key: "version", header: "Ver" },
 *     { key: "team",    header: "Team", format: (v) => v ?? "—" },
 *   ]);
 *
 * Always returns a string (caller decides where to write it). Uses no colour;
 * the caller is responsible for any chalk wrapping if a TTY is attached.
 */

import Table from "cli-table3";

export interface ColumnSpec<T> {
  key: keyof T & string;
  header: string;
  format?: (value: T[keyof T], row: T) => string;
}

export function renderTable<T extends Record<string, unknown>>(
  rows: T[],
  columns: ColumnSpec<T>[],
): string {
  const table = new Table({
    head: columns.map((c) => c.header),
    style: { head: [], border: [] }, // disable cli-table3's own colouring
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });

  for (const row of rows) {
    table.push(
      columns.map((c) => {
        const v = row[c.key];
        if (c.format) return c.format(v as T[keyof T], row);
        if (v === null || v === undefined) return "—";
        return String(v);
      }),
    );
  }

  return table.toString();
}
