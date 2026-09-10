# ADR-0007 — Sem comentários inline no código

## Status

Aceita.

## Contexto

Times diferentes têm convenções diferentes sobre comentário inline: uma corrente prefere código
autoexplicativo (nomes claros, funções pequenas) mais documentação de arquitetura separada; outra
prefere comentar o "porquê" no próprio ponto do código. Para este protótipo, a decisão do chat de
09/09/2026 fechou por não ter comentários em `frontend/src` nem `backend/src`, e essa regra foi
verificada explicitamente pelas três rodadas de revisão em `REVISAO.md`.

## Decisão

Nenhum arquivo em `frontend/src/` ou `backend/src/` tem comentário de código. Onde uma decisão
não óbvia precisaria de explicação, ela vai para fora do código: este diretório `docs/adr/`, o
`docs/ARCHITECTURE.md`, ou o `REVISAO.md`.

## Consequências

- **A favor**: código mais compacto e sem risco do comentário ficar desatualizado em relação ao
  código (um dos jeitos mais comuns de comentário virar ativamente enganoso); força nomes de
  função/variável a carregar o significado sozinhos.
- **Contra**: decisões de negócio não óbvias embutidas em uma linha de rota (por exemplo, por que
  `s.lastStudyAt` exige 20 h de intervalo em vez de comparar só a data em
  `backend/src/routes/study.js`) não têm explicação ao lado do código — só neste conjunto de
  documentos. **Isso significa que manter `docs/` atualizado junto com o código não é opcional**:
  sem comentário inline, este é o único lugar onde o "porquê" sobrevive.
- Qualquer mudança futura que reintroduza comentários precisa revisar esta ADR primeiro — é uma
  reversão de decisão, não um ajuste de estilo pontual.
