// Tienda pública: carga data.json, muestra catálogo y envía el pedido a WhatsApp.
const $ = (s) => document.querySelector(s);
let DATA = { settings: {}, products: [] };
let cart = [];
let filter = "Todos";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => `${DATA.settings.currency || "S/"} ${Number(n || 0).toFixed(2)}`;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const BOX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>`;
const PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
function placeholder() { return `<div class="ph">${BOX}</div>`; }
const imgHtml = (p) => (p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : placeholder(p.name));
const discount = (p) => (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

function cardHtml(p) {
  const d = discount(p);
  return `<article class="card">
    ${d ? `<span class="badge">-${d}%</span>` : ""}
    ${p.type === "pack" ? `<span class="badge pack">PACK</span>` : ""}
    <div class="img">${imgHtml(p)}</div>
    <div class="body">
      <span class="cat">${esc(p.category)}</span>
      <h3>${esc(p.name)}</h3>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
      ${p.includes?.length ? `<ul>${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
      <div class="card-foot">
        <div class="price"><span class="now">${money(p.price)}</span>${d ? `<span class="old">${money(p.oldPrice)}</span>` : ""}</div>
        <button class="add" data-add="${esc(p.id)}" aria-label="Agregar ${esc(p.name)} al carrito">${PLUS}</button>
      </div>
    </div>
  </article>`;
}

function renderGrid(el, list, emptyMsg) {
  el.innerHTML = list.length ? list.map(cardHtml).join("") : `<p class="empty">${emptyMsg}</p>`;
}

function render() {
  const s = DATA.settings;
  const active = DATA.products.filter((p) => p.active !== false);
  document.title = `${s.businessName} | Catálogo, descuentos y packs`;
  $("#announcement").textContent = s.announcement || "";
  $("#announcement").hidden = !s.announcement;
  $("#logo").innerHTML = (s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<span class="mark">${esc((s.businessName || "I")[0])}</span>`) + `<span>${esc(s.businessName)}</span>`;
  $("#heroTitle").textContent = s.businessName;
  $("#heroSlogan").textContent = s.slogan || "";
  $("#aboutText").textContent = s.about || "";
  $("#footName").textContent = s.businessName;
  $("#footSlogan").textContent = s.slogan || "";
  const wa = `https://wa.me/${s.whatsapp}`;
  $("#footWa").href = wa; $("#footWa").textContent = "+" + String(s.whatsapp).replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
  $("#waFloat").href = wa + "?text=" + encodeURIComponent(`Hola ${s.businessName}, quisiera información.`);
  ["#fbLink", "#footFb"].forEach((id) => { $(id).href = s.facebook || "#"; $(id).hidden = !s.facebook; });

  renderGrid($("#gridDeals"), active.filter((p) => discount(p) > 0 && p.type !== "pack"), "Pronto nuevas ofertas.");
  renderGrid($("#gridPacks"), active.filter((p) => p.type === "pack"), "Pronto nuevos packs.");

  const cats = ["Todos", ...new Set(active.map((p) => p.category).filter(Boolean))];
  if (!cats.includes(filter)) filter = "Todos";
  $("#filters").innerHTML = cats.map((c) => `<button class="chip ${c === filter ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const q = $("#search").value.trim().toLowerCase();
  const list = active.filter((p) => (filter === "Todos" || p.category === filter) && (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)));
  renderGrid($("#gridAll"), list, "No se encontraron productos.");
  $("#catCount").textContent = `${list.length} producto${list.length === 1 ? "" : "s"}`;
  renderCart();
}

// ---------- Carrito ----------
function findP(id) { return DATA.products.find((p) => p.id === id); }
function saveCart() { store.set("cart", cart); }
function addToCart(id) {
  const it = cart.find((i) => i.id === id);
  it ? it.qty++ : cart.push({ id, qty: 1 });
  saveCart(); renderCart(); toast("Agregado al carrito");
}
function renderCart() {
  cart = cart.filter((i) => findP(i.id) && i.qty > 0);
  const count = cart.reduce((a, i) => a + i.qty, 0);
  $("#cartCount").textContent = count;
  $("#cartItems").innerHTML = cart.length ? cart.map((i) => {
    const p = findP(i.id);
    return `<div class="item">
      <div class="thumb">${imgHtml(p)}</div>
      <div><div class="n">${esc(p.name)}</div><div class="p">${money(p.price)} × ${i.qty} = ${money(p.price * i.qty)}</div></div>
      <div class="qty"><button data-dec="${esc(p.id)}">−</button><span>${i.qty}</span><button data-inc="${esc(p.id)}">+</button></div>
    </div>`;
  }).join("") : `<p class="empty">Tu carrito está vacío.</p>`;
  const total = money(cart.reduce((a, i) => a + findP(i.id).price * i.qty, 0));
  $("#cartTotal").textContent = total;
  $("#cbCount").textContent = count; $("#cbTotal").textContent = total;
  $("#cartbar").classList.toggle("on", count > 0 && !$("#drawer").classList.contains("on"));
  document.body.classList.toggle("has-cart", count > 0);
  updateWaLink();
}
function openCart(on) { $("#drawer").classList.toggle("on", on); $("#overlay").classList.toggle("on", on); renderCart(); }

function orderMessage() {
  const s = DATA.settings;
  const name = $("#cName").value.trim();
  const place = $("#cPlace").value.trim();
  const note = $("#cNote").value.trim();
  let total = 0;
  const lines = cart.map((i) => {
    const p = findP(i.id); const sub = p.price * i.qty; total += sub;
    return `• ${i.qty} x ${p.name}${p.type === "pack" ? " (Pack)" : ""} — ${money(sub)}`;
  });
  return [
    `Hola ${s.businessName}, quiero hacer este pedido:`, "", ...lines, "",
    `*Total: ${money(total)}*`, "",
    name ? `Nombre: ${name}` : null,
    place ? `Distrito/Ciudad: ${place}` : null,
    `Entrega: ${$("#cDelivery").value}`,
    note ? `Comentario: ${note}` : null,
  ].filter((l) => l !== null).join("\n");
}
function updateWaLink() {
  if (!DATA.settings.whatsapp) return;
  $("#sendWa").href = `https://wa.me/${DATA.settings.whatsapp}?text=${encodeURIComponent(orderMessage())}`;
}
function onSendWa(e) {
  if (!cart.length) { e.preventDefault(); return toast("Agrega productos primero"); }
  if (!$("#cName").value.trim()) { e.preventDefault(); $("#cName").focus(); return toast("Escribe tu nombre"); }
  store.set("customer", { name: $("#cName").value.trim(), place: $("#cPlace").value.trim() });
}

let tt;
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("on"), 1800); }

