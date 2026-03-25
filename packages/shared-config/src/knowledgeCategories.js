import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"

const bibleCategories = Array.from(
  new Set(BIBLE_STUDY_MODULES.flatMap(module => module.categories))
)

export const MODULE_CATEGORY_MAP = {
  developer: [
    "developer",
    "code",
    "programming",
    "debugging",
    "architecture",
    "repository_metadata",
    "security",
    "performance",
    "database",
    "frontend",
    "backend",
    "mobile",
    "devops",
    "curated"
  ],
  bible: bibleCategories,
  games_logic: [
    "games_logic",
    "chess",
    "board_games",
    "rpg",
    "music"
  ],
  math_science: [
    "math_science",
    "mathematics",
    "logic",
    "physics",
    "chemistry",
    "biology",
    "programming_theory"
  ],
  agribusiness: [
    "agribusiness",
    "soil",
    "satellite",
    "gps",
    "planting",
    "harvest",
    "precision_agriculture"
  ],
  finance: [
    "finance",
    "accounting",
    "treasury",
    "risk",
    "payments",
    "markets"
  ]
}

export function resolveCategoriesFromModules(modules = [], bibleStudyModules = []) {
  const normalizedModules = Array.isArray(modules) ? modules : []
  const normalizedBibleModules = Array.isArray(bibleStudyModules) ? bibleStudyModules : []
  const categories = new Set()

  normalizedModules.forEach(moduleId => {
    const items = MODULE_CATEGORY_MAP[moduleId] || [moduleId]
    items.forEach(category => categories.add(category))
  })

  normalizedBibleModules.forEach(moduleId => {
    const module = BIBLE_STUDY_MODULES.find(item => item.id === moduleId)
    const items = module?.categories || [moduleId]
    items.forEach(category => categories.add(category))
  })

  return Array.from(categories)
}
