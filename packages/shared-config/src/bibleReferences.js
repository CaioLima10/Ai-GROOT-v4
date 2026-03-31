function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function normalizeBibleText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export const BIBLE_BOOKS = [
  { id: "GEN", name: "Genesis", aliases: ["genesis", "gen", "gn"] },
  { id: "EXO", name: "Exodo", aliases: ["exodo", "exo", "ex"] },
  { id: "LEV", name: "Levitico", aliases: ["levitico", "lev", "lv"] },
  { id: "NUM", name: "Numeros", aliases: ["numeros", "num", "nm"] },
  { id: "DEU", name: "Deuteronomio", aliases: ["deuteronomio", "deut", "dt"] },
  { id: "JOS", name: "Josue", aliases: ["josue", "jos"] },
  { id: "JDG", name: "Juizes", aliases: ["juizes", "juiz", "jz", "jdg"] },
  { id: "RUT", name: "Rute", aliases: ["rute", "rut", "rt"] },
  { id: "1SA", name: "1 Samuel", aliases: ["1 samuel", "1samuel", "1 sam", "1sam", "i samuel", "i sam", "1sa"] },
  { id: "2SA", name: "2 Samuel", aliases: ["2 samuel", "2samuel", "2 sam", "2sam", "ii samuel", "ii sam", "2sa"] },
  { id: "1KI", name: "1 Reis", aliases: ["1 reis", "1reis", "1 rs", "1rs", "1 rei", "1re", "i reis", "1ki"] },
  { id: "2KI", name: "2 Reis", aliases: ["2 reis", "2reis", "2 rs", "2rs", "2 rei", "2re", "ii reis", "2ki"] },
  { id: "1CH", name: "1 Cronicas", aliases: ["1 cronicas", "1cronicas", "1 cron", "1cron", "1 cro", "1cr", "i cronicas", "1ch"] },
  { id: "2CH", name: "2 Cronicas", aliases: ["2 cronicas", "2cronicas", "2 cron", "2cron", "2 cro", "2cr", "ii cronicas", "2ch"] },
  { id: "EZR", name: "Esdras", aliases: ["esdras", "esd", "ezr"] },
  { id: "NEH", name: "Neemias", aliases: ["neemias", "nee", "neh"] },
  { id: "EST", name: "Ester", aliases: ["ester", "est"] },
  { id: "JOB", name: "Jo", aliases: ["jo", "job"] },
  { id: "PSA", name: "Salmos", aliases: ["salmos", "salmo", "sl", "psalms", "psalm", "psa"] },
  { id: "PRO", name: "Proverbios", aliases: ["proverbios", "proverbio", "prov", "pv", "pro"] },
  { id: "ECC", name: "Eclesiastes", aliases: ["eclesiastes", "ec", "ecc"] },
  { id: "SNG", name: "Cantares", aliases: ["cantares", "canticos", "cantico dos canticos", "ct", "cant", "song of songs", "song of solomon", "sng"] },
  { id: "ISA", name: "Isaias", aliases: ["isaias", "is", "isa"] },
  { id: "JER", name: "Jeremias", aliases: ["jeremias", "jer"] },
  { id: "LAM", name: "Lamentacoes", aliases: ["lamentacoes", "lamentacao", "lam"] },
  { id: "EZK", name: "Ezequiel", aliases: ["ezequiel", "ez", "ezk"] },
  { id: "DAN", name: "Daniel", aliases: ["daniel", "dn", "dan"] },
  { id: "HOS", name: "Oseias", aliases: ["oseias", "os", "hos"] },
  { id: "JOL", name: "Joel", aliases: ["joel", "jl", "jol"] },
  { id: "AMO", name: "Amos", aliases: ["amos", "am", "amo"] },
  { id: "OBA", name: "Obadias", aliases: ["obadias", "ob", "oba"] },
  { id: "JON", name: "Jonas", aliases: ["jonas", "jn", "jon"] },
  { id: "MIC", name: "Miqueias", aliases: ["miqueias", "mq", "mic"] },
  { id: "NAM", name: "Naum", aliases: ["naum", "na", "nam"] },
  { id: "HAB", name: "Habacuque", aliases: ["habacuque", "hc", "hab"] },
  { id: "ZEP", name: "Sofonias", aliases: ["sofonias", "sf", "zep"] },
  { id: "HAG", name: "Ageu", aliases: ["ageu", "ag", "hag"] },
  { id: "ZEC", name: "Zacarias", aliases: ["zacarias", "zc", "zec"] },
  { id: "MAL", name: "Malaquias", aliases: ["malaquias", "ml", "mal"] },
  { id: "MAT", name: "Mateus", aliases: ["mateus", "mt", "mat"] },
  { id: "MRK", name: "Marcos", aliases: ["marcos", "mc", "mr", "mark", "mrk"] },
  { id: "LUK", name: "Lucas", aliases: ["lucas", "lc", "lk", "luk"] },
  { id: "JHN", name: "Joao", aliases: ["joao", "jo", "john", "jhn", "jnh"] },
  { id: "ACT", name: "Atos", aliases: ["atos", "at", "acts", "act"] },
  { id: "ROM", name: "Romanos", aliases: ["romanos", "rom", "rm"] },
  { id: "1CO", name: "1 Corintios", aliases: ["1 corintios", "1corintios", "1 cor", "1cor", "1 co", "1co", "i corintios"] },
  { id: "2CO", name: "2 Corintios", aliases: ["2 corintios", "2corintios", "2 cor", "2cor", "2 co", "2co", "ii corintios"] },
  { id: "GAL", name: "Galatas", aliases: ["galatas", "gal", "gl"] },
  { id: "EPH", name: "Efesios", aliases: ["efesios", "ef", "eph"] },
  { id: "PHP", name: "Filipenses", aliases: ["filipenses", "fp", "php", "philippians", "fl"] },
  { id: "COL", name: "Colossenses", aliases: ["colossenses", "cl", "col"] },
  { id: "1TH", name: "1 Tessalonicenses", aliases: ["1 tessalonicenses", "1tessalonicenses", "1 tess", "1tess", "1 ts", "1ts", "1th"] },
  { id: "2TH", name: "2 Tessalonicenses", aliases: ["2 tessalonicenses", "2tessalonicenses", "2 tess", "2tess", "2 ts", "2ts", "2th"] },
  { id: "1TI", name: "1 Timoteo", aliases: ["1 timoteo", "1timoteo", "1 tim", "1tim", "1 tm", "1tm", "1ti"] },
  { id: "2TI", name: "2 Timoteo", aliases: ["2 timoteo", "2timoteo", "2 tim", "2tim", "2 tm", "2tm", "2ti"] },
  { id: "TIT", name: "Tito", aliases: ["tito", "tit", "tt"] },
  { id: "PHM", name: "Filemom", aliases: ["filemom", "filemon", "fm", "phm"] },
  { id: "HEB", name: "Hebreus", aliases: ["hebreus", "hb", "heb"] },
  { id: "JAS", name: "Tiago", aliases: ["tiago", "tg", "jas", "james"] },
  { id: "1PE", name: "1 Pedro", aliases: ["1 pedro", "1pedro", "1 pe", "1pe", "1 ped", "1pd", "i pedro"] },
  { id: "2PE", name: "2 Pedro", aliases: ["2 pedro", "2pedro", "2 pe", "2pe", "2 ped", "2pd", "ii pedro"] },
  { id: "1JN", name: "1 Joao", aliases: ["1 joao", "1joao", "1 jo", "1jo", "i joao", "1jn", "1 jn"] },
  { id: "2JN", name: "2 Joao", aliases: ["2 joao", "2joao", "2 jo", "2jo", "ii joao", "2jn", "2 jn"] },
  { id: "3JN", name: "3 Joao", aliases: ["3 joao", "3joao", "3 jo", "3jo", "iii joao", "3jn", "3 jn"] },
  { id: "JUD", name: "Judas", aliases: ["judas", "jd", "jud"] },
  { id: "REV", name: "Apocalipse", aliases: ["apocalipse", "apoc", "ap", "revelacao", "revelation", "rev"] }
]

