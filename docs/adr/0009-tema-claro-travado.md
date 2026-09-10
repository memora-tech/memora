# ADR-0009 — Tema claro travado

## Status

Aceita.

## Contexto

O Escopo Consolidado v2 é literal ao especificar um fundo branco perolado fixo, e o produto usa
cor de marca (`#00A1E0`) e contraste calibrados para um único tema. Suportar tema escuro
multiplicaria a superfície de teste de contraste (WCAG AA) sem estar no escopo desta fase.

## Decisão

A interface não tem alternância de tema: `frontend/src/styles/tokens.css` define um único
conjunto de tokens de cor, sempre claro, fundo `#FAFAF7` (branco perolado). Botões primários usam
texto escuro sobre a cor de marca para atingir contraste AA (o hover corrigido para `--brand-700`,
5,9:1, depois do achado R-010 no `REVISAO.md`).

## Consequências

- **A favor**: uma única paleta para calibrar e testar contraste; sem lógica de
  `prefers-color-scheme` nem de alternância persistida por usuário.
- **Contra**: usuários com preferência de sistema por tema escuro não têm essa preferência
  respeitada — uma reversão futura desta decisão exigiria uma segunda paleta completa mais
  reteste de contraste em cada componente do design system.
