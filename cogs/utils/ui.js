const { EmbedBuilder } = require('discord.js');

function embedSuccess(title, description) {
  return new EmbedBuilder()
    .setTitle(title || 'Sucesso')
    .setDescription(description || '')
    .setColor(0x22BB66);
}

function embedError(title, description) {
  return new EmbedBuilder()
    .setTitle(title || 'Erro')
    .setDescription(description || '')
    .setColor(0xDD3333);
}

function embedInfo(title, description) {
  return new EmbedBuilder()
    .setTitle(title || 'Info')
    .setDescription(description || '')
    .setColor(0x6A5ACD);
}

function itemEmbed(item) {
  return new EmbedBuilder()
    .setTitle(`${item.emoji || ''} ${item.nome}`)
    .setDescription(item.descricao || '')
    .addFields(
      { name: 'Preço', value: `${item.preco} pontos`, inline: true },
      { name: 'ID', value: item.id, inline: true },
      { name: 'Tipo', value: item.tipo || '—', inline: true }
    )
    .setColor(0x00AAFF);
}

module.exports = { embedSuccess, embedError, embedInfo, itemEmbed };
