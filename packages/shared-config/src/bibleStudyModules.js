export const BIBLE_STUDY_MODULES = [
  {
    id: "passages_translations",
    label: "Passagens & Traducoes",
    summary: "Leitura de passagens, comparacao de versoes, canon e uso responsavel de traducoes.",
    categories: ["bible", "bible_translation", "canon"],
    keywords: ["passagem", "versao", "tradu", "canon", "septuaginta", "texto biblico"],
    instructions: [
      "Compare traducoes com sobriedade e explique quando a diferenca for lexical, contextual ou doutrinaria.",
      "Diferencie referencia biblica, tradicao de traducao e interpretacao teologica."
    ]
  },
  {
    id: "biblical_languages",
    label: "Hebraico, Aramaico & Grego",
    summary: "Idiomas originais, lexico basico, nuances textuais e limites de traducao.",
    categories: ["biblical_languages", "bible"],
    keywords: ["hebraico", "aramaico", "grego", "lexico", "morfologia", "original"],
    instructions: [
      "Explique nuances linguisticas sem fingir precisao academica absoluta quando o dado nao estiver confirmado.",
      "Mostre como o idioma original pode iluminar o texto sem anular boas traducoes modernas."
    ]
  },
  {
    id: "biblical_history",
    label: "Historia Biblica",
    summary: "Linha do tempo biblica, contexto politico, povos, imperios e periodos.",
    categories: ["biblical_history", "bible", "church_history"],
    keywords: ["historia biblica", "periodo biblico", "assiria", "babilonia", "roma", "israel", "juda"],
    instructions: [
      "Situe personagens, eventos e livros dentro da cronologia e do contexto historico-literario.",
      "Diga quando uma data e aproximada ou discutida."
    ]
  },
  {
    id: "church_history",
    label: "Igreja Primitiva & Historia da Igreja",
    summary: "Pais da igreja, concilios, heresias, expansao do cristianismo e igreja primitiva.",
    categories: ["church_history", "bible"],
    keywords: ["igreja primitiva", "pais da igreja", "concilio", "patristica", "historia da igreja"],
    instructions: [
      "Separe relato historico, tradicao e leitura confessional.",
      "Apresente panorama cronologico antes de detalhar controversias."
    ]
  },
  {
    id: "systematic_theology",
    label: "Teologia Sistematica",
    summary: "Doutrinas centrais, apologetica, escolas teologicas e comparacao entre tradicoes.",
    categories: ["theology", "apologetics", "bible"],
    keywords: ["teologia", "doutrina", "trindade", "soteriologia", "escatologia", "apologetica"],
    instructions: [
      "Compare escolas teologicas sem caricatura.",
      "Diferencie exegese, teologia biblica e teologia sistematica."
    ]
  },
  {
    id: "biblical_archaeology",
    label: "Arqueologia Biblica",
    summary: "Achados arqueologicos, inscricoes, geografia e limites da evidencia material.",
    categories: ["biblical_archaeology", "biblical_history"],
    keywords: ["arqueologia", "inscricao", "papiro", "manuscrito", "escavacao", "qran", "qumran"],
    instructions: [
      "Mostre o que a arqueologia apoia, ilustra ou nao consegue provar.",
      "Evite afirmar que evidencia material resolve sozinha questoes teologicas."
    ]
  }
]

export function listBibleStudyModules() {
  return BIBLE_STUDY_MODULES.map(module => ({
    id: module.id,
    label: module.label,
    summary: module.summary,
    categories: [...module.categories]
  }))
}

export function getBibleStudyModule(moduleId) {
  return BIBLE_STUDY_MODULES.find(module => module.id === moduleId) || null
}

export function getBibleStudyModules(moduleIds = []) {
  return moduleIds
    .map(moduleId => getBibleStudyModule(moduleId))
    .filter(Boolean)
}

export function inferBibleStudyModules(task = "", explicitModules = []) {
  const normalized = String(task || "").toLowerCase()
  const explicit = new Set(Array.isArray(explicitModules) ? explicitModules : [])

  BIBLE_STUDY_MODULES.forEach(module => {
    if (module.keywords.some(keyword => normalized.includes(keyword))) {
      explicit.add(module.id)
    }
  })

  return Array.from(explicit)
}
