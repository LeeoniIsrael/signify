export function readSetting<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`signify:${key}`);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}
export function saveSetting(key: string, value: unknown) {
  try {
    localStorage.setItem(`signify:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
