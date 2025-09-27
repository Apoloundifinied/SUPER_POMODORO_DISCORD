Loja de Recompensas — Guia rápido

Comandos (Slash Commands):

- /loja ver — Mostra todos os itens disponíveis na loja (nome, id, preço, descrição).
- /loja comprar id:<id> — Compra um item pelo seu `id` (ou o nome). Exemplo: `/loja comprar id:pausa_extra`.
- /loja minhas — Mostra seu saldo atual e os itens que você possui.
- /loja insignias — Filtra e mostra apenas as insignias que você possui.

Observações de integração:

- O sistema usa `cogs/db/pontos.json` para armazenar pontos e itens por usuário.
- As recompensas ficam em `cogs/db/recompensas.json`.
- Ao comprar, o bot usa funções seguras em `cogs/utils/pontos.js` (`tryRemovePontos` e `addItemToUser`).

Testes manuais recomendados:

1. Use `/pontos` para ver seu saldo atual.
2. Use `/loja ver` para listar itens e anotar um `id`.
3. Use `/loja comprar id:<id>` para tentar comprar. Verifique a mensagem de sucesso e o saldo com `/pontos` de novo.
4. Use `/loja minhas` para ver que o item foi registrado.

Notas de segurança e futuras melhorias:

- Para servidores com muitos usuários, considerar migrar para um banco de dados real para evitar race conditions. Atualmente as funções fazem leituras/escritas diretas em JSON.
- Poderíamos adicionar confirmações (botões) e roles automáticas (se o bot tiver permissão) para itens do tipo `role`.
- Adicionar tempo de validade para itens temporários (ex.: nome personalizado por 24h).
