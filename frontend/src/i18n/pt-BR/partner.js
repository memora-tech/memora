export const partner = {
  name: 'Painel do Parceiro',
  login: {
    title: 'Entrar no Painel do Parceiro',
    subtitle: 'Gerencie campanhas, estoque e baixas de cupons.',
    cnpj: 'CNPJ',
    password: 'Senha',
    submit: 'Entrar',
    errorCnpj: 'Digite o CNPJ com 14 dígitos.',
    errorPassword: 'Digite sua senha.',
    hint: 'Acesso da empresa parceira. A verificação formal do CNPJ acontece antes do primeiro acesso.',
    failed: 'Não foi possível entrar. Tente de novo.'
  },
  header: {
    logout: 'Sair'
  },
  nav: {
    label: 'Seções do painel',
    overview: 'Visão geral',
    campaigns: 'Campanhas',
    validate: 'Dar baixa',
    report: 'Conversão',
    positioning: 'Posicionamento'
  },
  states: {
    loading: 'Carregando o painel…',
    errorTitle: 'Não conseguimos carregar o painel',
    errorText: 'Verifique a conexão e tente de novo.',
    retry: 'Tentar de novo'
  },
  company: {
    title: 'Sua empresa',
    verified: 'Verificado',
    pending: 'Verificação em andamento',
    cnpj: 'CNPJ {cnpj}',
    stages: 'Aprovação em duas etapas',
    stage1: 'Documentação validada',
    stage2: 'Aprovação comercial',
    done: 'Concluída',
    waiting: 'Pendente',
    contact: 'Contato'
  },
  contract: {
    title: 'Contrato',
    startedLabel: 'Início',
    renewsLabel: 'Renovação',
    minMonths: 'Contrato mínimo de {months} meses',
    tier: 'Posicionamento: {tier}',
    noTier: 'Sem posicionamento pago',
    monthly: '{value} por mês',
    penalty: 'Multa de cancelamento: {penalty}',
    accepted: 'Aceito digitalmente em {date}',
    acceptedNoDate: 'Aceito digitalmente',
    pending: 'Aceite pendente',
    acceptCta: 'Aceitar contrato digitalmente',
    external: 'Se preferir, assine externamente e envie ao comercial.',
    acceptedToast: 'Contrato aceito digitalmente.',
    confirmTitle: 'Aceitar o contrato?',
    confirmText: 'Contrato mínimo de {months} meses. Multa de cancelamento: {penalty}.',
    confirm: 'Aceitar',
    cancel: 'Cancelar',
    error: 'Não foi possível registrar o aceite. Tente de novo.'
  },
  billing: {
    title: 'Como você paga',
    cpa: 'CPA por resgate',
    cpaHelp: 'Você só paga quando o aluno resgata.',
    commission: 'Comissão de intermediação',
    positioning: 'Posicionamento mensal',
    none: 'Sem cobrança'
  },
  alerts: {
    title: 'Alertas',
    empty: 'Nenhum alerta no momento.',
    queda_conversao: 'Queda de conversão',
    risco_renovacao: 'Risco de não renovação'
  },
  campaigns: {
    title: 'Campanhas',
    new: 'Nova campanha',
    empty: 'Nenhuma campanha ainda',
    emptyText: 'Crie a primeira campanha com estoque e validade.',
    stock: 'Estoque',
    stockValue: { one: '{count} unidade', other: '{count} unidades' },
    soldOut: 'Esgotado',
    lastUnits: 'Últimas unidades',
    cost: { one: '{count} Neurônio', other: '{count} Neurônios' },
    validity: 'Válido por {days} dias após o resgate',
    redemptions: 'Resgates',
    used: 'Usos confirmados',
    restock: 'Repor estoque',
    restockTitle: 'Repor estoque de "{title}"',
    restockLabel: 'Novo estoque',
    restockSave: 'Salvar estoque',
    restocked: 'Estoque atualizado.',
    pause: 'Pausar',
    resume: 'Retomar',
    paused: 'Pausada',
    positioning: {
      destaque: 'Destaque na loja',
      primeira_posicao: 'Primeira posição'
    },
    error: 'Não foi possível salvar. Tente de novo.',
    form: {
      title: 'Nova campanha',
      name: 'Título do cupom',
      description: 'Descrição',
      cost: 'Custo em Neurônios',
      stock: 'Estoque inicial',
      validity: 'Validade após o resgate, em dias',
      terms: 'Regras de uso',
      submit: 'Criar campanha',
      created: 'Campanha criada.',
      errorTitle: 'Dê um título ao cupom.',
      errorCost: 'Informe um custo em Neurônios maior que zero.',
      errorStock: 'Informe um estoque maior que zero.',
      hintCost: 'Alunos ganham 1 Neurônio por dia de acesso e bônus por meta batida.',
      hintStock: 'O resgate é atômico: dois pedidos simultâneos do último cupom geram um só sucesso.'
    }
  },
  redemptions: {
    title: 'Resgates recentes',
    all: 'Todos os resgates',
    total: { one: '{count} resgate no total', other: '{count} resgates no total' },
    status: {
      emitido: 'Emitido',
      utilizado: 'Utilizado',
      expirado: 'Expirado, Neurônios devolvidos ao aluno'
    },
    validUntil: 'Válido até {date}',
    usedAt: 'Usado em {date}',
    redeemedAt: 'Resgatado {when}',
    dateColumn: 'Resgatado em',
    statusColumn: 'Status',
    empty: 'Nenhum resgate ainda.'
  },
  validate: {
    title: 'Dar baixa em um cupom',
    intro: 'Digite ou escaneie o código do aluno. Cada código baixa uma única vez, por aqui ou pela API.',
    code: 'Código do cupom',
    placeholder: 'MEM-XXXX-XXXX',
    submit: 'Confirmar baixa',
    ok: 'Baixa registrada',
    already_used: 'Este código já foi utilizado',
    expired: 'Este código expirou',
    not_found: 'Código não encontrado para este parceiro',
    okText: 'Código {code} utilizado em {date}. Ele não pode ser usado de novo.',
    usedAtText: 'Usado em {date}.',
    expiredText: 'Os Neurônios voltaram para o aluno.',
    notFoundText: 'Confira se o código pertence a uma campanha sua.',
    error: 'Digite ou escaneie o código.',
    apiTitle: 'Também dá para dar baixa pela API',
    apiKey: 'Chave',
    apiEndpoint: 'Endpoint',
    genericError: 'Não foi possível validar agora. Tente de novo.'
  },
  report: {
    title: 'Relatório de conversão',
    redemptions: 'Resgates',
    confirmed: 'Uso confirmado',
    expired: 'Expirados',
    rate: 'Taxa de uso',
    cells: 'Perfil agregado',
    cellsNote: 'Só mostramos células com ao menos {min} pessoas.',
    cellColumn: 'Faixa e região',
    peopleColumn: 'Pessoas',
    suppressed: 'Suprimido',
    people: { one: '{count} pessoa', other: '{count} pessoas' },
    empty: 'Ainda não há dados suficientes.'
  },
  positioning: {
    title: 'Tabela de posicionamento',
    current: 'Seu plano atual',
    perMonth: 'por mês',
    free: 'Incluído',
    rules: 'Mesma tabela desde o início. Contrato mínimo de 3 meses; multa de cancelamento igual a 1 mês do valor de posicionamento.'
  },
  shell: {
    skip: 'Pular para o conteúdo',
    menu: 'Menu de navegação',
    close: 'Fechar menu',
    groups: { performance: 'Desempenho', operation: 'Operação', commercial: 'Comercial' }
  },
  entry: {
    kicker: 'Empresas parceiras',
    headline: 'Seus cupons na carteira de quem estuda todo dia.',
    highlights: ['Você só paga quando o aluno resgata.', 'Baixa do código pelo painel ou por API, uma única vez.', 'Conversão por perfil agregado, sem dado individual.'],
    footnote: 'CNPJ verificado antes do primeiro acesso.'
  },
  pages: {
    overviewLead: 'Situação da empresa, contrato e os resgates mais recentes.',
    campaignsLead: 'Ofertas ativas na loja, estoque e desempenho de cada uma.',
    validateLead: 'Cada código baixa uma única vez, por aqui ou pela API.',
    reportLead: 'Uso confirmado e perfil agregado dos alunos que resgataram.',
    positioningLead: 'Quanto custa cada nível de destaque na loja de cupons.',
    kpiRedemptions: 'Resgates emitidos',
    kpiUsed: 'Usados',
    kpiActive: 'Campanhas ativas',
    kpiStock: 'Estoque total',
    useRate: '{pct}% de uso',
    lowStock: { one: '{count} com estoque baixo', other: '{count} com estoque baixo' },
    stockOk: 'estoque saudável',
    paused: { one: '{count} pausada', other: '{count} pausadas' },
    usedOfRedeemed: '{used} de {redeemed} usados',
    funnel: 'Funil do período',
    nextStep: 'Próximo passo'
  }
}
