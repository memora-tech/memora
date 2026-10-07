import { daysFromNow, hoursFromNow, minutesFromNow } from '../lib/ids.js'

export const CATEGORIES = [
  { id: 'vestibular', name: 'Vestibular/ENEM', provisional: true },
  { id: 'concursos', name: 'Concursos', provisional: true },
  { id: 'superior', name: 'Ensino Superior', provisional: true },
  { id: 'idiomas', name: 'Idiomas', provisional: true },
  { id: 'medio', name: 'Ensino Médio', provisional: true },
  { id: 'certificacoes', name: 'Certificações', provisional: true },
  { id: 'outros', name: 'Outros', provisional: true }
]

export const REACTIONS = ['👏', '🔥', '🧠', '💡', '❤️', '😂']

const CELL_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img"><rect width="320" height="200" rx="24" fill="#E8F6FC"/><ellipse cx="160" cy="100" rx="130" ry="80" fill="#FFFFFF" stroke="#036B95" stroke-width="3"/><circle cx="150" cy="95" r="34" fill="#CDEBF8" stroke="#073B5C" stroke-width="3"/><circle cx="150" cy="95" r="10" fill="#073B5C"/><ellipse cx="230" cy="70" rx="22" ry="12" fill="#FFE9CF" stroke="#8C4B02" stroke-width="2"/><ellipse cx="90" cy="140" rx="22" ry="12" fill="#FFE9CF" stroke="#8C4B02" stroke-width="2"/><path d="M60 60 q20 -20 40 0 q20 20 40 0" fill="none" stroke="#9A9A96" stroke-width="2"/><path d="M180 150 l40 -6" stroke="#D8001C" stroke-width="3"/><circle cx="222" cy="143" r="6" fill="#D8001C"/><path d="M150 95 L222 143" stroke="#D8001C" stroke-width="2" stroke-dasharray="4 4"/></svg>'
)}`

const LIMIT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img"><rect width="320" height="200" rx="24" fill="#FFFFFF"/><line x1="30" y1="170" x2="300" y2="170" stroke="#9A9A96" stroke-width="2"/><line x1="40" y1="20" x2="40" y2="180" stroke="#9A9A96" stroke-width="2"/><path d="M50 160 C 100 150, 140 120, 170 90 S 240 40, 290 30" fill="none" stroke="#00A1E0" stroke-width="4"/><circle cx="170" cy="90" r="7" fill="#FFFFFF" stroke="#00A1E0" stroke-width="4"/><line x1="170" y1="170" x2="170" y2="95" stroke="#D6D6D0" stroke-dasharray="4 4"/><text x="164" y="190" font-family="Inter, sans-serif" font-size="14" fill="#5C5C5A">2</text><line x1="40" y1="90" x2="165" y2="90" stroke="#D6D6D0" stroke-dasharray="4 4"/><text x="18" y="95" font-family="Inter, sans-serif" font-size="14" fill="#5C5C5A">3</text></svg>'
)}`

const origin = (document, page, excerpt) => ({
  document,
  page,
  excerpt,
  model: 'claude-sonnet-5',
  reader: 'gemini-3.8-flash',
  promptVersion: 'v1.3'
})

const sched = ({ dueInDays = 0, stability = 4, difficulty = 5, reps = 3, lapses = 0, lastDays = -2, state = 'review' }) => ({
  state,
  stability,
  difficulty,
  due: dueInDays <= 0 ? minutesFromNow(-60 * (1 - dueInDays)) : daysFromNow(dueInDays),
  lastReview: daysFromNow(lastDays),
  reps,
  lapses,
  consecutiveLapses: 0
})

const card = (deckId, n, front, back, extra = {}) => ({
  id: `${deckId}_c${n}`,
  deckId,
  type: extra.type || 'text',
  front,
  back,
  media: extra.media || null,
  lang: extra.lang || 'pt-BR',
  origin: extra.origin || origin('Material do deck', n, front.slice(0, 40)),
  uncertain: false,
  sched: extra.sched || sched({ dueInDays: 3 })
})

