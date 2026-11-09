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
  ...(extra.remixOf ? { remixOf: extra.remixOf } : {}),
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
  const fsrs = node('Repetição espaçada', [node('Curva do esquecimento', [node('Ebbinghaus, 1885'), node('Queda rápida nas primeiras horas')]), node('Revisão ativa', [node('Recordar antes de ver a resposta'), node('Errar também consolida')]), node('Intervalos crescentes', [node('Estabilidade da memória'), node('Dificuldade do card')])])

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
      body: { root: organica },
      remixOf: { id: 'c7', kind: 'flashcards', title: 'Química Orgânica: funções', authorId: 'a1', authorName: 'Helena Ruiz' }
    }),
    material('m9', 'mapa', 'a4', 'Diagrama: respiração celular etapa por etapa', 'vestibular', {
      tags: ['bioquímica', 'respiração celular'],
      description: 'O caminho da glicose até o ATP, com onde acontece e quanto rende cada etapa.',
      publishedAt: hoursFromNow(-9),
      client: 'ChatGPT',
      stats: { views: 980, favorites: 210 },
      reactions: reactions(40, 26, 90, 33, 12, 1),
      body: {
        layout: 'diagrama',
        root: node('Respiração celular', [
          node('Glicólise', [node('Citoplasma', [], 'Não precisa de oxigênio'), node('Glicose → 2 piruvatos'), node('Saldo: 2 ATP + 2 NADH')]),
          node('Ciclo de Krebs', [node('Matriz mitocondrial'), node('Acetil-CoA → CO₂'), node('Saldo: 2 ATP + NADH + FADH₂')]),
          node('Cadeia respiratória', [node('Cristas mitocondriais'), node('O₂ é o aceptor final', [], 'Forma água'), node('Saldo: cerca de 34 ATP')])
        ])
      },
      remixOf: { id: 'm1', kind: 'resumo', title: 'Respiração celular em 5 minutos', authorId: 'a1', authorName: 'Helena Ruiz' }
    }),
    material('m10', 'quiz', 'a2', 'Quiz: princípios da Administração Pública', 'concursos', {
      tags: ['direito administrativo', 'art. 37', 'limpe'],
      description: 'Seis questões no estilo FGV e Cebraspe sobre o LIMPE, com gabarito comentado.',
      publishedAt: hoursFromNow(-5),
      client: 'Claude',
      stats: { views: 1320, favorites: 260 },
      reactions: reactions(38, 30, 72, 25, 9, 2),
      body: {
        questions: [
          { id: 'q1', prompt: 'Nomear o próprio cônjuge para cargo em comissão na mesma repartição fere principalmente qual princípio?', options: ['Legalidade', 'Impessoalidade', 'Moralidade', 'Publicidade', 'Eficiência'], answer: 2, explanation: 'A Súmula Vinculante 13 veda o nepotismo com base na moralidade administrativa.' },
          { id: 'q2', prompt: 'Para o administrador público, o princípio da legalidade significa que ele:', options: ['Pode fazer tudo o que a lei não proíbe', 'Só pode fazer o que a lei autoriza', 'Segue a vontade do superior hierárquico', 'Age conforme a conveniência do momento'], answer: 1, explanation: 'O particular faz o que a lei não proíbe; a Administração, só o que a lei permite.' },
          { id: 'q3', prompt: 'Uma placa de obra com o nome e a foto do prefeito viola qual princípio?', options: ['Impessoalidade', 'Eficiência', 'Legalidade', 'Continuidade'], answer: 0, explanation: 'O art. 37, § 1º, proíbe promoção pessoal em publicidade de atos e obras.' },
          { id: 'q4', prompt: 'O princípio da eficiência foi incluído no art. 37 por qual emenda constitucional?', options: ['EC 1/1992', 'EC 19/1998', 'EC 45/2004', 'EC 103/2019'], answer: 1, explanation: 'A Reforma Administrativa de 1998 (EC 19) acrescentou a eficiência.' },
          { id: 'q5', prompt: 'A publicação de atos oficiais na imprensa oficial está ligada principalmente a:', options: ['Publicidade', 'Moralidade', 'Impessoalidade', 'Autotutela'], answer: 0, explanation: 'A publicidade é condição de eficácia dos atos e garante o controle social.' },
          { id: 'q6', prompt: 'A exigência de concurso público para cargos efetivos concretiza sobretudo:', options: ['Eficiência e publicidade', 'Impessoalidade e moralidade', 'Legalidade estrita apenas', 'Supremacia do interesse privado'], answer: 1, explanation: 'O concurso trata todos de forma igual e afasta favorecimentos.' }
        ]
      },
      remixOf: { id: 'm4', kind: 'resumo', title: 'Princípios da Administração Pública (LIMPE)', authorId: 'a2', authorName: 'Rafael Nogueira' }
    }),
    material('m11', 'linha', 'a1', 'Linha do tempo da genética: de Mendel ao CRISPR', 'vestibular', {
      tags: ['genética', 'história da ciência', 'biologia'],
      description: 'Oito marcos que caem no ENEM, com o que cada descoberta mudou.',
      publishedAt: hoursFromNow(-14),
      client: 'Gemini',
      stats: { views: 870, favorites: 175 },
      reactions: reactions(26, 18, 61, 30, 11, 0),
      body: {
        events: [
          { id: 'e1', when: '1866', label: 'Mendel publica as leis da hereditariedade', note: 'Ervilhas, dominância e segregação dos fatores.' },
          { id: 'e2', when: '1900', label: 'Redescoberta de Mendel', note: 'De Vries, Correns e Tschermak chegam aos mesmos resultados.' },
          { id: 'e3', when: '1910', label: 'Morgan e as moscas-das-frutas', note: 'Genes ficam nos cromossomos; herança ligada ao sexo.' },
          { id: 'e4', when: '1944', label: 'DNA é o material genético', note: 'Experimento de Avery, MacLeod e McCarty.' },
          { id: 'e5', when: '1953', label: 'Dupla hélice do DNA', note: 'Watson e Crick, a partir da imagem de Rosalind Franklin.' },
          { id: 'e6', when: '1973', label: 'Primeiro DNA recombinante', note: 'Nasce a engenharia genética.' },
          { id: 'e7', when: '2003', label: 'Projeto Genoma Humano concluído', note: 'Cerca de 20 mil genes codificadores de proteína.' },
          { id: 'e8', when: '2012', label: 'CRISPR-Cas9 como editor de genes', note: 'Doudna e Charpentier; Nobel de Química em 2020.' }
        ]
      }
    }),
    material('m12', 'quiz', 'u1', 'Quiz: ciclo cardíaco', 'superior', {
      mcpReview: 'pendente',
      tags: ['fisiologia', 'coração'],
      description: 'Quatro questões que montei com o ChatGPT para revisar antes da prova.',
      status: 'privado',
      createdAt: hoursFromNow(-1),
      client: 'ChatGPT',
      body: {
        questions: [
          { id: 'q1', prompt: 'Em qual fase do ciclo cardíaco os ventrículos ejetam sangue?', options: ['Diástole', 'Sístole', 'Contração isovolumétrica', 'Enchimento rápido'], answer: 1, explanation: 'Na sístole ventricular as valvas semilunares se abrem e o sangue é ejetado.' },
          { id: 'q2', prompt: 'Qual estrutura é o marca-passo natural do coração?', options: ['Nó atrioventricular', 'Feixe de His', 'Nó sinoatrial', 'Fibras de Purkinje'], answer: 2, explanation: 'O nó sinoatrial dispara entre 60 e 100 vezes por minuto.' },
          { id: 'q3', prompt: 'A primeira bulha cardíaca (B1) corresponde ao fechamento das valvas:', options: ['Atrioventriculares', 'Semilunares', 'Aórtica e mitral', 'Pulmonar e tricúspide'], answer: 0, explanation: 'B1 marca o início da sístole, com o fechamento da mitral e da tricúspide.' },
          { id: 'q4', prompt: 'Débito cardíaco é o produto de:', options: ['Pressão × resistência', 'Frequência cardíaca × volume sistólico', 'Volume diastólico × pressão', 'Frequência × pressão arterial'], answer: 1, explanation: 'DC = FC × VS, em litros por minuto.' }
        ]
      }
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
        markdown: ['Cramming feels productive, but most of it is gone within a week.', '', '## The forgetting curve', 'Hermann Ebbinghaus showed in 1885 that memory drops fast in the first hours after learning.', '', '## What works instead', '- Recall the answer **before** looking at it', '- Review again right before you would forget', '- Let the intervals grow each time you get it right'].join(
          '\n'
        )
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
          markdown: ['Comecei com um cronograma bonito e irreal. Em duas semanas eu já estava atrasado.', '', '## O que mudou', '- **Blocos de 50 minutos** com uma matéria só', '- Revisão com flashcards todo dia, mesmo que só 15 minutos', '- Um dia por semana sem estudo novo, só revisão', '', '## O que eu mudaria', 'Teria começado pelos temas que mais caem e deixado o resto para depois.'].join(
            '\n'
          )
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
