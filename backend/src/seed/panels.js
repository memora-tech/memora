import { daysFromNow, hoursFromNow } from '../lib/ids.js'

const NAMES = [
  'Alice Ramos', 'Bruno Sá', 'Carla Dias', 'Diego Luz', 'Eduarda Melo', 'Felipe Nunes', 'Gabriela Reis', 'Heitor Paz',
  'Isabela Cruz', 'João Pedro Lima', 'Karina Souza', 'Leonardo Brito', 'Mariana Costa', 'Nicolas Teles', 'Olívia Prado',
  'Paulo Vieira', 'Quésia Rocha', 'Rafaela Duarte', 'Samuel Freitas', 'Tainá Moura', 'Ulisses Campos', 'Vitória Assis',
  'Wesley Farias', 'Ximena Lopes', 'Yasmin Braga', 'Zeca Andrade', 'Ana Clara Pires', 'Bento Xavier', 'Cecília Torres', 'Davi Menezes'
]

function students(prefix, total, consented, offset) {
  return Array.from({ length: total }, (_, i) => {
    const name = NAMES[(i + offset) % NAMES.length]
    const consent = i < consented
    return {
      id: `${prefix}_s${i + 1}`,
      name,
      consent,
      projectionActive: consent,
      metrics: consent
        ? { cardsWeek: 60 + ((i * 37) % 140), accuracy: 62 + ((i * 13) % 33), streak: (i * 5) % 21, lastStudy: daysFromNow(-((i % 5) + 0)) }
        : null
    }
  })
}

