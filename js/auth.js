import { getSession, loginAccount, registerAccount, ROLES } from "./service/authService.js";
import { qs, showToast } from "./utils.js";
import { releaseButterflies } from "./butterflies.js";

document.addEventListener("DOMContentLoaded", () => {
  const session = getSession();
  if (session) {
    window.location.href = session.role === ROLES.ADMIN ? "index.html#admin" : "index.html";
    return;
  }
  releaseButterflies(qs("#auth-butterflies"), 12);
  bindTabs();
  bindRoleToggle();
  renderPrefChips();
  bindForms();
});

function bindTabs() {
  qs("#tab-login")?.addEventListener("click", () => switchTab("login"));
  qs("#tab-register")?.addEventListener("click", () => switchTab("register"));
  qs("#swap-to-register")?.addEventListener("click", () => switchTab("register"));
  qs("#swap-to-login")?.addEventListener("click", () => switchTab("login"));
}

function switchTab(tab) {
  const login = tab === "login";
  qs("#tab-login")?.classList.toggle("active", login);
  qs("#tab-register")?.classList.toggle("active", !login);
  qs("#login-form")?.classList.toggle("is-hidden", !login);
  qs("#register-form")?.classList.toggle("is-hidden", login);
}

function bindRoleToggle() {
  qs("#register-role-toggle")?.addEventListener("click", (event) => {
    const option = event.target.closest(".role-option");
    if (!option) return;
    const role = option.dataset.role;
    qs("#register-role").value = role;
    document.querySelectorAll(".role-option").forEach((el) => el.classList.toggle("active", el === option));
    qs("#pref-block")?.classList.toggle("is-hidden", role !== ROLES.USER);
  });
}

function renderPrefChips() {
  const row = qs("#pref-chips");
  if (!row || row.dataset.bound) return;
  row.dataset.bound = "true";
  const genres = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Thriller"];
  row.innerHTML = genres.map((genre) => `<button type="button" class="pref-chip" data-genre="${genre}">${genre}</button>`).join("");
  row.addEventListener("click", (event) => {
    const chip = event.target.closest(".pref-chip");
    if (chip) chip.classList.toggle("selected");
  });
}

function collectPreferences() {
  return [...document.querySelectorAll(".pref-chip.selected")].map((chip) => chip.dataset.genre);
}

function showError(id, message) {
  const el = qs(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("is-hidden");
}

function clearError(id) {
  const el = qs(id);
  if (!el) return;
  el.textContent = "";
  el.classList.add("is-hidden");
}

function bindForms() {
  qs("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError("#login-error");
    try {
      const session = await loginAccount({
        name: qs("#login-name").value,
        email: qs("#login-email").value,
        password: qs("#login-password").value,
        role: qs("#login-role").value
      });
      showToast(`Welcome back, ${session.name}!`);
      window.location.href = session.role === ROLES.ADMIN ? "index.html#admin" : "index.html";
    } catch (error) {
      showError("#login-error", error.message);
    }
  });

  qs("#register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError("#register-error");
    try {
      const role = qs("#register-role").value || ROLES.USER;
      const session = await registerAccount({
        name: qs("#register-name").value,
        email: qs("#register-email").value,
        password: qs("#register-password").value,
        role,
        preferences: role === ROLES.USER ? collectPreferences() : []
      });
      showToast(`Welcome to Butterflix, ${session.name}!`);
      window.location.href = role === ROLES.ADMIN ? "index.html#admin" : "index.html";
    } catch (error) {
      showError("#register-error", error.message);
    }
  });
}
