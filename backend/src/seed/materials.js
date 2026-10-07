import { daysFromNow, hoursFromNow } from '../lib/ids.js'

const reactions = (a = 0, b = 0, c = 0, d = 0, e = 0, f = 0) => ({ '👏': a, '🔥': b, '🧠': c, '💡': d, '❤️': e, '😂': f })

let counter = 0
const node = (label, children = [], note) => {
  counter += 1
  return { id: `n${counter}`, label, ...(note ? { note } : {}), children }
}

const material = (id, kind, authorId, title, categoryId, extra) => ({
  id,
  kind,
  ownerId: authorId,
  authorId,
  title,
  categoryId,
  tags: extra.tags || [],
  lang: extra.lang || 'pt-BR',
  description: extra.description,
  body: extra.body,
  aiGenerated: true,
  source: { channel: 'mcp', client: extra.client || 'Claude', connectionId: null },
  status: extra.status || 'aprovado',
  ...(extra.mcpReview ? { mcpReview: extra.mcpReview } : {}),
  publicationId: null,
  publishedAt: extra.status === 'privado' ? null : extra.publishedAt,
  createdAt: extra.createdAt || extra.publishedAt,
  updatedAt: extra.publishedAt || extra.createdAt,
  stats: extra.stats || { views: 0, favorites: 0 },
  reactions: extra.reactions || reactions()
})

