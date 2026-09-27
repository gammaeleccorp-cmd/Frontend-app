export const runtime = {
  useMockApi: String(import.meta.env.VITE_USE_MOCK_API ?? "true").toLowerCase() === "true",
  apiBaseUrl: String(import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, ""),
};
