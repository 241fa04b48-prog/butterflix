import { getMovies, getMovieById, addMovie, updateMovie, deleteMovie, addMoviesBulk, INDUSTRIES, CATALOG_TYPES, getSpotlight, saveSpotlight } from "./service/movieService.js";
import { getSession, isAdmin, isLoggedIn, logout, getMyWatchlist, toggleMyWatchlist, clearMyWatchlist, getMyPreferences, setMyPreferences } from "./service/authService.js";
import { qs, qsa, formatDate, formatRating, escapeHtml, showToast, movieCard, statusClass, youtubeId } from "./utils.js";
import { releaseButterflies } from "./butterflies.js";

const DEFAULT_GENRES = [
  "Action", "Adventure", "Comedy", "Comedy Drama", "Documentary", "Drama",
  "Epic Action", "Fantasy", "Horror", "Romance", "Sci-Fi", "Sports Drama",
  "Thriller", "Action Drama", "Action Thriller", "Epic Adventure", "Biographical Thriller", "Horror Thriller", "Romance Drama"
];
const GENRE_COLORS = ["#c43b4a", "#3d6f94", "#c48a3a", "#6b5ca8", "#3f8a68", "#c45d38", "#8a3d6a", "#4a7a9a"];
const GENRE_IMAGES = {
  "Action": "posters/h3.jpg",
  "Action Drama": "posters/t1.jpg",
  "Action Thriller": "posters/t4.jpg",
  "Adventure": "posters/h4.jpg",
  "Biographical Thriller": "posters/h2.jpg",
  "Comedy": "poster-echoes.svg",
  "Comedy Drama": "posters/b3.jpg",
  "Documentary": "poster-northbound.svg",
  "Drama": "posters/b3.jpg",
  "Epic Action": "posters/t2.jpg",
  "Epic Adventure": "posters/h4.jpg",
  "Fantasy": "poster-aurora.svg",
  "Horror": "poster-vanta.svg",
  "Horror Thriller": "poster-vanta.svg",
  "Romance": "poster-softfocus.svg",
  "Romance Drama": "poster-softfocus.svg",
  "Sci-Fi": "posters/h1.jpg",
  "Sports Drama": "posters/b4.jpg",
  "Thriller": "posters/t4.jpg"
};
const FALLBACK_POSTER = "../assets/images/poster-aurora.svg";

let movies = [];
let myWatchlist = [];
let myPreferences = [];
let mySpotlight = ["h1", "t2", "t3"];
let pendingDeleteId = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    movies = await getMovies();
    try {
      const spotlightIds = await getSpotlight();
      if (Array.isArray(spotlightIds) && spotlightIds.length) mySpotlight = spotlightIds;
    } catch { /* keep default ids */ }
    if (isLoggedIn()) {
      try {
        myWatchlist = await getMyWatchlist();
        myPreferences = await getMyPreferences();
      } catch {
        // Saved login is no longer valid (server restarted, sessions reset, other copy of the app).
        // Drop it and carry on as a guest instead of hanging on the splash screen.
        logout();
        myWatchlist = [];
        myPreferences = [];
      }
    }
    applyAuthChrome();
    const page = document.body.dataset.page;
    if (page === "details") initDetails();
    else if (page === "industry") initIndustry();
    else initHome();
  } catch (error) {
    showStartupError(error);
  }
});

// Never leave the user stuck behind the splash: reveal the page and say what went wrong.
function showStartupError(error) {
  console.error("Butterflix startup failed:", error);
  qs("#splash")?.classList.add("done");
  qs("#app")?.classList.remove("is-hidden");
  const unreachable = error instanceof TypeError; // fetch() could not connect
  const message = unreachable
    ? "Cannot reach the Butterflix server. Start it with \"npm start\" and open http://127.0.0.1:8377/ (do not open the HTML file directly)."
    : (error && error.message) || "Something went wrong while loading Butterflix.";
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#b42c38;color:#fff;padding:14px 18px;font:600 14px/1.4 sans-serif;text-align:center";
  banner.textContent = message;
  document.body.prepend(banner);
}

const savedSet = () => new Set(myWatchlist.map(String));

// ---------- auth chrome ----------

function applyAuthChrome() {
  const session = getSession();
  const admin = isAdmin();

  qsa(".admin-only").forEach((el) => el.classList.toggle("is-hidden", !admin));
  qsa(".guest-only").forEach((el) => el.classList.toggle("is-hidden", Boolean(session)));

  const authLink = qs("#auth-link");
  if (authLink) {
    if (session) {
      authLink.textContent = `${session.name} · Logout`;
      authLink.href = "#logout";
      authLink.dataset.logout = "true";
    } else {
      authLink.textContent = "Login";
      authLink.href = "login.html";
      delete authLink.dataset.logout;
    }
  }

  qs("#spotlight-manage")?.classList.toggle("is-hidden", !admin);

  const nav = qs(".main-nav");
  if (nav && !qs("#pref-nav-link") && session && session.role === "user") {
    const link = document.createElement("a");
    link.className = "nav-link";
    link.id = "pref-nav-link";
    link.href = "#preferences";
    link.textContent = "My preferences";
    nav.appendChild(link);
  }
}

function handleLogoutClick(event) {
  const link = event.target.closest("[data-logout]");
  if (!link) return;
  event.preventDefault();
  logout();
  showToast("Logged out. See you soon!");
  window.location.href = "index.html";
}

