import { daysFromNow, hoursFromNow } from '../lib/ids.js'

export function seedGroups() {
  return {
    groups: [
      {
        id: 'g_enem',
        name: 'ENEM 2026',
        tagline: 'Reta final rumo ao 2º dia de provas',
        description: 'Quem vai fazer o ENEM 2026 estuda junto aqui: decks, resumos e mapas das áreas que mais caem, ranking da turma e um mural para trocar estratégia.',
        examName: 'ENEM 2026',
        examDate: daysFromNow(23).slice(0, 10),
        categoryIds: ['vestibular', 'medio'],
        tags: ['bioquímica', 'respiração celular', 'química', 'orgânica', 'enem', 'tri'],
        color: 'brand',
        baseMembers: 18420,
        weeklyGoal: 40000,
        weeklyDone: 31260,
        rules: ['Cite a fonte quando trouxer conteúdo de fora.', 'Nada de vender material ou pedir contato fora do Memora.', 'Dúvida de conteúdo é sempre bem-vinda.']
      },
      {
        id: 'g_oab',
        name: 'OAB 1ª fase',
        tagline: 'Ética, Constitucional e o resto do edital',
        description: 'Grupo para a primeira fase da OAB. Foco em jurisprudência atualizada e revisão de véspera.',
        examName: 'OAB · 1ª fase',
        examDate: daysFromNow(54).slice(0, 10),
        categoryIds: ['concursos'],
        tags: ['cf/88', 'art. 5º', 'oab', 'direito'],
        color: 'violet',
        baseMembers: 6210,
        weeklyGoal: 12000,
        weeklyDone: 7480,
        rules: ['Indique o artigo ou a súmula sempre que possível.', 'Respeite quem está começando.']
      },
      {
        id: 'g_concursos',
        name: 'Concursos públicos',
        tagline: 'Administrativo, Constitucional e Matemática financeira',
        description: 'Para quem estuda para concursos de nível médio e superior. Materiais organizados por disciplina de edital.',
        examName: null,
        examDate: null,
        categoryIds: ['concursos'],
        tags: ['matemática', 'juros', 'limpe', 'administração pública'],
        color: 'green',
        baseMembers: 9840,
        weeklyGoal: 20000,
        weeklyDone: 16900,
        rules: ['Informe a banca quando falar de questão.', 'Sem spam de cursinho.']
      },
      {
        id: 'g_saude',
        name: 'Medicina e Saúde',
        tagline: 'Fisiologia, bioquímica e anatomia sem decoreba',
        description: 'Estudantes de medicina, enfermagem e áreas da saúde compartilhando o que funciona.',
        examName: null,
        examDate: null,
        categoryIds: ['superior'],
        tags: ['fisiologia', 'cardiologia', 'bioquímica'],
        color: 'red',
        baseMembers: 5120,
        weeklyGoal: 9000,
        weeklyDone: 8100,
        rules: ['Conteúdo clínico sempre com referência.']
      },
      {
        id: 'g_ingles',
        name: 'Inglês do zero ao fluente',
        tagline: 'Vocabulário, falsos cognatos e leitura',
        description: 'Prática diária de inglês com decks curtos e textos comentados.',
        examName: null,
        examDate: null,
        categoryIds: ['idiomas'],
        tags: ['inglês', 'vocabulário', 'history'],
        color: 'orange',
        baseMembers: 7730,
        weeklyGoal: 10000,
        weeklyDone: 4300,
        rules: ['Pode postar em inglês ou português.']
      }
    ],
    groupMembers: [
      { userId: 'u1', groupId: 'g_enem', joinedAt: daysFromNow(-40) },
      { userId: 'u1', groupId: 'g_oab', joinedAt: daysFromNow(-18) }
    ],
    groupPosts: [
      { id: 'gp1', groupId: 'g_enem', authorId: 'a1', authorName: 'Helena Ruiz', text: 'Faltando 3 semanas: priorizem Natureza e Matemática, que pesam mais na TRI. Deixei o mapa de funções orgânicas atualizado.', createdAt: hoursFromNow(-2), likes: 214 },
      { id: 'gp2', groupId: 'g_enem', authorId: 'x5', authorName: 'Camila Prado', text: 'Alguém montou flashcards de ecologia? Só achei de citologia.', createdAt: hoursFromNow(-5), likes: 31 },
      { id: 'gp3', groupId: 'g_enem', authorId: 'a4', authorName: 'Bia Fonseca', text: 'Transformei o resumo de respiração celular da Helena num diagrama de etapas. Ficou ótimo para revisão rápida.', createdAt: hoursFromNow(-9), likes: 122 },
      { id: 'gp4', groupId: 'g_oab', authorId: 'a2', authorName: 'Rafael Nogueira', text: 'Súmula vinculante 11 caiu nas duas últimas provas. Revisem antes do simulado de sábado.', createdAt: hoursFromNow(-4), likes: 88 },
      { id: 'gp5', groupId: 'g_concursos', authorId: 'a2', authorName: 'Rafael Nogueira', text: 'Deck de Matemática Financeira revisado com as fórmulas de desconto composto corrigidas.', createdAt: daysFromNow(-1), likes: 57 },
      { id: 'gp6', groupId: 'g_saude', authorId: 'a4', authorName: 'Bia Fonseca', text: 'Semana que vem sai a v3 do deck de cardiovascular, com ECG básico.', createdAt: daysFromNow(-2), likes: 140 },
      { id: 'gp7', groupId: 'g_ingles', authorId: 'a3', authorName: 'Emily Carter', text: 'Tip: read one short article a day and turn the new words into cards.', createdAt: daysFromNow(-1), likes: 64 }
    ]
  }
}
