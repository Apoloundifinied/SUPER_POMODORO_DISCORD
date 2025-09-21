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
const { addPontos, getPontos } = require('./utils/pontos');

const POMODORO_FILE = './pomodoros.json';
const UPDATE_INTERVAL = 30 * 1000; // Update every 30 seconds

async function loadPomodoros() {
    try {
        const data = await fs.readFile(POMODORO_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function savePomodoros(pomodoros) {
    await fs.writeFile(POMODORO_FILE, JSON.stringify(pomodoros, null, 2));
}

async function fetchQuote() {
    try {
        const response = await fetch('http://127.0.0.1:8000/frases');
        const quoteData = await response.json();
        return `"${quoteData.frase}" — Motivação`;
    } catch {
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
    const green = Math.floor(255 * percent / 100);
    const color = (red << 16) | (green << 8) | 0;

    return new EmbedBuilder()
        .setTitle('Painel Pomodoro')
        .setDescription(`**Foco:** ${data.focus}\n**Duração:** ${data.duration} minutos\n\n**Motivação:**\n${quote}`)
        .addFields(
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

const COMPLETED_FILE = './pomodoros_concluidos.json';

async function loadCompleted() {
    try {
        const data = await fs.readFile(COMPLETED_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function saveCompleted(completed) {
    await fs.writeFile(COMPLETED_FILE, JSON.stringify(completed, null, 2));
}

async function incrementPomodoro(userId) {
    const completed = await loadCompleted();
    completed[userId] = (completed[userId] || 0) + 1;

    // A cada 2 Pomodoros, adiciona 50 pontos
    if (completed[userId] >= 2) {
        addPontos(userId, 50);
        completed[userId] = 0; // reset contador
        return 50;
    }
    await saveCompleted(completed);
    return 0;
}


function startInterval(userId, message, client) {
    return setInterval(async () => {
        let pomodoros = await loadPomodoros();
        const data = pomodoros[userId];
        if (!data || data.state !== 'active') return;

        const progress = calculateProgress(data);

        // Se o Pomodoro estiver completo
        if (progress.percent >= 100) {
            const reward = await incrementPomodoro(userId); // A cada 2 Pomodoros, ganha pontos
            const quote = await fetchQuote();
            const successEmbed = new EmbedBuilder()
                .setTitle('Pomodoro Concluído')
                .setDescription(`Você completou seu Pomodoro focado em "${data.focus}"!\n\n**Motivação:** ${quote}` +
                    (reward ? `\n🎉 Parabéns! Você ganhou **${reward} pontos**.` : ''))
                .setColor(0x00FF00)
                .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            try {
                await message.edit({ embeds: [successEmbed], components: [] });
            } catch (e) {
                console.error('Error completing Pomodoro:', e);
            }
            delete pomodoros[userId];
            await savePomodoros(pomodoros);
            return;
        }

        // Atualiza o tempo decorrido
        data.elapsed = progress.elapsedMs;
        pomodoros[userId] = data;
        await savePomodoros(pomodoros);

        // Atualiza o embed com progresso e motivação
        const quote = await fetchQuote();
        const updatedEmbed = createPanelEmbed(data, progress, quote, client);
        try {
            await message.edit({ embeds: [updatedEmbed] });
        } catch (e) {
            console.error('Error updating progress:', e);
        }
    }, UPDATE_INTERVAL);
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('pomodoro')
        .setDescription('Inicia ou gerencia um Pomodoro personalizado (somente em DMs)')
        .setDMPermission(true),

    async execute(interaction) {
        if (interaction.guildId) {
            return interaction.reply({ content: 'Este comando só pode ser usado em mensagens diretas (DMs)!', flags: 64 });
        }

        const userId = interaction.user.id;
        const client = interaction.client;
        let pomodoros = await loadPomodoros();

        // Handle existing Pomodoro
        if (pomodoros[userId] && pomodoros[userId].state !== 'stopped') {
            let data = pomodoros[userId];
            const progress = calculateProgress(data);
            const quote = await fetchQuote();

            if (progress.percent >= 100) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('Pomodoro Concluído')
                    .setDescription(`Você completou seu Pomodoro focado em "${data.focus}"!\n\n**Motivação:** ${quote}`)
                    .setColor(0x00FF00)
                    .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();
                await interaction.reply({ embeds: [successEmbed], flags: 0 });
                delete pomodoros[userId];
                await savePomodoros(pomodoros);
                return;
            }

            // Pause if active to prevent time jumps
            if (data.state === 'active') {
                data.elapsed += Date.now() - data.startTime;
                data.startTime = null;
                data.state = 'paused';
                pomodoros[userId] = data;
                await savePomodoros(pomodoros);
            }

            const embed = createPanelEmbed(data, progress, quote, client);
            const row = createButtonRow(data.state);
            message = await modalSubmit.reply({ embeds: [embed], components: [row], flags: 0 });


            data.messageId = message.id;
            data.channelId = message.channel.id;
            pomodoros[userId] = data;
            await savePomodoros(pomodoros);

            let interval;
            if (data.state === 'active') {
                interval = startInterval(userId, message, client);
            }

            const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });

            collector.on('collect', async i => {
                if (i.user.id !== userId) {
                    return i.reply({ content: 'Somente você pode controlar este Pomodoro!', flags: 64 });
                }

                let data = pomodoros[userId];
                if (!data) return;

                const progress = calculateProgress(data);
                const quote = await fetchQuote();

                if (i.customId === 'startPomodoro') {
                    if (data.state === 'active') return;
                    data.state = 'active';
                    data.startTime = Date.now();
                    interval = startInterval(userId, message, client);
                } else if (i.customId === 'pausePomodoro') {
                    if (data.state === 'active') {
                        data.elapsed += Date.now() - data.startTime;
                        data.startTime = null;
                        data.state = 'paused';
                        clearInterval(interval);
                    } else if (data.state === 'paused') {
                        data.startTime = Date.now();
                        data.state = 'active';
                        interval = startInterval(userId, message, client);
                    }
                } else if (i.customId === 'stopPomodoro') {
                    if (interval) clearInterval(interval);
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

            collector.on('end', () => {
                if (interval) clearInterval(interval);
            });

            return;
        }

        // Show modal for new Pomodoro
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

        let modalSubmit;
        try {
            modalSubmit = await interaction.awaitModalSubmit({
                filter: i => i.customId === 'pomodoroModal' && i.user.id === userId,
                time: 300000 // 5 minutes
            });
        } catch (e) {
            console.error('Error awaiting modal submit:', e);
            return;
        }

        const focus = modalSubmit.fields.getTextInputValue('focusInput');
        const durationStr = modalSubmit.fields.getTextInputValue('durationInput');
        const duration = parseInt(durationStr);

        if (isNaN(duration) || duration <= 0) {
            return modalSubmit.reply({ content: 'Duração inválida! Deve ser um número positivo.', flags: 64 });
        }

        let channelId;
        try {
            channelId = modalSubmit.channel?.id || (await modalSubmit.user.createDM()).id;
            if (!channelId) throw new Error('Failed to obtain channel ID');
        } catch (e) {
            console.error('Error getting DM channel:', e);
            return modalSubmit.reply({ content: 'Não foi possível acessar o canal de DM!', flags: 64 });
        }

        const data = {
            focus,
            duration,
            elapsed: 0,
            state: 'inactive',
            startTime: null,
            channelId,
            messageId: null
        };
        pomodoros[userId] = data;
        await savePomodoros(pomodoros);

        const quote = await fetchQuote();
        const embed = createPanelEmbed(data, { percent: 0, minutesCompleted: 0, minutesRemaining: duration }, quote, client);
        const row = createButtonRow(data.state);
        let message;
        try {
            message = await modalSubmit.reply({ embeds: [embed], components: [row], flags: 0 });
        } catch (e) {
            console.error('Error sending modal reply:', e);
            return;
        }

        data.messageId = message.id;
        pomodoros[userId] = data;
        await savePomodoros(pomodoros);

        let interval;
        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'Somente você pode controlar este Pomodoro!', flags: 64 });
            }

            let data = pomodoros[userId];
            if (!data) return;

            const progress = calculateProgress(data);
            const quote = await fetchQuote();

            if (i.customId === 'startPomodoro') {
                if (data.state === 'active') return;
                data.state = 'active';
                data.startTime = Date.now();
                interval = startInterval(userId, message, client);
            } else if (i.customId === 'pausePomodoro') {
                if (data.state === 'active') {
                    data.elapsed += Date.now() - data.startTime;
                    data.startTime = null;
                    data.state = 'paused';
                    clearInterval(interval);
                } else if (data.state === 'paused') {
                    data.startTime = Date.now();
                    data.state = 'active';
                    interval = startInterval(userId, message, client);
                }
            } else if (i.customId === 'stopPomodoro') {
                if (interval) clearInterval(interval);
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

        collector.on('end', () => {
            if (interval) clearInterval(interval);
        });
    }
};