// ---------- home ----------

function initHome() {
  setupSplash();
  refreshHome();
  bindHomeEvents();
  bindSharedEvents();
  bindSpotlightEvents();
  startAutoSlide();
  setupRevealAnimations();
}

function setupRevealAnimations() {
  const targets = qsa(".content-section");
  if (!targets.length || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  targets.forEach((section) => {
    section.classList.add("reveal");
    observer.observe(section);
  });
}

function initDetails() {
  bindSharedEvents();
  renderDetails();
}

const SPLASH_DURATION_MS = 4000;

function setupSplash() {
  const splash = qs("#splash");
  const app = qs("#app");
  if (!splash || !app) return;
  // Register the timer first so a decoration error can never keep the splash on screen.
  window.setTimeout(() => {
    splash.classList.add("done");
    app.classList.remove("is-hidden");
  }, SPLASH_DURATION_MS);
  try {
    releaseButterflies(qs("#splash-butterflies"), 34, { maxDelay: 1.2, speedScale: 0.6 });
  } catch (error) {
    console.warn("Splash butterflies failed:", error);
  }
}

// ---------- spotlight slider ----------

const SPOTLIGHT_IDS = ["h1", "t2", "t3"]; // pavan inception, Beharabali 2, Dhanush: The Rise
let slideIndex = 0;
let slideTimer = null;

function spotlights() {
  return mySpotlight.map((id) => movies.find((movie) => String(movie.id) === id)).filter(Boolean);
}

function renderSpotlight() {
  const track = qs("#spotlight-track");
  const dots = qs("#slider-dots");
  if (!track) return;
  const items = spotlights();
  if (!items.length) {
    track.innerHTML = `<p class="empty-copy">No spotlight titles found.</p>`;
    return;
  }
  track.innerHTML = items.map((movie) => `
    <article class="spot-slide" style="background-image:url('${escapeHtml(movie.backdrop || FALLBACK_POSTER)}')">
      <div class="spot-shade"></div>
      <div class="spot-inner">
        <img class="spot-poster" src="${escapeHtml(movie.poster || FALLBACK_POSTER)}" alt="${escapeHtml(movie.title)} poster">
        <div class="spot-copy">
          <p class="eyebrow">${escapeHtml(movie.industry || "Hollywood")} · ${escapeHtml(movie.type || "Movies")} · ${escapeHtml(movie.genre)}${movie.trailer ? " · Trailer available" : ""}</p>
          <h3>${escapeHtml(movie.title)}</h3>
          <p class="spot-desc">${escapeHtml(movie.description)}</p>
          <div class="hero-buttons">
            ${movie.trailer ? `<button class="primary-button" data-action="trailer" data-id="${escapeHtml(movie.id)}">▶ Watch trailer</button>` : ""}
            <a class="ghost-button" href="details.html?id=${escapeHtml(movie.id)}">View details</a>
          </div>
        </div>
      </div>
    </article>`
  ).join("");
  dots.innerHTML = items.map((movie, index) =>
    `<button type="button" class="slider-dot ${index === slideIndex ? "active" : ""}" data-slide="${index}" aria-label="Go to ${escapeHtml(movie.title)}"></button>`
  ).join("");
  goToSlide(slideIndex);
}

function goToSlide(index) {
  const track = qs("#spotlight-track");
  if (!track) return;
  const count = spotlights().length;
  if (!count) return;
  slideIndex = ((index % count) + count) % count;
  track.style.transform = `translateX(-${slideIndex * 100}%)`;
  qsa(".slider-dot").forEach((dot, i) => dot.classList.toggle("active", i === slideIndex));
}

function startAutoSlide() {
  stopAutoSlide();
  if (!qs("#spotlight-track")) return; // other pages / slider absent
  slideTimer = window.setInterval(() => goToSlide(slideIndex + 1), 2000);
}

function stopAutoSlide() {
  if (slideTimer) window.clearInterval(slideTimer);
  slideTimer = null;
}

function bindSpotlightEvents() {
  qs("#slide-prev")?.addEventListener("click", () => { goToSlide(slideIndex - 1); startAutoSlide(); });
  qs("#slide-next")?.addEventListener("click", () => { goToSlide(slideIndex + 1); startAutoSlide(); });
  qs("#slider-dots")?.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-slide]");
    if (!dot) return;
    goToSlide(Number(dot.dataset.slide));
    startAutoSlide();
  });
  const slider = qs("#spotlight-slider");
  slider?.addEventListener("mouseenter", stopAutoSlide);
  slider?.addEventListener("mouseleave", startAutoSlide);
  qs("#spotlight-list")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-spot-id]");
    if (!row) return;
    const featuredCount = document.querySelectorAll("#spotlight-list .spotlight-row.is-featured").length;
    if (!row.classList.contains("is-featured") && featuredCount >= 8) {
      showToast("Spotlight holds up to 8 titles.");
      return;
    }
    row.classList.toggle("is-featured");
    row.querySelector(".spot-row-star").textContent = row.classList.contains("is-featured") ? "★ Featured" : "☆ Add";
    updateSpotlightCount();
  });
}

function refreshHome() {
  renderHero(movies[0]);
  renderSpotlight();
  renderRows();
  renderRecommendations();
  renderGenres();
  renderStats();
  populateFilters();
  renderTable();
}

function allGenres() {
  return [...new Set([...DEFAULT_GENRES, ...movies.map((movie) => movie.genre).filter(Boolean)])].sort();
}

