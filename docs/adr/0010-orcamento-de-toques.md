# ADR-0010 — Orçamento de toques (tap-count budget) como restrição de UX

## Status

Aceita.

## Contexto

O "Mapa de Telas e Contagem de Toques" (09/09/2026) define, para cada ação frequente do app do
aluno, um número máximo de toques até o efeito acontecer — por exemplo, começar a sessão do dia em
1 toque, ou resgatar um cupom em 4 (🧠 → cupom → Resgatar → Confirmar). Esse mapa não é só uma
meta de produto solta: ele é tratado como um requisito verificável, e o `REVISAO.md` rastreia
desvios dele como achados de severidade Média (ex.: R-031, R-040, R-043, R-046).

## Decisão

Toda vez que um fluxo é implementado, seu número de toques até o efeito é contado explicitamente
contra o Mapa, e o fluxo é redesenhado se ultrapassar o orçamento — mesmo que a alternativa pareça,
isoladamente, mais "completa". Exemplos aplicados: pausar a meta aplica o preset de dias na hora
(toast com Desfazer, 2 toques) em vez de exigir um passo extra de "Pausar"; colar texto com
clipboard detectado envia direto (3 toques) em vez de abrir uma folha que ainda pede "Gerar
cards"; "Exportar" no menu do deck gera o arquivo direto (4 toques) em vez de abrir uma folha
intermediária; denunciar um deck envia ao escolher o motivo (3 toques), com o detalhe opcional
virando um passo posterior em vez de bloquear o envio.

## Consequências

- **A favor**: fluxos de alta frequência (começar a estudar, resgatar cupom, denunciar) ficam
  deliberadamente curtos; o orçamento dá um critério objetivo para julgar se uma tela nova "está
  boa" além de gosto pessoal.
- **Contra**: o orçamento por vezes empurra passos de configuração fina (ex.: ajustar dias exatos
  de uma pausa) para depois do efeito principal em vez de antes — o padrão do produto é "aplique o
  padrão razoável na hora, deixe o ajuste fino como opção secundária", o que é uma escolha
  deliberada de priorizar o caminho feliz sobre a configuração explícita.
- Qualquer novo fluxo do app do aluno deve ser checado contra o Mapa de Telas **antes** de
  implementar, não depois — é mais barato desenhar dentro do orçamento do que refatorar para
  caber nele.
