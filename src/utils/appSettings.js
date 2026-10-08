// Per-device app preferences. They change real behaviour (polling interval,
// motion and text size) and survive reloads through localStorage.
export const SETTINGS_KEY = "gamma_app_settings";
export const REFRESH_OPTIONS = [
  { value: 15, label: "هر ۱۵ ثانیه" },
  { value: 30, label: "هر ۳۰ ثانیه" },
  { value: 60, label: "هر ۱ دقیقه" },
  { value: 0, label: "خاموش (فقط دستی)" },
];
export const DEFAULT_SETTINGS = { refreshSeconds: 30, reduceMotion: false, largeText: false };

export function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const refresh = REFRESH_OPTIONS.some((item) => item.value === parsed.refreshSeconds) ? parsed.refreshSeconds : DEFAULT_SETTINGS.refreshSeconds;
    return { refreshSeconds: refresh, reduceMotion: Boolean(parsed.reduceMotion), largeText: Boolean(parsed.largeText) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage may be blocked */ }
  applySettings(settings);
  return settings;
}

export function applySettings(settings) {
  const root = document.documentElement;
  root.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  root.classList.toggle("large-text", Boolean(settings.largeText));
}
