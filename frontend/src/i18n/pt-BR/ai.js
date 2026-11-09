export const ai = {
  formatsTitle: 'O que sua IA monta para você',
  formatsLead: 'Peça na conversa com o Claude, o ChatGPT ou outro assistente conectado. A IA busca o conteúdo, estrutura no formato que você escolheu e envia para Recebidos.',
  soon: 'Em breve',
  available: 'Disponível',
  copyCommand: 'Copiar comando',
  copied: 'Comando copiado',
  commandLabel: 'Comando para colar na sua IA',
  formats: {
    mapa: { label: 'Mapa mental', text: 'Tema central com ramos e sub-ramos para ver o assunto inteiro de uma vez.', noun: 'um mapa mental' },
    flashcards: { label: 'Flashcards', text: 'Pergunta curta, resposta objetiva. Entra no estudo com repetição espaçada.', noun: 'flashcards' },
    resumo: { label: 'Resumo', text: 'Seções, listas e termos-chave em destaque para revisar antes da prova.', noun: 'um resumo' },
    diagrama: { label: 'Diagrama', text: 'Etapas de um processo em ordem, cada uma com o que acontece e o resultado.', noun: 'um diagrama de etapas' },
    linha: { label: 'Linha do tempo', text: 'Eventos e etapas em ordem, com datas e marcos.', noun: 'uma linha do tempo' },
    quiz: { label: 'Quiz', text: 'Questões de múltipla escolha no estilo da sua prova, com gabarito comentado.', noun: 'um quiz' }
  },
  command: {
    generic: 'Transforma este conteúdo em {noun} e salva no Memora.',
    fromCommunity: 'Lê "{title}" (id {id}) na comunidade do Memora e transforma em {noun}. Salva no Memora como remix desse conteúdo.',
    fromTopic: 'Pesquisa sobre {topic} e monta {noun} para revisar. Salva no Memora.'
  },
  flow: {
    label: 'Do comando ao material',
    ask: { title: 'Você pede', text: 'Na conversa com sua IA, com uma frase.' },
    build: { title: 'A IA estrutura', text: 'Busca o conteúdo e monta no formato escolhido.' },
    review: { title: 'Você aprova', text: 'Chega em Recebidos. Nada é salvo sem você.' },
    use: { title: 'Estuda e compartilha', text: 'Vai para seus decks, seu blog ou a comunidade.' }
  },
  transform: {
    action: 'Transformar com IA',
    title: 'Transformar com sua IA',
    lead: 'Escolha o formato. Copie o comando e cole na conversa com seu assistente: ele lê "{title}" no Memora e devolve no novo formato.',
    pick: 'Formato',
    connected: { one: '{count} IA conectada: {names}', other: '{count} IAs conectadas: {names}' },
    notConnected: 'Nenhuma IA conectada ainda. Conecte em poucos passos na área da Nôa.',
    connect: 'Conectar minha IA',
    manage: 'Ver na Nôa',
    arrives: 'O resultado chega em Recebidos para você aprovar antes de salvar.'
  },
  status: {
    title: 'Suas IAs',
    connected: { one: '{count} conectada', other: '{count} conectadas' },
    none: 'Nenhuma conectada',
    noneText: 'Conecte o Claude, o ChatGPT ou o Cursor e peça materiais direto da conversa.',
    lastUsed: 'usada {when}',
    neverUsed: 'ainda não usada',
    manage: 'Gerenciar conexões',
    connect: 'Conectar uma IA',
    pending: { one: '{count} item esperando você', other: '{count} itens esperando você' },
    review: 'Revisar'
  }
}
