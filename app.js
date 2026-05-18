const seed = {
  users: [
    { id: "admin", name: "Administrador", username: "admin", password: "admin123", role: "admin", monthlyLimit: 500 },
    { id: "u1", name: "Ana", username: "ana", password: "123", role: "user", monthlyLimit: 300 }
  ],
  products: [
    { id: crypto.randomUUID(), name: "Brigadeiro", price: 4.5, category: "Doces" },
    { id: crypto.randomUUID(), name: "Bolo de pote", price: 12, category: "Bolos" }
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
    return JSON.parse(raw);
  },
  set(data) { localStorage.setItem("doceMariaDB", JSON.stringify(data)); }
};

const state = { currentUser: JSON.parse(localStorage.getItem("doceMariaSession") || "null"), view: "dashboard" };
const app = document.getElementById("app");

const money = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthKey = new Date().toISOString().slice(0, 7);

function loginScreen(error = "") {
  app.innerHTML = `
    <div class="login-wrap">
      <section class="card login-card">
        <div class="logo logo-mark" aria-label="Doce Maria">Doce Maria</div>
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
    const data = db.get();
    const f = new FormData(e.target);
    const u = data.users.find(x => x.username === f.get("username") && x.password === f.get("password"));
    if (!u) return loginScreen("Credenciais inválidas.");
    state.currentUser = { id: u.id };
    localStorage.setItem("doceMariaSession", JSON.stringify(state.currentUser));
    render();
  };
}

function calcUserSpend(userId, data) {
  return data.consumptions.filter(c => c.userId === userId && c.month === monthKey).reduce((s,c)=>s + c.qty*c.price,0);
}

function renderLayout(content, nav = "dashboard") {
  const data = db.get();
  const user = data.users.find(u => u.id === state.currentUser.id);
  const adminItems = user.role === "admin" ? `<button data-v="products">Cadastro de produtos</button><button data-v="users">Controle de usuários</button>` : "";
  app.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <div class="brand">Doce Maria</div>
      <div>${user.name} • ${user.role}</div>
      <nav class="nav" id="nav">
        <button data-v="dashboard" class="${nav==="dashboard"?"active":""}">Dashboard</button>
        <button data-v="menu" class="${nav==="menu"?"active":""}">Menu / Consumo</button>
        ${adminItems}
      </nav>
      <button id="logout" style="margin-top:1rem;background:#7A6758;">Sair</button>
    </aside>
    <section class="content">${content}</section>
  </div>`;
  document.getElementById("logout").onclick = () => { localStorage.removeItem("doceMariaSession"); state.currentUser = null; render(); };
  document.getElementById("nav").onclick = e => { if (e.target.dataset.v) { state.view = e.target.dataset.v; render(); }};
}

function dashboard() {
  const data = db.get();
  const user = data.users.find(u => u.id === state.currentUser.id);
  const spend = calcUserSpend(user.id, data);
  if (user.role === "admin") {
    const totalUsers = data.users.filter(u=>u.role==="user").length;
    const totalRevenue = data.consumptions.filter(c=>c.month===monthKey).reduce((s,c)=>s+c.price*c.qty,0);
    renderLayout(`<h2>Dashboard Administrativo</h2>
      <div class="grid cols-3">
        <article class="card"><h3>${totalUsers}</h3><div class="tag">Clientes ativos</div></article>
        <article class="card"><h3>${money(totalRevenue)}</h3><div class="tag">Consumo total do mês</div></article>
        <article class="card"><h3>${data.products.length}</h3><div class="tag">Produtos cadastrados</div></article>
      </div>
      <article class="card" style="margin-top:1rem"><h3>Consumo por usuário (${monthKey})</h3>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Consumo</th><th>Limite mensal</th></tr></thead><tbody>
      ${data.users.filter(u=>u.role==='user').map(u=>`<tr><td>${u.name}</td><td>${money(calcUserSpend(u.id,data))}</td><td>${money(u.monthlyLimit||0)}</td></tr>`).join("")}
      </tbody></table></div></article>`, "dashboard");
  } else {
    renderLayout(`<h2>Meu Dashboard</h2><div class="grid cols-3">
      <article class="card"><h3>${money(spend)}</h3><div class="tag">Consumo no mês (${monthKey})</div></article>
      <article class="card"><h3>${money(user.monthlyLimit||0)}</h3><div class="tag">Limite mensal</div></article>
      <article class="card"><h3>${money((user.monthlyLimit||0)-spend)}</h3><div class="tag">Saldo estimado</div></article>
    </div>`, "dashboard");
  }
}

function menuView() {
  const data = db.get();
  const user = data.users.find(u => u.id === state.currentUser.id);
  renderLayout(`<h2>Menu de consumo</h2>
    <section class="grid cols-3">
      ${data.products.map(p=>`<article class="card product"><div><h4>${p.name}</h4><div class="tag">${p.category} • ${money(p.price)}</div></div><button data-buy="${p.id}">Adicionar</button></article>`).join("")}
    </section>
    <article class="card" style="margin-top:1rem">Total do mês: <strong>${money(calcUserSpend(user.id,data))}</strong></article>`, "menu");
  app.querySelectorAll("[data-buy]").forEach(b=>b.onclick = () => {
    const prod = data.products.find(p=>p.id===b.dataset.buy);
    data.consumptions.push({ id: crypto.randomUUID(), userId: user.id, productId: prod.id, price: prod.price, qty: 1, month: monthKey, date: new Date().toISOString() });
    db.set(data); menuView();
  });
}

function productsView() {
  const data = db.get();
  renderLayout(`<h2>Cadastro de produtos</h2>
    <form id="prodForm" class="card grid">
      <div class="form-row"><div><label>Nome</label><input name="name" required></div><div><label>Categoria</label><input name="category" required></div></div>
      <div><label>Preço</label><input name="price" type="number" min="0" step="0.01" required></div>
      <button>Salvar produto</button>
    </form>
    <section class="grid" style="margin-top:1rem">${data.products.map(p=>`<article class="card">${p.name} • ${p.category} • ${money(p.price)}</article>`).join("")}</section>
  `, "products");
  document.getElementById("prodForm").onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    data.products.push({ id: crypto.randomUUID(), name: f.get("name"), category: f.get("category"), price: Number(f.get("price")) });
    db.set(data); productsView();
  };
}

function usersView() {
  const data = db.get();
  renderLayout(`<h2>Controle de usuários</h2>
    <section class="grid">${data.users.filter(u=>u.role==='user').map(u=>`
      <article class="card"><strong>${u.name}</strong> (${u.username})<br>
      Consumo atual: ${money(calcUserSpend(u.id,data))}<br>
      <label>Limite mensal</label>
      <input type="number" data-limit="${u.id}" value="${u.monthlyLimit||0}" min="0" step="0.01"/>
      </article>`).join("")}</section>
    <button id="saveLimits" style="margin-top:1rem">Salvar limites mensais</button>
  `, "users");
  document.getElementById("saveLimits").onclick = () => {
    app.querySelectorAll("[data-limit]").forEach(i => {
      const u = data.users.find(x => x.id === i.dataset.limit);
      u.monthlyLimit = Number(i.value);
    });
    db.set(data);
    usersView();
  };
}

function render() {
  if (!state.currentUser) return loginScreen();
  const user = db.get().users.find(u => u.id === state.currentUser.id);
  if (!user) return loginScreen();
  const allowed = { dashboard, menu: menuView, products: productsView, users: usersView };
  if (user.role !== 'admin' && ["products","users"].includes(state.view)) state.view = "dashboard";
  (allowed[state.view] || dashboard)();
}

render();
