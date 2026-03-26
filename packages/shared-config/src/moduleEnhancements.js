import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"
import { DOMAIN_MODULES } from "./domainModules.js"

export const MODULE_ENHANCEMENT_PLANS = {
  developer: {
    id: "developer",
    label: DOMAIN_MODULES.developer.label,
    academicDirection: "engenharia profissional com rigor de arquitetura, qualidade e operacao",
    recommendedPromptPacks: ["github_copilot_engineering", "codex_execution", "enterprise_architecture"],
    focusAreas: [
      "backend_systems",
      "language_specialists",
      "framework_ecosystems",
      "data_platforms",
      "cloud_devops",
      "testing_quality",
      "security_engineering",
      "ai_ml_engineering"
    ],
    scholarlyPrompts: [
      "Separe causa raiz, evidência, hipótese, patch mínimo, validação e plano anti-regressão.",
      "Diferencie solução tática, solução estrutural e risco residual.",
      "Trate incidentes como problema de sistema: código, dados, deploy, observabilidade e operação."
    ]
  },
  bible: {
    id: "bible",
    label: DOMAIN_MODULES.bible.label,
    academicDirection: "estudo bíblico e teológico em nível exegético, histórico e pastoral responsável",
    recommendedPromptPacks: ["chatgpt_reasoning", "gemini_research", "academic_rigor", "theological_scholarship"],
    focusAreas: BIBLE_STUDY_MODULES.map(module => module.id),
    scholarlyPrompts: [
      "Separe texto, contexto histórico, tradição confessional e interpretação.",
      "Diferencie exegese, teologia bíblica, teologia sistemática e aplicação pastoral.",
      "Quando houver divergência, diga claramente onde há consenso e onde há escola."
    ]
  },
  history_archaeology: {
    id: "history_archaeology",
    label: DOMAIN_MODULES.history_archaeology.label,
    academicDirection: "historiografia crítica com arqueologia, epigrafia e cronologia",
    recommendedPromptPacks: ["gemini_research", "academic_rigor"],
    focusAreas: [
      "historiography_method",
      "ancient_near_east",
      "archaeology_field_methods",
      "epigraphy_textual_witness"
    ],
    scholarlyPrompts: [
      "Use evidência material, consenso acadêmico, inferência e limite metodológico como blocos fixos.",
      "Não trate tradição popular ou leitura apologética como fato estabelecido.",
      "Explique a força relativa de cada tipo de fonte."
    ]
  },
  research: {
    id: "research",
    label: DOMAIN_MODULES.research.label,
    academicDirection: "método de pesquisa, comparação de fontes e síntese orientada a decisão",
    recommendedPromptPacks: ["gemini_research", "academic_rigor", "scientific_rigor"],
    focusAreas: [
      "research_design",
      "source_criticism",
      "literature_review",
      "benchmark_evaluation",
      "synthesis_reporting"
    ],
    scholarlyPrompts: [
      "Estruture em pergunta, critérios, evidência, risco, lacuna e decisão provisória.",
      "Diferencie fato observável, tradeoff, inferência e ponto que ainda depende de benchmark.",
      "Nunca simule atualização ao vivo se ela não existir na execução."
    ]
  },
  cybersecurity: {
    id: "cybersecurity",
    label: DOMAIN_MODULES.cybersecurity.label,
    academicDirection: "segurança defensiva com postura profissional de AppSec, IR e proteção de dados",
    recommendedPromptPacks: ["codex_execution", "defensive_security_ops", "academic_rigor"],
    focusAreas: [
      "appsec_secure_coding",
      "cloud_identity",
      "incident_response",
      "threat_detection_monitoring",
      "privacy_data_protection"
    ],
    scholarlyPrompts: [
      "Explique ameaça, superfície de ataque, impacto, mitigação, monitoramento e recuperação.",
      "Mantenha foco estritamente defensivo, legal e ético.",
      "Quando houver dado sensível, trate memória, analytics e retenção como parte do risco."
    ]
  },
  games_logic: {
    id: "games_logic",
    label: DOMAIN_MODULES.games_logic.label,
    academicDirection: "didática estratégica com progressão, treino e teoria de decisão",
    recommendedPromptPacks: ["chatgpt_reasoning", "academic_rigor"],
    focusAreas: [
      "chess_training",
      "logic_puzzles",
      "rpg_systems",
      "music_theory_practice",
      "game_design_balance"
    ],
    scholarlyPrompts: [
      "Ensine por progressão: princípio, erro comum, treino e critério de revisão.",
      "Não entregue só a resposta; entregue o raciocínio verificável.",
      "Quando falar de game design, una sistema, balanceamento e experiência do jogador."
    ]
  },
  math_science: {
    id: "math_science",
    label: DOMAIN_MODULES.math_science.label,
    academicDirection: "rigor matemático e método científico com intuição e validação",
    recommendedPromptPacks: ["chatgpt_reasoning", "scientific_rigor", "academic_rigor"],
    focusAreas: [
      "mathematics_foundations",
      "statistics_data_analysis",
      "physics_engineering",
      "chemistry_materials",
      "biology_life_science",
      "ai_ml_math",
      "computational_science"
    ],
    scholarlyPrompts: [
      "Explique definição, intuição, formalização, verificação e hipótese usada.",
      "Use unidade, ordem de grandeza, validação experimental ou checagem dimensional quando aplicável.",
      "Diferencie modelo, aproximação e fato medido."
    ]
  },
  agribusiness: {
    id: "agribusiness",
    label: DOMAIN_MODULES.agribusiness.label,
    academicDirection: "agro orientado a campo com integração entre agronomia, telemetria e gestão",
    recommendedPromptPacks: ["gemini_research", "scientific_rigor", "academic_rigor", "agro_field_intelligence"],
    focusAreas: [
      "soil_fertility",
      "crop_health_protection",
      "precision_agriculture",
      "irrigation_water",
      "weather_forecasting",
      "harvest_operations",
      "smart_harvest_systems",
      "agro_gpts_automation",
      "agro_business_management"
    ],
    scholarlyPrompts: [
      "Relacione observação de campo, hipótese agronômica, risco operacional e validação local.",
      "Diferencie plano de decisão, experimento de talhão e recomendação final.",
      "Quando houver manejo sensível, peça validação local com agrônomo."
    ]
  },
  finance: {
    id: "finance",
    label: DOMAIN_MODULES.finance.label,
    academicDirection: "finanças com leitura executiva, risco e decisão sob incerteza",
    recommendedPromptPacks: ["chatgpt_reasoning", "gemini_research", "academic_rigor", "fintech_systems"],
    focusAreas: [
      "personal_finance",
      "corporate_finance",
      "accounting_controls",
      "valuation_investment",
      "payments_fintech_apps",
      "billing_revenue_ops",
      "banking_controls_compliance",
      "macro_risk"
    ],
    scholarlyPrompts: [
      "Explique cenário, risco, caixa, governança, sensibilidade e horizonte temporal.",
      "Diferencie conceito, hipótese financeira e recomendação profissional individual.",
      "Quando o tema depender de dado atual, diga isso claramente."
    ]
  },
  product_design_ux: {
    id: "product_design_ux",
    label: DOMAIN_MODULES.product_design_ux.label,
    academicDirection: "produto e design com rigor de pesquisa, decisão, copy e interface",
    recommendedPromptPacks: ["chatgpt_reasoning", "ux_product_strategy", "academic_rigor"],
    focusAreas: [
      "ux_research",
      "ui_design_systems",
      "ux_writing_content",
      "product_strategy"
    ],
    scholarlyPrompts: [
      "Diferencie problema de entendimento, problema de fluxo e problema de estratégia de produto.",
      "Relacione pesquisa, hipótese, interface, métrica e impacto no negócio.",
      "Quando revisar uma experiência, una clareza, acessibilidade, confiança e implementação."
    ]
  },
  data_ai_ml: {
    id: "data_ai_ml",
    label: DOMAIN_MODULES.data_ai_ml.label,
    academicDirection: "engenharia de dados e IA com benchmark, operação e governança",
    recommendedPromptPacks: ["codex_execution", "data_ml_systems", "scientific_rigor", "academic_rigor"],
    focusAreas: [
      "data_engineering",
      "analytics_bi",
      "mlops_evaluation",
      "llm_prompt_systems"
    ],
    scholarlyPrompts: [
      "Diferencie qualidade do dado, qualidade do modelo e qualidade da operação em produção.",
      "Sempre conecte benchmark, custo, latência, drift e rollback.",
      "Não trate automação analítica ou de IA como confiável sem avaliação e monitoramento."
    ]
  },
  education_pedagogy: {
    id: "education_pedagogy",
    label: DOMAIN_MODULES.education_pedagogy.label,
    academicDirection: "pedagogia aplicada com progressão, adaptação e avaliação formativa",
    recommendedPromptPacks: ["chatgpt_reasoning", "pedagogical_design", "academic_rigor"],
    focusAreas: [
      "lesson_planning",
      "assessment_feedback",
      "adaptive_teaching",
      "curriculum_learning_path"
    ],
    scholarlyPrompts: [
      "Planeje ensino por objetivo, atividade, evidência e revisão.",
      "Adapte conteúdo por nível sem abandonar o conceito central.",
      "Use avaliação para orientar o próximo passo de aprendizagem."
    ]
  },
  operations_logistics: {
    id: "operations_logistics",
    label: DOMAIN_MODULES.operations_logistics.label,
    academicDirection: "operações com foco em fluxo, gargalo, confiabilidade e cadeia logística",
    recommendedPromptPacks: ["enterprise_architecture", "academic_rigor"],
    focusAreas: [
      "process_mapping",
      "warehouse_distribution",
      "planning_procurement",
      "service_reliability_ops"
    ],
    scholarlyPrompts: [
      "Mapeie entrada, espera, restrição, SLA e recuperação operacional.",
      "Diferencie capacidade teórica, capacidade real e gargalo dominante.",
      "Explique custo, lead time, qualidade e resiliência como variáveis juntas."
    ]
  },
  medicine_health: {
    id: "medicine_health",
    label: DOMAIN_MODULES.medicine_health.label,
    academicDirection: "educacao em saude com cautela clinica, prevencao e triagem segura",
    recommendedPromptPacks: ["chatgpt_reasoning", "scientific_rigor", "clinical_caution"],
    focusAreas: [
      "health_education",
      "exam_literacy",
      "clinical_safety_triage",
      "public_health_prevention"
    ],
    scholarlyPrompts: [
      "Explique conceito de saúde com clareza, limite e necessidade de validação clínica.",
      "Nunca trate urgência como tema teórico.",
      "Diferencie educação em saúde, leitura orientativa e decisão médica."
    ]
  },
  law_policy: {
    id: "law_policy",
    label: DOMAIN_MODULES.law_policy.label,
    academicDirection: "leitura regulatoria e juridica com compliance, privacidade e impacto publico",
    recommendedPromptPacks: ["chatgpt_reasoning", "academic_rigor", "policy_compliance"],
    focusAreas: [
      "legal_reading_structure",
      "compliance_governance",
      "privacy_regulation",
      "public_policy_analysis"
    ],
    scholarlyPrompts: [
      "Diferencie texto normativo, interpretação, impacto prático e ponto de ambiguidade.",
      "Explique compliance como combinação de regra, processo, evidência e governança.",
      "Quando houver risco regulatório, diga o que exige validação profissional."
    ]
  }
}

