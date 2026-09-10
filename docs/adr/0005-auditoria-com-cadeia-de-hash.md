# ADR-0005 — Log de auditoria com cadeia de hash

## Status

Aceita.

## Contexto

O back-office de Compliance precisa de um log de auditoria confiável para ações sensíveis (troca
de senha, decisão de moderação, incidente de segurança, decisão automatizada da Nôa e sua
contestação) — e precisa poder **provar** que esse log não foi alterado depois do fato, não só
afirmar que não foi.

## Decisão

`backend/src/lib/audit.js` encadeia cada entrada ao hash da anterior: `appendAudit()` monta
`hash = sha256(JSON.stringify({ seq, ts, actor, actorRole, action, target, details, prevHash }))`,
onde `prevHash` é o `hash` da última entrada (ou `'GENESIS'` para a primeira). `verifyChain(log)`
percorre a lista recalculando cada hash e devolve `{ ok: false, brokenAt: seq }` no primeiro elo
que não bate. O back-office expõe esse resultado diretamente
(`GET /admin/compliance/overview` → `chain`).

## Consequências

- **A favor**: qualquer edição retroativa de uma entrada (mudar `details` de uma decisão já
  tomada, por exemplo) quebra a cadeia a partir daquele ponto e é detectável por
  `verifyChain()` sem precisar de um sistema externo de assinatura.
- **Contra**: isso prova **integridade** (nada mudou depois de escrito), não prova
  **autenticidade** de quem gerou cada linha — não há assinatura por chave privada nem timestamp
  de terceiro confiável; para uma auditoria com valor jurídico pleno isso precisaria evoluir (ex.:
  ancorar hashes periodicamente em um serviço externo). No estado atual, o hash encadeado só vive
  em memória e é apagado a cada reset do protótipo — não é um requisito de retenção real.
