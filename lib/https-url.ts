export const HTTPS_PREFIX = "https://";

/** True for a complete https:// URL. Only such a value may ever be saved or uploaded. */
export function isHttpsUrl(value: string): boolean {
  return value.startsWith(HTTPS_PREFIX) && value.length > HTTPS_PREFIX.length;
}

/**
 * True while a typed value can still become an https:// URL ("", "h", "https:/", "https://x").
 * The field keeps every keystroke and shows its error only once this is false.
 */
export function canBecomeHttpsUrl(value: string): boolean {
  return value.startsWith(HTTPS_PREFIX) || HTTPS_PREFIX.startsWith(value);
}
