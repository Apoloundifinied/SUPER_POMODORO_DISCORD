const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pontosUtil = require('./utils/pontos');

const RECOMPENSAS_FILE = path.join(__dirname, 'db', 'recompensas.json');
const PONTOS_FILE = path.join(__dirname, 'db', 'pontos.json');
const COMPRAS_FILE = path.join(__dirname, 'db', 'compras.json');

function loadRecompensas() {
  if (!fs.existsSync(RECOMPENSAS_FILE)) return { loja: [] };
  return JSON.parse(fs.readFileSync(RECOMPENSAS_FILE, 'utf8'));
}

function loadPontosRaw() {
  if (!fs.existsSync(PONTOS_FILE)) return {};
  return JSON.parse(fs.readFileSync(PONTOS_FILE, 'utf8'));
}

function ensureComprasFile() {
  if (!fs.existsSync(COMPRAS_FILE)) fs.writeFileSync(COMPRAS_FILE, JSON.stringify([], null, 2), 'utf8');
}

function logCompra(entry) {
  try {
    ensureComprasFile();
    const arr = JSON.parse(fs.readFileSync(COMPRAS_FILE, 'utf8'));
    arr.push(entry);
    fs.writeFileSync(COMPRAS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao registrar compra:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Interaja com a loja de recompensas')
    .addSubcommand(sub => sub
      .setName('ver')
      .setDescription('Mostra todos os itens disponíveis'))
    .addSubcommand(sub => sub
      .setName('comprar')
      .setDescription('Compra um item da loja pelo id')
      .addStringOption(opt => opt.setName('id').setDescription('ID do item').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('minhas')
      .setDescription('Mostra seus itens e saldo'))
    .addSubcommand(sub => sub
      .setName('insignias')
      .setDescription('Mostra suas insígnias')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const recompensas = loadRecompensas().loja;
    const pontosData = loadPontosRaw();
    pontosData[userId] = pontosData[userId] || { pontos: 0, pomodorosConcluidos: 0, itens: [] };

    // /loja ver -> embed + select menu (interactive)
    if (sub === 'ver') {
      const embed = new EmbedBuilder()
        .setTitle('🛒 Loja Pomodoro')
        .setDescription('Selecione um item na lista abaixo para ver detalhes e comprar.')
        .setColor(0x6A5ACD)
        .setFooter({ text: 'Use o menu para selecionar um item' });

      const options = recompensas.map(it => ({ label: `${it.nome} — ${it.preco} pts`, value: it.id, description: it.descricao.slice(0, 100), emoji: it.emoji || undefined }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`loja_select_${userId}`)
        .setPlaceholder('Escolha um item...')
        .addOptions(options.slice(0, 25));

      const row = new ActionRowBuilder().addComponents(select);

      const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

      const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120000 });

      collector.on('collect', async i => {
        if (!i.user || i.user.id !== userId) {
          await i.reply({ content: 'Apenas quem abriu a loja pode selecionar itens.', ephemeral: true });
          return;
        }

        const itemId = i.values[0];
        const item = recompensas.find(r => r.id === itemId);
        if (!item) {
          await i.reply({ content: 'Item não encontrado.', ephemeral: true });
          return;
        }

        const detail = new EmbedBuilder()
          .setTitle(`${item.emoji || ''} ${item.nome}`)
          .setDescription(item.descricao)
          .addFields(
            { name: 'Preço', value: `${item.preco} pontos`, inline: true },
            { name: 'ID', value: item.id, inline: true },
            { name: 'Tipo', value: item.tipo || '—', inline: true }
          )
          .setColor(0x00AAFF);

        const buyRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`loja_confirm_${userId}_${item.id}`).setLabel('Comprar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`loja_cancel_${userId}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        await i.update({ embeds: [detail], components: [buyRow], ephemeral: true });

        // coletor de botões
        const buttonCollector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
        buttonCollector.on('collect', async b => {
          if (!b.user || b.user.id !== userId) {
            await b.reply({ content: 'Apenas quem abriu a loja pode usar estes botões.', ephemeral: true });
            return;
          }

          if (b.customId === `loja_cancel_${userId}`) {
            await b.update({ content: 'Compra cancelada.', embeds: [], components: [] });
            buttonCollector.stop();
            collector.stop();
            return;
          }

          // confirmar compra
          if (b.customId === `loja_confirm_${userId}_${item.id}`) {
            // debitar
            const ok = pontosUtil.tryRemovePontos(userId, item.preco);
            if (!ok) {
              await b.update({ content: `❌ Saldo insuficiente. Você tem ${pontosUtil.getPontos(userId)} pontos.`, embeds: [], components: [] });
              buttonCollector.stop();
              collector.stop();
              return;
            }

            // adicionar item
            pontosUtil.addItemToUser(userId, item.nome);

            // tentar atribuir role se aplicavel
            let roleMsg = '';
            if (item.tipo === 'role' && b.guild) {
              try {
                const guild = b.guild;
                const member = await guild.members.fetch(userId).catch(() => null);
                const role = guild.roles.cache.find(r => r.name.toLowerCase() === item.nome.toLowerCase() || r.id === item.roleId);
                if (member && role) {
                  // check bot permissions
                  const botMember = await guild.members.fetch(b.client.user.id);
                  if (botMember.permissions.has('ManageRoles') && botMember.roles.highest.position > role.position) {
                    await member.roles.add(role).catch(e => { console.error('Erro ao adicionar role:', e); });
                    roleMsg = `\n🔰 Role **${role.name}** adicionada.`;
                  } else {
                    roleMsg = `\n⚠️ Não foi possível adicionar a role automaticamente (permissões). Peça a um admin.`;
                  }
                } else {
                  roleMsg = `\n⚠️ Role não encontrada no servidor. Administrador pode mapear o item ao role.`;
                }
              } catch (err) {
                console.error('Erro ao tentar atribuir role:', err);
              }
            }

            // log
            logCompra({ userId, itemId: item.id, itemName: item.nome, price: item.preco, date: new Date().toISOString(), guildId: b.guildId || null });

            await b.update({ content: `✅ Compra efetuada: **${item.nome}** por **${item.preco} pontos**.${roleMsg}\nSaldo atual: **${pontosUtil.getPontos(userId)} pontos**.`, embeds: [], components: [] });

            buttonCollector.stop();
            collector.stop();
            return;
          }
        });
      });

      collector.on('end', () => {
        try { reply.edit({ components: [] }).catch(() => {}); } catch(e) {}
      });

      return;
    }

    // /loja minhas -> embed com itens e saldo
    if (sub === 'minhas') {
      const user = pontosData[userId];
      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username} — Inventário`)
        .setColor(0x6A5ACD)
        .addFields(
          { name: 'Saldo', value: `${user.pontos || 0} pontos`, inline: true },
          { name: 'Itens', value: (user.itens && user.itens.length) ? user.itens.join('\n') : 'Nenhum item', inline: false }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // /loja insignias -> filtra insignias
    if (sub === 'insignias') {
      const user = pontosData[userId];
      const insignias = (user.itens || []).filter(i => i.toLowerCase().includes('insígnia') || i.toLowerCase().includes('insignia') || i.toLowerCase().includes('insignia'));
      const embed = new EmbedBuilder()
        .setTitle('🏅 Suas Insígnias')
        .setDescription(insignias.length ? insignias.join('\n') : 'Você não possui insignias ainda.')
        .setColor(0xFFD700);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // /loja comprar id:<id> via subcomando (sem UI)
    if (sub === 'comprar') {
      const id = interaction.options.getString('id');
      const item = recompensas.find(r => r.id === id || r.nome.toLowerCase() === id.toLowerCase());
      if (!item) {
        await interaction.reply({ content: '❌ Item não encontrado. Use `/loja ver` para ver os ids.', ephemeral: true });
        return;
      }

      if ((pontosData[userId].pontos || 0) < item.preco) {
        await interaction.reply({ content: `❌ Saldo insuficiente. Você tem ${pontosData[userId].pontos || 0} pontos.`, ephemeral: true });
        return;
      }

      const ok = pontosUtil.tryRemovePontos(userId, item.preco);
      if (!ok) {
        await interaction.reply({ content: `❌ Falha ao debitar pontos.`, ephemeral: true });
        return;
      }

      pontosUtil.addItemToUser(userId, item.nome);
      logCompra({ userId, itemId: item.id, itemName: item.nome, price: item.preco, date: new Date().toISOString(), guildId: interaction.guildId || null });

      // tentativa de role (se aplicável)
      let roleMsg = '';
      if (item.tipo === 'role' && interaction.guild) {
        try {
          const guild = interaction.guild;
          const member = await guild.members.fetch(userId).catch(() => null);
          const role = guild.roles.cache.find(r => r.name.toLowerCase() === item.nome.toLowerCase() || r.id === item.roleId);
          if (member && role) {
            const botMember = await guild.members.fetch(interaction.client.user.id);
            if (botMember.permissions.has('ManageRoles') && botMember.roles.highest.position > role.position) {
              await member.roles.add(role).catch(e => { console.error('Erro ao adicionar role:', e); });
              roleMsg = `\n🔰 Role **${role.name}** adicionada.`;
            } else {
              roleMsg = `\n⚠️ Não foi possível adicionar a role automaticamente (permissões).`;
            }
          } else {
            roleMsg = `\n⚠️ Role não encontrada no servidor.`;
          }
        } catch (err) { console.error(err); }
      }

      await interaction.reply({ content: `✅ Compra efetuada: **${item.nome}** por **${item.preco} pontos**.${roleMsg}\nSaldo atual: **${pontosUtil.getPontos(userId)} pontos**.`, ephemeral: true });
      return;
    }
  }
};
