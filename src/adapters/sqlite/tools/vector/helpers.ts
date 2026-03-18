/**
 * Vector Math Helpers
 *
 * Pure math functions for vector similarity and distance calculations.
 */

import { DbMcpError, ErrorCategory } from "../../../../utils/errors/index.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new DbMcpError(
      "Vector dimensions must match",
      "VECTOR_MISMATCH",
      ErrorCategory.VALIDATION,
    );
  }
  let dotProd = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProd += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProd / magnitude;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new DbMcpError(
      "Vector dimensions must match",
      "VECTOR_MISMATCH",
      ErrorCategory.VALIDATION,
    );
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    const diff = aVal - bVal;
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new DbMcpError(
      "Vector dimensions must match",
      "VECTOR_MISMATCH",
      ErrorCategory.VALIDATION,
    );
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

export function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number);
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number);
      }
    } catch {
      // Not valid JSON
    }
  }
  throw new DbMcpError(
    "Invalid vector format",
    "VECTOR_INVALID",
    ErrorCategory.VALIDATION,
  );
}
