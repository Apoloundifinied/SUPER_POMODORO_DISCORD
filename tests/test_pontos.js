const pontos = require('../cogs/utils/pontos');

// Testa addPontos e tryRemovePontos
(function(){
  const uid = 'test-user-1';
  pontos.savePontos({});
  pontos.addPontos(uid, 200);
  if (pontos.getPontos(uid) !== 200) throw new Error('addPontos falhou');
  const ok = pontos.tryRemovePontos(uid, 150);
  if (!ok) throw new Error('tryRemovePontos deveria ter retornado true');
  if (pontos.getPontos(uid) !== 50) throw new Error('Saldo incorreto após remover');
  const fail = pontos.tryRemovePontos(uid, 1000);
  if (fail) throw new Error('Remoção com saldo insuficiente deveria falhar');
  console.log('pontos tests passed');
})();
