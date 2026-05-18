const seed = {
  users: [
    { id: "admin", name: "Administrador", username: "admin", password: "admin123", role: "admin", monthlyLimit: 500 },
    { id: "u1", name: "Ana", username: "ana", password: "123", role: "user", monthlyLimit: 300 }
  ],
  settings: {
    logo: ""
  },
  products: [
    { id: crypto.randomUUID(), name: "Brigadeiro", price: 4.5, category: "Doces", photo: "" },
    { id: crypto.randomUUID(), name: "Bolo de pote", price: 12, category: "Bolos", photo: "" }
  ],
  consumptions: []
};

const db = {
  get() {
    const raw = localStorage.getItem("doceMariaDB");
    if (!raw) {
      localStorage.setItem("doceMariaDB", JSON.stringify(seed));
      return structuredClone(seed);
    }
    const parsed = JSON.parse(raw);
    if (!parsed.settings) parsed.settings = { logo: "" };
    return parsed;
  },
  set(data) { localStorage.setItem("doceMariaDB", JSON.stringify(data)); }
};

const state = { currentUser: JSON.parse(localStorage.getItem("doceMariaSession") || "null"), view: "dashboard" };
const app = document.getElementById("app");

const money = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = new Date().toISOString().slice(0, 7);
const nowDate = () => new Date().toLocaleString("pt-BR");

const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function loginScreen(error = "") {
  const data = db.get();
  app.innerHTML = `
    <div class="login-wrap">
      <section class="card login-card decorative-card">
        ${data.settings.logo ? `<img class="login-logo" src="${data.settings.logo}" alt="Logo Doce Maria">` : `<div class="logo logo-mark" aria-label="Doce Maria">Doce Maria</div>`}
        <h2>Entrar no sistema</h2>
        <p class="muted">Usuário padrão admin/admin123 e ana/123</p>
        ${error ? `<p style="color:#8B5E3C;">${error}</p>` : ""}
        <form id="loginForm" class="grid">
          <div><label>Usuário</label><input name="username" required /></div>
          <div><label>Senha</label><input name="password" type="password" required /></div>
          <button>Entrar</button>
        </form>
      </section>
    </div>`;

  document.getElementById("loginForm").onsubmit = e => {
    e.preventDefault();
    const dataNow = db.get();
    const f = new FormData(e.target);
    const u = dataNow.users.find(x => x.username === f.get("username") && x.password === f.get("password"));
    if (!u) return loginScreen("Credenciais inválidas.");
    state.currentUser = { id: u.id };
    localStorage.setItem("doceMariaSession", JSON.stringify(state.currentUser));
    render();
  };
}

function calcUserSpend(userId, data) { return data.consumptions.filter(c => c.userId === userId && c.month === monthKey).reduce((s,c)=>s + c.qty*c.price,0); }
function userMonthlyItems(userId, data) {
  const grouped = new Map();
  data.consumptions.filter(c => c.userId === userId && c.month === monthKey).forEach(c => {
    const product = data.products.find(p => p.id === c.productId);
    if (!grouped.has(c.productId)) grouped.set(c.productId, { name: product?.name || "Produto removido", qty: 0, unit: c.price, subtotal: 0 });
    const row = grouped.get(c.productId);
    row.qty += c.qty;
    row.subtotal += c.qty * c.price;
  });
  return Array.from(grouped.values());
}

function exportReceiptPDF(user, data) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return alert("Não foi possível carregar o gerador de PDF.");
  const items = userMonthlyItems(user.id, data);
  const total = calcUserSpend(user.id, data);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 16;
  doc.setFontSize(16); doc.text("RECIBO DE CONSUMO - DOCE MARIA", 12, y); y += 8;
  doc.setFontSize(11);
  doc.text(`Cliente: ${user.name}`, 12, y); y += 6;
  doc.text(`Usuário: ${user.username}`, 12, y); y += 6;
  doc.text(`Competência: ${monthKey}`, 12, y); y += 6;
  doc.text(`Gerado em: ${nowDate()}`, 12, y); y += 8;
  doc.setFontSize(12); doc.text("Itens consumidos", 12, y); y += 6; doc.setFontSize(10);
  items.forEach((item, idx) => {
    const line = `${idx + 1}. ${item.name} | Qtd: ${item.qty} | Unit: ${money(item.unit)} | Subtotal: ${money(item.subtotal)}`;
    const wrapped = doc.splitTextToSize(line, 184);
    doc.text(wrapped, 12, y);
    y += wrapped.length * 5;
    if (y > 270) { doc.addPage(); y = 16; }
  });
  y += 4; doc.setFontSize(12); doc.text(`TOTAL A PAGAR: ${money(total)}`, 12, y);
  doc.save(`recibo-doce-maria-${user.username}-${monthKey}.pdf`);
}

function brandElement(data) {
  return data.settings.logo ? `<img class="brand-logo" src="${data.settings.logo}" alt="Logo Doce Maria">` : `<div class="brand">Doce Maria</div>`;
}

function renderLayout(content, nav = "dashboard") {
  const data = db.get();
  const user = data.users.find(u => u.id === state.currentUser.id);
  const adminItems = user.role === "admin" ? `<button data-v="products">Produtos</button><button data-v="users">Usuários</button>` : "";
  app.innerHTML = `<div class="layout"><aside class="sidebar"><div class="brand-wrap">${brandElement(data)}</div><div class="welcome">${user.name}</div><nav class="nav" id="nav"><button data-v="dashboard" class="${nav==="dashboard"?"active":""}">Dashboard</button><button data-v="menu" class="${nav==="menu"?"active":""}">Menu</button>${adminItems}</nav><button id="logout" class="logout-btn">Sair</button></aside><section class="content">${content}</section></div>`;
  document.getElementById("logout").onclick = () => { localStorage.removeItem("doceMariaSession"); state.currentUser = null; render(); };
  document.getElementById("nav").onclick = e => { if (e.target.dataset.v) { state.view = e.target.dataset.v; render(); }};
}

