const { SlashCommandBuilder } = require('discord.js');
const { getPontos, atualizarRankJSON } = require('./utils/pontos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pontos')
        .setDescription('Veja quantos pontos você tem!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const total = getPontos(userId);

        atualizarRankJSON();

        await interaction.reply({
            content: `🏅 Você tem **${total} pontos** acumulados.`,
            ephemeral: true
        });
    }
};
