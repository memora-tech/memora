export const common = {
  app: 'Memora',
  nav: {
    study: 'Estudar',
    decks: 'Meus decks',
    community: 'Comunidade',
    profile: 'Perfil',
    create: 'Criar deck',
    noa: 'Nôa',
    wallet: 'Carteira',
    groups: { study: 'Estudo', community: 'Comunidade', ai: 'Inteligência' },
    plan: { free: 'Plano gratuito', premium: 'Plano Premium' },
    main: 'Navegação principal',
    skip: 'Ir para o conteúdo',
    breadcrumbs: 'Você está em',
    question: 'Pergunta',
    answer: 'Resposta',
    home: 'Memora, início'
  },
  userMenu: {
    label: 'Menu da conta',
    profile: 'Perfil',
    settings: 'Configurações',
    connections: 'Conexões',
    wallet: 'Carteira',
    subscription: 'Assinatura',
    support: 'Ajuda'
  },
  topline: {
    streak: { one: '{count} dia seguido', other: '{count} dias seguidos' },
    streakShort: '{count}',
    objective: '{name} em {days} d',
    objectiveToday: '{name} é hoje',
    objectiveTomorrow: '{name} é amanhã',
    noObjective: 'Sem prova marcada',
    neurons: 'Neurônios: {count}. Abrir Carteira',
    neuronsRedeemable: 'Você tem cupom para resgatar',
    search: 'Buscar decks na comunidade',
    goalMenu: 'Abrir menu da meta',
    reveal: 'Mostrar barra',
    exitFocus: 'Sair do estudo'
  },
  actions: {
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    close: 'Fechar',
    back: 'Voltar',
    save: 'Salvar',
    undo: 'Desfazer',
    retry: 'Tentar de novo',
    continue: 'Continuar',
    edit: 'Editar',
    delete: 'Excluir',
    remove: 'Remover',
    add: 'Adicionar',
    more: 'Mais opções',
    seeAll: 'Ver todos',
    copy: 'Copiar',
    copied: 'Copiado',
    open: 'Abrir',
    done: 'Concluído',
    skip: 'Pular',
    understand: 'Entendi',
    later: 'Agora não',
    accept: 'Aceitar',
    yes: 'Sim',
    no: 'Não',
    decrease: 'Diminuir',
    increase: 'Aumentar',
    dragToClose: 'Arraste para baixo ou toque para fechar'
  },
  field: { optional: '(opcional)' },
  and: ' e ',
  state: {
    loading: 'Carregando…',
    error: 'Algo deu errado.',
    offline: 'Você está offline.',
    offlineDetail: 'Decks estudados nos últimos 7 dias e decks fixados continuam disponíveis. Suas respostas serão sincronizadas quando a conexão voltar.',
    offlinePending: { one: '{count} resposta aguardando sincronização', other: '{count} respostas aguardando sincronização' },
    synced: { one: '{count} resposta sincronizada', other: '{count} respostas sincronizadas' },
    notFound: 'Não encontramos esta página.',
    empty: 'Nada por aqui ainda.',
    saved: 'Salvo.',
    moreNotices: { one: 'Mais {count} aviso', other: 'Mais {count} avisos' },
    fewerNotices: 'Recolher avisos'
  },
  reward: {
    dailyAccess: '+1 Neurônio por abrir o Memora hoje',
    goal: '+{amount} Neurônios por bater a meta',
    objective: '+{amount} Neurônios por contar como foi',
    generic: '+{amount} Neurônios'
  },
  verification: {
    required: 'Confirme seu e-mail e telefone para {action}.',
    cta: 'Confirmar agora',
    actions: { earn: 'ganhar Neurônios', publish: 'publicar na comunidade', comment: 'comentar', redeem: 'resgatar cupons', refer: 'participar da indicação' }
  },
  guardian: {
    required: 'Esta ação depende da liberação do seu responsável.',
    requested: 'Pedimos a liberação para {name}. Você recebe um aviso quando responder.',
    requestSent: 'Solicitação enviada ao responsável',
    pending: 'Aguardando seu responsável'
  },
  difficulty: { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' },
  plan: { free: 'Gratuito', premium: 'Premium' },
  units: {
    cards: { one: '{count} card', other: '{count} cards' },
    minutes: { one: '~{count} min', other: '~{count} min' },
    days: { one: '{count} dia', other: '{count} dias' },
    decks: { one: '{count} deck', other: '{count} decks' },
    people: { one: '{count} pessoa', other: '{count} pessoas' },
    members: { one: '{count} membro', other: '{count} membros' },
    neurons: 'Neurônios'
  },
  install: {
    title: 'Instalar o Memora',
    text: 'Abra direto da tela inicial e estude offline.',
    action: 'Instalar',
    later: 'Depois'
  },
  notification: {
    open: 'Abrir',
    dismiss: 'Dispensar',
    channel: { push: 'Notificação', whatsapp: 'WhatsApp' }
  },
  notFound: {
    title: 'Página não encontrada',
    text: 'O endereço pode ter mudado. Volte para a sessão do dia.',
    action: 'Ir para Estudar'
  },
  public: {
    preview: 'Prévia pública',
    by: 'por {author}',
    more: { one: '+{count} card ao entrar', other: '+{count} cards ao entrar' },
    loginToStudy: 'Para estudar este deck, entre no Memora. A prévia mostra só as primeiras perguntas.',
    cta: 'Entrar para estudar',
    create: 'Criar conta grátis',
    notFound: 'Este link não aponta para um deck público.'
  },
  intensity: { leve: 'leve', padrao: 'padrão', intenso: 'intenso' }
}