export function ownDecks() {
  const decks = [
    {
      id: 'd1',
      ownerId: 'u1',
      name: 'Direito Constitucional',
      categoryId: 'concursos',
      tags: ['CF/88', 'direitos fundamentais', 'controle de constitucionalidade'],
      difficulty: 'dificil',
      lang: 'pt-BR',
      difficult: false,
      focus: false,
      complementary: false,
      pinned: false,
      favorite: false,
      folderId: 'f1',
      source: { type: 'pdf', document: 'Apostila Constitucional 2026.pdf', pages: 48 },
      createdAt: daysFromNow(-40),
      lastStudiedAt: daysFromNow(-1),
      publication: { status: 'nao_publicado' }
    },
    {
      id: 'd2',
      ownerId: 'u1',
      name: 'Citologia',
      categoryId: 'vestibular',
      tags: ['biologia celular', 'organelas'],
      difficulty: 'medio',
      lang: 'pt-BR',
      difficult: false,
      focus: true,
      complementary: false,
      pinned: false,
      favorite: false,
      folderId: 'f2',
      source: { type: 'foto', document: 'Caderno de Biologia (3 fotos)', pages: 3 },
      createdAt: daysFromNow(-22),
      lastStudiedAt: daysFromNow(-2),
      publication: { status: 'em_triagem', publicationId: 'pub2' }
    },
    {
      id: 'd3',
      ownerId: 'u1',
      name: 'Cálculo I',
      categoryId: 'superior',
      tags: ['derivadas', 'limites', 'integrais'],
      difficulty: 'dificil',
      lang: 'pt-BR',
      difficult: false,
      focus: false,
      complementary: false,
      pinned: true,
      favorite: false,
      folderId: null,
      source: { type: 'texto', document: 'Resumo colado', pages: 1 },
      createdAt: daysFromNow(-30),
      lastStudiedAt: daysFromNow(-1),
      publication: { status: 'nao_publicado' }
    },
    {
      id: 'd4',
      ownerId: 'u1',
      name: 'Farmacologia',
      categoryId: 'superior',
      tags: ['farmacocinética'],
      difficulty: 'medio',
      lang: 'pt-BR',
      difficult: false,
      focus: false,
      complementary: true,
      pinned: false,
      favorite: false,
      folderId: null,
      source: { type: 'pdf', document: 'Farmacologia básica - cap. 1.pdf', pages: 22 },
      createdAt: daysFromNow(-35),
      lastStudiedAt: daysFromNow(-12),
      publication: { status: 'nao_publicado' }
    },
    {
      id: 'd5',
      ownerId: 'u1',
      name: 'Phrasal verbs',
      categoryId: 'idiomas',
      tags: ['inglês', 'vocabulário'],
      difficulty: 'facil',
      lang: 'pt-BR',
      difficult: false,
      focus: false,
      complementary: false,
      pinned: false,
      favorite: false,
      folderId: null,
      source: { type: 'anki', document: 'phrasal-verbs.apkg', pages: null },
      createdAt: daysFromNow(-18),
      lastStudiedAt: daysFromNow(-3),
      publication: { status: 'nao_publicado' }
    },
    {
      id: 'd6',
      ownerId: 'u1',
      name: 'Direito Administrativo',
      categoryId: 'concursos',
      tags: ['administração pública', 'licitações'],
      difficulty: 'medio',
      lang: 'pt-BR',
      difficult: false,
      focus: false,
      complementary: false,
      pinned: false,
      favorite: false,
      folderId: 'f1',
      source: { type: 'pdf', document: 'Direito Administrativo - resumo.pdf', pages: 31 },
      createdAt: daysFromNow(-44),
      lastStudiedAt: daysFromNow(-20),
      publication: { status: 'aprovado', publicationId: 'pub1', publicId: 'p-adm-2026', version: 1 }
    }
  ]

  const cards = [
    card('d1', 1, 'O que são normas de eficácia contida?', 'Normas de aplicabilidade imediata que uma lei posterior pode restringir. Exemplo: liberdade de profissão (art. 5º, XIII).', { sched: sched({ dueInDays: 0, lapses: 3, difficulty: 7.2 }), origin: origin('Apostila Constitucional 2026.pdf', 12, 'as normas de eficácia contida possuem aplicabilidade imediata...') }),
    card('d1', 2, 'Quais são os princípios expressos da Administração Pública no art. 37?', 'Legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE).', { sched: sched({ dueInDays: 0 }), origin: origin('Apostila Constitucional 2026.pdf', 30, 'A administração pública direta e indireta obedecerá aos princípios...') }),
    card('d1', 3, 'Qual é o prazo para impetrar mandado de segurança?', '120 dias contados da ciência do ato impugnado (Lei 12.016/2009, art. 23).', { sched: sched({ dueInDays: 0 }), origin: origin('Apostila Constitucional 2026.pdf', 21, 'O direito de requerer mandado de segurança extinguir-se-á decorridos cento e vinte dias...') }),
    card('d1', 4, 'O que é cláusula pétrea?', 'Matéria que não pode ser objeto de emenda tendente a aboli-la: forma federativa, voto direto, secreto, universal e periódico, separação dos Poderes e direitos e garantias individuais (art. 60, §4º).', { sched: sched({ dueInDays: 0, lapses: 2, difficulty: 6.8 }), origin: origin('Apostila Constitucional 2026.pdf', 9, 'Não será objeto de deliberação a proposta de emenda tendente a abolir...') }),
    card('d1', 5, 'Para que serve o habeas data?', 'Assegurar o conhecimento ou a retificação de informações pessoais constantes de registros de entidades governamentais ou de caráter público.', { sched: sched({ dueInDays: 0 }), origin: origin('Apostila Constitucional 2026.pdf', 22, 'conceder-se-á habeas data para assegurar o conhecimento de informações...') }),
    card('d1', 6, 'Quem pode propor ADI?', 'Os legitimados do art. 103: Presidente, Mesas do Senado e da Câmara, Governadores, PGR, Conselho Federal da OAB, partidos com representação no Congresso, confederações sindicais e entidades de classe de âmbito nacional.', { sched: sched({ dueInDays: 0 }), origin: origin('Apostila Constitucional 2026.pdf', 40, 'Podem propor a ação direta de inconstitucionalidade...') }),
    card('d1', 7, 'Qual a diferença entre direitos de 1ª e 2ª geração?', '1ª geração: liberdades negativas (vida, liberdade, propriedade). 2ª geração: direitos sociais que exigem prestação do Estado (saúde, educação, trabalho).', { sched: sched({ dueInDays: 4 }) }),
    card('d1', 8, 'O que é o princípio da simetria?', 'Estados, DF e Municípios devem observar, em suas constituições e leis orgânicas, o modelo federal quando a Constituição assim impõe.', { sched: sched({ dueInDays: 9 }) }),

    card('d2', 1, 'Qual organela realiza a síntese de ATP?', 'A mitocôndria, pela fosforilação oxidativa nas cristas mitocondriais.', { sched: sched({ dueInDays: 0 }) }),
    card('d2', 2, 'Identifique a organela apontada pela seta.', 'Núcleo: armazena o DNA e controla a atividade celular.', { type: 'image', media: { kind: 'image', src: CELL_SVG, alt: 'Esquema de célula eucarionte com seta apontando para a estrutura central esférica', sizeKB: 4 }, sched: sched({ dueInDays: 0 }) }),
    card('d2', 3, 'Qual é a função dos ribossomos?', 'Síntese de proteínas a partir do RNA mensageiro.', { sched: sched({ dueInDays: 0 }) }),
    card('d2', 4, 'Descreva a estrutura da membrana plasmática.', 'Bicamada lipídica com proteínas inseridas (modelo do mosaico fluido); controla a entrada e a saída de substâncias.', { sched: sched({ dueInDays: 0 }) }),
    card('d2', 5, 'Qual a diferença entre célula procarionte e eucarionte?', 'Procarionte não tem núcleo delimitado nem organelas membranosas; eucarionte tem núcleo e organelas.', { sched: sched({ dueInDays: 0 }) }),
    card('d2', 6, 'O que faz o complexo de Golgi?', 'Modifica, empacota e endereça proteínas e lipídios; origina os lisossomos.', { sched: sched({ dueInDays: 6 }) }),

    card('d3', 1, 'Regra da cadeia: derive f(g(x)).', "f'(g(x)) · g'(x)", { sched: sched({ dueInDays: 0 }) }),
    card('d3', 2, 'Qual é a derivada de sen(x)?', 'cos(x)', { sched: sched({ dueInDays: 0 }) }),
    card('d3', 3, 'Pelo gráfico, qual é o limite de f(x) quando x tende a 2?', '3. O limite existe mesmo com f(2) indefinido, porque os valores se aproximam de 3 pelos dois lados.', { type: 'image', media: { kind: 'image', src: LIMIT_SVG, alt: 'Gráfico de uma curva crescente com um ponto aberto em x igual a 2 e y igual a 3', sizeKB: 3 }, sched: sched({ dueInDays: 0 }) }),
    card('d3', 4, 'Definição de derivada por limite.', "f'(a) = lim h→0 [f(a + h) − f(a)] / h", { sched: sched({ dueInDays: 0 }) }),
    card('d3', 5, 'Qual é a integral de 1/x dx?', 'ln|x| + C', { sched: sched({ dueInDays: 5 }) }),

    card('d4', 1, 'O que é meia-vida plasmática?', 'Tempo para a concentração do fármaco no plasma cair pela metade.', { sched: sched({ dueInDays: 11, stability: 30, lastDays: -12 }) }),
    card('d4', 2, 'Qual a diferença entre agonista e antagonista?', 'Agonista ativa o receptor; antagonista se liga sem ativar e bloqueia a ação do agonista.', { sched: sched({ dueInDays: 14, stability: 30, lastDays: -12 }) }),
    card('d4', 3, 'O que é biodisponibilidade?', 'Fração da dose administrada que atinge a circulação sistêmica inalterada.', { sched: sched({ dueInDays: 9, stability: 30, lastDays: -12 }) }),
    card('d4', 4, 'O que é efeito de primeira passagem?', 'Metabolização hepática antes de o fármaco chegar à circulação sistêmica, reduzindo a biodisponibilidade oral.', { sched: sched({ dueInDays: 16, stability: 30, lastDays: -12 }) }),
    card('d4', 5, 'O que é janela terapêutica?', 'Intervalo entre a concentração mínima eficaz e a concentração mínima tóxica.', { sched: sched({ dueInDays: 20, stability: 30, lastDays: -12 }) }),

    card('d5', 1, "O que significa 'to put off'?", 'Adiar, deixar para depois.', { sched: sched({ dueInDays: 0 }) }),
    card('d5', 2, 'Ouça e escreva o phrasal verb.', "'Give up': desistir.", { type: 'audio', media: { kind: 'audio', src: null, durationSec: 3, transcript: 'give up', alt: 'Áudio de 3 segundos com a pronúncia de give up' }, sched: sched({ dueInDays: 0 }) }),
    card('d5', 3, "O que significa 'to run out of'?", 'Ficar sem algo. Exemplo: We ran out of milk.', { sched: sched({ dueInDays: 0 }) }),
    card('d5', 4, "O que significa 'to look forward to'?", 'Aguardar com expectativa por algo.', { sched: sched({ dueInDays: 2 }) }),
    card('d5', 5, "O que significa 'to bring up'?", 'Criar (filhos) ou mencionar um assunto.', { sched: sched({ dueInDays: 7 }) }),
    card('d5', 6, "O que significa 'to turn down'?", 'Recusar; abaixar (o volume).', { sched: sched({ dueInDays: 3 }) }),

    card('d6', 1, 'Cite os princípios do art. 37 da CF.', 'Legalidade, impessoalidade, moralidade, publicidade e eficiência.', { sched: sched({ dueInDays: 12, stability: 40, lastDays: -20 }) }),
    card('d6', 2, 'O que é poder de polícia?', 'Atividade estatal que condiciona e limita direitos individuais em favor do interesse público.', { sched: sched({ dueInDays: 15, stability: 40, lastDays: -20 }) }),
    card('d6', 3, 'Qual a diferença entre licitação dispensada e dispensável?', 'Dispensada: a própria lei afasta a licitação. Dispensável: a Administração pode optar por não licitar nos casos previstos em lei.', { sched: sched({ dueInDays: 18, stability: 40, lastDays: -20 }) }),
    card('d6', 4, 'Conceito de autarquia.', 'Pessoa jurídica de direito público criada por lei para exercer atividade típica da Administração.', { sched: sched({ dueInDays: 22, stability: 40, lastDays: -20 }) }),
    card('d6', 5, 'Responsabilidade civil do Estado: qual é a regra geral?', 'Objetiva, na modalidade risco administrativo (art. 37, §6º).', { sched: sched({ dueInDays: 25, stability: 40, lastDays: -20 }) })
  ]

  const folders = [
    { id: 'f1', ownerId: 'u1', name: 'Concurso TRF', parentId: null, createdAt: daysFromNow(-40), shared: true, members: [{ id: 'm1', name: 'Camila Prado', contact: 'camila@exemplo.com', role: 'membro', since: daysFromNow(-20) }, { id: 'm2', name: 'João Vitor', contact: '+55 11 90000-1111', role: 'membro', since: daysFromNow(-9) }] },
    { id: 'f2', ownerId: 'u1', name: 'ENEM 2026', parentId: null, createdAt: daysFromNow(-22), shared: false, members: [] }
  ]

  return { decks, cards, folders }
}

