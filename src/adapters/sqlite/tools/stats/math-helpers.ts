/**
 * Statistical Math Helpers
 *
 * Pure math functions for statistical inference (CDF, t-distribution, matrix operations).
 */

/**
 * Approximate normal CDF for p-value calculation
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Approximate t-distribution p-value (two-tailed)
 */
export function tDistPValue(t: number, df: number): number {
  if (df > 30) {
    return 2 * (1 - normalCDF(Math.abs(t)));
  }
  const x = df / (df + t * t);
  const p = Math.pow(x, df / 2) * 0.5;
  return Math.min(1, Math.max(0, 2 * p));
}

// Matrix utility functions for polynomial regression
export function matrixTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    const row: number[] = [];
    for (let i = 0; i < rows; i++) {
      row.push(A[i]?.[j] ?? 0);
    }
    result.push(row);
  }
  return result;
}

export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0]?.length ?? 0;
  const colsB = B[0]?.length ?? 0;
  const result: number[][] = [];
  for (let i = 0; i < rowsA; i++) {
    const row: number[] = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += (A[i]?.[k] ?? 0) * (B[k]?.[j] ?? 0);
      }
      row.push(sum);
    }
    result.push(row);
  }
  return result;
}

export function matrixInverse(A: number[][]): number[][] {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const currentVal = Math.abs(aug[row]?.[col] ?? 0);
      const maxVal = Math.abs(aug[maxRow]?.[col] ?? 0);
      if (currentVal > maxVal) {
        maxRow = row;
      }
    }

    const temp = aug[col];
    const swapRow = aug[maxRow];
    if (temp && swapRow) {
      aug[col] = swapRow;
      aug[maxRow] = temp;
    }

    const pivotRow = aug[col];
    if (!pivotRow) continue;

    const pivot = pivotRow[col] ?? 0;
    if (Math.abs(pivot) < 1e-10) {
      throw new Error("Matrix is singular, cannot compute inverse");
    }

    for (let j = 0; j < 2 * n; j++) {
      pivotRow[j] = (pivotRow[j] ?? 0) / pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const currentRow = aug[row];
        if (!currentRow) continue;
        const factor = currentRow[col] ?? 0;
        for (let j = 0; j < 2 * n; j++) {
          currentRow[j] = (currentRow[j] ?? 0) - factor * (pivotRow[j] ?? 0);
        }
      }
    }
  }

  return aug.map((row) => row.slice(n));
}
