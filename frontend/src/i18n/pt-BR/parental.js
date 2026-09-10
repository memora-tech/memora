export const parental = {
  name: 'Painel Parental',
  login: {
    title: 'Entrar no Painel Parental',
    subtitle: 'Acompanhe e gerencie a conta do seu filho ou filha no Memora.',
    email: 'E-mail',
    password: 'Senha',
    submit: 'Entrar',
    errorEmail: 'Digite um e-mail com @ para continuar.',
    errorPassword: 'Digite sua senha.',
    hint: 'Acesso exclusivo do responsável verificado. Não é o mesmo login do aluno.',
    failed: 'Não foi possível entrar. Tente de novo.'
  },
  header: {
    role: 'Responsável',
    logout: 'Sair',
    childOf: 'Conta de {name}'
  },
  nav: {
    label: 'Seções do painel',
    summary: 'Resumo',
    permissions: 'Permissões',
    requests: 'Solicitações',
    activity: 'Atividade'
  },
  states: {
    loading: 'Carregando o painel…',
    errorTitle: 'Não conseguimos carregar o painel',
    errorText: 'Verifique a conexão e tente de novo.',
    retry: 'Tentar de novo'
  },
  child: {
    title: 'Conta do menor',
    age: { one: '{count} ano', other: '{count} anos' },
    streak: 'Dias seguidos',
    studyDays: 'Dias com estudo',
    tone: 'Tom das notificações',
    toneValue: 'Leve, fixo para menores',
    quietWindow: 'Silêncio garantido',
    quietWindowValue: 'Das {start} às {end}',
    linked: 'Vinculada a você desde {date}'
  },
  weekly: {
    title: 'Resumo da semana',
    weekOf: 'Semana de {date}',
    studyDays: 'Dias com estudo',
    cards: 'Cards revisados',
    minutes: 'Minutos',
    accuracy: 'Acertos',
    subjects: 'Matérias estudadas',
    subjectMeta: '{cards} cards · {accuracy}% de acertos',
    emailNote: 'Você recebe este resumo por e-mail toda semana.'
  },
  decks: {
    title: 'Decks e matérias',
    meta: '{category} · {total} cards · {due} para revisar',
    lastStudied: 'Último estudo {when}',
    never: 'Ainda não estudado',
    empty: 'Nenhum deck criado ainda.'
  },
  gamification: {
    title: 'Neurônios e cupons',
    balance: 'Saldo atual',
    unit: 'Neurônios'
  },
  verification: {
    title: 'Verificação de idade',
    status: 'Concluída por terceiro homologado',
    method: 'Método',
    date: 'Data',
    hash: 'Hash do documento',
    verifiedBy: 'Quem verificou',
    deleted: 'Documentos apagados em {date}',
    retained: 'Guardamos só resultado, método, data, hash e quem verificou. Nenhuma imagem de documento fica armazenada.',
    guardian: 'Seu documento também foi apagado após a verificação, em {date}.'
  },
  milestones: {
    title: 'Marcos de idade',
    at: 'Aos {age} anos',
    thirteen: 'Abaixo de 13 anos, a conta só existe com o seu consentimento. Aos 13, o app avisa sobre a mudança de regime.'
  },
  permissions: {
    title: 'Permissões',
    intro: 'Cada liberação é independente. O que não estiver liberado vira uma solicitação que chega aqui para você decidir.',
    saved: 'Permissão atualizada.',
    error: 'Não foi possível salvar. Tente de novo.',
    windowTitle: 'Janela de notificação',
    windowHelp: 'Fora deste horário nenhuma notificação chega ao aluno.',
    start: 'Início do silêncio',
    end: 'Fim do silêncio',
    saveWindow: 'Salvar janela',
    windowSaved: 'Janela de notificação salva.',
    toneNote: 'O tom das notificações do menor é sempre "leve". Isso não pode ser alterado.',
    gamificationNote: 'Cupons e Neurônios funcionam igual para menores e adultos e não dependem de liberação sua.',
    on: 'Liberado',
    off: 'Bloqueado'
  },
  requests: {
    title: 'Solicitações',
    pending: 'Pendentes',
    decided: 'Decididas',
    empty: 'Nenhuma solicitação pendente',
    emptyText: 'Quando o aluno tentar algo que ainda não está liberado, o pedido aparece aqui.',
    approve: 'Aprovar',
    deny: 'Negar',
    aprovada: 'Aprovada',
    negada: 'Negada',
    pendente: 'Pendente',
    approvedToast: 'Solicitação aprovada. A permissão foi liberada.',
    deniedToast: 'Solicitação negada.',
    requestedAt: 'Pedido {when}',
    decidedAt: 'Decidido {when}',
    confirmDenyTitle: 'Negar esta solicitação?',
    confirmDenyText: 'O aluno vai ver que o pedido foi negado. Você pode liberar depois em Permissões.',
    confirmDeny: 'Negar',
    cancel: 'Cancelar',
    count: { one: '{count} pendente', other: '{count} pendentes' },
    error: 'Não foi possível registrar a decisão. Tente de novo.'
  },
  activity: {
    title: 'Atividade',
    history: 'Suas decisões',
    empty: 'Nenhuma decisão registrada ainda.'
  }
}
