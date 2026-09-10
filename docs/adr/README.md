# Registro de decisões de arquitetura (ADRs)

Cada arquivo aqui documenta **uma** decisão de arquitetura ou de produto que já foi tomada para o
Memora, no formato curto (Contexto → Decisão → Consequências) usado em times de engenharia para
não precisar redescutir a mesma escolha toda vez que alguém entra no projeto. Ver
[ARCHITECTURE.md](../ARCHITECTURE.md) para como as peças se encaixam.

Todas as ADRs abaixo estão com status **Aceita** — refletem decisões já implementadas no código,
reconstruídas a partir do `README.md`, do `REVISAO.md` (seções "Decisões registradas" / "Conforme")
e do próprio código-fonte. Nenhuma foi tomada nesta reconstrução; a numeração é só de organização.

| ADR | Título |
|---|---|
| [0001](./0001-backend-mock-em-memoria.md) | Backend mock em memória, sem banco de dados |
| [0002](./0002-monorepo-com-npm-workspaces.md) | Monorepo com npm workspaces |
| [0003](./0003-fsrs-simplificado.md) | Agendador de repetição espaçada FSRS simplificado |
| [0004](./0004-ledger-imutavel-de-neuronios.md) | Ledger imutável para a moeda virtual Neurônios |
| [0005](./0005-auditoria-com-cadeia-de-hash.md) | Log de auditoria com cadeia de hash |
| [0006](./0006-pt-br-unico-com-strings-externalizadas.md) | PT-BR único, com strings externalizadas por domínio |
| [0007](./0007-sem-comentarios-de-codigo.md) | Sem comentários inline no código |
| [0008](./0008-autenticacao-por-sessao-simples.md) | Autenticação por sessão simples (token opaco) |
| [0009](./0009-tema-claro-travado.md) | Tema claro travado |
| [0010](./0010-orcamento-de-toques.md) | Orçamento de toques (tap-count budget) como restrição de UX |
