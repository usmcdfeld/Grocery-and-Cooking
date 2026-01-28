const STORAGE_KEY = "recipes.v3";

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

// Import/Export
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

let draftIngredients = [];

/* ---------------- Storage ---------------- */

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

function normalizeName(s) {
  return (s || "").trim().toLowerCase();
}

function normalizeItemName(s) {
  return (s || "").trim().toLowerCase();
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- Draft ingredient entry ---------------- */

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

  const newRecipe = {
    id: uid(),
    name,
    servings,
    ingredients: draftIngredients.map(({ id, ...rest }) => rest),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const recipes = loadRecipes();
  // Replace by name if it already exists (avoid duplicates)
  const idx = recipes.findIndex((r) => normalizeName(r.name) === normalizeName(newRecipe.name));
  if (idx >= 0) recipes[idx] = { ...recipes[idx], ...newRecipe, id: recipes[idx].id };
  else recipes.push(newRecipe);

  saveRecipes(recipes);

  // reset draft
  recipeNameEl.value = "";
  servingsEl.value = "";
  draftIngredients = [];
  renderDraftIngredients();

  renderRecipes();
  shoppingListEl.textContent = "(select recipes, then generate)";
});

/* ---------------- Recipe menu ---------------- */

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

/* ---------------- Shopping list ---------------- */

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

/* ---------------- Import / Export ---------------- */

exportBtn.addEventListener("click", () => {
  const recipes = loadRecipes();

  const payload = {
    app: "recipe-picker-shopping-list",
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `recipes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const files = [...(importInput.files || [])];
  if (files.length === 0) return;

  try {
    const importedRecipes = [];

    for (const file of files) {
      const text = await file.text();
      const data = JSON.parse(text);

      // Accept either:
      // 1) full backup object: { app, version, exportedAt, recipes: [...] }
      // 2) array of recipes: [ ... ]
      // 3) single recipe object: { name, ingredients: [...] }
      const recipes = extractRecipesFromUnknownJson(data);

      for (const r of recipes) {
        const cleaned = sanitizeRecipe(r);
        if (cleaned) importedRecipes.push(cleaned);
      }
    }

    if (importedRecipes.length === 0) {
      alert("No valid recipes found in the selected file(s).");
      importInput.value = "";
      return;
    }

    const merged = mergeByName(loadRecipes(), importedRecipes);
    saveRecipes(merged);

    renderRecipes();
    alert(`Imported ${importedRecipes.length} recipe(s).`);
  } catch (e) {
    console.error(e);
    alert("Import failed: invalid JSON or unsupported format.");
  } finally {
    importInput.value = "";
  }
});

function extractRecipesFromUnknownJson(data) {
  if (!data) return [];

  // Full backup format
  if (Array.isArray(data.recipes)) return data.recipes;

  // Direct array of recipes
  if (Array.isArray(data)) return data;

  // Single recipe object
  if (typeof data === "object" && data.name && Array.isArray(data.ingredients)) return [data];

  return [];
}

function sanitizeRecipe(r) {
  if (!r || typeof r !== "object") return null;

  const name = (r.name || "").trim();
  if (!name) return null;

  const ingredientsRaw = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients = ingredientsRaw
    .map((ing) => {
      if (!ing || typeof ing !== "object") return null;
      const item = (ing.item || "").trim();
      if (!item) return null;

      const unit = (ing.unit || "").trim();
      const qty = typeof ing.qty === "number" ? ing.qty : (ing.qty === "" || ing.qty == null ? null : Number(ing.qty));
      const qtyClean = Number.isFinite(qty) ? qty : null;

      return { item, qty: qtyClean, unit };
    })
    .filter(Boolean);

  if (ingredients.length === 0) return null;

  const servings =
    typeof r.servings === "number"
      ? r.servings
      : r.servings == null || r.servings === ""
      ? null
      : toNumberOrNull(r.servings);

  const now = new Date().toISOString();

  return {
    id: r.id || uid(),
    name,
    servings: Number.isFinite(servings) ? servings : null,
    ingredients,
    createdAt: r.createdAt || now,
    updatedAt: now,
  };
}

function mergeByName(existing, incoming) {
  // Replace existing by name (case-insensitive). Otherwise append.
  const map = new Map(existing.map((r) => [normalizeName(r.name), r]));

  for (const r of incoming) {
    const key = normalizeName(r.name);
    if (map.has(key)) {
      const prev = map.get(key);
      map.set(key, { ...prev, ...r, id: prev.id, updatedAt: new Date().toISOString() });
    } else {
      map.set(key, r);
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------- Bulk actions ---------------- */

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

/* ---------------- Helpers ---------------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- Init ---------------- */
renderDraftIngredients();
renderRecipes();
