// Butterflix backend — pure Node.js, zero dependencies.
// Serves the static site + JSON REST API backed by db.json and flat files in /data.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 8377;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const DB_FILE = path.join(ROOT, "db.json");
const ACCOUNTS_FILE = path.join(DATA, "accounts.json");
const USERS_FILE = path.join(DATA, "users.json"); // per-user watchlist + preferences
const SESSIONS_FILE = path.join(DATA, "sessions.json"); // token -> account
const SPOTLIGHT_FILE = path.join(DATA, "spotlight.json"); // featured ids for the home slider
const TOKENS_FILE = path.join(DATA, "tokens.json"); // password reset-ish (kept simple: sessions only)

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);
for (const file of [ACCOUNTS_FILE, USERS_FILE, SESSIONS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
}
if (!fs.existsSync(SPOTLIGHT_FILE)) fs.writeFileSync(SPOTLIGHT_FILE, JSON.stringify(["h1", "t2", "t3"]));
if (!fs.existsSync(TOKENS_FILE)) fs.writeFileSync(TOKENS_FILE, "{}");

// ---------- tiny helpers ----------
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return fallback; }
};
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
const accounts = () => readJson(ACCOUNTS_FILE, {});
const users = () => readJson(USERS_FILE, {});
const sessions = () => readJson(SESSIONS_FILE, {});
const saveAccounts = (v) => writeJson(ACCOUNTS_FILE, v);
const saveUsers = (v) => writeJson(USERS_FILE, v);
const saveSessions = (v) => writeJson(SESSIONS_FILE, v);

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const newToken = () => crypto.randomBytes(24).toString("hex");

// Seed a default admin so the site is manageable out of the box.
{
  const bootAccounts = readJson(ACCOUNTS_FILE, {});
  if (!Object.keys(bootAccounts).length) {
    bootAccounts["admin@butterflix.com"] = {
      name: "Admin", email: "admin@butterflix.com", password: hash("admin123"), role: "admin", createdAt: Date.now()
    };
    writeJson(ACCOUNTS_FILE, bootAccounts);
  }
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

function getAccount(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const email = sessions()[token];
  if (!email) return null;
  const account = accounts()[email];
  return account ? { ...account, email, token } : null;
}

const publicAccount = (account) => ({ name: account.name, email: account.email, role: account.role });

function getMovies() {
  const db = readJson(DB_FILE, { movies: [] });
  return Array.isArray(db.movies) ? db.movies : [];
}
function saveMovies(list) {
  writeJson(DB_FILE, { movies: list });
}
const getSpotlight = () => {
  const list = readJson(SPOTLIGHT_FILE, []);
  return Array.isArray(list) ? list.map(String) : [];
};
const saveSpotlight = (ids) => writeJson(SPOTLIGHT_FILE, ids);

const INDUSTRIES = ["Hollywood", "Bollywood", "Tollywood"];
const CATALOG_TYPES = ["Movies", "TV Shows", "Cartoons"];

function normalizeMovie(movie, fallbackId) {
  return {
    ...movie,
    id: String(movie.id || fallbackId),
    title: String(movie.title || "").trim(),
    genre: String(movie.genre || "").trim(),
    industry: INDUSTRIES.includes(movie.industry) ? movie.industry : "Hollywood",
    type: CATALOG_TYPES.includes(movie.type) ? movie.type : "Movies",
    language: String(movie.language || "").trim(),
    director: String(movie.director || "").trim(),
    cast: String(movie.cast || "").trim() || "Ensemble cast",
    releaseDate: movie.releaseDate || new Date().toISOString().slice(0, 10),
    duration: String(movie.duration || "").trim() || "TBA",
    rating: Number(movie.rating) || 0,
    description: String(movie.description || "").trim() || `${movie.title} — added to the catalogue.`,
    poster: movie.poster || "../assets/images/poster-aurora.svg",
    backdrop: movie.backdrop || "../assets/images/backdrop-aurora.svg",
    trailer: movie.trailer || "",
    status: movie.status || "Published"
  };
}

const validateMovie = (movie) => {
  for (const key of ["title", "genre", "language", "director", "releaseDate", "duration", "description"]) {
    if (!String(movie[key] ?? "").trim()) return `Please complete the ${key} field.`;
  }
  const rating = Number(movie.rating);
  if (Number.isNaN(rating) || rating < 0 || rating > 10) return "Rating must be between 0 and 10.";
  if (!CATALOG_TYPES.includes(movie.type)) return "Please choose a valid type: Movies, TV Shows, or Cartoons.";
  return null;
};

// ---------- static files ----------
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webm": "video/webm", ".woff2": "font/woff2"
};

