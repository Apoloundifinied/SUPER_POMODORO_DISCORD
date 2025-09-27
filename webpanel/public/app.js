const api = {
  loja: () => fetchJson('/api/loja'),
  compras: () => fetchJson('/api/compras'),
  refund: (index, token) => fetchJson('/api/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index, token }) }),
};

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function qs(sel) { return document.querySelector(sel); }
function qid(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const t = qid('toast');
  t.innerHTML = `<div class="px-4 py-2 rounded shadow ${type === 'error' ? 'bg-red-500 text-white' : 'bg-white text-slate-900'} transition-opacity duration-500" style="opacity:0">${msg}</div>`;
  const box = t.firstElementChild;
  t.classList.remove('hidden');
  requestAnimationFrame(() => box.style.opacity = 1);
  setTimeout(() => { box.style.opacity = 0; setTimeout(() => t.classList.add('hidden'), 500); }, 3500);
}

function makeCard(item) {
  const div = document.createElement('div');
  div.className = 'store-card';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:13px;color:var(--muted)">${item.emoji || ''}</div>
        <div style="font-weight:600">${item.nome}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">ID: ${item.id}</div>
      </div>
      <div style="text-align:right">
        <div class="price">${item.preco} pts</div>
        <button class="btn-buy" style="margin-top:10px">Comprar</button>
      </div>
    </div>
    <div class="desc">${item.descricao || ''}</div>
  `;
  div.querySelector('.btn-buy').onclick = () => openModal(item);
  return div;
}

let STORE = [];
let COMPRAS = [];

async function loadPanel() {
  try {
    const loja = await api.loja();
    STORE = loja.loja || [];
    COMPRAS = await api.compras();

    renderStore();
    renderCompras();
    renderStats();
  } catch (err) {
    console.error(err);
    toast('Erro ao carregar painel', 'error');
  }
}

function renderStore() {
  const grid = qid('loja-grid');
  grid.innerHTML = '';
  const q = qid('search').value.toLowerCase();
  const type = qid('filter-type').value;
  const items = STORE.filter(i => (type === 'all' || (i.tipo || '') === type) && (i.nome.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)));
  items.forEach(it => grid.appendChild(makeCard(it)));
}

function renderCompras() {
  const table = qid('compras-table');
  table.innerHTML = '';
  if (!COMPRAS.length) { table.textContent = 'Nenhuma compra registrada.'; return; }
  // header
  const hdr = document.createElement('div'); hdr.className='row'; hdr.innerHTML = '<div>#</div><div>Data</div><div>Usuário</div><div>Item</div><div>Preço</div><div></div>'; table.appendChild(hdr);
  COMPRAS.forEach((c, idx) => {
    const row = document.createElement('div'); row.className='row';
    const d = new Date(c.date).toLocaleString();
    row.innerHTML = `<div class="small">${c.id || idx}</div><div class="small">${d}</div><div class="small">${c.userId}</div><div>${c.itemName}</div><div>${c.price}</div><div><button class="btn-refund">Reembolsar</button></div>`;
    row.querySelector('.btn-refund').onclick = () => openRefundModal(idx, c);
    table.appendChild(row);
  });
}

function renderStats() {
  const s = qid('stats');
  s.innerHTML = '';
  const total = COMPRAS.reduce((a,b)=>a+(b.price||0),0);
  s.innerHTML = `<div>Total gasto: <strong>${total} pts</strong></div><div>Total compras: <strong>${COMPRAS.length}</strong></div>`;
}

function openModalContent(html) { qid('modal-content').innerHTML = html; qid('modal').classList.remove('hidden'); qid('modal').classList.add('flex'); }
function closeModal() { qid('modal').classList.add('hidden'); qid('modal').classList.remove('flex'); }

function openModal(item) {
  openModalContent(`<h3 class="text-lg font-semibold">${item.emoji || ''} ${item.nome}</h3><p class="mt-2 text-sm text-slate-600">${item.descricao}</p><div class="mt-3">Preço: <strong>${item.preco} pts</strong></div>`);
  qid('modal-refund').style.display = 'none';
}

function openRefundModal(idx, compra) {
  openModalContent(`<h3 class="text-lg font-semibold">Reembolsar compra</h3><p class="mt-2 text-sm text-slate-600">#${idx} — ${compra.userId} — ${compra.itemName} — ${compra.price} pts</p>`);
  qid('modal-refund').style.display = 'inline-block';
  qid('modal-refund').onclick = async () => {
    const token = qid('token').value.trim();
    if (!token) return toast('Insira o token admin', 'error');
    try {
      await api.refund(idx, token);
      toast('Reembolso efetuado');
      closeModal();
      loadPanel();
    } catch (e) { console.error(e); toast('Erro ao reembolsar', 'error'); }
  };
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
  qid('search').addEventListener('input', renderStore);
  qid('filter-type').addEventListener('change', renderStore);
  qid('modal-close').addEventListener('click', closeModal);
  qid('nav-loja').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  qid('nav-compras').addEventListener('click', () => { window.scrollTo({ top: 600, behavior: 'smooth' }); });

  // token persistence
  const tokenInput = qid('token');
  const saved = localStorage.getItem('adminToken');
  if (saved) tokenInput.value = saved;
  tokenInput.addEventListener('input', (e) => localStorage.setItem('adminToken', e.target.value));
  qid('btn-clear-token').addEventListener('click', () => { localStorage.removeItem('adminToken'); tokenInput.value = ''; toast('Token limpo'); });

  // sidebar toggle for mobile
  qid('btn-toggle-side').addEventListener('click', () => { const s = qid('sidebar'); s.classList.toggle('hidden'); });

  // cursor trail
  (function cursorTrail() {
    const root = document.body;
    const colors = ['rgba(124,58,237,0.9)', 'rgba(6,182,212,0.9)'];
    let idx = 0;
    document.addEventListener('mousemove', (e) => {
      const dot = document.createElement('div');
      dot.style.position = 'fixed';
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.pointerEvents = 'none';
      dot.style.zIndex = 9999;
      dot.style.background = colors[idx % colors.length];
      dot.style.opacity = '0.9';
      dot.style.transform = 'translate(-50%, -50%) scale(0.4)';
      dot.style.transition = 'all 600ms linear';
      root.appendChild(dot);
      requestAnimationFrame(() => { dot.style.transform = 'translate(-50%, -50%) scale(1)'; dot.style.opacity = 0; });
      setTimeout(() => dot.remove(), 600);
      idx++;
    });
  })();

  loadPanel();
});

