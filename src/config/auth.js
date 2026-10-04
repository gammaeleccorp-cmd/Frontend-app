export const OTP_LENGTH = 5;

export const MOCK_SESSION_KEY = "gamma_mock_session";
export const MOCK_ACCOUNTS_KEY = "gamma_mock_accounts";

function getStorage(kind) {
  return kind === "session" ? window.sessionStorage : window.localStorage;
}

export function readMockSession() {
  const temporary = getStorage("session").getItem(MOCK_SESSION_KEY);
  const persistent = getStorage("local").getItem(MOCK_SESSION_KEY);
  const raw = temporary || persistent;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    clearMockSession();
    return null;
  }
}

export function writeMockSession(session, rememberMe) {
  clearMockSession();
  getStorage(rememberMe ? "local" : "session").setItem(MOCK_SESSION_KEY, JSON.stringify(session));
}

export function clearMockSession() {
  getStorage("local").removeItem(MOCK_SESSION_KEY);
  getStorage("session").removeItem(MOCK_SESSION_KEY);
}

export function readMockAccounts() {
  const raw = window.localStorage.getItem(MOCK_ACCOUNTS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(MOCK_ACCOUNTS_KEY);
    return [];
  }
}

export function writeMockAccounts(accounts) {
  window.localStorage.setItem(MOCK_ACCOUNTS_KEY, JSON.stringify(accounts));
}
