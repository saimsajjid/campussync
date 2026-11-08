/**
 * Safe JSON parsing utility that avoids crashing on primitive strings, numbers, or already parsed objects.
 */
export function safeJsonParse<T = any>(val: any): T {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val !== 'string') {
    return val as T;
  }
  const trimmed = val.trim();
  // Only attempt JSON.parse if it looks like a serialized JSON object or array
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return val as unknown as T;
    }
  }
  return val as unknown as T;
}