function renderHero(movie) {
  const hero = qs("#hero");
  if (!hero) return;
  if (!movie) {
    hero.innerHTML = `<div class="hero-content empty-hero"><p class="eyebrow">Catalogue is empty</p><h1>Add your first movie</h1><p class="hero-description">Use Manage to create a title with a genre. It will appear here as the featured premiere.</p><button class="primary-button" id="hero-add">＋ Add movie</button></div>`;
    return;
  }
  const adminButtons = isAdmin() ? `<button class="ghost-button" data-action="edit" data-id="${escapeHtml(movie.id)}">Edit title</button>` : "";
  hero.innerHTML = `
    <div class="hero-backdrop" style="background-image:url('${escapeHtml(movie.backdrop || FALLBACK_POSTER)}')"></div>
    <div class="hero-vignette"></div>
    <div class="hero-content">
      <div class="hero-kicker">
        <span>Featured premiere</span>
        <span>${escapeHtml(movie.genre)}</span>
        <span>${escapeHtml(movie.industry || "Hollywood")}</span>
      </div>
      <h1>${escapeHtml(movie.title)}</h1>
      <p class="hero-description">${escapeHtml(movie.description)}</p>
      <div class="hero-buttons">
        <a class="primary-button" href="details.html?id=${escapeHtml(movie.id)}">View details</a>
        ${adminButtons}
      </div>
    </div>
    <div class="hero-poster" style="background-image:url('${escapeHtml(movie.poster || FALLBACK_POSTER)}')"></div>
  `;
}

function renderRows() {
  const sorted = [...movies].sort((a, b) => Number(b.rating) - Number(a.rating));
  const upcoming = movies.filter((movie) => movie.status === "Coming Soon");
  const saved = myWatchlist
    .map((id) => movies.find((movie) => String(movie.id) === String(id)))
    .filter(Boolean);
  const tvShows = movies.filter((movie) => movie.type === "TV Shows");
  const cartoons = movies.filter((movie) => movie.type === "Cartoons");
  const groups = {
    "#trending-row": movies.slice(0, 6),
    "#popular-row": sorted.slice(0, 6),
    "#tv-row": tvShows.slice(0, 12),
    "#cartoon-row": cartoons.slice(0, 12),
    "#watchlist-row": saved,
    "#upcoming-row": (upcoming.length ? upcoming : movies.filter((movie) => movie.status !== "Draft")).slice(0, 6)
  };
  Object.entries(groups).forEach(([selector, group]) => {
    const target = qs(selector);
    if (!target) return;
    const emptyMessage = selector === "#watchlist-row"
      ? (isLoggedIn() ? "Nothing saved yet — tap ♡ on any poster to build your watchlist." : "Login to start your personal watchlist.")
      : selector === "#tv-row"
        ? "No series yet — admins can add TV shows with the ＋ Add movie button (choose Type: TV Shows)."
        : selector === "#cartoon-row"
          ? "No cartoons yet — admins can add them with Type: Cartoons."
          : "No titles in this row yet.";
    target.innerHTML = group.length ? group.map((movie) => movieCard(movie, savedSet())).join("") : `<p class="empty-copy">${emptyMessage}</p>`;
  });
  qs("#clear-watchlist")?.classList.toggle("is-hidden", !saved.length);
}

function renderRecommendations() {
  const section = qs("#recommend-section");
  const target = qs("#recommend-row");
  if (!section || !target) return;
  if (!isLoggedIn() || isAdmin()) {
    section.classList.add("is-hidden");
    return;
  }
  let picks = [];
  if (myPreferences.length) {
    picks = movies.filter((movie) => myPreferences.includes(movie.genre) && !myWatchlist.includes(String(movie.id)));
  }
  if (picks.length < 6) {
    const filler = movies.filter((movie) => !picks.includes(movie) && !myWatchlist.includes(String(movie.id)));
    picks = [...picks, ...filler].slice(0, 6);
  }
  if (!picks.length) {
    section.classList.add("is-hidden");
    return;
  }
  section.classList.remove("is-hidden");
  target.innerHTML = picks.map((movie) => movieCard(movie, savedSet())).join("");
}

function renderGenres() {
  const target = qs("#genre-grid");
  if (!target) return;
  const genres = [...new Set(movies.map((movie) => movie.genre).filter(Boolean))];
  if (!genres.length) {
    target.innerHTML = `<p class="empty-copy">Genres appear here after you add movies.</p>`;
    return;
  }
  target.innerHTML = genres.map((genre, index) => {
    const count = movies.filter((movie) => movie.genre === genre).length;
    const image = GENRE_IMAGES[genre] || "poster-aurora.svg";
    return `<button class="genre-tile has-image" type="button" style="--genre-color:${GENRE_COLORS[index % GENRE_COLORS.length]};--tile-image:url('../assets/images/${image}')" data-genre="${escapeHtml(genre)}">
      <p>${String(count).padStart(2, "0")}</p>
      <h3>${escapeHtml(genre)}</h3>
    </button>`;
  }).join("");
}

