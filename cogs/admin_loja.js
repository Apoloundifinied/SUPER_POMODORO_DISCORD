const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pontosUtil = require('./utils/pontos');

const COMPRAS_FILE = path.join(__dirname, 'db', 'compras.json');
const PONTOS_FILE = path.join(__dirname, 'db', 'pontos.json');

function loadCompras() {
  if (!fs.existsSync(COMPRAS_FILE)) return [];
  return JSON.parse(fs.readFileSync(COMPRAS_FILE, 'utf8'));
}

function saveCompras(arr) {
  fs.writeFileSync(COMPRAS_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminloja')
    .setDescription('Comandos administrativos da loja')
    .addSubcommand(s => s.setName('logs').setDescription('Mostra últimas compras'))
    .addSubcommand(s => s.setName('refund').setDescription('Reembolsa uma compra por índice').addIntegerOption(o => o.setName('index').setDescription('Índice da compra (via logs)').setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageGuild')) {
      await interaction.reply({ content: 'Você precisa de permissão Manage Guild para usar este comando.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'logs') {
      const compras = loadCompras().slice(-20).reverse();
      const lines = compras.map((c, i) => `#${compras.length - i - 1} — ${c.date} — ${c.userId} — ${c.itemName} — ${c.price} pts`);
      await interaction.reply({ content: lines.join('\n') || 'Nenhuma compra', ephemeral: true });
      return;
    }

    if (sub === 'refund') {
      const idx = interaction.options.getInteger('index');
      const compras = loadCompras();
      if (idx < 0 || idx >= compras.length) {
        await interaction.reply({ content: 'Índice inválido.', ephemeral: true });
        return;
      }

      const compra = compras[idx];
      // reembolsar
      pontosUtil.addPontos(compra.userId, compra.price);

      // remover item do usuário
      const pontos = pontosUtil.loadPontos();
      if (pontos[compra.userId] && pontos[compra.userId].itens) {
        pontos[compra.userId].itens = pontos[compra.userId].itens.filter(it => it !== compra.itemName);
        pontosUtil.savePontos(pontos);
      }

      // remover do log
      compras.splice(idx, 1);
      saveCompras(compras);

      await interaction.reply({ content: `Reembolso efetuado para ${compra.userId} — ${compra.itemName} (+${compra.price} pontos)`, ephemeral: true });
      return;
    }
  }
};
