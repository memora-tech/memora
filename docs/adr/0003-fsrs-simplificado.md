# ADR-0003 — Agendador de repetição espaçada FSRS simplificado

## Status

Aceita.

## Contexto

O Escopo Consolidado v2 exige repetição espaçada real (não um intervalo fixo tipo "revise em 3
dias") para a fila diária de estudo, incluindo lapsos, dificuldade percebida e retenção alvo. FSRS
(Free Spaced Repetition Scheduler) é o algoritmo público de referência para isso, mas sua
implementação completa (otimização de parâmetros por usuário via aprendizado de máquina sobre o
histórico de revisões) é um investimento maior do que o protótipo precisa para validar a
experiência do aluno.

## Decisão

`backend/src/lib/fsrs.js` implementa uma versão simplificada do FSRS: os 21 parâmetros do modelo
ficam fixos (`DEFAULT_PARAMS`, não otimizados por usuário), a retenção alvo é fixa em 90%
(`TARGET_RETENTION`), e `schedule(current, rating, reviewedAt)` recalcula
`stability`/`difficulty`/`due`/`reps`/`lapses`/`consecutiveLapses` a cada revisão com fórmulas
determinísticas por nota (`again|hard|good|easy`). `isDue()` decide se um card entra na fila do
dia comparando `due` com o agora.

## Consequências

- **A favor**: o comportamento é determinístico e fácil de testar (`backend/test/api.test.js`
  cobre cenários de streak, revisão e lapso); a fila de estudo do dia reage de forma plausível a
  acertos e erros sem precisar de infraestrutura de treinamento de modelo.
- **Contra**: os parâmetros fixos não se ajustam ao padrão de esquecimento de cada aluno — dois
  alunos com desempenho muito diferente recebem a mesma curva de intervalo. Se o produto for para
  produção, otimizar `DEFAULT_PARAMS` por usuário (como o FSRS completo faz) é um trabalho futuro
  explícito, não um bug do protótipo.