function dashboard(){const data=db.get();const user=data.users.find(u=>u.id===state.currentUser.id);const spend=calcUserSpend(user.id,data);if(user.role==="admin"){const totalUsers=data.users.filter(u=>u.role==="user").length;const totalRevenue=data.consumptions.filter(c=>c.month===monthKey).reduce((s,c)=>s+c.price*c.qty,0);renderLayout(`<h2>Dashboard Administrativo</h2><div class="grid cols-3"><article class="card metric-card"><h3>${totalUsers}</h3><div class="tag">Clientes</div></article><article class="card metric-card"><h3>${money(totalRevenue)}</h3><div class="tag">Consumo do mês</div></article><article class="card metric-card"><h3>${data.products.length}</h3><div class="tag">Produtos</div></article></div>`,`dashboard`);}else{renderLayout(`<h2>Meu Dashboard</h2><div class="grid cols-3"><article class="card metric-card"><h3>${money(spend)}</h3><div class="tag">Consumo do mês</div></article><article class="card metric-card"><h3>${money(user.monthlyLimit||0)}</h3><div class="tag">Limite mensal</div></article><article class="card metric-card"><h3>${money((user.monthlyLimit||0)-spend)}</h3><div class="tag">Saldo</div></article></div><article class="card" style="margin-top:.8rem"><button id="exportReceipt">Exportar recibo PDF</button></article>`,`dashboard`);document.getElementById("exportReceipt").onclick=()=>exportReceiptPDF(user,data);}}

function menuView(){const data=db.get();const user=data.users.find(u=>u.id===state.currentUser.id);renderLayout(`<h2>Menu</h2><section class="grid cols-3">${data.products.map(p=>`<article class="card product"><div class="product-main">${p.photo?`<img class="product-photo" src="${p.photo}" alt="${p.name}">`:`<div class="product-photo placeholder">Sem foto</div>`}<div><h4>${p.name}</h4><div class="tag">${p.category} • ${money(p.price)}</div></div></div><button data-buy="${p.id}">Adicionar</button></article>`).join("")}</section><article class="card" style="margin-top:.8rem">Total: <strong>${money(calcUserSpend(user.id,data))}</strong></article>`,`menu`);app.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>{const prod=data.products.find(p=>p.id===b.dataset.buy);data.consumptions.push({id:crypto.randomUUID(),userId:user.id,productId:prod.id,price:prod.price,qty:1,month:monthKey,date:new Date().toISOString()});db.set(data);menuView();});}

function productsView(){const data=db.get();renderLayout(`<h2>Produtos & Logo</h2><form id="logoForm" class="card grid"><div><label>Logo da Doce Maria</label><input name="logo" type="file" accept="image/*"></div><button>Salvar logo</button></form><form id="prodForm" class="card grid" style="margin-top:.8rem"><div class="form-row"><div><label>Nome</label><input name="name" required></div><div><label>Categoria</label><input name="category" required></div></div><div><label>Preço</label><input name="price" type="number" min="0" step="0.01" required></div><div><label>Foto do produto</label><input name="photo" type="file" accept="image/*"></div><button>Salvar produto</button></form><section class="grid" style="margin-top:.8rem">${data.products.map(p=>`<article class="card list-product"><div>${p.photo?`<img class="thumb" src="${p.photo}" alt="${p.name}">`:`<div class="thumb placeholder">Sem foto</div>`}</div><div>${p.name}<br><span class="tag">${p.category} • ${money(p.price)}</span></div></article>`).join("")}</section>`,`products`);
  document.getElementById("logoForm").onsubmit = async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const file = form.get("logo");
    if (!file || !file.size) return;
    data.settings.logo = await fileToDataUrl(file);
    db.set(data);
    render();
  };
  document.getElementById("prodForm").onsubmit = async e => {e.preventDefault();const f=new FormData(e.target);const file=f.get("photo");let photo="";if(file&&file.size) photo=await fileToDataUrl(file);data.products.push({id:crypto.randomUUID(),name:f.get("name"),category:f.get("category"),price:Number(f.get("price")),photo});db.set(data);productsView();};}

function usersView(){const data=db.get();renderLayout(`<h2>Usuários</h2><section class="grid">${data.users.filter(u=>u.role==='user').map(u=>`<article class="card"><strong>${u.name}</strong><br>Consumo: ${money(calcUserSpend(u.id,data))}<br><label>Limite mensal</label><input type="number" data-limit="${u.id}" value="${u.monthlyLimit||0}" min="0" step="0.01"/></article>`).join("")}</section><button id="saveLimits" style="margin-top:.8rem">Salvar limites</button>`,`users`);document.getElementById("saveLimits").onclick=()=>{app.querySelectorAll("[data-limit]").forEach(i=>{const u=data.users.find(x=>x.id===i.dataset.limit);u.monthlyLimit=Number(i.value);});db.set(data);usersView();};}

function render(){if(!state.currentUser) return loginScreen();const user=db.get().users.find(u=>u.id===state.currentUser.id);if(!user) return loginScreen();const allowed={dashboard,menu:menuView,products:productsView,users:usersView};if(user.role!=="admin"&&["products","users"].includes(state.view)) state.view="dashboard";(allowed[state.view]||dashboard)();}
render();
