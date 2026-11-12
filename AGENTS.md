Contexto: projeto Memora (monorepo npm workspaces: backend Express 5 em ESM, frontend Vite + React 18). Estamos transformando o protótipo mock (estado em memória) em MVP real para ~5 testadores adultos, com prazo 14/11/2026. Trabalhe SOMENTE na branch indicada por mim. Escopo: apenas o app do aluno.

Regras fixas:
1. Não deduza nada. Em caso de dúvida, pergunte antes de agir.
2. Antes de escrever código em qualquer tarefa grande, me entregue um PLANO: o que vai fazer, lista de arquivos que vai criar/alterar, riscos. Só implemente depois da minha aprovação.
3. Leia CONTRIBUTING.md e docs/adr/ antes de começar. Siga as convenções: sem comentários inline (ADR-0007), strings de UI via i18n/pt-BR por domínio, autenticação via requireRole, erros via fail(), cliente de API em lib/api.js.
4. Nunca imprima, comite ou mova valores de .env ou chaves. Chaves só em variáveis de ambiente, só no servidor. Nunca use a service_role do Supabase no frontend.
5. Não desligue features apagando código: tire a rota do app.js e a tela da navegação por flag de configuração.
6. Se precisar alterar algo fora do escopo pedido, faça em commit separado e me diga o que mudou, por quê e o que pode quebrar.
7. Não instale dependência nova sem justificar. Não rode comandos destrutivos (drop, reset, delete em massa) sem minha confirmação.
8. Um commit por tarefa, mensagem clara. Mantenha os testes do núcleo passando.
9. Contratos de API: preserve o formato das respostas para o frontend não quebrar. Se tiver de mudar, liste cada quebra e o ajuste no front.
10. Fora do MVP (não implementar, não migrar): painéis parental/B2B/back-office/parceiro, MCP e Recebidos, materiais (quiz, mapa, linha do tempo, blog), grupos de estudo, ranking, assinatura, cupons.