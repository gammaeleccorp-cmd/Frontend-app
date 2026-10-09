export const runtime = {
  useMockApi: String(import.meta.env.VITE_USE_MOCK_API ?? "false").toLowerCase() === "true",
  apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL ?? "https://api.gamma-tech.ir").replace(/\/$/, ""),
};

// Support channels come only from build configuration; nothing is invented.
export const support = {
  phone: String(import.meta.env.VITE_SUPPORT_PHONE ?? "").trim(),
  email: String(import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim(),
  url: String(import.meta.env.VITE_SUPPORT_URL ?? "").trim(),
  hours: String(import.meta.env.VITE_SUPPORT_HOURS ?? "").trim(),
};
