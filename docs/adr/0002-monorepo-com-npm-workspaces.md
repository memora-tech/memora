# ADR-0002 — Monorepo com npm workspaces

## Status

Aceita.

## Contexto

O protótipo precisa de dois processos que evoluem juntos e compartilham contrato de API a cada
mudança de rota: um frontend (Vite + React) e um backend mock (Express). Times pequenos
trabalhando num único protótipo se beneficiam de um único `npm install`, um único lockfile e
comandos que orquestram os dois processos ao mesmo tempo.

## Decisão

Um único repositório com `package.json` raiz declarando
`"workspaces": ["frontend", "backend"]` (npm workspaces, sem Lerna/Nx/Turborepo). O script
`npm run dev` na raiz usa `concurrently` para subir `npm run dev -w backend` e
`npm run dev -w frontend` num único terminal, com saída colorida e prefixada
(`-n api,web -c blue,cyan`). `npm test` roda os testes de cada workspace em sequência
(`npm run test -w backend && npm run test -w frontend`).

## Consequências

- **A favor**: um único `npm install` resolve as duas árvores de dependências; `npm run dev`
  sobe o app inteiro (API + frontend) com um comando; adicionar um terceiro workspace (ex.: um
  pacote de tipos compartilhados) é imediato.
- **Contra**: sem uma ferramenta de monorepo dedicada (Nx/Turborepo), não há cache de build
  incremental nem grafo de dependências entre workspaces — para dois pacotes isso ainda compensa,
  mas deixaria de compensar se o número de pacotes crescesse.
- Consequência operacional direta: como o processo do Vite (frontend) e o do Node
  `--watch` (backend) rodam dentro da própria pasta do projeto, eles mantêm handles abertos nela
  — mover, renomear ou excluir a pasta do projeto no Windows falha enquanto `npm run dev` (ou
  qualquer processo filho seu) estiver rodando.