const community = (id, authorId, name, categoryId, difficulty, lang, stats, extra = {}) => ({
  id,
  authorId,
  name,
  categoryId,
  difficulty,
  lang,
  version: extra.version || 1,
  publishedAt: extra.publishedAt || daysFromNow(-30),
  description: extra.description || '',
  tags: extra.tags || [],
  stats,
  reactions: extra.reactions || { '👏': 0, '🔥': 0, '🧠': 0, '💡': 0, '❤️': 0, '😂': 0 },
  publicId: extra.publicId || `p-${id}`,
  clonedFrom: extra.clonedFrom || null
})

const ccard = (deckId, n, front, back, extra = {}) => ({
  id: `${deckId}_c${n}`,
  deckId,
  type: 'text',
  front,
  back,
  media: null,
  lang: extra.lang || 'pt-BR',
  translation: extra.translation || null
})

export function communityContent() {
  const authors = [
    { id: 'a1', name: 'Helena Ruiz', handle: 'helena.bio', topic: 'Biologia', level: 8, points: 8420, badges: ['Aprovada Medicina UFMG 2018', 'Criadora verificada'], neuronsTotal: 2310, decksCount: 14, followers: 3200, bio: 'Professora de biologia. Cards curtos, uma ideia por vez.', lang: 'pt-BR' },
    { id: 'a2', name: 'Rafael Nogueira', handle: 'rafa.direito', topic: 'Direito', level: 6, points: 4100, badges: ['Aprovado OAB 2025'], neuronsTotal: 1120, decksCount: 9, followers: 870, bio: 'Concurseiro em recuperação. Decks de Direito baseados em jurisprudência.', lang: 'pt-BR' },
    { id: 'a3', name: 'Emily Carter', handle: 'emily.hist', topic: 'History', level: 4, points: 1500, badges: [], neuronsTotal: 640, decksCount: 5, followers: 210, bio: 'History teacher from Austin, TX. Cards in plain English.', lang: 'en' },
    { id: 'a4', name: 'Bia Fonseca', handle: 'bia.fisio', topic: 'Saúde', level: 7, points: 6050, badges: ['Aprovada ENEM 2024', 'Criadora do mês · Set/2026', 'Monitora de Fisiologia'], neuronsTotal: 1980, decksCount: 11, followers: 2450, bio: 'Estudante de medicina. Fisiologia sem decoreba.', lang: 'pt-BR', creatorOfMonth: true }
  ]

  const decks = [
    community('c1', 'a1', 'Bioquímica: Ciclo de Krebs', 'vestibular', 'medio', 'pt-BR', { studiedWeek: 1240, votes: 312, favorites: 890, comments: 3, clones: 140 }, { version: 3, publishedAt: daysFromNow(-6), description: 'As oito etapas do ciclo em cards de uma informação só.', tags: ['bioquímica', 'respiração celular'], reactions: { '👏': 120, '🔥': 88, '🧠': 200, '💡': 40, '❤️': 60, '😂': 5 } }),
    community('c2', 'a2', 'Direitos Fundamentais em 40 cards', 'concursos', 'dificil', 'pt-BR', { studiedWeek: 860, votes: 240, favorites: 610, comments: 1, clones: 95 }, { publishedAt: daysFromNow(-20), description: 'Art. 5º da CF/88 inteiro, com jurisprudência do STF.', tags: ['CF/88', 'art. 5º'], reactions: { '👏': 70, '🔥': 55, '🧠': 130, '💡': 22, '❤️': 31, '😂': 2 } }),
    community('c3', 'a3', 'US History: Road to Independence', 'medio', 'medio', 'en', { studiedWeek: 410, votes: 98, favorites: 260, comments: 0, clones: 30 }, { publishedAt: daysFromNow(-12), description: 'From the Stamp Act to the Declaration, one fact per card.', tags: ['american revolution', 'history'], reactions: { '👏': 30, '🔥': 12, '🧠': 44, '💡': 9, '❤️': 15, '😂': 1 } }),
    community('c4', 'a4', 'Fisiologia: Sistema Cardiovascular', 'superior', 'medio', 'pt-BR', { studiedWeek: 1510, votes: 402, favorites: 1120, comments: 0, clones: 210 }, { version: 2, publishedAt: daysFromNow(-4), description: 'Do ciclo cardíaco à regulação da pressão arterial.', tags: ['fisiologia', 'cardiologia'], reactions: { '👏': 210, '🔥': 160, '🧠': 300, '💡': 80, '❤️': 140, '😂': 12 } }),
    community('c5', 'a4', 'Inglês: Falsos cognatos', 'idiomas', 'facil', 'pt-BR', { studiedWeek: 730, votes: 150, favorites: 480, comments: 0, clones: 60 }, { publishedAt: daysFromNow(-15), description: 'Palavras que parecem, mas não são.', tags: ['inglês', 'vocabulário'], reactions: { '👏': 60, '🔥': 20, '🧠': 40, '💡': 70, '❤️': 33, '😂': 48 } }),
    community('c6', 'a2', 'Matemática Financeira para concursos', 'concursos', 'medio', 'pt-BR', { studiedWeek: 320, votes: 66, favorites: 190, comments: 0, clones: 22 }, { publishedAt: daysFromNow(-25), description: 'Juros simples, compostos e descontos.', tags: ['matemática', 'juros'], reactions: { '👏': 20, '🔥': 8, '🧠': 25, '💡': 14, '❤️': 6, '😂': 0 } }),
    community('c7', 'a1', 'Química Orgânica: funções', 'vestibular', 'facil', 'pt-BR', { studiedWeek: 540, votes: 120, favorites: 350, comments: 0, clones: 41 }, { publishedAt: daysFromNow(-9), description: 'Reconheça a função pelo grupo funcional.', tags: ['química', 'orgânica'], reactions: { '👏': 44, '🔥': 15, '🧠': 60, '💡': 28, '❤️': 19, '😂': 3 } })
  ]

  const cards = [
    ccard('c1', 1, 'Onde ocorre o ciclo de Krebs?', 'Na matriz mitocondrial.'),
    ccard('c1', 2, 'Qual molécula inicia o ciclo ao se combinar com o oxaloacetato?', 'Acetil-CoA, formando citrato.'),
    ccard('c1', 3, 'Quantas moléculas de CO₂ são liberadas por volta?', 'Duas.'),
    ccard('c1', 4, 'Quais coenzimas são reduzidas no ciclo?', 'NAD⁺ → NADH (3 por volta) e FAD → FADH₂ (1 por volta).'),
    ccard('c1', 5, 'Qual é o ganho direto de energia por volta?', '1 GTP, equivalente a 1 ATP.'),
    ccard('c1', 6, 'Qual enzima converte succinato em fumarato?', 'Succinato desidrogenase, ligada à membrana interna da mitocôndria.'),

    ccard('c2', 1, 'A casa é asilo inviolável. Quais são as exceções?', 'Flagrante delito, desastre, prestar socorro ou, durante o dia, por determinação judicial.'),
    ccard('c2', 2, 'É possível pena de morte no Brasil?', 'Só em caso de guerra declarada (art. 5º, XLVII, a).'),
    ccard('c2', 3, 'O que é o direito de resposta?', 'Direito proporcional ao agravo, além de indenização por dano material, moral ou à imagem.'),
    ccard('c2', 4, 'Prisão civil por dívida: quando é admitida?', 'Apenas para o devedor de alimentos (a do depositário infiel foi afastada pelo STF).'),
    ccard('c2', 5, 'O que garante o princípio do juiz natural?', 'Ninguém será processado nem sentenciado senão pela autoridade competente; vedado juízo ou tribunal de exceção.'),

    ccard('c3', 1, 'What was the Stamp Act of 1765?', 'A British tax on printed materials in the American colonies, one of the first direct taxes and a major cause of colonial protest.', { lang: 'en', translation: { 'pt-BR': { front: 'O que foi a Lei do Selo de 1765?', back: 'Um imposto britânico sobre materiais impressos nas colônias americanas, um dos primeiros impostos diretos e uma grande causa de protestos coloniais.' } } }),
    ccard('c3', 2, 'Who wrote most of the Declaration of Independence?', 'Thomas Jefferson, in June 1776.', { lang: 'en', translation: { 'pt-BR': { front: 'Quem escreveu a maior parte da Declaração de Independência?', back: 'Thomas Jefferson, em junho de 1776.' } } }),
    ccard('c3', 3, "What does 'no taxation without representation' mean?", 'Colonists argued Parliament could not tax them because they had no elected representatives in it.', { lang: 'en', translation: { 'pt-BR': { front: "O que significa 'sem representação não há tributação'?", back: 'Os colonos argumentavam que o Parlamento não podia tributá-los porque eles não tinham representantes eleitos nele.' } } }),
    ccard('c3', 4, 'When was the Boston Tea Party?', 'December 16, 1773.', { lang: 'en', translation: { 'pt-BR': { front: 'Quando foi a Festa do Chá de Boston?', back: '16 de dezembro de 1773.' } } }),
    ccard('c3', 5, 'What were the Intolerable Acts?', 'Laws passed in 1774 to punish Massachusetts after the Boston Tea Party, closing Boston Harbor and restricting self-government.', { lang: 'en', translation: { 'pt-BR': { front: 'O que foram as Leis Intoleráveis?', back: 'Leis aprovadas em 1774 para punir Massachusetts após a Festa do Chá de Boston, fechando o porto de Boston e restringindo o autogoverno.' } } }),

    ccard('c4', 1, 'Quais são as fases do ciclo cardíaco?', 'Sístole (contração) e diástole (relaxamento).'),
    ccard('c4', 2, 'O que é débito cardíaco?', 'Volume de sangue ejetado por minuto: frequência cardíaca × volume sistólico.'),
    ccard('c4', 3, 'Onde se origina o impulso elétrico do coração?', 'No nó sinoatrial, o marca-passo natural.'),
    ccard('c4', 4, 'O que a onda P representa no ECG?', 'A despolarização atrial.'),
    ccard('c4', 5, 'Qual sistema regula a pressão arterial a longo prazo?', 'O sistema renina-angiotensina-aldosterona, pelos rins.'),

    ccard('c5', 1, "'Pretend' significa pretender?", 'Não. Significa fingir. Pretender é intend.'),
    ccard('c5', 2, "'Actually' significa atualmente?", 'Não. Significa na verdade. Atualmente é currently.'),
    ccard('c5', 3, "'Push' significa puxar?", 'Não. Significa empurrar. Puxar é pull.'),
    ccard('c5', 4, "'Library' significa livraria?", 'Não. Significa biblioteca. Livraria é bookstore.'),
    ccard('c5', 5, "'Parents' significa parentes?", 'Não. Significa pais. Parentes é relatives.'),

    ccard('c6', 1, 'Fórmula do montante em juros simples.', 'M = C · (1 + i · t)'),
    ccard('c6', 2, 'Fórmula do montante em juros compostos.', 'M = C · (1 + i)^t'),
    ccard('c6', 3, 'O que é desconto comercial simples?', 'Desconto calculado sobre o valor nominal: D = N · i · t.'),
    ccard('c6', 4, 'Taxa efetiva × taxa nominal: qual a diferença?', 'A nominal é declarada por período diferente do de capitalização; a efetiva é a realmente aplicada por período de capitalização.'),

    ccard('c7', 1, 'Qual grupo funcional caracteriza os álcoois?', 'Hidroxila (–OH) ligada a carbono saturado.'),
    ccard('c7', 2, 'Qual grupo funcional caracteriza os aldeídos?', 'Carbonila na extremidade da cadeia (–CHO).'),
    ccard('c7', 3, 'Qual grupo funcional caracteriza os ácidos carboxílicos?', 'Carboxila (–COOH).'),
    ccard('c7', 4, 'Qual grupo funcional caracteriza as aminas?', 'Nitrogênio ligado a carbonos (–NH₂, –NHR, –NR₂).')
  ]

  const comments = [
    { id: 'cm1', deckId: 'c1', authorName: 'Juliana M.', authorId: 'x1', text: 'O card 4 me salvou na prova de bioquímica, obrigada!', createdAt: daysFromNow(-4), replies: [{ id: 'cm1r1', authorName: 'Helena Ruiz', authorId: 'a1', text: 'Que bom, Juliana! Publiquei a versão 3 com mais detalhes das coenzimas.', createdAt: daysFromNow(-3) }] },
    { id: 'cm2', deckId: 'c1', authorName: 'Pedro H.', authorId: 'x2', text: 'Acho que falta o card sobre a regulação do ciclo (isocitrato desidrogenase).', createdAt: daysFromNow(-2), replies: [{ id: 'cm2r1', authorName: 'Helena Ruiz', authorId: 'a1', text: 'Concordo, entra na próxima versão.', createdAt: daysFromNow(-2) }] },
    { id: 'cm3', deckId: 'c1', authorName: 'Ana Beatriz', authorId: 'x3', text: 'Tem tradução para inglês? Estudo com um colega de fora.', createdAt: daysFromNow(-1), replies: [] },
    { id: 'cm4', deckId: 'c2', authorName: 'Thiago L.', authorId: 'x4', text: 'Excelente para revisão de véspera.', createdAt: daysFromNow(-8), replies: [] },
    { id: 'cm5', deckId: null, materialId: 'm3', authorName: 'Camila Prado', authorId: 'x5', text: 'Não sabia que errar questão fácil pesava tanto. Vou mudar minha estratégia no simulado.', createdAt: hoursFromNow(-6), replies: [{ id: 'cm5r1', authorName: 'Rafael Nogueira', authorId: 'a2', text: 'Isso! Começa pelas que você domina e deixa as difíceis para o fim.', createdAt: hoursFromNow(-4) }] },
    { id: 'cm6', deckId: null, materialId: 'm1', authorName: 'Pedro H.', authorId: 'x2', text: 'Resumo perfeito para a véspera. Faltou só a fermentação.', createdAt: daysFromNow(-1), replies: [] }
  ]

  return { authors, decks, cards, comments }
}
