export const mcp = {
  arrival: {
    eyebrow: 'Chegou via MCP · {source}',
    meta: { one: '{count} pergunta e resposta · {category}', other: '{count} perguntas e respostas · {category}' },
    more: { one: '+{count} outro deck esperando', other: '+{count} outros decks esperando' },
    previewLabel: 'Prévia dos primeiros cards',
    addToStudy: 'Adicionar ao meu estudo',
    review: 'Revisar o deck',
    hint: 'O deck já está em Meus decks, fora do estudo até você decidir.',
    dismiss: 'Dispensar aviso',
    added: '"{name}" entrou no seu estudo',
    toast: 'Chegou do {source}: {name}',
    eyebrowPost: 'Post de blog via MCP · {source}',
    journeyLabel: 'Caminho até a comunidade',
    journey: {
      arrived: { title: 'Chegou', help: 'Privado, só você vê' },
      review: { title: 'Você revisa', help: 'Leia e edite se quiser' },
      share: { title: 'Compartilha', help: 'Comunidade ou seguidores' },
      moderation: { title: 'Moderação', help: 'Até 72 h' },
      community: { title: 'No Blog', help: 'Aparece para todos' }
    },
    reviewShare: 'Revisar e compartilhar',
    openBlog: 'Ver em Meu blog',
    postHint: 'Nada vai para a comunidade sem você decidir.',
    simulatePost: 'Simular post de blog do Claude',
    simulatedPost: 'O Claude Desktop enviou o post "{name}" pelo MCP. Veja o alerta na tela inicial.',
    toastAction: 'Ver',
    simulate: 'Simular envio do Claude',
    simulating: 'Enviando…',
    simulated: 'O Claude Desktop enviou "{name}" pelo MCP. Veja o alerta na tela inicial.',
    simulateHint: 'Simula o Claude Desktop chamando a ferramenta salvar_flashcards neste servidor MCP.'
  },
  title: 'Conexões',
  lead: 'Conecte outros sistemas e assistentes (Claude, ChatGPT, plataformas de ensino) pelo protocolo MCP. Os decks gerados lá chegam direto na sua biblioteca do Memora.',
  how: {
    title: 'Como funciona',
    steps: [
      'Crie uma conexão e copie o token. Ele aparece uma vez só.',
      'Adicione o Memora como servidor MCP no outro sistema, com o endereço e o token.',
      'Lá, peça: "transforma isso em flashcards e salva no Memora".',
      'O deck chega em Meus decks. Você decide se programa para estudo ou publica na comunidade.'
    ]
  },
  endpoint: 'Endereço do servidor MCP',
  copy: 'Copiar',
  copied: 'Copiado',
  create: {
    title: 'Nova conexão',
    name: 'Nome da conexão',
    namePlaceholder: 'Claude Desktop, ChatGPT, Cursor…',
    submit: 'Gerar token',
    tokenTitle: 'Token da conexão "{name}"',
    tokenWarning: 'Copie agora. Por segurança, o Memora guarda só uma impressão do token e não consegue mostrá-lo de novo.',
    done: 'Já copiei',
    claudeCode: 'Claude Code (terminal)',
    jsonConfig: 'Configuração JSON (clientes com transporte HTTP)',
    limit: 'Até {count} conexões ativas por conta.'
  },
  connections: {
    title: 'Conexões',
    empty: 'Nenhuma conexão ainda.',
    token: 'Token terminado em {hint}',
    client: 'cliente {client}',
    lastUsed: 'último uso {when}',
    neverUsed: 'ainda não usada',
    revoked: 'Revogada',
    active: 'Ativa',
    revoke: 'Revogar',
    revokeTitle: 'Revogar "{name}"?',
    revokeText: 'A IA perde o acesso na hora. O que já foi salvo continua na sua conta.',
    revokedToast: 'Conexão revogada'
  },
  tools: {
    title: 'O que a sua IA pode fazer',
    write: 'Salva',
    read: 'Consulta'
  },
  activity: {
    title: 'Atividade recente',
    empty: 'Nenhuma chamada ainda.',
    failed: 'Falhou: {error}'
  },
  safety: 'A conexão só salva e consulta conteúdo de estudo na sua conta. Nada vai para a comunidade sem passar pela moderação, e você pode revogar a qualquer momento.',
  providers: {
    title: 'Para provedores de conteúdo educacional',
    text: 'Plataformas de educação podem conectar seus próprios agentes ao Memora pelo mesmo protocolo e levar material até os alunos, sempre com fonte e passando pela moderação.'
  }
}
