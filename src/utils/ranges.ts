export const MAX_NUMBER = 1_000_000_000_000;
export const MAX_EXPANDED_RANGE_SIZE = 5000;
export const MAX_TOTAL_CUSTOM_NUMBERS = 10000;

export interface RangeValidationResult {
  valid: boolean;
  error?: string;
  numbers?: number[];
}

export function validateCustomRanges(input: string): RangeValidationResult {
  const parts = input
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const uniqueNumbers = new Set<number>();

  if (parts.length === 0) {
    return { valid: false, error: 'No valid numbers found' };
  }

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\[|\]$/g, '').trim();

    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (!Number.isSafeInteger(n) || n < 0 || n > MAX_NUMBER) {
        return { valid: false, error: `Invalid number: ${rawPart}` };
      }
      uniqueNumbers.add(n);
      continue;
    }

    if (/^\d+\s*-\s*\d+$/.test(part)) {
      const [startText, endText] = part.split('-').map(value => value.trim());
      const start = Number(startText);
      const end = Number(endText);

      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || end > MAX_NUMBER) {
        return { valid: false, error: `Invalid range: ${rawPart}` };
      }

      const rangeSize = end - start + 1;
      if (rangeSize > MAX_EXPANDED_RANGE_SIZE) {
        return {
          valid: false,
          error: `Range too large: ${rawPart}. Keep each range at ${MAX_EXPANDED_RANGE_SIZE.toLocaleString()} numbers or fewer.`
        };
      }

      for (let value = start; value <= end; value++) {
        uniqueNumbers.add(value);
        if (uniqueNumbers.size > MAX_TOTAL_CUSTOM_NUMBERS) {
          return {
            valid: false,
            error: `Too many numbers selected. Keep the total at ${MAX_TOTAL_CUSTOM_NUMBERS.toLocaleString()} numbers or fewer.`
          };
        }
      }
      continue;
    }

    return { valid: false, error: `Invalid entry: ${rawPart}` };
  }

  return { valid: true, numbers: [...uniqueNumbers] };
}