export function seedPanels() {
  const parental = {
    guardian: { id: 'g1', name: 'Patrícia Alves', email: 'patricia.alves@exemplo.com', phone: '+55 11 98888-0001', verified: true, verifiedAt: daysFromNow(-35), method: 'documento + prova de vida', provider: 'Verificador homologado' },
    child: { id: 'u1', name: 'Lucas Alves', age: 15, birthDate: '2011-03-22', verifiedAt: daysFromNow(-35), documentDeletedAt: hoursFromNow(-35 * 24 + 22), documentHash: '9f1c…e2a7', verifiedBy: 'Verificador homologado' },
    permissions: {
      community: false,
      publicLink: false,
      externalMembers: false,
      schoolShare: false,
      whatsappInfo: false,
      notificationWindow: { start: '21:00', end: '07:00' }
    },
    requests: [
      { id: 'req1', type: 'community', title: 'Liberar comunidade', detail: 'Lucas quer seguir a criadora Helena Ruiz e comentar em decks.', createdAt: hoursFromNow(-5), status: 'pendente' },
      { id: 'req2', type: 'publicLink', title: 'Compartilhar link público', detail: 'Lucas quer enviar o deck "Citologia" para um colega pelo WhatsApp.', createdAt: daysFromNow(-1), status: 'pendente' }
    ],
    weeklySummary: {
      weekOf: daysFromNow(-6),
      studyDays: 5,
      cards: 132,
      minutes: 48,
      accuracy: 78,
      streak: 6,
      subjects: [
        { name: 'Citologia', cards: 54, accuracy: 81 },
        { name: 'Cálculo I', cards: 40, accuracy: 70 },
        { name: 'Phrasal verbs', cards: 38, accuracy: 84 }
      ],
      milestones: ['Aos 16 anos, as permissões da comunidade passam a ser configuráveis pelo próprio aluno, com seu acompanhamento.']
    },
    history: [
      { at: daysFromNow(-3), text: 'Você negou "Liberar membros externos em pastas".' },
      { at: daysFromNow(-10), text: 'Resumo semanal enviado por e-mail.' },
      { at: daysFromNow(-35), text: 'Verificação de idade concluída. Documentos apagados em 22 h.' }
    ]
  }

  const b2b = {
    tenant: { id: 't1', name: 'Colégio Horizonte', cnpj: '45.678.901/0001-22', sso: 'Google Workspace', dpa: { signedAt: daysFromNow(-60), version: 'DPA v1.2', status: 'ativo' }, isolation: 'Row-Level Security por tenant_id', plan: 'Licença anual · 400 alunos' },
    users: [
      { id: 'b1', name: 'Direção Colégio Horizonte', email: 'direcao@horizonte.edu.br', role: 'admin' },
      { id: 'b2', name: 'Marta Lins', email: 'marta.lins@horizonte.edu.br', role: 'coordenador' },
      { id: 'b3', name: 'Jonas Pereira', email: 'jonas.pereira@horizonte.edu.br', role: 'professor', subjects: ['Biologia'] },
      { id: 'b4', name: 'Secretaria', email: 'secretaria@horizonte.edu.br', role: 'leitura' }
    ],
    classes: [
      { id: 'k1', name: '3º A', year: 2026, semester: 2, subject: 'Biologia', teacherId: 'b3', room: 'Sala 12', students: students('k1', 28, 24, 0) },
      { id: 'k2', name: '3º B', year: 2026, semester: 2, subject: 'Biologia', teacherId: 'b3', room: 'Sala 14', students: students('k2', 26, 9, 7) },
      { id: 'k3', name: '2º A', year: 2026, semester: 2, subject: 'Química', teacherId: 'b3', room: 'Sala 8', students: students('k3', 30, 30, 15) }
    ],
    invites: [
      { id: 'inv1', contact: 'pedro.alves@aluno.horizonte.edu.br', classId: 'k1', method: 'e-mail', status: 'pendente', minor: true, guardianStatus: 'aguardando responsável', sentAt: daysFromNow(-2) },
      { id: 'inv2', contact: '+55 11 97777-2222', classId: 'k2', method: 'telefone', status: 'aceito', minor: false, guardianStatus: null, sentAt: daysFromNow(-5) },
      { id: 'inv3', contact: 'Código HRZ-3B-2026', classId: 'k2', method: 'código de turma', status: 'pendente', minor: null, guardianStatus: null, sentAt: daysFromNow(-1) }
    ],
    indicators: {
      byTeacher: [{ teacher: 'Jonas Pereira', classes: 3, consentedStudents: 63, avgAccuracy: 76, avgCardsWeek: 118 }],
      bySubject: [
        { subject: 'Biologia', consentedStudents: 33, avgAccuracy: 78, avgCardsWeek: 124 },
        { subject: 'Química', consentedStudents: 30, avgAccuracy: 73, avgCardsWeek: 110 }
      ],
      bySemester: [
        { label: '2026/1', avgAccuracy: 71, avgCardsWeek: 96 },
        { label: '2026/2', avgAccuracy: 76, avgCardsWeek: 118 }
      ],
      byYear: [
        { label: '2025', avgAccuracy: 69 },
        { label: '2026', avgAccuracy: 74 }
      ]
    },
    minAggregate: 10
  }

  const admin = {
    users: [
      { id: 'adm1', name: 'Ana Moderadora', role: 'moderador', areas: ['Biologia', 'Química'] },
      { id: 'adm2', name: 'Beto Suporte', role: 'suporte_n1' },
      { id: 'adm3', name: 'Carla Suporte', role: 'suporte_n2' },
      { id: 'adm4', name: 'Diego Comercial', role: 'comercial' },
      { id: 'adm5', name: 'Elisa Financeiro', role: 'financeiro' },
      { id: 'adm6', name: 'Fábio Compliance', role: 'compliance' },
      { id: 'adm7', name: 'Gabi Engenharia', role: 'engenharia' },
      { id: 'adm8', name: 'Hugo Moderador', role: 'moderador', areas: ['Direito'] }
    ],
    policy: { version: 'v2.1', publishedAt: daysFromNow(-14), url: '/politica-de-conteudo', changes: ['Regra nova sobre material protegido por direitos autorais', 'Prazo de contestação explícito: 30 dias'] },
    incidents: [
      { id: 'inc1', title: 'E-mails expostos em log de aplicação', detectedAt: daysFromNow(-40), status: 'encerrado', affected: 120, minorsAffected: 14, anpdNotifiedAt: daysFromNow(-38), holdersNotifiedAt: daysFromNow(-38), runbook: 'RB-SEC-03' }
    ],
    dpo: { name: 'Sócio-fundador (nomeação formal)', email: 'dpo@memora.app', appointedAt: daysFromNow(-90), replacementTrigger: 'Encarregado independente ao fechar a 1ª escola B2B ou atingir 10 mil contas, o que vier primeiro.', accounts: 6820, b2bSigned: 1, replacementDue: true },
    flags: [
      { key: 'ai_generation', label: 'Geração por IA', on: true, kill: false, integration: 'Bedrock / Vertex' },
      { key: 'gemini_pro_fallback', label: 'Fallback Gemini Pro (páginas ilegíveis)', on: true, kill: false, integration: 'Vertex AI' },
      { key: 'noa_autonomous', label: 'Ações autônomas de Nôa', on: true, kill: false, integration: 'interno' },
      { key: 'community_publish', label: 'Publicação na comunidade', on: true, kill: false, integration: 'interno' },
      { key: 'coupons_redeem', label: 'Resgate de cupons', on: true, kill: false, integration: 'API parceiros' },
      { key: 'whatsapp_informativo', label: 'WhatsApp informativo (2×/semana)', on: true, kill: false, integration: 'Meta Cloud API' },
      { key: 'payments', label: 'Cobrança (gateway)', on: true, kill: false, integration: 'Gateway de pagamento' }
    ],
    aiCosts: Array.from({ length: 14 }, (_, i) => ({ day: daysFromNow(-(13 - i)).slice(0, 10), costPerActiveUserBRL: Number((0.42 + ((i * 7) % 5) * 0.05).toFixed(2)), revenuePerActiveUserBRL: 0.98, thresholdPct: 60 })),
    noaQuality: [
      { action: 'mark_difficult', acceptance: 0.62, feedbackPositive: 0.71, days: 30 },
      { action: 'reorder_queue', acceptance: 0.48, feedbackPositive: 0.55, days: 30 },
      { action: 'suggest_reinforcement', acceptance: 0.34, feedbackPositive: 0.6, days: 30 },
      { action: 'adjust_goal', acceptance: 0.27, feedbackPositive: 0.5, days: 30 },
      { action: 'reminder_time', acceptance: 0.08, feedbackPositive: 0.3, days: 30, flagged: true },
      { action: 'reduce_load', acceptance: 0.41, feedbackPositive: 0.66, days: 30 }
    ],
    commercialAlerts: [
      { id: 'al1', partnerId: 'p4', type: 'queda_conversao', text: 'Lanchonete do Campus: conversão caiu 38% em 14 dias após esgotar o estoque.', at: daysFromNow(-1) },
      { id: 'al2', partnerId: 'p6', type: 'risco_renovacao', text: 'Óptica Vista Clara: contrato mínimo termina em 12 dias sem resposta ao aceite digital.', at: daysFromNow(-2) }
    ],
    churnRisk: [
      { userId: 'u9', name: 'Marina S.', signal: '5 reagendamentos em 7 dias', action: 'cupom de retenção enviado', at: daysFromNow(-1) },
      { userId: 'u10', name: 'Caio R.', signal: 'Premium sem gerar decks há 21 dias', action: 'desconto de renovação oferecido', at: daysFromNow(-3) }
    ],
    notificationTemplates: [
      { key: 'streak_risco', channel: 'push', category: 'lembretes', intensity: 'padrao', sent: 41280, delivered: 0.972, acted: 0.386, optOut: 0.004, disabled: false },
      { key: 'prova_proxima', channel: 'whatsapp', category: 'lembretes', intensity: 'padrao', sent: 12640, delivered: 0.981, acted: 0.442, optOut: 0.009, disabled: false },
      { key: 'meta_batida', channel: 'push', category: 'conquistas', intensity: 'leve', sent: 28910, delivered: 0.968, acted: 0.211, optOut: 0.002, disabled: false },
      { key: 'informativo_memoria', channel: 'whatsapp', category: 'informativo', intensity: 'leve', sent: 9870, delivered: 0.975, acted: 0.128, optOut: 0.026, disabled: true, disabledReason: 'Opt-out acima de 2%', disabledAt: daysFromNow(-3) },
      { key: 'cobranca_falhou', channel: 'push', category: 'conta', intensity: 'leve', sent: 1420, delivered: 0.991, acted: 0.612, optOut: 0.001, disabled: false, transactional: true },
      { key: 'volta_por_aqui', channel: 'push', category: 'lembretes', intensity: 'intenso', sent: 6310, delivered: 0.964, acted: 0.174, optOut: 0.019, disabled: false }
    ],
    notificationOptOutLimit: 0.02,
    teamPlan: { moderators: 6, support: 4, commercial: 2, sre: 1, reviewedAt: daysFromNow(-20) }
  }

  const partner = {
    partners: [
      { id: 'p1', name: 'Café Sinapse', cnpj: '12.345.678/0001-90', category: 'Alimentação', verified: true, approvalStages: ['Documentação validada', 'Aprovação comercial'], contract: { startedAt: daysFromNow(-60), minMonths: 3, positioningTier: 'Destaque na loja', positioningMonthlyBRL: 350, cpaBRL: 1.2, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: true, renewsAt: daysFromNow(30) }, contact: 'Renata Prado', email: 'renata@cafesinapse.com.br' },
      { id: 'p2', name: 'Papelaria Traço', cnpj: '23.456.789/0001-01', category: 'Papelaria', verified: true, contract: { startedAt: daysFromNow(-45), minMonths: 3, positioningTier: null, positioningMonthlyBRL: 0, cpaBRL: 1.5, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: true, renewsAt: daysFromNow(45) } },
      { id: 'p3', name: 'Livraria Página Viva', cnpj: '34.567.890/0001-12', category: 'Livros', verified: true, contract: { startedAt: daysFromNow(-20), minMonths: 3, positioningTier: null, positioningMonthlyBRL: 0, cpaBRL: 2.0, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: false, renewsAt: daysFromNow(70) } },
      { id: 'p4', name: 'Lanchonete do Campus', cnpj: '45.678.901/0001-23', category: 'Alimentação', verified: true, contract: { startedAt: daysFromNow(-80), minMonths: 3, positioningTier: null, positioningMonthlyBRL: 0, cpaBRL: 1.0, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: true, renewsAt: daysFromNow(10) } },
      { id: 'p5', name: 'StudyFlix', cnpj: '56.789.012/0001-34', category: 'Educação', verified: true, contract: { startedAt: daysFromNow(-30), minMonths: 3, positioningTier: 'Primeira posição', positioningMonthlyBRL: 900, cpaBRL: 4.0, commissionPct: 10, penalty: '1 mês do valor de posicionamento', acceptedDigitally: true, renewsAt: daysFromNow(60) } },
      { id: 'p6', name: 'Óptica Vista Clara', cnpj: '67.890.123/0001-45', category: 'Saúde', verified: false, approvalStages: ['Documentação validada'], contract: { startedAt: daysFromNow(-78), minMonths: 3, positioningTier: 'Destaque na loja', positioningMonthlyBRL: 350, cpaBRL: 1.8, commissionPct: 8, penalty: '1 mês do valor de posicionamento', acceptedDigitally: false, renewsAt: daysFromNow(12) } }
    ],
    positioningTable: [
      { tier: 'Sem posicionamento', monthlyBRL: 0, description: 'Aparece na loja por relevância.' },
      { tier: 'Destaque na loja', monthlyBRL: 350, description: 'Selo de destaque e prioridade na lista.' },
      { tier: 'Primeira posição', monthlyBRL: 900, description: 'Primeiro cupom da loja para todos os alunos.' },
      { tier: 'Banner na Carteira', monthlyBRL: 1500, description: 'Faixa visual na tela Carteira.' }
    ],
    conversion: {
      p1: {
        period: 'Últimos 30 dias',
        redemptions: 412,
        confirmedUse: 268,
        expired: 61,
        cells: [
          { label: '18 a 24 anos · SP capital', n: 180, shown: true },
          { label: '25 a 34 anos · SP capital', n: 64, shown: true },
          { label: '18 a 24 anos · interior SP', n: 31, shown: true },
          { label: '18 a 24 anos · RJ', n: 12, shown: false },
          { label: '35+ anos · SP capital', n: 8, shown: false }
        ],
        minCell: 20
      }
    },
    redemptions: [
      { id: 'rd1', partnerId: 'p1', code: 'MEM-7K2P-91QX', redeemedAt: daysFromNow(-20), validUntil: daysFromNow(10), status: 'emitido', campaignId: 'cp1' },
      { id: 'rd2', partnerId: 'p1', code: 'MEM-Q3ZD-77LM', redeemedAt: daysFromNow(-2), validUntil: daysFromNow(28), status: 'emitido', campaignId: 'cp1' },
      { id: 'rd3', partnerId: 'p1', code: 'MEM-8HNF-2C4V', redeemedAt: daysFromNow(-6), validUntil: daysFromNow(24), status: 'utilizado', usedAt: daysFromNow(-5), campaignId: 'cp1' },
      { id: 'rd4', partnerId: 'p1', code: 'MEM-AA21-B9KD', redeemedAt: daysFromNow(-40), validUntil: daysFromNow(-10), status: 'expirado', campaignId: 'cp1' }
    ]
  }

  return { parental, b2b, admin, partner }
}
