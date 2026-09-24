export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

export const formatDate = (date) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
};

export const formatRating = (rating) => {
  const value = Number(rating || 0);
  return value > 0 ? value.toFixed(1) : "TBA";
};

export const escapeHtml = (value = "") =>
  String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

export const showToast = (message) => {
  const toast = qs("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
};

export const youtubeId = (url) => {
  const match = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return match ? match[1] : "";
};

const TYPE_BADGES = { "TV Shows": "TV", Cartoons: "Cartoon", Movies: "Movie" };
export const typeBadge = (movie) => {
  const label = TYPE_BADGES[movie.type] || "Movie";
  const cls = movie.type === "TV Shows" ? "type-tv" : movie.type === "Cartoons" ? "type-cartoon" : "type-movie";
  return `<span class="type-badge ${cls}">${label}</span>`;
};

export const movieCard = (movie, savedSet = new Set()) => {
  const saved = savedSet.has(String(movie.id));
  const rating = Number(movie.rating || 0) > 0 ? `★ ${formatRating(movie.rating)}` : "TBA";
  return `
  <article class="movie-card" data-movie-id="${escapeHtml(movie.id)}">
    ${typeBadge(movie)}
    <button class="favorite-icon ${saved ? "is-active" : ""}" type="button" data-watchlist-id="${escapeHtml(movie.id)}" aria-label="Toggle ${escapeHtml(movie.title)} on watchlist">${saved ? "♥" : "♡"}</button>
    <div class="poster-frame">
      <img loading="lazy" src="${escapeHtml(movie.poster)}" alt="${escapeHtml(movie.title)} poster">
      <div class="card-overlay">
        <span class="genre-badge">${escapeHtml(movie.genre)}</span>
        ${movie.trailer ? `<button type="button" class="overlay-trailer" data-action="trailer" data-id="${escapeHtml(movie.id)}">▶ Trailer</button>` : ""}
        <span class="view-link">View details ↗</span>
      </div>
    </div>
    <h3>${escapeHtml(movie.title)}</h3>
    <div class="card-meta">
      <span>${escapeHtml(String(movie.releaseDate || "").slice(0, 4))}</span>
      <span>${escapeHtml(movie.language)}</span>
      <span class="rating">${rating}</span>
    </div>
  </article>
`;
};

export const statusClass = (status) => {
  if (status === "Coming Soon") return "coming-soon";
  if (status === "Draft") return "draft";
  return "published";
};
