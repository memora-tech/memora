# ADR-0004 — Ledger imutável para a moeda virtual Neurônios

## Status

Aceita.

## Contexto

Neurônios são a moeda virtual do Memora (ganha por acesso diário, meta batida, resultado de
objetivo, indicação, clonagem de deck por terceiros; gasta em resgate de cupom). Regras do escopo
exigem nunca deixar o saldo negativo, nunca poder comprar Neurônios (só ganhar), e dar
transparência total de onde cada unidade veio ou foi gasta — inclusive para o back-office
investigar disputas ("por que meu saldo mudou?").

## Decisão

`backend/src/lib/ledger.js` não guarda um campo de saldo mutável por usuário. Guarda uma lista
**append-only** de lançamentos — `{ id, ts, userId, amount, type, meta, balanceAfter }` — e
`balanceOf(state, userId)` sempre lê o `balanceAfter` do lançamento mais recente daquele usuário.
`appendEntry()` é o único ponto de escrita (via `credit()`/`debit()`) e lança
`insufficient_balance` se o novo saldo ficaria negativo — a regra de "nunca fica negativo" está
garantida estruturalmente, não por uma checagem espalhada em cada rota que debita.

## Consequências

- **A favor**: qualquer disputa de saldo se resolve lendo o extrato (é literalmente o que
  `GET /wallet` e `GET /admin/finance/overview` expõem); não existe caminho de código que edite um
  saldo diretamente, então não há como um bug deixar saldo e extrato dessincronizados; resgate de
  cupom e reembolso por expiração são só mais dois tipos de lançamento (`coupon_redeem`,
  `coupon_expired_refund`), sem lógica especial.
- **Contra**: calcular o saldo é O(n) sobre os lançamentos daquele usuário
  (`state.ledger.filter(...)`) — aceitável em memória com o volume de um protótipo, mas exigiria
  uma tabela de saldo materializado (ou um índice) num banco real com histórico longo.
