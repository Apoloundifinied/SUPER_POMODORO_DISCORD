const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');
const { addPontos } = require('./cogs/utils/pontos');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

client.commands = new Collection();

// ===== CARREGAR COMANDOS =====
const commandsPath = join(__dirname, 'cogs');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js') && file !== 'utils');

for (const file of commandFiles) {
    try {
        const command = require(join(commandsPath, file));
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.warn(`Skipping ${file}: missing data or execute`);
        }
    } catch (err) {
        console.error(`Error loading ${file}:`, err);
    }
}

// ===== REGISTRAR TODOS OS COMANDOS =====
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registrando todos os comandos globalmente...');
        const allCommands = client.commands.map(cmd => cmd.data.toJSON());
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: allCommands }
        );
        console.log('Todos os comandos registrados!');
    } catch (error) {
        console.error('Erro ao registrar comandos globalmente:', error);
    }
})();

client.once('clientReady', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

// ===== INTERAÇÕES DE SLASH COMMANDS =====
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        const isGuild = !!interaction.guildId;

        // Somente defer comandos de guild que não são pontos/pomodoro/rank
        if (isGuild && !['pomodoro', 'pontos', 'rank'].includes(command.data.name) && !interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ flags: 64 });
        }

        await command.execute(interaction);

        // Pontos automáticos apenas para comandos de guild normais
        if (isGuild && !['pomodoro', 'pontos', 'rank'].includes(command.data.name)) {
            const total = addPontos(interaction.user.id, 50);
            await interaction.followUp({
                content: `🎉 Você ganhou **50 pontos**! Total: **${total} pontos**.`,
                flags: 64 // Ephemeral using flags
            });
        }

    } catch (err) {
        console.error('Erro ao executar comando:', {
            error: err.message,
            stack: err.stack,
            command: interaction.commandName,
            interactionId: interaction.id
        });

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Ocorreu um erro ao executar esse comando!', flags: 64 }).catch(() => {});
        } else if (interaction.deferred) {
            await interaction.editReply({ content: 'Ocorreu um erro ao executar esse comando!' }).catch(() => {});
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
