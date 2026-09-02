/** Tracks cell locations for cross-sheet Excel formulas. */

function colLetter(col: number): string {
  let n = col;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export class ExportCellRegistry {
  private readonly sheetByKey = new Map<string, string>();
  private readonly rowByKey = new Map<string, number>();
  private readonly colByKey = new Map<string, number>();

  /** Register a row-level line item (used across month/year columns). */
  registerRow(sheetName: string, row: number, key: string) {
    this.sheetByKey.set(key, sheetName);
    this.rowByKey.set(key, row);
  }

  /** Register a single cell (e.g. assumption value). */
  registerCell(sheetName: string, row: number, col: number, key: string) {
    this.sheetByKey.set(key, sheetName);
    this.rowByKey.set(key, row);
    this.colByKey.set(key, col);
  }

  row(key: string): number | undefined {
    return this.rowByKey.get(key);
  }

  /** Absolute reference e.g. `'ASSUMPTIONS'!$C$5` */
  absRef(key: string, col?: number): string | null {
    const sheet = this.sheetByKey.get(key);
    const row = this.rowByKey.get(key);
    if (!sheet || row == null) return null;
    const c = col ?? this.colByKey.get(key);
    if (c == null) return null;
    return `'${sheet}'!$${colLetter(c)}$${row}`;
  }

  /** Same-sheet relative ref for one column e.g. `B5` */
  localRef(key: string, col: number): string | null {
    const row = this.rowByKey.get(key);
    if (row == null) return null;
    return `${colLetter(col)}${row}`;
  }

  /** Cross-sheet ref for one column e.g. `'MONTHLY P&L'!B5` */
  cellRef(key: string, col: number): string | null {
    const sheet = this.sheetByKey.get(key);
    const local = this.localRef(key, col);
    if (!sheet || !local) return null;
    return `'${sheet}'!${local}`;
  }

  sumRange(sheetName: string, row: number, colStart: number, colEnd: number): string {
    const start = `${colLetter(colStart)}${row}`;
    const end = `${colLetter(colEnd)}${row}`;
    return `SUM('${sheetName}'!${start}:${end})`;
  }
}

export { colLetter };
