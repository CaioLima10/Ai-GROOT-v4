export const COMPAT_MODELS = [
  {
    id: "groot-1-free",
    label: "GIOM Free",
    profile: "adaptive_teacher",
    modules: ["developer"]
  },
  {
    id: "groot-1-dev",
    label: "GIOM Dev",
    profile: "senior_engineer",
    modules: ["developer"]
  },
  {
    id: "groot-1-bible",
    label: "GIOM Bible",
    profile: "research_mentor",
    modules: ["bible"],
    bibleStudyModules: [
      "passages_translations",
      "biblical_languages",
      "biblical_history",
      "church_history",
      "systematic_theology",
      "biblical_archaeology"
    ]
  },
  {
    id: "groot-1-finance",
    label: "GIOM Finance",
    profile: "research_mentor",
    modules: ["finance"]
  },
  {
    id: "groot-1-agro",
    label: "GIOM Agro",
    profile: "research_mentor",
    modules: ["agribusiness"]
  },
  {
    id: "groot-1-math",
    label: "GIOM Math & Science",
    profile: "adaptive_teacher",
    modules: ["math_science"]
  },
  {
    id: "groot-1-games",
    label: "GIOM Games & Logic",
    profile: "adaptive_teacher",
    modules: ["games_logic"]
  }
]

export function listCompatModels() {
  return COMPAT_MODELS.map(model => ({ ...model }))
}

export function resolveCompatModel(modelId = "groot-1-free") {
  return COMPAT_MODELS.find(model => model.id === modelId) || COMPAT_MODELS[0]
}
