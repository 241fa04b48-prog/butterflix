import { api } from "./apiService.js";

export const INDUSTRIES = ["Hollywood", "Bollywood", "Tollywood"];
export const CATALOG_TYPES = ["Movies", "TV Shows", "Cartoons"];

export async function getMovies() {
  const { movies } = await api("/api/movies");
  return movies;
}

export async function getMovieById(id) {
  const { movie } = await api(`/api/movies/${encodeURIComponent(id)}`);
  return movie;
}

export async function addMovie(movie) {
  const { movie: created } = await api("/api/movies", { method: "POST", body: movie });
  return created;
}

export async function addMoviesBulk(entries) {
  const { movies } = await api("/api/movies/bulk", { method: "POST", body: { entries } });
  return movies;
}

export async function updateMovie(id, changes) {
  const { movie } = await api(`/api/movies/${encodeURIComponent(id)}`, { method: "PUT", body: changes });
  return movie;
}

export async function deleteMovie(id) {
  await api(`/api/movies/${encodeURIComponent(id)}`, { method: "DELETE" });
  return true;
}

// ---------- spotlight (admin-controlled featured slider) ----------

export async function getSpotlight() {
  const { spotlight } = await api("/api/spotlight");
  return spotlight;
}

export async function saveSpotlight(ids) {
  const { spotlight } = await api("/api/spotlight", { method: "PUT", body: { ids } });
  return spotlight;
}