export const PLANNED_MODULES = [
  {
    id: "media_communication",
    label: "Midia & Comunicacao",
    summary: "Storytelling, estratégia editorial, roteiro, posicionamento e comunicação institucional."
  },
  {
    id: "manufacturing_industry",
    label: "Industria & Manufatura",
    summary: "Processos industriais, qualidade, manutenção, produção e melhoria contínua."
  },
  {
    id: "psychology_support",
    label: "Psicologia & Apoio Humano",
    summary: "Psicoeducação, regulação emocional e comunicação de apoio com fortes limites de segurança."
  },
  {
    id: "real_estate_construction",
    label: "Imoveis & Construcao",
    summary: "Projetos, obras, orçamento, cronograma, segurança e decisão imobiliária."
  },
  {
    id: "language_translation",
    label: "Idiomas & Traducao",
    summary: "Tradução, adaptação cultural, ensino de idiomas e comunicação multilíngue."
  },
  {
    id: "sports_performance",
    label: "Esportes & Performance",
    summary: "Treino, periodização, análise de desempenho e educação esportiva."
  }
]

export function getModuleEnhancementPlan(moduleId) {
  return MODULE_ENHANCEMENT_PLANS[moduleId] || null
}

export function listModuleEnhancementPlans() {
  return Object.values(MODULE_ENHANCEMENT_PLANS).map(plan => ({
    id: plan.id,
    label: plan.label,
    academicDirection: plan.academicDirection,
    recommendedPromptPacks: [...plan.recommendedPromptPacks],
    focusAreas: [...plan.focusAreas],
    scholarlyPrompts: [...plan.scholarlyPrompts]
  }))
}

export function listPlannedModules() {
  return PLANNED_MODULES.map(module => ({ ...module }))
}
