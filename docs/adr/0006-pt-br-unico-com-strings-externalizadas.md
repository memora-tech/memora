# ADR-0006 — PT-BR único, com strings externalizadas por domínio

## Status

Aceita.

## Contexto

O Escopo Consolidado v2 define PT e EN como idiomas do MVP, mas o protótipo precisa validar
produto em português antes de investir em tradução completa (conteúdo de comunidade traduzido,
revisão de moderador em outro idioma, etc.). Ao mesmo tempo, decidir agora *não* traduzir para
inglês não deveria significar espalhar texto solto em português pelo código do jeito que seria
difícil de extrair depois.

## Decisão

Todo o texto de interface vive em dicionários por domínio
(`frontend/src/i18n/pt-BR/{common,auth,study,create,decks,community,wallet,profile,proto,parental,partner,b2b,admin}.js`),
agregados em `frontend/src/i18n/pt-BR/index.js` e consumidos via `useT()` — nenhum componente
escreve literal de UI diretamente. `SUPPORTED_LOCALES` já lista `en` com `available: false`: o
seletor de idioma existe na interface e mostra inglês como indisponível, em vez de simplesmente
não existir. O backend, por ora, **não segue** essa regra à risca — mensagens de erro e templates
ficam embutidos em português no código do servidor (rastreado como pendência de baixa severidade,
R-022 no `REVISAO.md`).

## Consequências

- **A favor**: adicionar um segundo idioma no frontend é uma questão de escrever um novo conjunto
  de arquivos `en/*.js` e apontar `DICTIONARIES.en` para eles — nenhum componente muda; o
  dicionário organizado por domínio espelha 1:1 `features/`+`areas/`, então achar a chave certa é
  previsível.
- **Contra**: qualquer string composta por concatenação de dicionário (`.split('.')`,
  `.replace()`, `.join(' e ')` — rastreado como R-034 no `REVISAO.md`) quebra ao traduzir, porque
  depende da ordem de palavras do português; strings assim precisam de chave própria, não de
  recorte de outra chave.
