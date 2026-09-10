# ADR-0008 — Autenticação por sessão simples (token opaco)

## Status

Aceita.

## Contexto

O protótipo precisa demonstrar cinco fluxos de login diferentes (aluno, responsável, escola B2B,
back-office, parceiro), cada um com seus próprios papéis, sem o custo de implementar OAuth/OIDC
real, rotação de chave ou um provedor de identidade externo — o objetivo é validar produto, não
segurança de produção.

## Decisão

Cada área tem sua própria rota `POST .../auth/login`, que aceita qualquer credencial preenchida
(sem verificar senha de fato) e devolve um token opaco (`tok_<random>`,
`backend/src/lib/auth.js` → `createSession()`). O token é guardado em memória
(`state.sessions`), sem JWT, sem assinatura, sem refresh token — `findSession()` só confere se o
token existe e não passou de 30 dias sem uso (expiração deslizante). `requireRole(...roles)` é o
único middleware de autorização: resolve a sessão a partir do header
`Authorization: Bearer <token>` e checa se `session.role` está na lista permitida.

## Consequências

- **A favor**: qualquer um dos cinco fluxos de login funciona sem senha real, o que é exatamente o
  que uma demonstração navegável precisa; adicionar um novo papel é só estender a lista de roles
  aceitas por `requireRole(...)`.
- **Contra**: nada aqui é seguro para produção — não há hash de senha, não há proteção contra
  força bruta além do limite de cadastro por IP, e o token não pode ser revogado em lote nem
  assinado para verificação offline. Uma futura API real precisa substituir isto por um esquema de
  autenticação de verdade (OAuth2/OIDC, JWT assinado ou sessão com store persistente), o que é uma
  reescrita da camada de auth, não uma extensão dela.
