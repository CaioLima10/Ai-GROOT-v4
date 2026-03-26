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
      "ai_ml_math"
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
    recommendedPromptPacks: ["gemini_research", "scientific_rigor", "academic_rigor"],
    focusAreas: [
      "soil_fertility",
      "crop_health_protection",
      "precision_agriculture",
      "irrigation_water",
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
    recommendedPromptPacks: ["chatgpt_reasoning", "gemini_research", "academic_rigor"],
    focusAreas: [
      "personal_finance",
      "corporate_finance",
      "accounting_controls",
      "valuation_investment",
      "macro_risk"
    ],
    scholarlyPrompts: [
      "Explique cenário, risco, caixa, governança, sensibilidade e horizonte temporal.",
      "Diferencie conceito, hipótese financeira e recomendação profissional individual.",
      "Quando o tema depender de dado atual, diga isso claramente."
    ]
  }
}

export const PLANNED_MODULES = [
  {
    id: "medicine_health",
    label: "Saude & Medicina",
    summary: "Leitura de exames, fundamentos biomédicos, segurança do paciente e educação em saúde com forte cautela."
  },
  {
    id: "law_policy",
    label: "Direito & Politicas Publicas",
    summary: "Leitura normativa, estrutura legal comparada, regulação, compliance e políticas públicas."
  },
  {
    id: "product_design_ux",
    label: "Produto, UX & Design",
    summary: "Pesquisa de produto, UX writing, design systems, fluxos, acessibilidade e decisão de produto."
  },
  {
    id: "data_ai_ml",
    label: "Dados, IA & MLOps",
    summary: "Modelagem de dados, pipelines, experimentação, inferência, avaliação, MLOps e governança."
  },
  {
    id: "education_pedagogy",
    label: "Educacao & Pedagogia",
    summary: "Didática, currículo, avaliação, progressão de aprendizagem e adaptação por nível."
  },
  {
    id: "operations_logistics",
    label: "Operacoes & Logistica",
    summary: "Processos, SLA, cadeia logística, gargalos, confiabilidade e otimização operacional."
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