function renderStats() {
  const target = qs("#stats-grid");
  if (!target) return;
  const rated = movies.filter((movie) => Number(movie.rating) > 0);
  const average = rated.reduce((sum, movie) => sum + Number(movie.rating), 0) / (rated.length || 1);
  const stats = [
    ["Total movies", movies.length, "Live catalogue"],
    ["TV shows", movies.filter((movie) => movie.type === "TV Shows").length, "Series & episodes"],
    ["Cartoons", movies.filter((movie) => movie.type === "Cartoons").length, "Animation for all ages"],
    ["Average rating", formatRating(average), "Audience score"]
  ];
  target.innerHTML = stats.map(([label, value, trend]) => `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-number">${value}</div>
      <div class="stat-trend">${trend}</div>
    </div>
  `).join("");
}

function populateFilters() {
  const genres = allGenres();
  const languages = [...new Set(movies.map((movie) => movie.language).filter(Boolean))].sort();
  const years = [...new Set(movies.map((movie) => String(movie.releaseDate).slice(0, 4)))].sort().reverse();
  const statuses = [...new Set(movies.map((movie) => movie.status).filter(Boolean))];
  fillSelect(qs("#genre-filter"), genres, "All genres");
  fillSelect(qs("#language-filter"), languages, "All languages");
  fillSelect(qs("#year-filter"), years, "Any year");
  fillSelect(qs("#table-genre"), [...new Set(movies.map((movie) => movie.genre).filter(Boolean))].sort(), "All genres");
  fillSelect(qs("#table-status"), statuses, "All statuses");
  fillSelect(qs("#table-industry"), INDUSTRIES, "All industries");
  fillSelect(qs("#table-type"), CATALOG_TYPES, "All types");
  fillSelect(qs("#type-filter"), CATALOG_TYPES, "All types");
  fillDatalist(qs("#genre-options"), genres);
}

function fillSelect(select, values, allLabel) {
  if (!select) return;
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${allLabel}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = [...select.options].some((option) => option.value === current) ? current : "all";
}

