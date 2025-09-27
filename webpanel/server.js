const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PANEL_PORT || 3001;

const DB_DIR = path.join(__dirname, '..', 'cogs', 'db');
const RECOMP_FILE = path.join(DB_DIR, 'recompensas.json');
const COMPRAS_FILE = path.join(DB_DIR, 'compras.json');
const PONTOS_FILE = path.join(DB_DIR, 'pontos.json');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function safeRead(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { return fallback; }
}

app.get('/api/loja', (req, res) => {
  res.json(safeRead(RECOMP_FILE, { loja: [] }));
});

app.get('/api/compras', (req, res) => {
  res.json(safeRead(COMPRAS_FILE, []));
});

app.get('/api/pontos', (req, res) => {
  res.json(safeRead(PONTOS_FILE, {}));
});

// refund endpoint -- protegido por token ADMIN_PANEL_TOKEN
app.post('/api/refund', (req, res) => {
  const token = req.headers['x-admin-token'] || req.body.token;
  if (!token || token !== process.env.ADMIN_PANEL_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const { index } = req.body;
  const compras = safeRead(COMPRAS_FILE, []);
  if (typeof index !== 'number' || index < 0 || index >= compras.length) return res.status(400).json({ error: 'Invalid index' });

  const compra = compras[index];
  // reembolsar pontos
  const pontos = safeRead(PONTOS_FILE, {});
  pontos[compra.userId] = pontos[compra.userId] || { pontos: 0, pomodorosConcluidos: 0, itens: [] };
  pontos[compra.userId].pontos += compra.price;
  // remover item
  if (pontos[compra.userId].itens) pontos[compra.userId].itens = pontos[compra.userId].itens.filter(it => it !== compra.itemName);

  fs.writeFileSync(PONTOS_FILE, JSON.stringify(pontos, null, 2));
  compras.splice(index, 1);
  fs.writeFileSync(COMPRAS_FILE, JSON.stringify(compras, null, 2));

  return res.json({ ok: true, refunded: compra });
});

app.listen(PORT, () => console.log(`Web painel rodando em http://localhost:${PORT}`));
