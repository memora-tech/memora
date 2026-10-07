export const noa = {
  eyebrow: 'Inteligência',
  title: 'Nôa',
  lead: 'Sua assistente de estudo. Ela acompanha acertos, erros e horários, sugere ajustes e explica cada decisão. Tudo o que ela faz pode ser desfeito.',
  budget: '{used} de {limit} sugestões hoje',
  briefing: {
    title: 'Oi, {name}. Olhei seu estudo de hoje.',
    lead: 'Um resumo do que importa agora e o próximo passo para cada ponto.',
    todayLabel: 'Hoje',
    todayValue: { one: '{count} card para revisar', other: '{count} cards para revisar' },
    todayText: 'Cerca de {minutes} min, em {decks} decks programados.',
    todayNone: 'Nada para revisar',
    todayNoneText: 'Você está em dia. Que tal explorar a comunidade?',
    todayAction: 'Começar',
    weakLabel: 'Ponto mais fraco',
    weakText: '{lapses} erros em {cards} cards. Vale uma revisão só dos pontos fracos.',
    weakNone: 'Nenhum por enquanto',
    weakNoneText: 'Quando você errar um card mais de uma vez, ele aparece aqui.',
    weakAction: 'Revisar',
    objectiveLabel: 'Próxima prova',
    objectiveValue: { one: '{name} em {count} dia', other: '{name} em {count} dias' },
    objectiveText: 'Organize os decks dessa prova no plano até a data.',
    objectiveNone: 'Nenhuma prova marcada',
    objectiveNoneText: 'Marque uma prova e a Nôa organiza o ritmo até ela.',
    objectiveAction: 'Ver objetivos',
    objectiveAdd: 'Marcar prova',
    accuracyLabel: 'Acerto recente',
    accuracyText: { one: 'Na última revisão.', other: 'Nas últimas {count} revisões.' },
    accuracyNone: 'Revise alguns cards para a Nôa calcular.'
  },
  actions: {
    title: 'Peça para a Nôa',
    weak: { title: 'Revisar meus pontos fracos', text: 'Abre o deck com mais erros no modo “Pontos fracos”.' },
    generate: { title: 'Gerar flashcards', text: 'De um texto, PDF, foto ou de outro sistema conectado.' },
    plan: { title: 'Planejar até a prova', text: 'Defina a data e veja o ritmo diário necessário.' },
    goal: { title: 'Ajustar minha meta', text: 'Hoje: {done} de {goal} cards. Mude a meta ou pause.' }
  },
  tabsLabel: 'Detalhes da Nôa',
  tabs: {
    suggestions: 'Sugestões',
    history: 'Histórico',
    catalog: 'O que ela faz',
    limits: 'Transparência'
  },
  suggestions: {
    accept: 'Aceitar',
    dismiss: 'Dispensar',
    accepted: 'Sugestão aceita',
    dismissed: 'Sugestão dispensada',
    emptyTitle: 'Nada pendente',
    emptyText: 'Quando a Nôa notar algo no seu estudo, a sugestão aparece aqui.'
  },
  decisions: {
    lead: 'Tudo o que a Nôa fez na sua conta, com o motivo. Use “Desfazer” para voltar atrás.',
    revert: 'Desfazer',
    reverted: 'Ação desfeita',
    revertedTag: 'desfeita'
  },
  catalog: {
    autonomous: 'Age sozinha',
    asks: 'Pede permissão',
    trigger: 'Quando'
  },
  limits: {
    signals: 'O que a Nôa analisa',
    never: 'O que a Nôa nunca faz sozinha',
    budget: 'Limite diário: {suggestions} sugestões e {autonomous} ação automática. Catálogo de ações {version}.'
  }
}