// ---------- Eventos ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-cat]");
  if (!t) return;
  if (t.dataset.add) addToCart(t.dataset.add);
  if (t.dataset.inc) { cart.find((i) => i.id === t.dataset.inc).qty++; saveCart(); renderCart(); }
  if (t.dataset.dec) { cart.find((i) => i.id === t.dataset.dec).qty--; saveCart(); renderCart(); }
  if (t.dataset.cat) { filter = t.dataset.cat; render(); }
});
$("#search").addEventListener("input", render);
$("#openCart").onclick = () => openCart(true);
$("#closeCart").onclick = $("#overlay").onclick = () => openCart(false);
$("#sendWa").addEventListener("click", onSendWa);
$("#cartbarBtn").onclick = () => openCart(true);
$("#checkout").addEventListener("input", updateWaLink);
$("#checkout").addEventListener("submit", (e) => e.preventDefault());
$("#clearCart").onclick = () => { cart = []; saveCart(); renderCart(); };

(async function init() {
  cart = store.get("cart", []);
  const c = store.get("customer", {});
  $("#cName").value = c.name || ""; $("#cPlace").value = c.place || "";
  try {
    const r = await fetch("data.json?v=" + Date.now(), { cache: "no-store" });
    DATA = await r.json();
  } catch (e) { console.error("No se pudo cargar data.json", e); }
  // Vista previa del panel (solo en el navegador del administrador)
  const preview = store.get("adminPreview", null);
  if (preview && new URLSearchParams(location.search).has("preview")) DATA = preview;
  render();
})();
