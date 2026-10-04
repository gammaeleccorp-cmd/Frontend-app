export const runtime = {
  useMockApi: String(import.meta.env.VITE_USE_MOCK_API ?? "false").toLowerCase() === "true",
  apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL ?? "https://api.gamma-tech.ir").replace(/\/$/, ""),
};