function fillDatalist(list, values) {
  if (!list) return;
  list.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function renderTable() {
  const target = qs("#movie-table-body");
  if (!target) return;
  const query = (qs("#table-search")?.value || "").toLowerCase();
  const genre = qs("#table-genre")?.value || "all";
  const status = qs("#table-status")?.value || "all";
  const industry = qs("#table-industry")?.value || "all";
  const type = qs("#table-type")?.value || "all";
  const visible = movies.filter((movie) => {
    const haystack = [movie.title, movie.genre, movie.director, movie.language].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (genre === "all" || movie.genre === genre) && (status === "all" || movie.status === status) && (industry === "all" || movie.industry === industry) && (type === "all" || (movie.type || "Movies") === type);
  });
  if (!visible.length) {
    target.innerHTML = `<tr><td colspan="9" class="empty-cell">No movies match these catalogue filters. Add a movie or clear the search.</td></tr>`;
    return;
  }
  target.innerHTML = visible.map((movie) => `
    <tr>
      <td>
        <div class="table-movie">
          <img class="table-poster" src="${escapeHtml(movie.poster || FALLBACK_POSTER)}" alt="">
          <div>
            <strong>${escapeHtml(movie.title)}</strong>
            <span>${escapeHtml(movie.director)}</span>
          </div>
        </div>
      </td>
      <td><span class="genre-pill">${escapeHtml(movie.genre)}</span></td>
      <td>${escapeHtml(movie.industry || "—")}</td>
      <td>${escapeHtml(movie.type || "Movies")}</td>
      <td>${escapeHtml(movie.language)}</td>
      <td>${formatDate(movie.releaseDate)}</td>
      <td><span class="rating">★ ${formatRating(movie.rating)}</span></td>
      <td><span class="status-pill ${statusClass(movie.status)}">${escapeHtml(movie.status)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="view" data-id="${escapeHtml(movie.id)}" title="View">View</button>
          <button type="button" data-action="edit" data-id="${escapeHtml(movie.id)}" title="Edit">Edit</button>
          <button type="button" class="danger-text" data-action="delete" data-id="${escapeHtml(movie.id)}" title="Delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function applySearch() {
  const panel = qs("#search-panel");
  const target = qs("#search-results");
  if (!panel || !target) return;
  const query = (qs("#search-input")?.value || "").toLowerCase();
  const genre = qs("#genre-filter")?.value || "all";
  const language = qs("#language-filter")?.value || "all";
  const year = qs("#year-filter")?.value || "all";
  const rating = qs("#rating-filter")?.value || "all";
  const type = qs("#type-filter")?.value || "all";
  const active = query || genre !== "all" || language !== "all" || year !== "all" || rating !== "all" || type !== "all";
  if (!active && panel.classList.contains("is-collapsed")) {
    target.classList.add("is-hidden");
    return;
  }
  const results = movies.filter((movie) =>
    (!query || [movie.title, movie.genre, movie.director, movie.language, movie.industry].some((value) => String(value).toLowerCase().includes(query))) &&
    (genre === "all" || movie.genre === genre) &&
    (language === "all" || movie.language === language) &&
    (year === "all" || String(movie.releaseDate).startsWith(year)) &&
    (rating === "all" || Number(movie.rating) >= Number(rating)) &&
    (type === "all" || (movie.type || "Movies") === type)
  );
  target.classList.remove("is-hidden");
  target.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">${results.length} matches</p>
        <h2>Search <em>results</em></h2>
      </div>
    </div>
    <div class="movie-row results-grid">${results.length ? results.map((movie) => movieCard(movie, savedSet())).join("") : '<p class="empty-copy">No movies match your current filters.</p>'}</div>
  `;
}

function bindHomeEvents() {
  qs("#table-search")?.addEventListener("input", renderTable);
  qs("#table-genre")?.addEventListener("change", renderTable);
  qs("#table-status")?.addEventListener("change", renderTable);
  qs("#table-industry")?.addEventListener("change", renderTable);
  qs("#search-input")?.addEventListener("input", applySearch);
  qs("#clear-search")?.addEventListener("click", () => {
    qs("#search-input").value = "";
    applySearch();
  });
  ["genre-filter", "language-filter", "year-filter", "rating-filter", "type-filter"].forEach((id) => {
    qs(`#${id}`)?.addEventListener("change", applySearch);
  });
  qs("#menu-toggle")?.addEventListener("click", () => qs(".main-nav")?.classList.toggle("open"));
  qs("#search-toggle")?.addEventListener("click", () => {
    qs("#search-panel")?.classList.toggle("is-collapsed");
    if (!qs("#search-panel")?.classList.contains("is-collapsed")) qs("#search-input")?.focus();
    applySearch();
  });
  qs("#add-movie-button")?.addEventListener("click", () => openModal());
  qs("#bulk-add-button")?.addEventListener("click", openBulkModal);
  qs("#quick-add")?.addEventListener("click", () => openModal());
  qs("#clear-watchlist")?.addEventListener("click", async () => {
    await clearMyWatchlist();
    myWatchlist = [];
    refreshHome();
    showToast("Watchlist cleared");
  });
  qs("#pref-nav-link")?.addEventListener("click", openPreferences);
  qs("#pref-edit")?.addEventListener("click", openPreferences);
  qs("#spotlight-manage")?.addEventListener("click", openSpotlightManager);
  qs("#spotlight-close")?.addEventListener("click", closeSpotlightManager);
  qs("#spotlight-cancel")?.addEventListener("click", closeSpotlightManager);
  qs("#spotlight-save")?.addEventListener("click", saveSpotlightChanges);
}

// ---------- industry page ----------

const INDUSTRY_META = {
  Hollywood: { tagline: "Blockbusters, epics, and studio gold from the West.", backdrop: "posters/h3.jpg" },
  Bollywood: { tagline: "Song, dance, and drama from the world's largest film city.", backdrop: "posters/b1.jpg" },
  Tollywood: { tagline: "Grand spectacle and legends from the Telugu screen.", backdrop: "posters/t2.jpg" }
};

function initIndustry() {
  const industry = new URLSearchParams(window.location.search).get("industry") || "Hollywood";
  const meta = INDUSTRY_META[industry] || INDUSTRY_META.Hollywood;
  document.title = `${industry} · Butterflix`;
  qs("#industry-title").textContent = industry;
  qs("#industry-tagline").textContent = meta.tagline;
  qs("#industry-backdrop").style.backgroundImage = `url('../assets/images/${meta.backdrop}')`;
  qs("#industry-section-title").innerHTML = `All <em>${escapeHtml(industry)}</em> movies`;
  document.querySelectorAll(".main-nav .nav-link").forEach((link) => {
    link.classList.toggle("active", link.href.includes(`industry=${industry}`));
  });
  refreshIndustry(industry);
  bindHomeEvents();
  bindSharedEvents();
  qs("#industry-sort")?.addEventListener("change", () => refreshIndustry(industry));
  qs("#industry-genre")?.addEventListener("change", () => refreshIndustry(industry));
  qs("#industry-add-button")?.addEventListener("click", () => openModal(null, industry));
}

function refreshIndustry(industry) {
  const pool = movies.filter((movie) => (movie.industry || "Hollywood") === industry);
  const sort = qs("#industry-sort")?.value || "newest";
  const genre = qs("#industry-genre")?.value || "all";
  const count = pool.filter((movie) => genre === "all" || movie.genre === genre);
  const sorted = [...count].sort((a, b) => {
    if (sort === "rating") return Number(b.rating) - Number(a.rating);
    if (sort === "title") return a.title.localeCompare(b.title);
    return new Date(b.releaseDate) - new Date(a.releaseDate);
  });
  const target = qs("#industry-grid");
  if (target) {
    target.innerHTML = sorted.length ? sorted.map((movie) => movieCard(movie, savedSet())).join("") : `<p class="empty-copy">No ${escapeHtml(industry)} titles yet${isAdmin() ? " — use ＋ Add movie to create the first one." : "."}</p>`;
  }
  const rated = pool.filter((m) => Number(m.rating) > 0);
  qs("#industry-stats").innerHTML = [
    ["Titles", pool.length],
    ["Avg rating", formatRating(rated.reduce((s, m) => s + Number(m.rating), 0) / (rated.length || 1))],
    ["Coming soon", pool.filter((m) => m.status === "Coming Soon").length]
  ].map(([label, value]) => `<div class="industry-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  fillSelect(qs("#industry-genre"), [...new Set(pool.map((m) => m.genre).filter(Boolean))].sort(), "All genres");
}

// ---------- shared events ----------

function bindSharedEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("click", handleLogoutClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", handleBackdropClick);
  qs("#modal-close")?.addEventListener("click", closeModal);
  qs("#modal-cancel")?.addEventListener("click", closeModal);
  qs("#confirm-cancel")?.addEventListener("click", closeConfirm);
  qs("#confirm-delete")?.addEventListener("click", confirmDelete);
  qs("#trailer-close")?.addEventListener("click", closeTrailer);
  qs("#movie-form")?.addEventListener("submit", saveMovie);
  qs("#bulk-save")?.addEventListener("click", saveBulk);
  qs("#movie-poster")?.addEventListener("input", updatePosterPreview);
  qs("#genre-chip-row")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-chip-genre]");
    if (chip) qs("#movie-genre").value = chip.dataset.chipGenre;
  });
  qs("#preferences-modal")?.addEventListener("click", (event) => {
    const chip = event.target.closest(".pref-chip");
    if (chip) chip.classList.toggle("selected");
  });
  qs("#preferences-save")?.addEventListener("click", savePreferences);
  qs("#preferences-close")?.addEventListener("click", closePreferences);
  qs("#preferences-cancel")?.addEventListener("click", closePreferences);
  qs("#bulk-close")?.addEventListener("click", closeBulkModal);
  qs("#bulk-cancel")?.addEventListener("click", closeBulkModal);
}

function handleClick(event) {
  if (event.target.closest("#hero-add")) {
    openModal();
    return;
  }
  const favorite = event.target.closest(".favorite-icon");
  if (favorite) {
    event.stopPropagation();
    handleFavoriteToggle(favorite);
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    event.stopPropagation();
    handleTableAction(action.dataset.action, action.dataset.id);
    return;
  }
  const card = event.target.closest(".movie-card");
  if (card) {
    window.location.href = `details.html?id=${card.dataset.movieId}`;
    return;
  }
  const genre = event.target.closest(".genre-tile");
  if (genre) {
    qs("#search-panel")?.classList.remove("is-collapsed");
    qs("#search-input").value = "";
    qs("#genre-filter").value = genre.dataset.genre;
    applySearch();
    qs("#search-panel").scrollIntoView({ behavior: "smooth" });
    return;
  }
}

// ---------- spotlight manager (admin) ----------

function openSpotlightManager() {
  if (!isAdmin()) {
    showToast("Only admins can manage the spotlight.");
    return;
  }
  const list = qs("#spotlight-list");
  if (!list) return;
  const featured = new Set(mySpotlight.map(String));
  list.innerHTML = movies.map((movie) => `
    <button type="button" class="spotlight-row ${featured.has(String(movie.id)) ? "is-featured" : ""}" data-spot-id="${escapeHtml(movie.id)}">
      <img src="${escapeHtml(movie.poster || FALLBACK_POSTER)}" alt="">
      <span class="spot-row-title">${escapeHtml(movie.title)}</span>
      <span class="spot-row-meta">${escapeHtml(movie.industry || "Hollywood")} · ${escapeHtml(movie.type || "Movies")}</span>
      <span class="spot-row-star">${featured.has(String(movie.id)) ? "★ Featured" : "☆ Add"}</span>
    </button>
  `).join("") || '<p class="empty-copy">Add movies first.</p>';
  updateSpotlightCount();
  qs("#spotlight-modal")?.classList.remove("is-hidden");
}

function updateSpotlightCount() {
  const count = qs("#spotlight-count");
  if (!count) return;
  const n = document.querySelectorAll("#spotlight-list .spotlight-row.is-featured").length;
  count.textContent = `${n} of 8 featured`;
  count.classList.toggle("at-limit", n >= 8);
}

function closeSpotlightManager() {
  qs("#spotlight-modal")?.classList.add("is-hidden");
}

async function saveSpotlightChanges() {
  const ids = [...document.querySelectorAll("#spotlight-list .spotlight-row.is-featured")].map((row) => row.dataset.spotId);
  if (!ids.length) {
    showToast("Pick at least one movie for the spotlight.");
    return;
  }
  try {
    mySpotlight = await saveSpotlight(ids);
    closeSpotlightManager();
    slideIndex = 0;
    renderSpotlight();
    goToSlide(0);
    startAutoSlide();
    showToast(`Spotlight updated — ${mySpotlight.length} title${mySpotlight.length === 1 ? "" : "s"} featured.`);
  } catch (error) {
    showToast(error.message);
  }
}

async function handleFavoriteToggle(favorite) {
  const id = favorite.dataset.watchlistId || favorite.closest(".movie-card")?.dataset.movieId;
  if (!isLoggedIn()) {
    showToast("Login to save movies to your watchlist.");
    window.location.href = "login.html";
    return;
  }
  try {
    const result = await toggleMyWatchlist(id);
    myWatchlist = result.list;
    favorite.textContent = result.added ? "♥" : "♡";
    favorite.classList.toggle("is-active", result.added);
    showToast(result.added ? "Added to your watchlist" : "Removed from your watchlist");
    if (document.body.dataset.page === "home") {
      renderRows();
      renderRecommendations();
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function handleTableAction(action, id) {
  if (action === "view") window.location.href = `details.html?id=${id}`;
  if (action === "trailer") openTrailer(await getMovieById(id));
  if (action === "watchlist") {
    try {
      const result = await toggleMyWatchlist(id);
      myWatchlist = result.list;
      showToast(result.added ? "Added to your watchlist" : "Removed from your watchlist");
      renderDetails();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  if (action === "edit") openModal(await getMovieById(id));
  if (action === "delete") {
    if (!isAdmin()) {
      showToast("Only admins can delete movies.");
      return;
    }
    const movie = await getMovieById(id);
    openConfirm(movie);
  }
}

// ---------- trailer ----------

function openTrailer(movie) {
  const modal = qs("#trailer-modal");
  const frame = qs("#trailer-frame");
  if (!modal || !frame || !movie?.trailer) return;
  stopAutoSlide();
  const videoId = youtubeId(movie.trailer);
  if (!videoId) {
    window.open(movie.trailer, "_blank", "noopener");
    return;
  }
  frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  qs("#trailer-title").textContent = movie.title;
  modal.classList.remove("is-hidden");
}

function closeTrailer() {
  const frame = qs("#trailer-frame");
  if (frame) frame.src = "";
  qs("#trailer-modal")?.classList.add("is-hidden");
  startAutoSlide();
}

// ---------- movie modal ----------

function openModal(movie = null, presetIndustry = null) {
  const modal = qs("#movie-modal");
  if (!modal) return;
  if (!isAdmin()) {
    showToast("Only admins can add or edit movies.");
    return;
  }
  fillDatalist(qs("#genre-options"), allGenres());
  renderGenreChips(movie?.genre);
  qs("#modal-title").textContent = movie ? "Edit movie" : "Add a new movie";
  qs("#movie-form").reset();
  qs("#movie-id").value = movie?.id || "";
  ["title", "genre", "industry", "language", "director", "cast", "releaseDate", "duration", "rating", "description", "poster", "backdrop", "trailer", "status"].forEach((key) => {
    const field = qs(`#movie-${key}`);
    if (field && movie) field.value = movie[key] ?? "";
  });
  const industryField = qs("#movie-industry");
  if (industryField && !movie) {
    const pageIndustry = presetIndustry || new URLSearchParams(window.location.search).get("industry");
    if (pageIndustry) industryField.value = pageIndustry;
  }
  updatePosterPreview();
  modal.classList.remove("is-hidden");
}

function renderGenreChips(selected) {
  const row = qs("#genre-chip-row");
  if (!row) return;
  row.innerHTML = allGenres().slice(0, 10).map((genre) =>
    `<button type="button" class="genre-chip ${genre === selected ? "is-active" : ""}" data-chip-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`
  ).join("");
}

function updatePosterPreview() {
  const preview = qs("#poster-preview");
  if (!preview) return;
  const src = qs("#movie-poster")?.value || FALLBACK_POSTER;
  preview.style.backgroundImage = `url('${src}')`;
}

function closeModal() {
  qs("#movie-modal")?.classList.add("is-hidden");
}

function closeAnyModal() {
  closeTrailer();
  closeModal();
  closeConfirm();
  closeBulkModal();
  closePreferences();
  closeSpotlightManager();
}

function handleKeydown(event) {
  if (event.key !== "Escape") return;
  closeAnyModal();
}

function handleBackdropClick(event) {
  if (event.target.classList?.contains("modal-backdrop")) closeAnyModal();
}

// ---------- bulk add ----------

function openBulkModal() {
  if (!isAdmin()) {
    showToast("Only admins can add movies.");
    return;
  }
  qs("#bulk-text").value = "";
  qs("#bulk-industry").value = new URLSearchParams(window.location.search).get("industry") || "Hollywood";
  const typeField = qs("#bulk-type");
  if (typeField) typeField.value = "Movies";
  qs("#bulk-counter").textContent = "0 movies detected";
  qs("#bulk-modal")?.classList.remove("is-hidden");
  qs("#bulk-text")?.focus();
}

function closeBulkModal() {
  qs("#bulk-modal")?.classList.add("is-hidden");
}

async function saveBulk(event) {
  event?.preventDefault?.();
  const raw = qs("#bulk-text").value.trim();
  const industry = qs("#bulk-industry").value || "Hollywood";
  const type = qs("#bulk-type")?.value || "Movies";
  if (!raw) return;
  const entries = raw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(";").map((part) => part.trim());
    const [title, genre, language, director, rating, releaseDate] = parts;
    return {
      title,
      genre,
      language: language || "English",
      director: director || "Unknown",
      rating: Number(rating) || 0,
      releaseDate: releaseDate || "",
      industry,
      type,
      description: "",
      status: "Published"
    };
  });
  try {
    const created = await addMoviesBulk(entries);
    movies = await getMovies();
    closeBulkModal();
    showToast(`${created.length} ${type.toLowerCase().replace(/s$/, "")}${created.length === 1 ? "" : "s"} added to ${industry}.`);
    if (document.body.dataset.page === "industry") refreshIndustry(industry);
    else refreshHome();
  } catch (error) {
    showToast(error.message);
  }
}

