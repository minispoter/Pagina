// Panel de administración: edita data.json y lo publica en GitHub (GitHub Pages).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let DATA = null;      // borrador actual
let remoteSha = null; // sha de data.json en GitHub
let gh = store.get("gh", { owner: "minispoter", repo: "Pagina", branch: "main", token: "" });

// ---------- Utilidades ----------
function status(msg, type = "info") { const el = $("#status"); el.textContent = msg; el.className = `status on ${type}`; if (type === "ok") setTimeout(() => el.classList.remove("on"), 4000); }
let tt; function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 1800); }
const money = (n) => `${DATA.settings.currency || "S/"} ${Number(n || 0).toFixed(2)}`;
const b64encode = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin); };
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function placeholder(name) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `<div class="ph" style="background:hsl(${hue} 60% 50%)">${esc(name[0] || "?")}</div>`;
}

function markDirty(on = true) {
  $("#dirty").classList.toggle("on", on);
  store.set("adminDraft", on ? { data: DATA, sha: remoteSha } : null);
  store.set("adminPreview", DATA);
}

// Reduce la imagen a máx. 1000px y la devuelve como dataURL JPEG
function resizeImage(file, max = 1000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- GitHub ----------
const ghConnected = () => gh.token && gh.owner && gh.repo;
async function ghApi(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${gh.token}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) },
  });
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error(`${r.status} ${t.message || r.statusText}`); }
  return r.json();
}
async function ghLoad() {
  const f = await ghApi(`contents/data.json?ref=${encodeURIComponent(gh.branch)}&t=${Date.now()}`);
  remoteSha = f.sha;
  return JSON.parse(b64decode(f.content));
}
async function ghPutFile(path, base64, message, sha) {
  return ghApi(`contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: base64, branch: gh.branch, ...(sha ? { sha } : {}) }) });
}

async function publish() {
  if (!ghConnected()) {
    $("#connDetails").open = true;
    return status("Conecta tu cuenta de GitHub para publicar, o usa 'Descargar data.json' en Respaldo.", "err");
  }
  const btn = $("#publish"); btn.disabled = true;
  try {
    // 1) Subir imágenes nuevas (dataURL) como archivos en /images
    const pending = [...DATA.products.filter((p) => p.image?.startsWith("data:")).map((p) => ({ o: p, k: "image", n: p.id })),
      ...(DATA.settings.logo?.startsWith("data:") ? [{ o: DATA.settings, k: "logo", n: "logo" }] : [])];
    for (let i = 0; i < pending.length; i++) {
      const it = pending[i];
      status(`Subiendo imágenes ${i + 1}/${pending.length}…`);
      const path = `images/${it.n}-${Date.now()}.jpg`;
      await ghPutFile(path, it.o[it.k].split(",")[1], `Imagen ${it.n}`);
      it.o[it.k] = path;
    }
    // 2) Guardar data.json
    status("Publicando catálogo…");
    const res = await ghPutFile("data.json", b64encode(JSON.stringify(DATA, null, 2) + "\n"), "Actualizar catálogo desde el panel", remoteSha);
    remoteSha = res.content.sha;
    markDirty(false);
    renderAll();
    status("✅ Publicado. La web se actualizará en 1–2 minutos.", "ok");
  } catch (e) {
    if (String(e.message).startsWith("409")) status("Otro cambio se publicó mientras editabas. Pulsa 'Conectar y cargar' para traer la última versión (perderás el borrador).", "err");
    else status("Error al publicar: " + e.message, "err");
  } finally { btn.disabled = false; }
}

// ---------- Render ----------
function renderTable() {
  const q = $("#aSearch").value.trim().toLowerCase();
  const list = DATA.products.filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q));
  $("#nProd").textContent = DATA.products.length;
  $("#pTable").innerHTML = list.map((p) => {
    const d = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `<tr>
      <td><div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : placeholder(p.name)}</div></td>
      <td><b>${esc(p.name)}</b></td>
      <td>${p.type === "pack" ? "Pack" : "Producto"}</td>
      <td>${esc(p.category)}</td>
      <td>${money(p.price)}</td>
      <td>${d ? `-${d}%` : "—"}</td>
      <td><input type="checkbox" data-toggle="${esc(p.id)}" ${p.active !== false ? "checked" : ""} style="width:auto"></td>
      <td style="white-space:nowrap"><button class="btn btn-ghost sm" data-edit="${esc(p.id)}">Editar</button>
        <button class="btn btn-ghost sm" data-del="${esc(p.id)}">🗑</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="muted">Sin productos.</td></tr>`;
  $("#catList").innerHTML = [...new Set(DATA.products.map((p) => p.category).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join("");
}
function fillSettings() {
  const s = DATA.settings;
  $("#sName").value = s.businessName || ""; $("#sWa").value = s.whatsapp || ""; $("#sSlogan").value = s.slogan || "";
  $("#sAnn").value = s.announcement || ""; $("#sAbout").value = s.about || ""; $("#sFb").value = s.facebook || "";
  $("#sCur").value = s.currency || "S/"; $("#sLogo").value = s.logo?.startsWith("data:") ? "" : s.logo || "";
}
function renderAll() { renderTable(); fillSettings(); }
function updatePrev() {
  const src = $("#pForm").dataset.img || $("#pImg").value.trim();
  $("#pPrev").innerHTML = src ? `<img src="${esc(src)}" alt="">` : "";
  $("#incWrap").style.display = $("#pType").value === "pack" ? "" : "none";
}

// ---------- Formulario producto ----------
function resetForm() {
  $("#pForm").reset(); $("#pId").value = ""; delete $("#pForm").dataset.img;
  $("#pActive").checked = true; $("#formTitle").textContent = "➕ Nuevo producto"; $("#pSave").textContent = "Guardar producto";
  updatePrev();
}
function editProduct(id) {
  const p = DATA.products.find((x) => x.id === id); if (!p) return;
  $("#pId").value = p.id; $("#pName").value = p.name; $("#pType").value = p.type || "producto";
  $("#pCat").value = p.category || ""; $("#pPrice").value = p.price; $("#pOld").value = p.oldPrice || "";
  $("#pDesc").value = p.description || ""; $("#pInc").value = (p.includes || []).join("\n");
  $("#pActive").checked = p.active !== false;
  if (p.image?.startsWith("data:")) { $("#pForm").dataset.img = p.image; $("#pImg").value = ""; }
  else { delete $("#pForm").dataset.img; $("#pImg").value = p.image || ""; }
  $("#formTitle").textContent = "✏️ Editar producto"; $("#pSave").textContent = "Guardar cambios";
  updatePrev(); $("#pForm").scrollIntoView({ behavior: "smooth", block: "center" });
}
$("#pForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("#pId").value || uid();
  const p = {
    id, name: $("#pName").value.trim(), category: $("#pCat").value.trim() || "General",
    type: $("#pType").value, price: Number($("#pPrice").value), oldPrice: Number($("#pOld").value) || 0,
    image: $("#pForm").dataset.img || $("#pImg").value.trim(),
    description: $("#pDesc").value.trim(),
    includes: $("#pType").value === "pack" ? $("#pInc").value.split("\n").map((s) => s.trim()).filter(Boolean) : [],
    active: $("#pActive").checked,
  };
  const i = DATA.products.findIndex((x) => x.id === id);
  i >= 0 ? (DATA.products[i] = p) : DATA.products.unshift(p);
  markDirty(); renderTable(); resetForm(); toast("Guardado. Recuerda publicar.");
});
$("#pFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("#pForm").dataset.img = await resizeImage(f); $("#pImg").value = ""; updatePrev();
};
$("#pImg").oninput = () => { delete $("#pForm").dataset.img; updatePrev(); };
$("#pType").onchange = updatePrev;
$("#pCancel").onclick = resetForm;
$("#aSearch").oninput = renderTable;

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-edit],[data-del]"); if (!t) return;
  if (t.dataset.edit) editProduct(t.dataset.edit);
  if (t.dataset.del) {
    const p = DATA.products.find((x) => x.id === t.dataset.del);
    if (p && confirm(`¿Eliminar "${p.name}"?`)) { DATA.products = DATA.products.filter((x) => x !== p); markDirty(); renderTable(); }
  }
});
document.addEventListener("change", (e) => {
  const id = e.target.dataset?.toggle; if (!id) return;
  DATA.products.find((x) => x.id === id).active = e.target.checked; markDirty();
});

// ---------- Datos del negocio ----------
$("#sForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const s = DATA.settings;
  Object.assign(s, {
    businessName: $("#sName").value.trim(), whatsapp: $("#sWa").value.replace(/\D/g, ""), slogan: $("#sSlogan").value.trim(),
    announcement: $("#sAnn").value.trim(), about: $("#sAbout").value.trim(), facebook: $("#sFb").value.trim(), currency: $("#sCur").value.trim() || "S/",
  });
  if ($("#sLogo").value.trim()) s.logo = $("#sLogo").value.trim();
  markDirty(); toast("Datos guardados. Recuerda publicar.");
});
$("#sLogoFile").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; DATA.settings.logo = await resizeImage(f, 300); $("#sLogo").value = ""; markDirty(); toast("Logo cargado"); };

// ---------- Conexión ----------
function fillConn() {
  $("#ghOwner").value = gh.owner; $("#ghRepo").value = gh.repo; $("#ghBranch").value = gh.branch; $("#ghToken").value = gh.token;
  $("#connInfo").textContent = ghConnected() ? `Conectado a ${gh.owner}/${gh.repo} (${gh.branch})` : "No conectado";
}
$("#connect").onclick = async () => {
  gh = { owner: $("#ghOwner").value.trim(), repo: $("#ghRepo").value.trim(), branch: $("#ghBranch").value.trim() || "main", token: $("#ghToken").value.trim() };
  store.set("gh", gh); fillConn();
  try { status("Cargando catálogo desde GitHub…"); DATA = await ghLoad(); markDirty(false); renderAll(); status("✅ Conectado y catálogo cargado.", "ok"); $("#connDetails").open = false; }
  catch (e) { status("No se pudo conectar: " + e.message, "err"); }
};
$("#logout").onclick = () => { gh.token = ""; store.set("gh", gh); fillConn(); status("Sesión cerrada en este navegador.", "info"); };
$("#publish").onclick = publish;
$("#discard").onclick = async () => { if (confirm("¿Descartar todos los cambios sin publicar?")) { store.del("adminDraft"); location.reload(); } };

// ---------- Respaldo ----------
$("#export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" }));
  a.download = "data.json"; a.click();
};
$("#import").onchange = async (e) => {
  try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d.products)) throw 0; DATA = d; markDirty(); renderAll(); toast("Importado"); }
  catch { status("Archivo inválido.", "err"); }
};

// ---------- Inicio ----------
(async function init() {
  fillConn();
  const draft = store.get("adminDraft", null);
  if (draft?.data) { DATA = draft.data; remoteSha = draft.sha; markDirty(true); }
  else {
    try {
      DATA = ghConnected() ? await ghLoad() : await (await fetch("data.json?v=" + Date.now(), { cache: "no-store" })).json();
    } catch (e) {
      status("No se pudo cargar el catálogo: " + e.message, "err");
      DATA = await (await fetch("data.json?v=" + Date.now())).json().catch(() => ({ settings: {}, products: [] }));
    }
  }
  if (!ghConnected()) $("#connDetails").open = true;
  renderAll(); resetForm();
})();