const BOOKS_BY_ID = new Map(BIBLE_BOOKS.map((book) => [book.id, book]))

const BOOK_ALIAS_INDEX = BIBLE_BOOKS
  .flatMap((book) => [book.id, book.name, ...(book.aliases || [])].map((alias) => ({
    alias: normalizeBibleText(alias),
    book
  })))
  .filter((entry) => entry.alias)
  .sort((left, right) => right.alias.length - left.alias.length)

export function getBibleBookById(bookId = "") {
  return BOOKS_BY_ID.get(String(bookId || "").trim().toUpperCase()) || null
}

export function listBibleBooks() {
  return BIBLE_BOOKS.map((book) => ({ ...book }))
}

export function findBibleBookByAlias(input = "") {
  const normalized = normalizeBibleText(input)
  if (!normalized) return null

  const direct = BOOK_ALIAS_INDEX.find((entry) => entry.alias === normalized)
  return direct ? direct.book : null
}

export function buildBibleBookHeaderMatchers() {
  return BIBLE_BOOKS.map((book) => {
    const headerAliases = [book.name, ...(book.aliases || [])]
      .map((alias) => normalizeBibleText(alias))
      .filter((alias) => alias.length >= 4)
      .filter((alias, index, list) => list.indexOf(alias) === index)
      .sort((left, right) => right.length - left.length)

    return {
      ...book,
      headerAliases
    }
  })
}

