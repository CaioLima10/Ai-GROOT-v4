export const languageLearningApis = [
  {
    id: "dictionary_api_dev",
    name: "DictionaryAPI.dev",
    pricing: "free",
    auth: "none",
    type: "dictionary",
    capabilities: ["definitions", "phonetics", "audio", "examples", "synonyms", "antonyms"],
    primaryLanguages: ["en"],
    endpoint: "https://api.dictionaryapi.dev/api/v2/entries/en/<word>",
    productionFit: "medium",
    limits: "Public free API; no explicit hard limit highlighted in primary docs.",
    notes: "Best for quick English lexical lookup. Not enough alone for multilingual nuance or idioms."
  },
  {
    id: "datamuse",
    name: "Datamuse",
    pricing: "free",
    auth: "none",
    type: "lexical_semantic",
    capabilities: ["reverse_dictionary", "related_words", "spelling", "autocomplete", "sounds_like", "collocations"],
    primaryLanguages: ["en", "es"],
    endpoint: "https://api.datamuse.com/words",
    productionFit: "medium",
    limits: "Up to 100000 requests/day without API key before rate-limiting may occur.",
    notes: "Excellent for ambiguity resolution, writing help and lexical expansion."
  },
  {
    id: "mediawiki_wiktionary",
    name: "MediaWiki Action API for Wiktionary",
    pricing: "free",
    auth: "none",
    type: "dictionary_multilingual",
    capabilities: ["definitions", "etymology", "idioms", "usage_notes", "translations", "variants"],
    primaryLanguages: ["multilingual"],
    endpoint: "https://<wiki>/w/api.php",
    productionFit: "medium",
    limits: "Public read access; follow API etiquette and cache aggressively.",
    notes: "Best source for idioms, usage nuance and multilingual lexical enrichment, but requires parsing."
  },
  {
    id: "languagetool_public",
    name: "LanguageTool Public API",
    pricing: "free_tier",
    auth: "optional",
    type: "grammar_style",
    capabilities: ["grammar", "style", "spelling", "language_detection", "rewrites", "feedback"],
    primaryLanguages: ["multilingual"],
    endpoint: "https://languagetool.org/v2/check",
    productionFit: "medium",
    limits: "20 requests/min, 75000 chars/min, 20000 chars/request on free public endpoint.",
    notes: "Great for feedback and output quality control; self-host if it becomes central."
  },
  {
    id: "mymemory",
    name: "MyMemory Translation API",
    pricing: "free_tier",
    auth: "optional",
    type: "translation_memory",
    capabilities: ["translation_lookup", "translation_memory", "segment_match", "bilingual_examples"],
    primaryLanguages: ["multilingual"],
    endpoint: "https://api.mymemory.translated.net/get?q=<text>&langpair=pt|en",
    productionFit: "low_medium",
    limits: "5000 chars/day anonymous, 50000 chars/day with valid email parameter.",
    notes: "Useful as translation memory and example source, not as main high-volume MT backbone."
  },
  {
    id: "libretranslate",
    name: "LibreTranslate",
    pricing: "open_source",
    auth: "instance_dependent",
    type: "translation",
    capabilities: ["translate", "detect_language", "list_languages", "health"],
    primaryLanguages: ["multilingual"],
    endpoint: "https://libretranslate.com/translate",
    productionFit: "high_if_self_hosted",
    limits: "Public instance behavior depends on host; self-host recommended for stable production use.",
    notes: "Strong open source fallback for translation and language routing."
  },
  {
    id: "fasttext_lid_176",
    name: "fastText lid.176",
    pricing: "free",
    auth: "none",
    type: "local_model",
    capabilities: ["language_identification"],
    primaryLanguages: ["176_languages"],
    endpoint: "local_model",
    productionFit: "high",
    limits: "Runs locally; no request quota.",
    notes: "Should be the first step in routing multilingual traffic before external calls."
  },
  {
    id: "mozilla_common_voice",
    name: "Mozilla Common Voice / Data Collective",
    pricing: "free",
    auth: "dataset_access",
    type: "open_dataset",
    capabilities: ["speech_data", "text_data", "language_id_data", "colloquial_speech"],
    primaryLanguages: ["multilingual"],
    endpoint: "https://datacollective.mozillafoundation.org/organization/cmfh0j9o10006ns07jq45h7xk",
    productionFit: "training_only",
    limits: "Dataset access model, not request API. Many datasets listed as CC0-1.0.",
    notes: "Ideal for offline learning, evaluation and future speech/language enrichment."
  }
]

export function getLanguageApisByCapability(capability = "") {
  const normalized = String(capability || "").trim().toLowerCase()
  if (!normalized) return [...languageLearningApis]
  return languageLearningApis.filter((service) =>
    Array.isArray(service.capabilities) && service.capabilities.some((item) => item.toLowerCase() === normalized)
  )
}

export function getLanguageApisByType(type = "") {
  const normalized = String(type || "").trim().toLowerCase()
  if (!normalized) return [...languageLearningApis]
  return languageLearningApis.filter((service) => String(service.type || "").toLowerCase() === normalized)
}