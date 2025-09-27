const fs = require('fs');
const path = require('path');

const RECOMPENSAS_PATH = path.join(__dirname, '..', 'db', 'recompensas.json');
const PONTOS_PATH = path.join(__dirname, '..', 'db', 'pontos.json');

function carregarRecompensas() {
  if (!fs.existsSync(RECOMPENSAS_PATH)) return { loja: [] };
  return JSON.parse(fs.readFileSync(RECOMPENSAS_PATH, 'utf8'));
}

function carregarPontos() {
  if (!fs.existsSync(PONTOS_PATH)) return {};
  return JSON.parse(fs.readFileSync(PONTOS_PATH, 'utf8'));
}

function salvarPontos(dados) {
  fs.writeFileSync(PONTOS_PATH, JSON.stringify(dados, null, 2), 'utf8');
}

function listarLoja() {
  const dados = carregarRecompensas();
  return dados.loja || [];
}

function comprar(userId, itemId) {
  const loja = listarLoja();
  const item = loja.find(i => i.id === itemId || i.nome.toLowerCase() === itemId.toLowerCase());
  if (!item) return { ok: false, reason: 'not_found' };

  const pontos = carregarPontos();
  pontos[userId] = pontos[userId] || { pontos: 0, pomodorosConcluidos: 0, itens: [] };
  if ((pontos[userId].pontos || 0) < item.preco) return { ok: false, reason: 'insufficient' };

  pontos[userId].pontos -= item.preco;
  pontos[userId].itens = pontos[userId].itens || [];
  pontos[userId].itens.push(item.nome);
  salvarPontos(pontos);

  return { ok: true, item };
}

module.exports = { listarLoja, comprar, carregarPontos, salvarPontos, carregarRecompensas };