export function seedMaterials() {
  counter = 0
  const cardiovascular = node('Sistema cardiovascular', [
    node('Coração', [node('Ciclo cardíaco', [node('Sístole', [], 'Contração e ejeção'), node('Diástole', [], 'Relaxamento e enchimento')]), node('Condução elétrica', [node('Nó sinoatrial', [], 'Marca-passo natural'), node('Nó atrioventricular'), node('Feixe de His')])]),
    node('Vasos', [node('Artérias', [], 'Levam sangue do coração'), node('Veias', [], 'Trazem sangue ao coração'), node('Capilares', [], 'Trocas com os tecidos')]),
    node('Pressão arterial', [node('Débito cardíaco × resistência'), node('Barorreceptores', [], 'Ajuste rápido'), node('Sistema renina-angiotensina', [], 'Ajuste de longo prazo')]),
    node('Circulações', [node('Pulmonar', [], 'Coração → pulmões → coração'), node('Sistêmica', [], 'Coração → corpo → coração')])
  ])
  counter = 0
  const organica = node('Funções orgânicas', [
    node('Oxigenadas', [node('Álcool', [], '–OH em carbono saturado'), node('Aldeído', [], '–CHO na ponta'), node('Cetona', [], 'C=O no meio da cadeia'), node('Ácido carboxílico', [], '–COOH')]),
    node('Nitrogenadas', [node('Amina', [], '–NH₂, –NHR, –NR₂'), node('Amida', [], '–CONH₂')]),
    node('Hidrocarbonetos', [node('Alcanos'), node('Alcenos'), node('Alcinos'), node('Aromáticos')])
  ])
  counter = 0
  const fsrs = node('Repetição espaçada', [
    node('Curva do esquecimento', [node('Ebbinghaus, 1885'), node('Queda rápida nas primeiras horas')]),
    node('Revisão ativa', [node('Recordar antes de ver a resposta'), node('Errar também consolida')]),
    node('Intervalos crescentes', [node('Estabilidade da memória'), node('Dificuldade do card')])
  ])

  return [
    material('m1', 'resumo', 'a1', 'Respiração celular em 5 minutos', 'vestibular', {
      tags: ['bioquímica', 'respiração celular'],
      description: 'Glicólise, ciclo de Krebs e cadeia respiratória com o saldo de ATP de cada etapa.',
      publishedAt: daysFromNow(-2),
      stats: { views: 2140, favorites: 312 },
      reactions: reactions(88, 40, 160, 52, 30, 2),
      body: {
        markdown: [
          '## Visão geral',
          'A respiração celular transforma a energia da glicose em **ATP**. Acontece em três etapas, uma no citoplasma e duas na mitocôndria.',
          '',
          '## 1. Glicólise',
          '- Onde: citoplasma',
          '- Glicose (6C) → 2 piruvatos (3C)',
          '- Saldo: **2 ATP** e 2 NADH',
          '',
          '## 2. Ciclo de Krebs',
          '- Onde: matriz mitocondrial',
          '- Cada acetil-CoA libera 2 CO₂',
          '- Por glicose: 2 ATP (GTP), 6 NADH e 2 FADH₂',
          '',
          '## 3. Cadeia respiratória',
          '- Onde: membrana interna da mitocôndria',
          '- O oxigênio é o **aceptor final** de elétrons e vira água',
          '- Produz cerca de **26 a 28 ATP** por fosforilação oxidativa',
          '',
          '## Para a prova',
          '1. Sem oxigênio, só a glicólise continua (fermentação).',
          '2. O CO₂ que você expira sai do ciclo de Krebs.',
          '3. Saldo total aproximado: **30 a 32 ATP** por glicose.'
        ].join('\n'),
        sources: [{ title: 'Alberts, Biologia Molecular da Célula, cap. 14', url: null }]
      }
    }),
    material('m2', 'mapa', 'a4', 'Mapa mental: sistema cardiovascular', 'superior', {
      tags: ['fisiologia', 'cardiologia'],
      description: 'Coração, vasos, pressão arterial e circulações em um mapa só.',
      publishedAt: daysFromNow(-1),
      client: 'ChatGPT',
      stats: { views: 1820, favorites: 404 },
      reactions: reactions(120, 70, 210, 64, 90, 4),
      body: { root: cardiovascular }
    }),
    material('m3', 'noticia', 'a2', 'ENEM 2026: entenda como a nota da TRI é calculada', 'vestibular', {
      tags: ['enem', 'tri'],
      description: 'Acertar questões fáceis pesa mais do que parece. Veja por que a coerência das respostas muda a sua nota.',
      publishedAt: hoursFromNow(-20),
      stats: { views: 3400, favorites: 520 },
      reactions: reactions(140, 98, 120, 180, 40, 10),
      body: {
        outlet: 'Blog do Rafa',
        url: 'https://blog.exemplo.com.br/enem-tri-como-funciona',
        sources: [],
        markdown: [
          'A Teoria de Resposta ao Item (TRI) não conta só quantas questões você acertou. Ela olha **quais** questões você acertou.',
          '',
          '## O que a TRI considera',
          '- **Dificuldade** de cada questão',
          '- **Discriminação**: quanto a questão separa quem sabe de quem não sabe',
          '- **Acerto ao acaso**: a chance de chutar e acertar',
          '',
          '## Por que a coerência importa',
          'Quem acerta questões difíceis mas erra fáceis tem padrão parecido com chute. A nota desse candidato tende a ser menor do que a de alguém com o mesmo número de acertos, mas coerentes.',
          '',
          '## Na prática',
          '1. Resolva primeiro as questões que você domina.',
          '2. Não deixe questões fáceis para o fim da prova.',
          '3. Chutar não tira pontos, mas não substitui a coerência.'
        ].join('\n')
      }
    }),
    material('m4', 'resumo', 'a2', 'Princípios da Administração Pública (LIMPE)', 'concursos', {
      tags: ['direito administrativo', 'art. 37'],
      description: 'Legalidade, impessoalidade, moralidade, publicidade e eficiência com exemplos de prova.',
      publishedAt: daysFromNow(-5),
      stats: { views: 980, favorites: 201 },
      reactions: reactions(40, 22, 70, 18, 9, 1),
      body: {
        markdown: [
          '## Onde está',
          'Art. 37, *caput*, da Constituição Federal de 1988.',
          '',
          '## Os cinco princípios',
          '- **Legalidade**: a administração só faz o que a lei autoriza.',
          '- **Impessoalidade**: o ato atende ao interesse público, não a pessoas.',
          '- **Moralidade**: além de legal, o ato precisa ser ético.',
          '- **Publicidade**: atos são públicos, salvo sigilo previsto em lei.',
          '- **Eficiência**: incluído pela EC 19/1998; busca resultado com economia.',
          '',
          '## Pegadinhas comuns',
          '1. Eficiência não estava no texto original da CF/88.',
          '2. Publicidade é requisito de eficácia, não de validade, do ato.'
        ].join('\n'),
        sources: [{ title: 'Constituição Federal de 1988, art. 37', url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm' }]
      }
    }),
    material('m5', 'mapa', 'a1', 'Funções orgânicas num mapa', 'vestibular', {
      tags: ['química', 'orgânica'],
      description: 'Oxigenadas, nitrogenadas e hidrocarbonetos com o grupo funcional de cada uma.',
      publishedAt: daysFromNow(-7),
      stats: { views: 760, favorites: 150 },
      reactions: reactions(30, 12, 55, 20, 8, 0),
      body: { root: organica }
    }),
    material('m6', 'noticia', 'a3', 'Why spaced repetition beats cramming', 'idiomas', {
      lang: 'en',
      tags: ['study tips', 'memory'],
      description: 'Reviewing at growing intervals keeps more of what you learn for longer, and the research goes back to 1885.',
      publishedAt: daysFromNow(-3),
      stats: { views: 540, favorites: 88 },
      reactions: reactions(20, 10, 33, 25, 6, 1),
      body: {
        outlet: "Emily's History Notes",
        url: 'https://notes.example.com/spaced-repetition',
        sources: [],
        markdown: [
          'Cramming feels productive, but most of it is gone within a week.',
          '',
          '## The forgetting curve',
          'Hermann Ebbinghaus showed in 1885 that memory drops fast in the first hours after learning.',
          '',
          '## What works instead',
          '- Recall the answer **before** looking at it',
          '- Review again right before you would forget',
          '- Let the intervals grow each time you get it right'
        ].join('\n')
      }
    }),
    {
      ...material('m8', 'noticia', 'u1', 'Como montei meu cronograma para a OAB', 'concursos', {
        tags: ['oab', 'cronograma'],
        description: 'O que funcionou nos meus primeiros três meses de estudo e o que eu mudaria.',
        status: 'privado',
        createdAt: daysFromNow(-1),
        body: {
          outlet: null,
          url: null,
          sources: [],
          markdown: [
            'Comecei com um cronograma bonito e irreal. Em duas semanas eu já estava atrasado.',
            '',
            '## O que mudou',
            '- **Blocos de 50 minutos** com uma matéria só',
            '- Revisão com flashcards todo dia, mesmo que só 15 minutos',
            '- Um dia por semana sem estudo novo, só revisão',
            '',
            '## O que eu mudaria',
            'Teria começado pelos temas que mais caem e deixado o resto para depois.'
          ].join('\n')
        }
      }),
      aiGenerated: false,
      source: { channel: 'app', client: null, connectionId: null }
    },
    material('m7', 'mapa', 'u1', 'Como funciona a repetição espaçada', 'outros', {
      mcpReview: 'pendente',
      tags: ['estudo'],
      description: 'Mapa que montei conversando com o Claude.',
      status: 'privado',
      createdAt: hoursFromNow(-3),
      body: { root: fsrs }
    })
  ]
}
