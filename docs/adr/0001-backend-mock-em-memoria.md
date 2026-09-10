# ADR-0001 — Backend mock em memória, sem banco de dados

## Status

Aceita.

## Contexto

O objetivo desta fase do Memora é um **protótipo navegável**: validar o Escopo Consolidado v2 e o
Mapa de Telas com um app do aluno completo e quatro painéis, com regras de negócio reais o
suficiente para serem testadas (FSRS, ledger, moderação, limites de plano), mas sem o custo de
montar infraestrutura de produção (banco de dados, migrations, ambiente gerenciado) antes de o
produto estar validado.

## Decisão

O backend (`backend/src/`) é uma API Express cujo estado inteiro vive em um único objeto
JavaScript em memória (`backend/src/store.js`), recriado por `seed()` (`backend/src/seed/`) na
subida do processo. Não há driver de banco de dados, ORM ou camada de repositório — as rotas leem
e escrevem `req.store.state` diretamente. `POST /_proto/reset` recria o estado do zero a qualquer
momento, o que a barra de ferramentas do protótipo usa para trocar de perfil demonstrativo.

## Consequências

- **A favor**: zero setup de infraestrutura para rodar (`npm install && npm run dev`); estado
  sempre limpo e reproduzível a partir do seed; qualquer regra de negócio pode ser prototipada e
  testada (`backend/test/api.test.js`, 34 testes) sem depender de um banco real.
- **Contra**: todo dado é perdido a cada reinício do processo — não serve para nenhum uso além de
  demonstração; não há teste de carga, concorrência real de escrita ou migração de schema; o
  código de rota mistura o que em produção seriam camadas de acesso a dados com a lógica de
  negócio, então uma futura migração para um banco real (provavelmente relacional, dado o
  domínio transacional do ledger) exigirá extrair essas fronteiras.
- Este ponto é o motivo pelo qual `docs/ARCHITECTURE.md` é explícito, na abertura, sobre este
  documento descrever o protótipo e não a arquitetura de produção.
