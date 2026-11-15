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

function placeholder(name) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const ini = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return `<div class="ph" style="background:linear-gradient(135deg,hsl(${hue} 60% 45%),hsl(${(hue + 40) % 360} 70% 55%))">${esc(ini)}</div>`;
}
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
      <div class="price"><span class="now">${money(p.price)}</span>${d ? `<span class="old">${money(p.oldPrice)}</span>` : ""}</div>
      <button class="btn btn-primary add" data-add="${esc(p.id)}">Agregar</button>
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
  $("#cartTotal").textContent = money(cart.reduce((a, i) => a + findP(i.id).price * i.qty, 0));
}
function openCart(on) { $("#drawer").classList.toggle("on", on); $("#overlay").classList.toggle("on", on); }

function sendWhatsApp() {
  if (!cart.length) return toast("Agrega productos primero");
  const s = DATA.settings;
  const name = $("#cName").value.trim();
  const place = $("#cPlace").value.trim();
  if (!name) { $("#cName").focus(); return toast("Escribe tu nombre"); }
  store.set("customer", { name, place });
  let total = 0;
  const lines = cart.map((i) => {
    const p = findP(i.id); const sub = p.price * i.qty; total += sub;
    return `• ${i.qty} x ${p.name}${p.type === "pack" ? " (Pack)" : ""} — ${money(sub)}`;
  });
  const msg = [
    `Hola ${s.businessName}, quiero hacer este pedido:`, "", ...lines, "",
    `*Total: ${money(total)}*`, "",
    `Nombre: ${name}`,
    place ? `Distrito/Ciudad: ${place}` : null,
    `Entrega: ${$("#cDelivery").value}`,
    $("#cNote").value.trim() ? `Comentario: ${$("#cNote").value.trim()}` : null,
  ].filter((l) => l !== null).join("\n");
  window.open(`https://wa.me/${s.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
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
$("#sendWa").onclick = sendWhatsApp;
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