// ---------- preferences ----------

function openPreferences() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }
  const row = qs("#preferences-chips");
  if (!row) return;
  const selected = new Set(myPreferences);
  row.innerHTML = allGenres().map((genre) =>
    `<button type="button" class="pref-chip ${selected.has(genre) ? "selected" : ""}" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`
  ).join("");
  qs("#preferences-modal")?.classList.remove("is-hidden");
}

function closePreferences() {
  qs("#preferences-modal")?.classList.add("is-hidden");
}

async function savePreferences() {
  const selected = [...document.querySelectorAll("#preferences-chips .pref-chip.selected")].map((chip) => chip.dataset.genre);
  try {
    myPreferences = await setMyPreferences(selected);
    closePreferences();
    showToast(selected.length ? `Preferences saved: ${selected.join(", ")}` : "Preferences cleared.");
    renderRecommendations();
    qs("#recommend-section")?.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showToast(error.message);
  }
}

// ---------- delete confirm ----------

function openConfirm(movie) {
  pendingDeleteId = movie?.id || null;
  qs("#confirm-title").textContent = movie ? `Delete “${movie.title}”?` : "Delete this movie?";
  qs("#confirm-copy").textContent = movie
    ? `${movie.title} (${movie.genre}) will be removed from the catalogue, rows, and search.`
    : "This title will be removed from the catalogue.";
  qs("#confirm-modal")?.classList.remove("is-hidden");
}

