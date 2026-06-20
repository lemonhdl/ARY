const STORAGE_KEY = 'ary.adminSession';

export function readAdminSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function writeAdminSession(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (_) {
    /* ignore storage failures in demo runtime */
  }
}

export function resolveAdminSession(adminUsers) {
  const candidates = Array.isArray(adminUsers) ? adminUsers : [];
  const stored = readAdminSession();
  const matched = stored && candidates.find((user) => user.userId === stored.userId);
  if (matched) return matched;

  const fallback = candidates[0] || null;
  if (fallback) writeAdminSession(fallback);
  return fallback;
}