const fs = require('fs');
const path = require('path');

const PONTOS_FILE = path.join(__dirname, 'pontos.json');
const RANK_FILE = path.join(__dirname, 'rankuser.json');

function loadPontos() {
    if (!fs.existsSync(PONTOS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PONTOS_FILE));
}

function savePontos(data) {
    fs.writeFileSync(PONTOS_FILE, JSON.stringify(data, null, 2));
}

function addPontos(userId, amount) {
    const data = loadPontos();
    data[userId] = data[userId] || { pontos: 0, pomodorosConcluidos: 0 };
    data[userId].pontos += amount;
    savePontos(data);
    atualizarRankJSON(); // Atualiza ranking sempre que pontua
    return data[userId].pontos;
}

function getPontos(userId) {
    const data = loadPontos();
    return (data[userId] && data[userId].pontos) || 0;
}

function addPomodoro(userId) {
    const data = loadPontos();
    data[userId] = data[userId] || { pontos: 0, pomodorosConcluidos: 0 };
    data[userId].pomodorosConcluidos += 1;

    let pontosGanhados = 0;
    if (data[userId].pomodorosConcluidos % 2 === 0) {
        data[userId].pontos += 50;
        pontosGanhados = 50;
    }

    savePontos(data);
    atualizarRankJSON(); // Atualiza ranking sempre que conclui pomodoro
    return { totalPontos: data[userId].pontos, pontosGanhados };
}

// ✅ Função que retorna todos os usuários e pontos
function getTodosPontos() {
    const data = loadPontos();
    return Object.entries(data).map(([userId, info]) => ({
        userId,
        pontos: info.pontos
    }));
}

// ✅ Função que gera/atualiza rankuser.json com top 5
function atualizarRankJSON() {
    const todos = getTodosPontos()
        .sort((a, b) => b.pontos - a.pontos) // maior para menor
        .slice(0, 5); // top 5
    fs.writeFileSync(RANK_FILE, JSON.stringify(todos, null, 2), 'utf8');
}

module.exports = { addPontos, getPontos, addPomodoro, loadPontos, savePontos, getTodosPontos, atualizarRankJSON };