function closeConfirm() {
  pendingDeleteId = null;
  qs("#confirm-modal")?.classList.add("is-hidden");
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  closeConfirm();
  try {
    await deleteMovie(id);
    movies = await getMovies();
    showToast("Movie removed from catalogue");
    if (document.body.dataset.page === "details") {
      window.location.href = "index.html#admin";
      return;
    }
    if (document.body.dataset.page === "industry") {
      refreshIndustry(new URLSearchParams(window.location.search).get("industry") || "Hollywood");
      return;
    }
    refreshHome();
    applySearch();
  } catch (error) {
    showToast(error.message);
  }
}

// ---------- save (add / edit) ----------

async function saveMovie(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const movie = Object.fromEntries(formData.entries());
  try {
    if (movie.id) await updateMovie(movie.id, movie);
    else await addMovie(movie);
    movies = await getMovies();
    closeModal();
    showToast(movie.id ? "Movie updated. Genre and details are live." : "Movie added to the catalogue.");
    if (document.body.dataset.page === "details") {
      await renderDetails();
      return;
    }
    if (document.body.dataset.page === "industry") {
      refreshIndustry(new URLSearchParams(window.location.search).get("industry") || "Hollywood");
      return;
    }
    refreshHome();
    applySearch();
  } catch (error) {
    showToast(error.message);
  }
}

