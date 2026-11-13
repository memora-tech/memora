# ADR-0013 — Autenticação via Supabase Auth (JWT) exclusiva para maiores de 18 anos

## Status

Aceita (substitui a [ADR-0008](./0008-autenticacao-por-sessao-simples.md)).

## Contexto

A ADR-0008 aceitava qualquer credencial em `POST /auth/login`, emitia tokens opacos em memória
(`tok_...`), usava código fixo `123456` para confirmação e continha fluxos de verificação parental
para menores de idade. Para o MVP real voltado exclusivamente a testadores adultos (≥ 18 anos), é
necessário autenticação real com hash de senha, sessão persistente baseada em JWT e bloqueio de
cadastro de menores ou não convidados no servidor.

## Decisão

1. A autenticação passa a ser feita pelo **Supabase Auth** (e-mail e senha), com o **signup público
   desligado** no painel do Supabase. Todos os atalhos de demonstração, tokens em memória e o código
   fixo `123456` são removidos.
2. O cadastro acontece exclusivamente via `POST /v1/auth/register` no servidor (usando `service_role`
   com `auth.admin.createUser`), exigindo código de convite (`INVITE_CODE`) e validando **idade ≥ 18
   anos no servidor** e em constraint `CHECK` em `public.profiles`.
3. O frontend obtém o JWT (`access_token`) no Supabase Auth e o envia no header
   `Authorization: Bearer <jwt>` em todas as chamadas à API Express (`/v1/*`).
4. O middleware `requireRole` / `requireStudent` na API Express valida o JWT junto ao Supabase Auth,
   cria um cliente de banco escopado com esse JWT (`req.db`) e carrega o perfil do aluno em
   `public.profiles`.

## Consequências

- **A favor**: senhas gerenciadas com segurança pelo Supabase Auth (bcrypt/Argon2, recuperação de
  senha e renovação de token); bloqueio total de cadastros não autorizados ou de menores de 18 anos
  antes mesmo de tocar no `auth.users`; compatibilidade nativa com `auth.uid()` nas políticas de RLS.
- **Contra**: testes automatizados da API precisam usar mocks da camada de auth/dados ou um projeto
  Supabase de teste.

