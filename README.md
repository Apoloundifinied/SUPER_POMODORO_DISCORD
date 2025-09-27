# SUPER_POMODORO_DISCORD

![Project banner](https://user-images.githubusercontent.com/000000/placeholder-banner.gif)

> Uma solução completa para Pomodoro no Discord — bot gamificado com loja, painel web administrativo e sistema de pontos.

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/status-active-green)]

---

[1mVisão rápida[0m

- Bot Discord com comandos de pomodoro, pontuação e ranking.
- Loja integrada que consome pontos (`cogs/db/pontos.json`) para recompensas e insígnias.
- Painel web (Express) para administração, visualização de compras e reembolsos.

![UI preview animated gif](https://user-images.githubusercontent.com/000000/placeholder-ui.gif)

---

## Recursos principais

- Comandos slash para pomodoro, pontos, ranking e loja.
- Registro de compras em `cogs/db/compras.json`.
- Frontend leve (vanilla JS + CSS) em `webpanel/public`.
- Persistência simples via JSON (pronta para migrar para SQLite se desejar).

---

## Começando (Desenvolvimento)

1. Clone o repositório

```bash
git clone https://github.com/Apoloundifinied/SUPER_POMODORO_DISCORD.git
cd SUPER_POMODORO_DISCORD
```

2. Instale dependências (Node >= 18 recomendado)

```bash
npm install
```

3. Crie um arquivo `.env` na raiz com as variáveis abaixo (não comite este arquivo!)

```
DISCORD_TOKEN=seu_token_do_bot_aqui
ADMIN_PANEL_TOKEN=algum_token_secreto
PORT=3000
```

4. Rodar o bot localmente

```bash
node main.js
```

5. Rodar o painel administrativo

```bash
npm run start-panel
# abre em http://localhost:3000
```

---

## Endpoints principais do painel

- `GET /api/loja` — lista de recompensas
- `GET /api/pontos/:userId` — pontos do usuário
- `POST /api/comprar` — comprar recompensa (body JSON)
- `GET /api/compras` — lista de compras (admin)
- `POST /api/refund` — reembolsar compra (admin)

(Use header `x-admin-token: <ADMIN_PANEL_TOKEN>` para endpoints admin)

---

## Segurança (obrigatório)

1. Se você já cometeu segredos (ex.: `.env`) no Git — ROTACIONE imediatamente o token do bot no Discord Developer Portal.
2. Nunca comite variáveis de ambiente. O projeto já inclui `.gitignore` com `.env`.
3. Se um segredo foi exposto, execute `git filter-repo` ou peça ajuda para limpar o histórico (isso já foi feito nesta cópia).

---

## Migrar para SQLite (opcional)

O projeto tem um caminho claro para migrar a persistência:

- Criar adapter SQL (SQLite com SQLModel/SQLAlchemy em Python ou better-sqlite3/sequelize em Node).
- Migrar os arquivos JSON com um script de importação.
- Testar transações e concorrência.

---

## Animações & gráficos

- Para GIFs animados ou SVG animado, substitua os placeholders em `README.md` pelos links das imagens geradas (ex.: tela do painel, fluxo de compra).
- Se quiser, posso gerar imagens/SVGs estáticas do fluxo de compra ou um GIF curto do painel (preciso do painel em execução para gravar)

---

## Troubleshooting rápido

- Erro `Cannot find module 'discord.js'`: execute `npm install`.
- Erro de push (GH013 push protection): removeu `.env` da história; rotacione seu token.

---

## Contribuição

Pull requests são bem-vindos. Para grandes mudanças, abra uma issue descrevendo a proposta.

---

## Licença

ISC