// ---------- details page ----------

async function renderDetails() {
  const id = new URLSearchParams(window.location.search).get("id") || movies[0]?.id;
  const movie = (id && await getMovieById(id)) || movies[0];
  const target = qs("#detail-main");
  if (!target) return;
  if (!movie) {
    target.innerHTML = `<section class="content-section"><p class="empty-copy">No movie found. <a href="index.html#admin">Return to the catalogue</a>.</p></section>`;
    return;
  }
  const saved = myWatchlist.includes(String(movie.id));
  const adminButtons = isAdmin()
    ? `<button class="ghost-button" data-action="edit" data-id="${escapeHtml(movie.id)}">Edit movie</button>
       <button class="danger-button" data-action="delete" data-id="${escapeHtml(movie.id)}">Delete movie</button>`
    : "";
  const recommendations = movies.filter((item) => item.id !== movie.id && item.genre === movie.genre).slice(0, 6);
  const fallback = movies.filter((item) => item.id !== movie.id).slice(0, 6);
  target.innerHTML = `
    <section class="detail-hero">
      <div class="detail-backdrop" style="background-image:url('${escapeHtml(movie.backdrop || FALLBACK_POSTER)}')"></div>
      <div class="detail-vignette"></div>
      <div class="detail-inner">
        <img class="detail-poster" src="${escapeHtml(movie.poster || FALLBACK_POSTER)}" alt="${escapeHtml(movie.title)} poster">
        <div class="detail-copy">
          <a class="back-link" href="index.html">← Back to collection</a>
          <p class="eyebrow">${escapeHtml(movie.industry || "Hollywood")} · ${escapeHtml(movie.genre)} · ${escapeHtml(movie.status)}</p>
          <h1>${escapeHtml(movie.title)} <span class="detail-rating">★ ${formatRating(movie.rating)}</span></h1>
          <div class="detail-facts">
            <span>${escapeHtml(String(movie.releaseDate).slice(0, 4))}</span>
            <span>${escapeHtml(movie.type || "Movies")}</span>
            <span>${escapeHtml(movie.duration)}</span>
            <span>${escapeHtml(movie.language)}</span>
          </div>
          <p class="hero-description">${escapeHtml(movie.description)}</p>
          <div class="hero-buttons">
            ${movie.trailer ? `<button class="primary-button" data-action="trailer" data-id="${escapeHtml(movie.id)}">▶ Watch trailer</button>` : ""}
            <button class="ghost-button" data-action="watchlist" data-id="${escapeHtml(movie.id)}">${saved ? "♥ In watchlist" : "♡ Add to watchlist"}</button>
            ${adminButtons}
          </div>
        </div>
      </div>
    </section>
    <section class="detail-info">
      <div class="info-item"><span>Director</span><strong>${escapeHtml(movie.director)}</strong></div>
      <div class="info-item"><span>Cast</span><strong>${escapeHtml(movie.cast)}</strong></div>
      <div class="info-item"><span>Genre</span><strong>${escapeHtml(movie.genre)}</strong></div>
      <div class="info-item"><span>Industry</span><strong><a class="industry-link" href="industry.html?industry=${encodeURIComponent(movie.industry || "Hollywood")}">${escapeHtml(movie.industry || "Hollywood")}</a></strong></div>
    </section>
    <section class="content-section recommend-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Keep watching</p>
          <h2>More <em>like this</em></h2>
        </div>
      </div>
      <div class="movie-row">${(recommendations.length ? recommendations : fallback).map((item) => movieCard(item, savedSet())).join("") || '<p class="empty-copy">Add more titles in this genre to see recommendations.</p>'}</div>
    </section>
  `;
}
