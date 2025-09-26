const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
} = require('discord.js');
const fs = require('fs/promises');
const fetch = require('node-fetch');
const { addPontos } = require('./utils/pontos');

const POMODORO_FILE = './pomodoros.json';
const COMPLETED_FILE = './pomodoros_concluidos.json';
const UPDATE_INTERVAL = 30 * 1000; // 30 segundos
const QUOTE_API_URL = process.env.QUOTE_API_URL || 'http://127.0.0.1:8000/frases';

const intervals = new Map();
let savingPomodoros = false;
let savingCompleted = false;

// ---- Funções auxiliares ----

async function loadPomodoros() {
    try {
        const data = await fs.readFile(POMODORO_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid JSON structure');
        return parsed;
    } catch (error) {
        console.error('Error loading pomodoros:', error);
        return {};
    }
}

async function savePomodoros(pomodoros) {
    while (savingPomodoros) await new Promise(resolve => setTimeout(resolve, 100));
    savingPomodoros = true;
    try {
        await fs.writeFile(POMODORO_FILE, JSON.stringify(pomodoros, null, 2));
    } finally {
        savingPomodoros = false;
    }
}

async function loadCompleted() {
    try {
        const data = await fs.readFile(COMPLETED_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid JSON structure');
        return parsed;
    } catch (error) {
        console.error('Error loading completed pomodoros:', error);
        return {};
    }
}

async function saveCompleted(completed) {
    while (savingCompleted) await new Promise(resolve => setTimeout(resolve, 100));
    savingCompleted = true;
    try {
        await fs.writeFile(COMPLETED_FILE, JSON.stringify(completed, null, 2));
    } finally {
        savingCompleted = false;
    }
}

async function fetchQuote() {
    try {
        const response = await fetch(QUOTE_API_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const quoteData = await response.json();
        return `"${quoteData.frase}" — Motivação`;
    } catch (error) {
        console.error('Error fetching quote:', error);
        return '"Mantenha o foco!" — Sistema';
    }
}

function calculateProgress(data) {
    let elapsedMs = data.elapsed || 0;
    if (data.state === 'active' && data.startTime) {
        elapsedMs += Date.now() - data.startTime;
    }
    const totalMs = data.duration * 60 * 1000;
    const percent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
    const minutesCompleted = Math.floor(elapsedMs / 60000);
    const minutesRemaining = Math.max(0, data.duration - minutesCompleted);
    return { percent, minutesCompleted, minutesRemaining, elapsedMs };
}

function createPanelEmbed(data, progress, quote, client) {
    const { percent, minutesCompleted, minutesRemaining } = progress;
    const barLength = 20;
    const filled = Math.round((percent / 100) * barLength);
    const progressBar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    const red = Math.floor(255 * (1 - percent / 100));
    const green = Math.floor(255 * (percent / 100));
    const color = (red << 16) | (green << 8) | 0;

    const safeQuote = quote.length > 200 ? quote.slice(0, quote.lastIndexOf(' ', 200)) + "..." : quote;

    return new EmbedBuilder()
        .setTitle('Painel Pomodoro')
        .setDescription(`**Foco:** ${data.focus}\n**Duração:** ${data.duration} minutos`)
        .addFields(
            { name: 'Motivação', value: safeQuote },
            { name: 'Progresso', value: `\`\`\`${progressBar}\`\`\`` },
            { name: 'Completado', value: `${percent}% (${minutesCompleted} min)`, inline: true },
            { name: 'Restante', value: `${minutesRemaining} min`, inline: true },
            { name: 'Estado', value: data.state === 'active' ? 'Ativo' : data.state === 'paused' ? 'Pausado' : 'Inativo', inline: true }
        )
        .setColor(color)
        .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
}

function createButtonRow(state) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('startPomodoro')
            .setLabel('Iniciar')
            .setStyle(ButtonStyle.Success)
            .setDisabled(state === 'active'),
        new ButtonBuilder()
            .setCustomId('pausePomodoro')
            .setLabel(state === 'paused' ? 'Retomar' : 'Pausar')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(state === 'inactive'),
        new ButtonBuilder()
            .setCustomId('stopPomodoro')
            .setLabel('Parar')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(state === 'inactive')
    );
}

async function incrementPomodoro(userId) {
    const completed = await loadCompleted();
    completed[userId] = (completed[userId] || 0) + 1;

    let reward = 0;
    if (completed[userId] >= 2) {
        await addPontos(userId, 50);
        reward = 50;
        completed[userId] = 0;
    }
    await saveCompleted(completed);
    return reward;
}

async function updateMessage(client, data, embed, components = null) {
    try {
        const channel = await client.channels.fetch(data.channelId);
        const message = await channel.messages.fetch(data.messageId);
        await message.edit({ embeds: [embed], components: components ? [components] : [] });
    } catch (error) {
        console.error('Error updating message:', error);
    }
}

function startInterval(userId, client) {
    const intervalId = setInterval(async () => {
        let pomodoros = await loadPomodoros();
        const data = pomodoros[userId];
        if (!data || data.state !== 'active') return;

        const progress = calculateProgress(data);

        if (progress.percent >= 100) {
            const reward = await incrementPomodoro(userId);
            const quote = await fetchQuote();
            const successEmbed = new EmbedBuilder()
                .setTitle('Pomodoro Concluído')
                .setDescription(`Você completou seu Pomodoro focado em "${data.focus}"!\n\n**Motivação:** ${quote}` +
                    (reward ? `\n🎉 Parabéns! Você ganhou **${reward} pontos**.` : ''))
                .setColor(0x00FF00)
                .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            await updateMessage(client, data, successEmbed);
            stopInterval(userId);
            delete pomodoros[userId];
            await savePomodoros(pomodoros);
            return;
        }

        data.elapsed = progress.elapsedMs;
        pomodoros[userId] = data;
        await savePomodoros(pomodoros);

        const quote = await fetchQuote();
        const updatedEmbed = createPanelEmbed(data, progress, quote, client);
        await updateMessage(client, data, updatedEmbed);
    }, UPDATE_INTERVAL);
    intervals.set(userId, intervalId);
    return intervalId;
}

function stopInterval(userId) {
    if (intervals.has(userId)) {
        clearInterval(intervals.get(userId));
        intervals.delete(userId);
    }
}

// ---- Comando /pomodoro ----

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pomodoro')
        .setDescription('Inicia ou gerencia um Pomodoro personalizado (somente DMs)')
        .setDMPermission(true),

    async execute(interaction) {
        if (interaction.guildId) {
            return interaction.reply({ content: 'Este comando só pode ser usado em DMs!', ephemeral: true });
        }

        const userId = interaction.user.id;
        const client = interaction.client;
        if (!interaction.channel) {
            console.error('No channel found for interaction', { interactionId: interaction.id });
            return interaction.reply({ content: 'Erro: Canal não encontrado.', ephemeral: true });
        }

        let pomodoros = await loadPomodoros();

        // Se já existe um Pomodoro
        if (pomodoros[userId] && pomodoros[userId].state !== 'stopped') {
            let data = pomodoros[userId];
            const progress = calculateProgress(data);
            const quote = await fetchQuote();

            const embed = createPanelEmbed(data, progress, quote, client);
            const row = createButtonRow(data.state);
            const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            data.channelId = interaction.channel.id;
            data.messageId = message.id;
            pomodoros[userId] = data;
            await savePomodoros(pomodoros);

            let intervalId;
            if (data.state === 'active') intervalId = startInterval(userId, client);

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 24 * 60 * 60 * 1000 // 24 horas
            });

            collector.on('collect', async i => {
                if (!i.user || i.user.id !== userId) return i.reply({ content: 'Somente você pode controlar este Pomodoro!', ephemeral: true });
                data = pomodoros[userId];
                if (!data) return;

                const progress = calculateProgress(data);
                const quote = await fetchQuote();

                if (i.customId === 'startPomodoro') {
                    if (data.state !== 'active') {
                        data.state = 'active';
                        data.startTime = Date.now();
                        intervalId = startInterval(userId, client);
                    }
                } else if (i.customId === 'pausePomodoro') {
                    if (data.state === 'active') {
                        data.elapsed += Date.now() - data.startTime;
                        data.startTime = null;
                        data.state = 'paused';
                        stopInterval(userId);
                    } else if (data.state === 'paused') {
                        data.state = 'active';
                        data.startTime = Date.now();
                        intervalId = startInterval(userId, client);
                    }
                } else if (i.customId === 'stopPomodoro') {
                    stopInterval(userId);
                    data.state = 'stopped';
                    const stopEmbed = new EmbedBuilder()
                        .setTitle('Pomodoro Parado')
                        .setDescription(`Seu Pomodoro foi interrompido.\n\n**Motivação:** ${quote}`)
                        .setColor(0xFF0000)
                        .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();
                    await i.update({ embeds: [stopEmbed], components: [] });
                    delete pomodoros[userId];
                    await savePomodoros(pomodoros);
                    collector.stop();
                    return;
                }

                pomodoros[userId] = data;
                await savePomodoros(pomodoros);
                const updatedEmbed = createPanelEmbed(data, progress, quote, client);
                const updatedRow = createButtonRow(data.state);
                await i.update({ embeds: [updatedEmbed], components: [updatedRow] });
            });

            collector.on('end', (collected, reason) => {
                stopInterval(userId);
                if (reason === 'time' && pomodoros[userId]) {
                    delete pomodoros[userId];
                    savePomodoros(pomodoros);
                }
            });
            return;
        }

        // Cria modal para novo Pomodoro
        const modal = new ModalBuilder()
            .setCustomId('pomodoroModal')
            .setTitle('Seu Pomodoro Perfeito');

        const focusInput = new TextInputBuilder()
            .setCustomId('focusInput')
            .setLabel('Foco do Pomodoro (ex: estudar JS)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const durationInput = new TextInputBuilder()
            .setCustomId('durationInput')
            .setLabel('Duração em minutos')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(focusInput),
            new ActionRowBuilder().addComponents(durationInput)
        );

        await interaction.showModal(modal);

        try {
            const modalSubmit = await interaction.awaitModalSubmit({
                filter: i => {
                    try {
                        return i.customId === 'pomodoroModal' && i.user && i.user.id === userId;
                    } catch {
                        return false;
                    }
                },
                time: 300000
            });

            const focus = modalSubmit.fields.getTextInputValue('focusInput');
            const durationStr = modalSubmit.fields.getTextInputValue('durationInput');
            const duration = parseInt(durationStr);

            if (isNaN(duration) || duration <= 0 || duration > 120) {
                return modalSubmit.reply({ content: 'Duração inválida! Deve ser entre 1 e 120 minutos.', ephemeral: true });
            }

            // Cria objeto Pomodoro
            const data = { focus, duration, elapsed: 0, state: 'inactive', startTime: null, channelId: modalSubmit.channel.id, messageId: null };
            pomodoros[userId] = data;
            await savePomodoros(pomodoros);

            const quote = await fetchQuote();
            const embed = createPanelEmbed(data, { percent: 0, minutesCompleted: 0, minutesRemaining: duration, elapsedMs: 0 }, quote, client);
            const row = createButtonRow(data.state);

            const message = await modalSubmit.reply({ embeds: [embed], components: [row], fetchReply: true });
            data.messageId = message.id;
            pomodoros[userId] = data;
            await savePomodoros(pomodoros);

            // Botões do novo Pomodoro
            let intervalId;
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 24 * 60 * 60 * 1000 // 24 horas
            });

            collector.on('collect', async i => {
                if (!i.user || i.user.id !== userId) return i.reply({ content: 'Somente você pode controlar este Pomodoro!', ephemeral: true });
                let data = pomodoros[userId];
                if (!data) return;

                const progress = calculateProgress(data);
                const quote = await fetchQuote();

                if (i.customId === 'startPomodoro') {
                    if (data.state !== 'active') {
                        data.state = 'active';
                        data.startTime = Date.now();
                        intervalId = startInterval(userId, client);
                    }
                } else if (i.customId === 'pausePomodoro') {
                    if (data.state === 'active') {
                        data.elapsed += Date.now() - data.startTime;
                        data.startTime = null;
                        data.state = 'paused';
                        stopInterval(userId);
                    } else if (data.state === 'paused') {
                        data.state = 'active';
                        data.startTime = Date.now();
                        intervalId = startInterval(userId, client);
                    }
                } else if (i.customId === 'stopPomodoro') {
                    stopInterval(userId);
                    data.state = 'stopped';
                    const stopEmbed = new EmbedBuilder()
                        .setTitle('Pomodoro Parado')
                        .setDescription(`Seu Pomodoro foi interrompido.\n\n**Motivação:** ${quote}`)
                        .setColor(0xFF0000)
                        .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
                        .setTimestamp();
                    await i.update({ embeds: [stopEmbed], components: [] });
                    delete pomodoros[userId];
                    await savePomodoros(pomodoros);
                    collector.stop();
                    return;
                }

                pomodoros[userId] = data;
                await savePomodoros(pomodoros);
                const updatedEmbed = createPanelEmbed(data, progress, quote, client);
                const updatedRow = createButtonRow(data.state);
                await i.update({ embeds: [updatedEmbed], components: [updatedRow] });
            });

            collector.on('end', (collected, reason) => {
                stopInterval(userId);
                if (reason === 'time' && pomodoros[userId]) {
                    delete pomodoros[userId];
                    savePomodoros(pomodoros);
                }
            });

        } catch (e) {
            if (e.message.includes('time') || e.message.includes('timeout')) {
                return; // Ignora timeout do modal
            }
            console.error('Erro aguardando submit do modal:', {
                error: e.message,
                stack: e.stack,
                userId,
                interactionId: interaction.id
            });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.followUp({ content: 'Erro ao processar o Pomodoro. Tente novamente.', ephemeral: true }).catch(() => {});
            }
        }
    }
};