// Paths that must never be served to the browser (source, credentials, sessions, tooling).
const BLOCKED = ["server.js", "package.json", "data", "scripts", "tools", ".freebuff", "node_modules"];
const isBlocked = (rel) => BLOCKED.includes(rel.split(/[\\/]/)[0]);

function serveStatic(req, res, pathname) {
  // "/" (and "/index.html") -> redirect so the browser's base URL is /views/.
  // Without this, links like "login.html" resolve to "/login.html" and 404.
  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(302, { Location: "/views/index.html" });
    return res.end();
  }

  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, { error: "Bad request" }); }
  let filePath = path.join(ROOT, rel);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return send(res, 403, { error: "Forbidden" });
  if (isBlocked(path.relative(ROOT, filePath))) return send(res, 404, { error: "Not found" });

  // Convenience: "/login.html", "/industry.html", "/details.html" also work (served from /views).
  if (!fs.existsSync(filePath) && /^\/[\w-]+\.html$/.test(pathname)) {
    const alt = path.join(ROOT, "views", path.basename(pathname));
    if (fs.existsSync(alt)) filePath = alt;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, { error: "Not found" });
    const stream = fs.createReadStream(filePath);
    stream.on("open", () => {
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
      stream.pipe(res);
    });
    stream.on("error", () => send(res, 404, { error: "Not found" }));
  });
}

