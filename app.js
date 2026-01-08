const STORAGE_KEY = "recipes.v2";

const recipeListEl = document.getElementById("recipeList");
const shoppingListEl = document.getElementById("shoppingList");
const generateBtn = document.getElementById("generateBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const copyBtn = document.getElementById("copyBtn");
const searchEl = document.getElementById("search");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");

// Entry-based UI
const recipeNameEl = document.getElementById("recipeName");
const servingsEl = document.getElementById("servings");
const ingItemEl = document.getElementById("ingItem");
const ingQtyEl = document.getElementById("ingQty");
const ingUnitEl = document.getElementById("ingUnit");
const addIngBtn = document.getElementById("addIngBtn");
const ingTableEl = document.getElementById("ingTable");
const saveRecipeBtn = document.getElementById("saveRecipeBtn");
const resetRecipeBtn = document.getElementById("resetRecipeBtn");

let draftIngredients = [];

function loadRecipes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecipes(recipes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function normalizeItemName(s) {
  return (s || "").trim().toLowerCase();
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------- Draft ingredient entry ---------- */

function renderDraftIngredients() {
  ingTableEl.innerHTML = "";

  if (draftIngredients.length === 0) {
    ingTableEl.innerHTML = `<p class="muted">No ingredients yet. Add some above.</p>`;
    return;
  }

  for (const ing of draftIngredients) {
    const row = document.createElement("label");

    const qtyText = ing.qty == null ? "" : `${ing.qty}`;
    const unitText = (ing.unit || "").trim();
    const pill = [qtyText, unitText].filter(Boolean).join(" ");

    row.innerHTML = `
      <div><strong>${escapeHtml(ing.item)}</strong></div>
      <div class="pill">${escapeHtml(pill)}</div>
      <button type="button" data-remove="${ing.id}" class="danger" style="margin-left:8px;">Remove</button>
    `;

    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";

    ingTableEl.appendChild(row);
  }

  ingTableEl.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove");
      draftIngredients = draftIngredients.filter((x) => x.id !== id);
      renderDraftIngredients();
    });
  });
}

addIngBtn.addEventListener("click", () => {
  const item = (ingItemEl.value || "").trim();
  if (!item) {
    alert("Ingredient item name is required.");
    return;
  }

  const qty = ingQtyEl.value === "" ? null : toNumberOrNull(ingQtyEl.value);
  const unit = (ingUnitEl.value || "").trim();

  draftIngredients.push({ id: uid(), item, qty, unit });

  ingItemEl.value = "";
  ingQtyEl.value = "";
  ingUnitEl.value = "";
  ingItemEl.focus();

  renderDraftIngredients();
});

resetRecipeBtn.addEventListener("click", () => {
  recipeNameEl.value = "";
  servingsEl.value = "";
  ingItemEl.value = "";
  ingQtyEl.value = "";
  ingUnitEl.value = "";
  draftIngredients = [];
  renderDraftIngredients();
});

saveRecipeBtn.addEventListener("click", () => {
  const name = (recipeNameEl.value || "").trim();
  if (!name) {
    alert("Recipe name is required.");
    return;
  }
  if (draftIngredients.length === 0) {
    alert("Add at least one ingredient.");
    return;
  }

  const servings = servingsEl.value === "" ? null : toNumberOrNull(servingsEl.value);

  const recipes = loadRecipes();
  recipes.push({
    id: uid(),
    name,
    servings,
    ingredients: draftIngredients.map(({ id, ...rest }) => rest),
    createdAt: new Date().toISOString(),
  });

  saveRecipes(recipes);

  // reset draft
  recipeNameEl.value = "";
  servingsEl.value = "";
  draftIngredients = [];
  renderDraftIngredients();

  renderRecipes();
  shoppingListEl.textContent = "(select recipes, then generate)";
});

/* ---------- Recipe menu ---------- */

function renderRecipes() {
  const recipes = loadRecipes();
  const q = (searchEl.value || "").trim().toLowerCase();

  recipeListEl.innerHTML = "";

  const filtered = recipes.filter((r) => (r?.name || "").toLowerCase().includes(q));

  if (filtered.length === 0) {
    recipeListEl.innerHTML = `<p class="muted">No recipes stored yet.</p>`;
    return;
  }

  for (const r of filtered) {
    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" data-id="${r.id}" />
      <div>
        <div><strong>${escapeHtml(r.name)}</strong></div>
        <div class="muted">${(r.ingredients?.length || 0)} ingredients</div>
      </div>
    `;
    recipeListEl.appendChild(label);
  }
}

function getSelectedRecipeIds() {
  return [...document.querySelectorAll('input[type="checkbox"][data-id]:checked')].map((cb) =>
    cb.getAttribute("data-id")
  );
}

/* ---------- Shopping list ---------- */

function buildShoppingList(selectedIds) {
  const recipes = loadRecipes();
  const selected = recipes.filter((r) => selectedIds.includes(r.id));

  // Merge by normalized item + unit
  const merged = new Map();

  for (const r of selected) {
    for (const ing of r.ingredients || []) {
      const item = (ing.item || "").trim();
      if (!item) continue;

      const unit = (ing.unit || "").trim();
      const key = `${normalizeItemName(item)}__${unit.toLowerCase()}`;

      const qty = typeof ing.qty === "number" ? ing.qty : null;

      if (!merged.has(key)) {
        merged.set(key, { item, unit, qty });
      } else {
        const curr = merged.get(key);
        // Only sum if both quantities are numeric
        if (curr.qty != null && qty != null) curr.qty += qty;
        else if (curr.qty == null && qty != null) curr.qty = qty;
      }
    }
  }

  const items = [...merged.values()].sort((a, b) => a.item.localeCompare(b.item));

  const lines = items.map((x) => {
    const qty = x.qty == null ? "" : String(x.qty);
    const unit = (x.unit || "").trim();
    const right = [qty, unit].filter(Boolean).join(" ").trim();
    return right ? `- ${x.item} — ${right}` : `- ${x.item}`;
  });

  return lines.join("\n");
}

generateBtn.addEventListener("click", () => {
  const ids = getSelectedRecipeIds();
  if (ids.length === 0) {
    shoppingListEl.textContent = "Pick at least one recipe.";
    return;
  }
  const text = buildShoppingList(ids);
  shoppingListEl.textContent = text || "(no ingredients found)";
});

copyBtn.addEventListener("click", async () => {
  const text = shoppingListEl.textContent || "";
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    alert("Copy failed (clipboard permissions).");
  }
});

/* ---------- Bulk actions ---------- */

searchEl.addEventListener("input", renderRecipes);

selectAllBtn.addEventListener("click", () => {
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach((cb) => (cb.checked = true));
});

selectNoneBtn.addEventListener("click", () => {
  document.querySelectorAll('input[type="checkbox"][data-id]').forEach((cb) => (cb.checked = false));
});

clearAllBtn.addEventListener("click", () => {
  if (!confirm("Delete all stored recipes from this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderRecipes();
  shoppingListEl.textContent = "(select recipes, then generate)";
});

/* ---------- Helpers ---------- */

function escapeHtml(str) {
  // Minimal escaping to prevent HTML injection in innerHTML usage
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Init ---------- */
renderDraftIngredients();
renderRecipes();
