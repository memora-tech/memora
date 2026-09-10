# Memora · mock navegável v1

Protótipo funcional do Memora construído a partir do **Escopo Consolidado v2** e do **Mapa de Telas e Contagem de Toques** (09/09/2026). Cobre o app do aluno completo, a entrada na conta e os quatro painéis web, com uma API mock em Node que reproduz as regras de negócio.

## Como rodar

Requisitos: Node 24 e npm 11 (funciona a partir do Node 20.19).

```bash
npm install
npm run dev
```

- App do aluno: http://localhost:5180/app (ou http://localhost:5180, que redireciona para entrar)
- API mock: http://localhost:3180/v1/health
- Painel Parental: http://localhost:5180/parental
- Painel B2B: http://localhost:5180/b2b
- Back-office: http://localhost:5180/admin
- Painel do Parceiro: http://localhost:5180/parceiro

As portas 5180 e 3180 foram escolhidas para não colidir com os outros projetos que costumam rodar em 5173 a 5175 e 3001. Se 5180 estiver ocupada, o Vite avisa no terminal qual porta usou.

Na tela de entrar, "Entrar direto no app de demonstração" pula cadastro, confirmações e onboarding com a conta de exemplo já verificada. Qualquer credencial preenchida funciona em todas as áreas. Códigos de confirmação: `123456`.

Outros comandos:

```bash
npm test                 # API mock (25 testes) + frontend (painéis e fluxos do aluno)
npm run build            # build de produção com PWA (manifest, service worker, ícones)
npm run preview -w frontend
node frontend/scripts/generate-icons.mjs   # regenera os ícones do PWA
```

## Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — como o sistema se encaixa (backend, frontend, subsistemas centrais), com diagramas.
- [`docs/openapi.yaml`](docs/openapi.yaml) — referência completa de toda rota `/v1` (OpenAPI 3.0).
- [`docs/adr/`](docs/adr/README.md) — registro das decisões de arquitetura e produto já tomadas, com o porquê de cada uma.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — guia de engenharia: setup, convenções, como adicionar rota/feature, testes.
- [`REVISAO.md`](REVISAO.md) — auditoria de conformidade contra o escopo (achados abertos e fechados).

## Estrutura

```
Memora/
  backend/                 API mock Express 5 (estado em memória, reinicia com o servidor)
    src/seed/              dados fictícios: decks, cards, comunidade, cupons, painéis
    src/routes/            rotas /v1 por domínio (auth, me, study, decks, generation,
                           community, wallet, subscription, privacy, support, noa,
                           public, parental, b2b, admin, partner, _proto)
    src/lib/               FSRS simplificado, ledger imutável, auditoria com hash encadeado
    test/api.test.js       testes de regra de negócio com supertest
  frontend/                Vite 8 + React 18 (JavaScript) + PWA
    src/design-system/     componentes base (Button, Sheet, Field, Toggle, Menu ≤ 6 itens…)
    src/state/             Session, Study (sessão, fila offline, cansaço) e Proto (controles)
    src/features/          auth, study (E1–E6), create (C1–C3), decks (M1–M3),
                           community (K1–K5), wallet (P2–P3), profile (P1, P4–P7), proto, public
    src/areas/             student (layout, linha do topo, abas, trilho), parental, partner,
                           b2b, admin
    src/i18n/pt-BR/        todas as strings, por domínio
    src/test/              testes de fluxo do aluno contra o backend real em processo
  docs/                    arquitetura, referência de API (OpenAPI) e ADRs — ver "Documentação" acima
  CONTRIBUTING.md          guia de engenharia
  REVISAO.md               relatório do agente revisor (49 achados, com status)
```

## Controles do protótipo

O botão "Protótipo" no canto inferior esquerdo alterna os estados que mudam a interface: perfil (adulto gratuito, adulto Premium, menor de 16), cupom resgatável, modo offline, chegada de notificação push ou WhatsApp (respeitando opt-in, limites, janela de silêncio e deduplicação, com opção de ignorar só para demonstração), simulação de cansaço durante a sessão, cenário da próxima geração (normal, falha definitiva, documento grande) e reinício dos dados.

## Decisões registradas

- Tema claro travado (Escopo literal: fundo sempre branco perolado #FAFAF7).
- Cor oficial #00A1E0; botões primários usam texto escuro sobre a cor para atingir contraste AA.
- Tipografia e raios da leva 1 (Outfit + Inter, bolhas), ícones vetoriais monocromáticos, Nôa só com rótulo e borda tracejada.
- Categorias do sistema são uma lista provisória marcada no seed. Reações fixas: 👏 🔥 🧠 💡 ❤️ 😂.
- Toque longo no card abre Difícil e Fácil lado a lado; a linha do topo volta por até 4 s ou até o próximo card; desktop a partir de 1024 px com trilho lateral e atalhos (espaço, setas, 1, 2, Esc).
- Interface em PT-BR com strings externalizadas; EN aparece como indisponível no seletor.
- O PDF de exportação é entregue como texto no protótipo.