// ---------- API router ----------
async function handleApi(req, res, pathname, query) {
  const method = req.method;
  const body = method === "POST" || method === "PUT" || method === "PATCH" ? await readBody(req) : {};
  const account = getAccount(req);

  // ----- auth -----
  if (pathname === "/api/register" && method === "POST") {
    const { name, email, password, role, preferences } = body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!String(name || "").trim()) return send(res, 400, { error: "Please enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizedEmail)) return send(res, 400, { error: "Please enter a valid email address." });
    if (String(password || "").length < 4) return send(res, 400, { error: "Password must be at least 4 characters." });
    if (!["admin", "user"].includes(role)) return send(res, 400, { error: "Please choose a role." });
    const all = accounts();
    if (all[normalizedEmail]) return send(res, 409, { error: "An account with this email already exists. Try logging in." });
    const record = { name: String(name).trim(), email: normalizedEmail, password: hash(password), role, createdAt: Date.now() };
    all[normalizedEmail] = record;
    saveAccounts(all);
    if (role === "user") {
      const userData = users();
      userData[normalizedEmail] = { email: normalizedEmail, name: record.name, watchlist: [], preferences: Array.isArray(preferences) ? preferences : [], savedAt: Date.now() };
      saveUsers(userData);
    }
    const token = newToken();
    const sessionMap = sessions();
    sessionMap[token] = normalizedEmail;
    saveSessions(sessionMap);
    return send(res, 201, { token, user: publicAccount(record) });
  }

  if (pathname === "/api/login" && method === "POST") {
    const { email, password, role } = body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const record = accounts()[normalizedEmail];
    if (!record) return send(res, 401, { error: "No account found for this email. Please register first." });
    if (record.password !== hash(password)) return send(res, 401, { error: "Incorrect password. Please try again." });
    if (role && record.role !== role) return send(res, 403, { error: `This account is registered as "${record.role}". Switch the role selector to continue.` });
    const token = newToken();
    const sessionMap = sessions();
    sessionMap[token] = normalizedEmail;
    saveSessions(sessionMap);
    return send(res, 200, { token, user: publicAccount(record) });
  }

  if (pathname === "/api/logout" && method === "POST") {
    if (account) {
      const sessionMap = sessions();
      delete sessionMap[account.token];
      saveSessions(sessionMap);
    }
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/me" && method === "GET") {
    if (!account) return send(res, 401, { error: "Not logged in." });
    return send(res, 200, { user: publicAccount(account) });
  }

  // ----- movies -----
  if (pathname === "/api/movies" && method === "GET") {
    return send(res, 200, { movies: getMovies() });
  }

  if (pathname === "/api/movies" && method === "POST") {
    if (!account || account.role !== "admin") return send(res, 403, { error: "Only admins can add movies." });
    const list = getMovies();
    const created = normalizeMovie(body, `m${Date.now()}`);
    const invalid = validateMovie(created);
    if (invalid) return send(res, 400, { error: invalid });
    list.unshift(created);
    saveMovies(list);
    return send(res, 201, { movie: created });
  }

  if (pathname === "/api/movies/bulk" && method === "POST") {
    if (!account || account.role !== "admin") return send(res, 403, { error: "Only admins can add movies." });
    const list = getMovies();
    const created = [];
    (Array.isArray(body.entries) ? body.entries : []).forEach((entry, index) => {
      if (!entry || !String(entry.title || "").trim() || !String(entry.genre || "").trim()) return;
      const candidate = normalizeMovie({ ...entry, id: `m${Date.now()}_${index}` }, `m${Date.now()}_${index}`);
      if (validateMovie(candidate)) return;
      created.push(candidate);
    });
    if (!created.length) return send(res, 400, { error: "No valid rows found. Each movie needs at least a title, genre, and rating." });
    saveMovies([...created, ...list]);
    return send(res, 201, { movies: created, count: created.length });
  }

  let match = pathname.match(/^\/api\/movies\/([^/]+)$/);
  if (match) {
    const id = match[1];
    const list = getMovies();
    const index = list.findIndex((movie) => String(movie.id) === id);
    if (method === "GET") {
      if (index < 0) return send(res, 404, { error: "Movie not found." });
      return send(res, 200, { movie: list[index] });
    }
    if (method === "PUT" || method === "PATCH") {
      if (!account || account.role !== "admin") return send(res, 403, { error: "Only admins can edit movies." });
      if (index < 0) return send(res, 404, { error: "Movie not found." });
      const updated = normalizeMovie({ ...list[index], ...body, id }, id);
      const invalid = validateMovie(updated);
      if (invalid) return send(res, 400, { error: invalid });
      list[index] = updated;
      saveMovies(list);
      return send(res, 200, { movie: updated });
    }
    if (method === "DELETE") {
      if (!account || account.role !== "admin") return send(res, 403, { error: "Only admins can delete movies." });
      if (index < 0) return send(res, 404, { error: "Movie not found." });
      const [removed] = list.splice(index, 1);
      saveMovies(list);
      return send(res, 200, { ok: true, removed: removed.id });
    }
  }

  // ----- spotlight (admin-controlled featured slider) -----
  if (pathname === "/api/spotlight" && method === "GET") {
    const ids = getSpotlight();
    const list = getMovies();
    const items = ids.map((id) => list.find((movie) => String(movie.id) === id)).filter(Boolean);
    return send(res, 200, { spotlight: ids, items });
  }

  if (pathname === "/api/spotlight" && method === "PUT") {
    if (!account || account.role !== "admin") return send(res, 403, { error: "Only admins can manage the spotlight." });
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 8);
    const list = getMovies();
    const valid = ids.filter((id) => list.some((movie) => String(movie.id) === id));
    saveSpotlight(valid);
    return send(res, 200, { spotlight: valid });
  }

  // ----- per-user data (watchlist + preferences) -----
  if (pathname === "/api/me/data" && method === "GET") {
    if (!account) return send(res, 401, { error: "Not logged in." });
    const record = users()[account.email] || { email: account.email, name: account.name, watchlist: [], preferences: [] };
    return send(res, 200, { data: record });
  }

  if (pathname === "/api/me/data" && method === "PUT") {
    if (!account) return send(res, 401, { error: "Not logged in." });
    const all = users();
    const current = all[account.email] || { email: account.email, name: account.name, watchlist: [], preferences: [] };
    const next = {
      ...current,
      name: body.name ?? current.name,
      watchlist: Array.isArray(body.watchlist) ? body.watchlist.map(String) : current.watchlist,
      preferences: Array.isArray(body.preferences) ? body.preferences.filter(Boolean) : current.preferences,
      savedAt: Date.now()
    };
    all[account.email] = next;
    saveUsers(all);
    return send(res, 200, { data: next });
  }

  // ----- admin: list accounts + user data -----
  if (pathname === "/api/admin/users" && method === "GET") {
    if (!account || account.role !== "admin") return send(res, 403, { error: "Admins only." });
    const allAccounts = accounts();
    const allUsers = users();
    const list = Object.values(allAccounts).map((record) => ({
      ...publicAccount(record),
      createdAt: record.createdAt,
      watchlist: allUsers[record.email]?.watchlist || [],
      preferences: allUsers[record.email]?.preferences || []
    }));
    return send(res, 200, { users: list });
  }

  return send(res, 404, { error: `Unknown API route: ${method} ${pathname}` });
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;
  try {
    if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname, url.searchParams);
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error("Server error:", error);
    return send(res, 500, { error: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Butterflix running →  http://127.0.0.1:${PORT}/views/index.html\n`);
  console.log(`  Database files: ${DATA} , ${path.basename(DB_FILE)}`);
  console.log(`  Stop the server with Ctrl+C\n`);
});
