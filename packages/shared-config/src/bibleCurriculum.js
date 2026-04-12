export const BIBLE_LEARNING_TRACKS = [
  {
    id: "biblical_foundations",
    label: "Fundamentos Biblicos",
    summary: "Base segura para leitura, panorama do canon e discipulado inicial.",
    assistantProfile: "adaptive_teacher",
    activeModules: ["bible"],
    bibleStudyModules: [
      "passages_translations",
      "study_methods_hermeneutics",
      "devotional_practice",
      "sunday_school_curriculum"
    ],
    promptPacks: ["chatgpt_reasoning", "christian_public_care", "pedagogical_design"],
    preferredBibleCode: "NAA",
    ministryFocus: "new_believers",
    depthPreference: "balanced",
    steps: [
      {
        id: "foundation_storyline",
        label: "Panorama da narrativa",
        summary: "Entender o fio da historia biblica de Genesis ao Apocalipse.",
        goal: "Conectar criacao, queda, alianca, redencao e nova criacao sem perder o contexto dos livros.",
        promptStarter: "Monte um panorama da narrativa biblica de Genesis ao Apocalipse em linguagem clara, mostrando os grandes movimentos da historia e os textos-base de cada fase.",
        moduleIds: ["passages_translations", "biblical_periods"]
      },
      {
        id: "foundation_method",
        label: "Metodo de estudo",
        summary: "Aprender observacao, interpretacao e aplicacao com metodo seguro.",
        goal: "Separar o que o texto diz, o que a doutrina organiza e o que vira aplicacao pastoral.",
        promptStarter: "Ensine um metodo simples e fiel para estudar um texto biblico, separando observacao, interpretacao, contexto e aplicacao.",
        moduleIds: ["study_methods_hermeneutics", "devotional_practice"]
      },
      {
        id: "foundation_devotional_rhythm",
        label: "Ritmo devocional",
        summary: "Transformar estudo em rotina pratica de leitura, oracao e obediencia.",
        goal: "Criar uma rotina semanal simples para novos convertidos, com leitura, memoria e aplicacao.",
        promptStarter: "Crie um plano devocional de 7 dias para novos convertidos, com leitura biblica, explicacao breve, oracao e aplicacao pratica.",
        moduleIds: ["devotional_practice", "sunday_school_curriculum"]
      }
    ]
  },
  {
    id: "biblical_languages_track",
    label: "Hebraico, Aramaico e Grego",
    summary: "Trilha para nuance textual, vocabulario-chave e leitura responsavel dos idiomas originais.",
    assistantProfile: "research_mentor",
    activeModules: ["bible", "research"],
    bibleStudyModules: [
      "biblical_languages",
      "passages_translations",
      "study_methods_hermeneutics",
      "biblical_theology"
    ],
    promptPacks: ["chatgpt_reasoning", "theological_scholarship", "academic_rigor"],
    preferredBibleCode: "NAA",
    ministryFocus: "",
    depthPreference: "advanced",
    steps: [
      {
        id: "languages_orientation",
        label: "Mapa dos idiomas",
        summary: "Saber onde entram hebraico, aramaico e grego na Biblia.",
        goal: "Entender corpus, periodos, alfabetos e limites de traduzir palavra por palavra.",
        promptStarter: "Explique o papel do hebraico, aramaico e grego na Biblia, mostrando quando cada idioma aparece e por que isso importa para a interpretacao.",
        moduleIds: ["biblical_languages", "biblical_history"]
      },
      {
        id: "languages_word_study",
        label: "Estudo lexical responsavel",
        summary: "Estudar termos sem exagero apologetico ou falacias de palavra.",
        goal: "Aprender a comparar lexico, contexto, traducao e uso canonico do termo.",
        promptStarter: "Ensine como fazer um estudo lexical biblico de forma responsavel, sem cair em falacias de etimologia ou simplificacoes indevidas.",
        moduleIds: ["biblical_languages", "passages_translations", "study_methods_hermeneutics"]
      },
      {
        id: "languages_textual_insight",
        label: "Nuance textual",
        summary: "Usar idiomas originais para iluminar o texto sem desprezar boas traducoes.",
        goal: "Praticar comparacao de traducoes, fluxo textual e impacto de escolhas lexicais.",
        promptStarter: "Pegue uma passagem biblica conhecida e mostre como comparar traducoes e nuances dos idiomas originais sem perder a fidelidade ao contexto.",
        moduleIds: ["biblical_languages", "passages_translations", "biblical_theology"]
      }
    ]
  },
  {
    id: "theology_history_ministry",
    label: "Teologia, Historia e Ministerio",
    summary: "Integracao entre doutrina, historia da igreja e aplicacao protestante responsavel.",
    assistantProfile: "pastoral_companion",
    activeModules: ["bible", "research", "history_archaeology"],
    bibleStudyModules: [
      "systematic_theology",
      "biblical_theology",
      "church_history",
      "protestant_confessional_lines",
      "protestant_preaching_traditions",
      "pastoral_theology"
    ],
    promptPacks: ["chatgpt_reasoning", "christian_public_care", "theological_scholarship", "academic_rigor"],
    preferredBibleCode: "ARC",
    ministryFocus: "",
    depthPreference: "balanced",
    steps: [
      {
        id: "theology_core_doctrines",
        label: "Doutrinas centrais",
        summary: "Organizar temas como Deus, Cristo, salvacao, igreja e escatologia.",
        goal: "Distinguir exegese, teologia biblica e sistematica ao tratar doutrinas centrais.",
        promptStarter: "Organize as doutrinas centrais da fe crista em ordem didatica, mostrando base biblica, tensoes interpretativas e aplicacao para a igreja local.",
        moduleIds: ["systematic_theology", "biblical_theology"]
      },
      {
        id: "theology_historical_reading",
        label: "Historia da igreja",
        summary: "Ler pais da igreja, reformas e linhas confessionais com criterio biblico.",
        goal: "Separar valor historico, desenvolvimento doutrinario e autoridade final das Escrituras.",
        promptStarter: "Monte um panorama da historia da igreja para um protestante, separando periodos, nomes centrais, contribuicoes e limites de autoridade.",
        moduleIds: ["church_history", "patristics_church_fathers", "protestant_confessional_lines"]
      },
      {
        id: "theology_pastoral_delivery",
        label: "Ensino e pregacao",
        summary: "Transformar estudo em aula, esboco e cuidado pastoral fiel ao texto.",
        goal: "Sair do estudo para ensino publico com clareza, sobriedade e aplicacao biblica.",
        promptStarter: "Transforme um estudo biblico em roteiro de aula ou esboco expositivo, mantendo a fidelidade ao texto e uma aplicacao pastoral madura.",
        moduleIds: ["protestant_preaching_traditions", "homiletics_preaching", "pastoral_theology"]
      }
    ]
  }
]

export function listBibleLearningTracks() {
  return BIBLE_LEARNING_TRACKS.map((track) => ({
    id: track.id,
    label: track.label,
    summary: track.summary,
    assistantProfile: track.assistantProfile,
    activeModules: [...track.activeModules],
    bibleStudyModules: [...track.bibleStudyModules],
    promptPacks: [...track.promptPacks],
    preferredBibleCode: track.preferredBibleCode,
    ministryFocus: track.ministryFocus,
    depthPreference: track.depthPreference,
    steps: track.steps.map((step) => ({
      id: step.id,
      label: step.label,
      summary: step.summary,
      goal: step.goal,
      promptStarter: step.promptStarter,
      moduleIds: [...step.moduleIds]
    }))
  }))
}

export function getBibleLearningTrack(trackId = "") {
  return BIBLE_LEARNING_TRACKS.find((track) => track.id === trackId) || null
}