function matchBookAliasInText(normalizedText = "") {
  for (const entry of BOOK_ALIAS_INDEX) {
    const pattern = new RegExp(`(?:^|\\b)${escapeRegex(entry.alias)}(?:\\b|$)`)
    const match = normalizedText.match(pattern)
    if (match) {
      return {
        book: entry.book,
        index: match.index || 0,
        matchedAlias: entry.alias
      }
    }
  }

  return null
}

export function parseBibleReference(input = "") {
  const raw = String(input || "").trim()
  if (!raw) {
    return null
  }

  const usfmMatch = raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .match(/^([1-3]?[A-Z]{2,3})\.(\d+)(?:\.(\d+)(?:[-–](\d+))?)?$/)

  if (usfmMatch) {
    const book = getBibleBookById(usfmMatch[1])
    if (!book) {
      return null
    }

    const chapter = Number(usfmMatch[2])
    const verseStart = usfmMatch[3] ? Number(usfmMatch[3]) : null
    const verseEnd = usfmMatch[4] ? Number(usfmMatch[4]) : verseStart

    return {
      raw,
      bookId: book.id,
      bookName: book.name,
      chapter,
      verseStart,
      verseEnd,
      isChapterOnly: verseStart == null,
      canonical: verseStart == null
        ? `${book.id}.${chapter}`
        : `${book.id}.${chapter}.${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}`,
      human: verseStart == null
        ? `${book.name} ${chapter}`
        : `${book.name} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}`
    }
  }

  const normalized = normalizeBibleText(raw)
  const match = matchBookAliasInText(normalized)
  if (!match) {
    return null
  }

  const tail = normalized.slice(match.index + match.matchedAlias.length).trim()
  const locationMatch = tail.match(/^(\d+)(?:\s*(?::|\.|,|\s)\s*(\d+)(?:\s*[-–]\s*(\d+))?)?/)
  if (!locationMatch) {
    return null
  }

  const chapter = Number(locationMatch[1])
  const verseStart = locationMatch[2] ? Number(locationMatch[2]) : null
  const verseEnd = locationMatch[3] ? Number(locationMatch[3]) : verseStart

  return {
    raw,
    bookId: match.book.id,
    bookName: match.book.name,
    chapter,
    verseStart,
    verseEnd,
    isChapterOnly: verseStart == null,
    canonical: verseStart == null
      ? `${match.book.id}.${chapter}`
      : `${match.book.id}.${chapter}.${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}`,
    human: verseStart == null
      ? `${match.book.name} ${chapter}`
      : `${match.book.name} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}`
  }
}
