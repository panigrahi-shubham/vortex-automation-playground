import { WorkflowError } from '../../workflows/errors';

type Options = { size: string[]; color: string[] };
function options(value: unknown): Options | null {
  if (value === null || value === undefined) return null;
  const v = value as Options;
  if (!Array.isArray(v.size) || !Array.isArray(v.color) || !v.size.length || !v.color.length ||
      [...v.size, ...v.color].some(s => typeof s !== 'string' || !s.length || s.length > 100)) {
    throw new WorkflowError(409, 'Product options are unavailable');
  }
  return v;
}

// Stable JSON also serves as the cart line's unique variant key and order snapshot.
export function variantKey(configuration: unknown, selection: unknown): string {
  const allowed = options(configuration);
  if (!allowed) {
    if (selection !== undefined && selection !== null && selection !== '') throw new WorkflowError(422, 'This product has no options');
    return '';
  }
  const chosen = selection as { size?: unknown; color?: unknown } | null;
  if (!chosen || typeof chosen !== 'object' || typeof chosen.size !== 'string' || !allowed.size.includes(chosen.size)) throw new WorkflowError(422, 'Please select a valid size');
  if (typeof chosen.color !== 'string' || !allowed.color.includes(chosen.color)) throw new WorkflowError(422, 'Please select a valid colour');
  return JSON.stringify({ size: chosen.size, color: chosen.color });
}

export function variantAvailable(configuration: unknown, key: string) {
  try { return variantKey(configuration, key ? JSON.parse(key) : null) === key; }
  catch { return false; }
}
