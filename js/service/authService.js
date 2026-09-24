import { api, getSession, setSession, clearSession } from "./apiService.js";

export { getSession };

export const ROLES = { ADMIN: "admin", USER: "user" };

// ---------- session ----------

export function isAdmin() {
  return getSession()?.role === "admin";
}

export function isLoggedIn() {
  return Boolean(getSession());
}

export function logout() {
  api("/api/logout", { method: "POST", auth: false }).catch(() => {});
  clearSession();
}

// ---------- accounts ----------

export async function registerAccount({ name, email, password, role, preferences = [] }) {
  const { token, user } = await api("/api/register", { method: "POST", auth: false, body: { name, email, password, role, preferences } });
  setSession({ token, email: user.email, name: user.name, role: user.role });
  return getSession();
}

export async function loginAccount({ email, password, role }) {
  const { token, user } = await api("/api/login", { method: "POST", auth: false, body: { email, password, role } });
  setSession({ token, email: user.email, name: user.name, role: user.role });
  return getSession();
}

export async function fetchMe() {
  const { user } = await api("/api/me", { auth: false });
  return user;
}

// ---------- per-user data ----------

export async function getMyData() {
  if (!isLoggedIn()) return { watchlist: [], preferences: [] };
  const { data } = await api("/api/me/data");
  return data;
}

export async function saveMyData(changes) {
  const { data } = await api("/api/me/data", { method: "PUT", body: changes });
  return data;
}

export async function getMyWatchlist() {
  return (await getMyData()).watchlist || [];
}

export async function toggleMyWatchlist(movieId) {
  const data = await getMyData();
  const key = String(movieId);
  const list = (data.watchlist || []).map(String);
  const added = !list.includes(key);
  const next = added ? [key, ...list] : list.filter((id) => id !== key);
  await saveMyData({ watchlist: next });
  return { added, list: next };
}

export async function clearMyWatchlist() {
  await saveMyData({ watchlist: [] });
  return [];
}

export async function getMyPreferences() {
  return (await getMyData()).preferences || [];
}

export async function setMyPreferences(preferences) {
  const data = await saveMyData({ preferences });
  return data.preferences || [];
}

export async function listAccounts() {
  const { users } = await api("/api/admin/users");
  return users;
}
