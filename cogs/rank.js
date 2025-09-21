const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const RANK_FILE = path.join(__dirname, 'utils', 'rankuser.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Mostra o ranking dos top 5 usuários (somente DM)')
        .setDMPermission(true), // Permite apenas DM

    async execute(interaction) {
        // Bloqueia uso em guilds
        if (interaction.guildId) {
            return interaction.reply({
                content: 'Este comando só pode ser usado em mensagens diretas (DMs)!',
                ephemeral: true
            });
        }

        // Lê o ranking do JSON
        if (!fs.existsSync(RANK_FILE)) {
            return interaction.reply({
                content: 'Nenhum ranking disponível no momento.',
                ephemeral: true
            });
        }

        const ranking = JSON.parse(fs.readFileSync(RANK_FILE, 'utf8'));

        if (ranking.length === 0) {
            return interaction.reply({
                content: 'Nenhum usuário pontuou ainda.',
                ephemeral: true
            });
        }

        // Monta a mensagem do top 5
        const rankingMsg = ranking.map((user, index) => {
            return `#${index + 1} <@${user.userId}> - ${user.pontos} pontos`;
        }).join('\n');

        await interaction.reply({
            content: `🏆 **Top 5 Usuários** 🏆\n\n${rankingMsg}`,
            ephemeral: true
        });
    }
};
