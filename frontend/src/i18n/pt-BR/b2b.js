export const b2b = {
  name: 'Painel B2B',
  login: {
    title: 'Entrar no painel da instituição',
    subtitle: 'Acesso exclusivo para escolas e cursinhos, com login próprio e separado do app do aluno.',
    provider: 'Entrar com SSO',
    google: 'Google Workspace',
    microsoft: 'Microsoft Entra',
    role: 'Seu papel na instituição',
    roles: {
      admin: 'Administrador da instituição',
      coordenador: 'Coordenador',
      professor: 'Professor',
      leitura: 'Somente leitura'
    },
    roleHint: 'No protótipo você escolhe o papel; no produto ele vem do SSO.',
    submit: 'Entrar com {provider}',
    error: 'Não foi possível entrar. Tente de novo.',
    dpaNote: 'A ativação exige DPA assinado antes do primeiro acesso.'
  },
  header: {
    tenant: 'Instituição',
    dpa: 'DPA',
    dpaStatus: '{version} · {status} desde {date}',
    isolation: 'Isolamento',
    sso: 'SSO',
    plan: 'Licença',
    role: 'Papel',
    logout: 'Sair',
    loggedAs: 'Você está como {name}'
  },
  nav: {
    classes: 'Turmas',
    invites: 'Convites',
    indicators: 'Indicadores',
    users: 'Usuários',
    label: 'Seções do painel'
  },
  rules: {
    title: 'Regras deste painel',
    noRanking: 'Não existe ranking entre alunos da mesma turma. Nenhuma lista é ordenada por desempenho.',
    minAggregate: 'Agregados exigem ao menos {min} alunos com consentimento. Abaixo disso, só a visão individual consentida.',
    projection: 'O dado do aluno entra por projeção revogável: revogar corta a inclusão imediatamente e remove o aluno das visões individuais; agregados já entregues permanecem.',
    api: 'API de leitura por tenant: fase posterior.',
    consent: 'Desempenho individual aparece só com consentimento do aluno.'
  },
  classes: {
    title: 'Turmas',
    students: { one: '{count} aluno', other: '{count} alunos' },
    consented: '{count} com consentimento',
    teacher: 'Professor',
    room: 'Sala',
    subject: 'Matéria',
    period: '{year}/{semester}',
    aggregates: 'Agregados da turma',
    blocked: 'Agregados indisponíveis',
    avgAccuracy: 'Acerto médio',
    avgCardsWeek: 'Cards por semana',
    active7d: 'Estudaram nos últimos 7 dias',
    activeStudents: 'Alunos ativos',
    open: 'Abrir turma',
    empty: 'Nenhuma turma cadastrada.'
  },
  detail: {
    back: 'Voltar para turmas',
    title: 'Turma {name}',
    students: 'Alunos da turma',
    caption: 'Alunos em ordem de matrícula. Não há ordenação por desempenho.',
    name: 'Aluno',
    consent: 'Consentimento',
    consentYes: 'Consentiu',
    consentNo: 'Sem consentimento',
    revokedLabel: 'Projeção revogada',
    cardsWeek: 'Cards/semana',
    accuracy: 'Acerto',
    streak: 'Streak',
    lastStudy: 'Último estudo',
    revoke: 'Revogar projeção',
    revokeTitle: 'Revogar a projeção de {name}?',
    revokeText: 'A inclusão é cortada agora e o aluno sai das visões individuais. Agregados já entregues permanecem.',
    revokeConfirm: 'Revogar',
    revoked: 'Projeção de {name} revogada.',
    hidden: 'Dados individuais só aparecem com consentimento do aluno.',
    noIndividual: 'Seu papel não vê desempenho individual. Coordenadores e professores veem, com consentimento do aluno.',
    notFound: 'Turma não encontrada.'
  },
  invites: {
    title: 'Convites',
    new: 'Convidar aluno',
    contact: 'E-mail, telefone ou código de turma',
    contactHint: 'O aluno aceita o convite no app. Se tiver menos de 16 anos, o responsável também aceita no painel parental.',
    class: 'Turma',
    method: 'Como convidar',
    methods: {
      email: 'E-mail',
      phone: 'Telefone',
      code: 'Código de turma'
    },
    send: 'Enviar convite',
    sent: 'Convite enviado.',
    status: {
      pendente: 'Pendente',
      aceito: 'Aceito'
    },
    minor: 'Menor de 16',
    guardian: 'Responsável: {status}',
    sentAt: 'Enviado {when}',
    empty: 'Nenhum convite ainda.',
    forbidden: 'Seu papel não convida alunos.',
    validation: 'Informe o contato e escolha a turma.'
  },
  indicators: {
    title: 'Indicadores',
    restricted: 'Indicadores por professor, turma, sala, matéria, semestre e ano são visíveis para coordenadores e administradores.',
    byTeacher: 'Por professor',
    bySubject: 'Por matéria',
    bySemester: 'Por semestre',
    byYear: 'Por ano',
    byClass: 'Por turma e sala',
    teacher: 'Professor',
    classes: 'Turmas',
    consentedStudents: 'Alunos com consentimento',
    avgAccuracy: 'Acerto médio',
    avgCardsWeek: 'Cards/semana',
    subject: 'Matéria',
    label: 'Período',
    room: 'Sala',
    class: 'Turma',
    suppressed: 'Suprimido (< {min})'
  },
  users: {
    title: 'Usuários da instituição',
    name: 'Nome',
    email: 'E-mail',
    role: 'Papel',
    subjects: 'Matérias',
    restricted: 'Só o administrador da instituição vê os usuários.'
  },
  export: {
    title: 'Exportar',
    csv: 'Exportar CSV',
    xlsx: 'Exportar XLSX',
    done: 'Arquivo pronto: {file} ({rows} linhas).',
    download: 'Baixar {file}',
    note: 'Agregados abaixo do mínimo saem como "suprimido".'
  },
  states: {
    loading: 'Carregando…',
    error: 'Não foi possível carregar.',
    retry: 'Tentar de novo',
    forbidden: 'Sem permissão para esta área.',
    offline: 'Você está offline.'
  }
}
