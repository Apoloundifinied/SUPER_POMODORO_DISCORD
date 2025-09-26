const fs = require('fs');
const path = require('path');

const pontosPath = path.join(__dirname, 'pontos.json');

// Carrega pontos.json
function carregarPontos() {
  if (!fs.existsSync(pontosPath)) return { usuarios: {} };
  return JSON.parse(fs.readFileSync(pontosPath));
}

// Mostra a loja
function mostrarLoja(Loja) {
  console.log("🛒 Loja Pomodoro 🛒");
  Loja.forEach((item, index) => {
    console.log(`${index + 1} - ${item.nome} | ${item.preco} pontos | ${item.descricao}`);
  });
}

// Loja fixa
const data = {
  Loja: [
    { nome: "Pausa Extra", preco: 50, descricao: "Ganha 5 minutos de pausa extra." },
    { nome: "Tema Escuro", preco: 100, descricao: "Desbloqueia o tema escuro no app." }
  ]
};



function comprarItem(usuario, itemIndex) {
  const item = data.Loja[itemIndex];
  if (!item) return console.log("❌ Item não existe!");

  if (usuario.pontos >= item.preco) {
    usuario.pontos -= item.preco;

    if (!usuario.itens) usuario.itens = [];
    usuario.itens.push(item.nome);

    console.log(`✅ Você comprou: ${item.nome}`);
  } else {
    console.log("❌ Saldo insuficiente");
  }
}


// Salvar alterações
function salvarPontos(dados) {
  fs.writeFileSync(pontosPath, JSON.stringify(dados, null, 2));
}

// ----------------- TESTE -----------------
let pontos = carregarPontos();
let usuario = pontos["929506957063241738"]; // 👈 pega pelo ID

mostrarLoja(data.Loja);
comprarItem(usuario, 0); // compra o item 0 (Pausa Extra)
salvarPontos(pontos);

console.log("Novo saldo:", usuario.pontos);
console.log("Itens:", usuario.itens);
