import fs from "fs/promises"
import path from "path"
import dotenv from "dotenv"
import { fileURLToPath } from "url"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const DEFAULT_MANIFEST = path.join(ROOT_DIR, "knowledge", "imported", "free-sources", "manifest.json")
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "knowledge", "imported", "free-sources", "snapshots")
const DEFAULT_LIMIT = 3
const DEFAULT_USER_AGENT = process.env.GIOM_FREE_SOURCE_USER_AGENT || "GIOM-FreeSources/1.0 (contact: local-dev)"

function parseArgs() {
  const args = process.argv.slice(2)
  const getValue = flag => {
    const index = args.indexOf(flag)
    return index >= 0 ? args[index + 1] : null
  }

  const sourceArg = getValue("--source")
  const limitValue = Number(getValue("--limit") || DEFAULT_LIMIT)

  return {
    manifestPath: path.resolve(getValue("--manifest") || DEFAULT_MANIFEST),
    outputDir: path.resolve(getValue("--out") || DEFAULT_OUTPUT_DIR),
    sourceFilter: sourceArg
      ? sourceArg.split(",").map(item => item.trim()).filter(Boolean)
      : [],
    limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : DEFAULT_LIMIT,
    dryRun: args.includes("--dry-run"),
    ingest: args.includes("--ingest"),
    listOnly: args.includes("--list")
  }
}

async function loadManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8")
  const data = JSON.parse(raw)
  if (!Array.isArray(data.sources)) {
    throw new Error("Manifesto invalido: sources deve ser um array.")
  }
  return data
}

async function fetchJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)

  let response
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "application/json",
        ...headers
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status} ao acessar ${url}: ${body.slice(0, 240)}`)
  }

  return response.json()
}

function logConnectorWarning(sourceId, detail, error) {
  console.warn(`⚠️ ${sourceId}: ${detail}: ${error.message}`)
}

function stripHtml(input) {
  return String(input || "").replace(/<[^>]+>/g, " ")
}

function normalizeWhitespace(input) {
  return String(input || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function isoDate() {
  return new Date().toISOString()
}

function isPermissiveLicense(license) {
  const normalized = String(license || "").toLowerCase()
  if (!normalized) return false
  return normalized.includes("public domain")
    || normalized === "pd"
    || normalized === "cc0"
    || normalized === "cc-by"
    || normalized === "cc-by-sa"
}

function limitItems(items, limit) {
  return Array.isArray(items) ? items.slice(0, limit) : []
}

function chunkItems(items, chunkSize) {
  if (!Array.isArray(items) || items.length === 0) return []
  const size = Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : items.length
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildDocument(entry, source, payload) {
  return {
    title: payload.title,
    content: normalizeWhitespace(payload.content),
    category: payload.category || source.category || "general",
    categories: payload.categories || source.categories || [],
    modules: payload.modules || source.modules || [],
    bibleStudyModules: payload.bibleStudyModules || source.bibleStudyModules || [],
    language: payload.language || "en",
    source: payload.source,
    license: payload.license || source.license || "unknown",
    tags: payload.tags || [],
    fetchedAt: isoDate(),
    sourceId: source.id,
    sourceName: source.name,
    attributionRequired: source.attributionRequired !== false,
    author: payload.author || null,
    summary: payload.summary || null
  }
}

async function fetchGitHubRepositorySearch(source, config) {
  const token = process.env.GITHUB_TOKEN
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const documents = []

  for (const queryDef of source.queries || []) {
    const params = new URLSearchParams({
      q: queryDef.query,
      sort: "stars",
      order: "desc",
      per_page: String(config.limit)
    })
    try {
      const data = await fetchJson(`${source.apiBaseUrl}?${params.toString()}`, { headers })

      for (const repo of limitItems(data.items, config.limit)) {
        documents.push(buildDocument(config, source, {
          title: `GitHub Repo: ${repo.full_name}`,
          source: repo.html_url,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Repository: ${repo.full_name}`,
            `Query label: ${queryDef.label}`,
            `Description: ${repo.description || "No description provided."}`,
            `Primary language: ${repo.language || "unknown"}`,
            `Stars: ${repo.stargazers_count}`,
            `Topics: ${(repo.topics || []).join(", ") || "none"}`,
            `Updated at: ${repo.updated_at}`,
            `License: ${repo.license?.spdx_id || repo.license?.name || "repository_specific"}`,
            `URL: ${repo.html_url}`
          ].join("\n"),
          tags: [queryDef.label, repo.language].filter(Boolean),
          license: repo.license?.spdx_id || source.license,
          summary: repo.description || null
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta GitHub ${queryDef.label}`, error)
    }
  }

  return documents
}

async function fetchStackExchangeQuestions(source, config) {
  const documents = []

  for (const queryDef of source.queries || []) {
    const params = new URLSearchParams({
      pagesize: String(config.limit),
      order: "desc",
      sort: "votes",
      site: queryDef.site || "stackoverflow",
      tagged: queryDef.tagged,
      filter: "withbody"
    })
    try {
      const data = await fetchJson(`${source.apiBaseUrl}?${params.toString()}`)

      for (const item of limitItems(data.items, config.limit)) {
        const bodyText = normalizeWhitespace(String(item.body || "").replace(/<[^>]+>/g, " "))
        documents.push(buildDocument(config, source, {
          title: `Stack Overflow: ${item.title}`,
          source: item.link,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${item.title}`,
            `Tags: ${(item.tags || []).join(", ")}`,
            `Score: ${item.score}`,
            `Answer count: ${item.answer_count}`,
            `Owner: ${item.owner?.display_name || "community"}`,
            `Excerpt: ${bodyText.slice(0, 1600) || "No body excerpt available."}`,
            `URL: ${item.link}`,
            `License: CC-BY-SA`
          ].join("\n"),
          tags: item.tags || [],
          summary: bodyText.slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta Stack Exchange ${queryDef.label}`, error)
    }
  }

  return documents
}

async function fetchMediaWikiExtracts(source, config) {
  const documents = []

  for (const page of limitItems(source.pages, Math.max(config.limit, source.pages?.length || 0))) {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      explaintext: "1",
      redirects: "1",
      format: "json",
      titles: page
    })
    try {
      const data = await fetchJson(`${source.wikiBaseUrl}?${params.toString()}`)
      const pages = data?.query?.pages || {}
      const pageRecord = Object.values(pages)[0]
      const title = pageRecord?.title || page
      const extract = normalizeWhitespace(pageRecord?.extract || "")
      if (!extract) continue

      const baseUrl = source.wikiBaseUrl.replace(/\/w\/api\.php$/, "")
      documents.push(buildDocument(config, source, {
        title: `${source.name}: ${title}`,
        source: `${baseUrl}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        categories: source.categories,
        modules: source.modules,
        bibleStudyModules: source.bibleStudyModules,
        content: [
          `Title: ${title}`,
          `Source collection: ${source.name}`,
          "",
          extract.slice(0, 3200)
        ].join("\n"),
        tags: [title],
        summary: extract.slice(0, 280)
      }))
    } catch (error) {
      logConnectorWarning(source.id, `falha ao extrair pagina ${page}`, error)
    }
  }

  return documents.slice(0, Math.max(config.limit, documents.length))
}

async function fetchSefariaTexts(source, config) {
  const documents = []
  const chunkSize = source.chunkSize || 8

  for (const reference of limitItems(source.references, config.limit)) {
    const params = new URLSearchParams({
      context: "0",
      commentary: "0",
      pad: "0",
      lang: "bi"
    })

    try {
      const encodedRef = encodeURIComponent(reference)
      const data = await fetchJson(`${source.apiBaseUrl}/${encodedRef}?${params.toString()}`, {
        timeoutMs: 15000
      })

      const hebrewLicense = data.heLicense || ""
      const englishLicense = data.license || ""
      const hebrewVerses = Array.isArray(data.he) ? data.he.map(verse => normalizeWhitespace(stripHtml(verse))) : []
      const englishVerses = Array.isArray(data.text) ? data.text.map(verse => normalizeWhitespace(stripHtml(verse))) : []
      const includeHebrew = hebrewVerses.length > 0 && isPermissiveLicense(hebrewLicense)
      const includeEnglish = englishVerses.length > 0 && isPermissiveLicense(englishLicense)
      const sourceRef = data.ref || reference
      const sourceUrl = `https://www.sefaria.org/${encodeURIComponent(sourceRef.replace(/ /g, "_"))}`
      const chunkCount = Math.max(includeHebrew ? hebrewVerses.length : 0, includeEnglish ? englishVerses.length : 0)

      if (!includeHebrew && !includeEnglish) {
        documents.push(buildDocument(config, source, {
          title: `Sefaria: ${sourceRef}`,
          source: sourceUrl,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `Reference: ${sourceRef}`,
            `Primary category: ${data.primary_category || "Tanakh"}`,
            `Hebrew version: ${data.heVersionTitle || "unknown"}`,
            `Hebrew license: ${hebrewLicense || "unknown"}`,
            `English version: ${data.versionTitle || "unknown"}`,
            `English license: ${englishLicense || "unknown"}`,
            `Version source: ${data.versionSource || data.heVersionSource || "https://www.sefaria.org"}`,
            `Source URL: ${sourceUrl}`,
            "",
            "Text omitted from snapshot content because the returned versions were not permissively licensed for storage.",
            "Keep the citation, version metadata, and source link for retrieval or follow-up fetching."
          ].join("\n"),
          language: "he",
          tags: [data.book, ...(data.categories || []), reference].filter(Boolean),
          license: hebrewLicense || englishLicense || source.license,
          summary: `Metadata only for ${sourceRef}`
        }))
        continue
      }

      for (const [chunkIndex, hebrewChunk] of chunkItems(includeHebrew ? hebrewVerses : englishVerses, chunkSize).entries()) {
        const startVerse = chunkIndex * chunkSize + 1
        const endVerse = Math.min(startVerse + chunkSize - 1, chunkCount)
        const englishChunk = includeEnglish
          ? englishVerses.slice(chunkIndex * chunkSize, chunkIndex * chunkSize + chunkSize)
          : []
        const contentSections = [
          `Reference: ${sourceRef}`,
          `Verse range: ${startVerse}-${endVerse}`,
          `Primary category: ${data.primary_category || "Tanakh"}`,
          `Hebrew version: ${data.heVersionTitle || "unknown"}`,
          `Hebrew license: ${hebrewLicense || "unknown"}`,
          `English version: ${data.versionTitle || "unknown"}`,
          `English license: ${englishLicense || "unknown"}`,
          `Version source: ${data.versionSource || data.heVersionSource || "https://www.sefaria.org"}`,
          `Source URL: ${sourceUrl}`
        ]

        if (includeHebrew) {
          contentSections.push(
            "",
            "Hebrew text:",
            hebrewChunk.map((verse, verseIndex) => `${startVerse + verseIndex}. ${verse}`).join("\n")
          )
        }

        if (includeEnglish && englishChunk.length > 0) {
          contentSections.push(
            "",
            "English text:",
            englishChunk.map((verse, verseIndex) => `${startVerse + verseIndex}. ${verse}`).join("\n")
          )
        }

        const summarySource = includeEnglish && englishChunk.length > 0
          ? englishChunk.join(" ")
          : hebrewChunk.join(" ")

        documents.push(buildDocument(config, source, {
          title: `Sefaria: ${sourceRef} vv. ${startVerse}-${endVerse}`,
          source: sourceUrl,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: contentSections.join("\n"),
          language: includeEnglish ? "en" : "he",
          tags: [data.book, ...(data.categories || []), reference, `verses:${startVerse}-${endVerse}`].filter(Boolean),
          license: includeEnglish ? englishLicense : hebrewLicense || source.license,
          summary: normalizeWhitespace(summarySource).slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na referencia Sefaria ${reference}`, error)
    }
  }

  return documents
}

async function fetchOpenLibrarySubjects(source, config) {
  const documents = []

  for (const subject of source.subjects || []) {
    try {
      let data
      const slug = subject.toLowerCase().replace(/\s+/g, "_")
      const params = new URLSearchParams({ limit: String(config.limit), details: "true" })

      try {
        data = await fetchJson(`${source.apiBaseUrl}/subjects/${encodeURIComponent(slug)}.json?${params.toString()}`, {
          timeoutMs: 12000
        })
      } catch (error) {
        logConnectorWarning(source.id, `fallback de busca para subject ${subject}`, error)
        const searchParams = new URLSearchParams({
          q: subject,
          limit: String(config.limit),
          mode: "everything"
        })
        data = await fetchJson(`${source.apiBaseUrl}/search.json?${searchParams.toString()}`, {
          timeoutMs: 12000
        })
      }

      const works = Array.isArray(data.works) ? data.works : Array.isArray(data.docs) ? data.docs : []

      for (const work of limitItems(works, config.limit)) {
        const description = typeof work.description === "string"
          ? work.description
          : work.description?.value || work.first_sentence?.join?.(" ") || work.subtitle || "No description available."
        const authorNames = (work.authors || work.author_name || []).map(author => author.name || author)
        const workKey = work.key || (work.cover_edition_key ? `/works/${work.cover_edition_key}` : "")
        documents.push(buildDocument(config, source, {
          title: `Open Library: ${work.title}`,
          source: workKey ? `${source.apiBaseUrl}${workKey}` : source.apiBaseUrl,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${work.title}`,
            `Subject: ${subject}`,
            `Authors: ${authorNames.join(", ") || "unknown"}`,
            `First published: ${work.first_publish_year || "unknown"}`,
            `Edition count: ${work.edition_count || work.edition_key?.length || 0}`,
            `Availability: ${work.availability?.status || "unknown"}`,
            `Description: ${description}`,
            `URL: ${workKey ? `${source.apiBaseUrl}${workKey}` : source.apiBaseUrl}`
          ].join("\n"),
          tags: [subject],
          summary: normalizeWhitespace(description).slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha no subject Open Library ${subject}`, error)
    }
  }

  return documents
}

async function fetchGutendexTopics(source, config) {
  const documents = []

  for (const topic of source.topics || []) {
    const params = new URLSearchParams({
      search: topic,
      languages: "en",
      copyright: "false"
    })
    try {
      const data = await fetchJson(`${source.apiBaseUrl}?${params.toString()}`, { timeoutMs: 25000 })

      for (const book of limitItems(data.results, config.limit)) {
        documents.push(buildDocument(config, source, {
          title: `Gutendex: ${book.title}`,
          source: book.formats?.["text/html"] || book.formats?.["text/plain; charset=utf-8"] || `https://www.gutenberg.org/ebooks/${book.id}`,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${book.title}`,
            `Topic: ${topic}`,
            `Authors: ${(book.authors || []).map(a => a.name).join(", ") || "unknown"}`,
            `Languages: ${(book.languages || []).join(", ") || "unknown"}`,
            `Bookshelves: ${(book.bookshelves || []).join(", ") || "none"}`,
            `Subjects: ${(book.subjects || []).join(" | ") || "none"}`,
            `Summary: ${(book.summaries || []).join(" ") || "No summary available."}`,
            `Download count: ${book.download_count || 0}`,
            `Project Gutenberg ID: ${book.id}`
          ].join("\n"),
          tags: [topic, ...(book.languages || [])],
          summary: normalizeWhitespace((book.summaries || []).join(" ")).slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha no topico Gutendex ${topic}`, error)
    }
  }

  return documents
}

async function fetchArxivPapers(source, config) {
  const documents = []

  for (const queryDef of source.queries || []) {
    const maxResults = queryDef.maxResults || config.limit
    const params = new URLSearchParams({
      search_query: queryDef.query,
      start: "0",
      max_results: String(maxResults),
      sortBy: "submittedDate",
      sortOrder: "descending"
    })

    try {
      const url = `${source.apiBaseUrl}?${params.toString()}`
      const response = await fetch(url, { headers: { "User-Agent": "GIOM-IA" } })
      const text = await response.text()

      const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) || []
      const papers = entries.map(entry => {
        const titleMatch = entry.match(/<title[^>]*>([^<]+)<\/title>/)
        const summaryMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)
        const authorMatches = entry.match(/<name>([^<]+)<\/name>/g) || []
        const authors = authorMatches.map(m => m.replace(/<\/?name>/g, ""))
        const idMatch = entry.match(/arxiv\.org\/abs\/([^\s<]+)/)
        const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)
        const catMatch = entry.match(/term="([^"]+)"/)
        return {
          title: titleMatch ? titleMatch[1].trim() : "Untitled",
          summary: summaryMatch ? normalizeWhitespace(summaryMatch[1]) : "",
          authors,
          arxivId: idMatch ? idMatch[1].trim() : "",
          published: publishedMatch ? publishedMatch[1] : "",
          category: catMatch ? catMatch[1] : ""
        }
      })

      for (const paper of limitItems(papers, maxResults)) {
        if (!paper.arxivId || !paper.title) continue
        documents.push(buildDocument(config, source, {
          title: `arXiv: ${paper.title}`,
          source: `https://arxiv.org/abs/${paper.arxivId}`,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${paper.title}`,
            `arXiv ID: ${paper.arxivId}`,
            `Query: ${queryDef.label}`,
            `Category: ${paper.category}`,
            `Authors: ${paper.authors.slice(0, 5).join(", ") || "unknown"}${paper.authors.length > 5 ? " et al." : ""}`,
            `Published: ${paper.published}`,
            `Summary: ${paper.summary}`,
            `URL: https://arxiv.org/abs/${paper.arxivId}`
          ].join("\n"),
          tags: [queryDef.label, paper.category],
          language: "en",
          summary: paper.summary.slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta arXiv ${queryDef.label}`, error)
    }
  }

  return documents
}

async function fetchPubmedArticles(source, config) {
  const documents = []

  for (const queryDef of source.queries || []) {
    try {
      const apiKey = process.env.PUBMED_API_KEY
      const searchBase = {
        db: "pubmed",
        term: queryDef.query,
        retmax: String(queryDef.retmax || config.limit),
        rettype: "json",
        tool: "GIOM-IA",
        email: "research@ncbi.nlm.nih.gov"
      }
      if (apiKey) searchBase.api_key = apiKey
      const searchParams = new URLSearchParams(searchBase)

      const searchUrl = `${source.apiBaseUrl}/esearch.fcgi?${searchParams.toString()}`
      const searchData = await fetchJson(searchUrl, { timeoutMs: 15000 })
      const pmids = searchData?.esearchresult?.idlist || searchData?.result?.uids || []

      if (pmids.length === 0) continue

      const fetchBase = {
        db: "pubmed",
        id: pmids.slice(0, 10).join(","),
        rettype: "json",
        tool: "GIOM-IA",
        email: "research@ncbi.nlm.nih.gov"
      }
      if (apiKey) fetchBase.api_key = apiKey
      const fetchParams = new URLSearchParams(fetchBase)

      const fetchUrl = `${source.apiBaseUrl}/efetch.fcgi?${fetchParams.toString()}`
      const fetchData = await fetchJson(fetchUrl, { timeoutMs: 15000 })
      const articles = fetchData?.result?.uids || []

      for (const pmid of limitItems(articles, queryDef.retmax || config.limit)) {
        const article = fetchData?.result?.[pmid]
        if (!article || !article.uid) continue

        const authors = (article.authors || []).map(a => a.name)
        const abstract = article.abstract || "No abstract available."

        documents.push(buildDocument(config, source, {
          title: `PubMed: ${article.title}`,
          source: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${article.title}`,
            `PMID: ${pmid}`,
            `Query: ${queryDef.label}`,
            `Authors: ${authors.slice(0, 5).join(", ") || "unknown"}${authors.length > 5 ? " et al." : ""}`,
            `Journal: ${article.source || "unknown"}`,
            `Published: ${article.pubdate || "unknown"}`,
            `Abstract: ${abstract}`,
            `URL: https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          ].join("\n"),
          tags: [queryDef.label, article.source || "biomedical"],
          summary: normalizeWhitespace(abstract).slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta PubMed ${queryDef.label}`, error)
    }
  }

  return documents
}

async function fetchDoajJournals(source, config) {
  const documents = []

  for (const journal of source.journals || []) {
    try {
      const params = new URLSearchParams({
        q: `title:"${journal}" OR keywords:"${journal}"`,
        pageSize: String(Math.min(config.limit, 100))
      })

      const url = `${source.apiBaseUrl}/search/journals/search?${params.toString()}`
      const data = await fetchJson(url, { timeoutMs: 12000 })
      const results = data?.results || []

      for (const j of limitItems(results, config.limit)) {
        documents.push(buildDocument(config, source, {
          title: `DOAJ Journal: ${j.bibjson?.title || j.title || "Untitled"}`,
          source: j.bibjson?.link?.[0]?.url || j.url || source.apiBaseUrl,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Title: ${j.bibjson?.title || j.title}`,
            `Journal: ${journal}`,
            `ISSN: ${(j.bibjson?.issn || []).join(", ") || "unknown"}`,
            `Publisher: ${j.bibjson?.publisher || "unknown"}`,
            `Description: ${j.bibjson?.description || "No description"}`,
            `Language: ${(j.bibjson?.language || []).join(", ") || "unknown"}`,
            `Country: ${j.bibjson?.country || "unknown"}`,
            `URL: ${j.bibjson?.link?.[0]?.url || j.url || source.apiBaseUrl}`
          ].join("\n"),
          tags: [journal],
          summary: normalizeWhitespace(j.bibjson?.description || "").slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta DOAJ ${journal}`, error)
    }
  }

  return documents
}

async function fetchOverpassGeospatial(source, config) {
  const documents = []

  for (const location of source.locations || []) {
    try {
      const [minLat, minLon, maxLat, maxLon] = location.bbox.split(",").map(Number)
      const overpassQuery = `[out:json][timeout:25];(node["historic"](${minLat},${minLon},${maxLat},${maxLon});way["historic"](${minLat},${minLon},${maxLat},${maxLon});node["place_of_worship"]["religion"="christian"](${minLat},${minLon},${maxLat},${maxLon});node["archaeological_site"](${minLat},${minLon},${maxLat},${maxLon}););out center;`

      const formData = new URLSearchParams({ data: overpassQuery })
      const response = await fetch(source.apiBaseUrl, {
        method: "POST",
        body: formData.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "GIOM-IA" }
      })
      const json = await response.json()
      const elements = (json.elements || []).filter(e => e.tags?.name)

      for (const elem of limitItems(elements, config.limit)) {
        const name = elem.tags.name
        const type = elem.tags.historic || elem.tags.archaeological_site || elem.tags.place_of_worship || "historical_site"
        const wiki = elem.tags.wikipedia || elem.tags.wikidata || null
        const lat = elem.lat || elem.center?.lat || (minLat + maxLat) / 2
        const lon = elem.lon || elem.center?.lon || (minLon + maxLon) / 2

        documents.push(buildDocument(config, source, {
          title: `OpenStreetMap: ${name} (${type})`,
          source: wiki ? `https://en.wikipedia.org/wiki/${wiki}` : `https://www.openstreetmap.org/#map=18/${lat}/${lon}`,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `Name: ${name}`,
            `Location: ${location.name}`,
            `Type: ${type}`,
            `Coordinates: ${lat}, ${lon}`,
            wiki ? `Wikipedia/Wikidata: ${wiki}` : null,
            `Source: OpenStreetMap contributors (ODbL)`,
            `URL: https://www.openstreetmap.org/#map=18/${lat}/${lon}`
          ].filter(Boolean).join("\n"),
          tags: [location.name, type, "openstreetmap"],
          language: "en",
          summary: `${type}: ${name} — ${location.name}`
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha na consulta Overpass para ${location.name}`, error)
    }
  }

  return documents
}

async function fetchApiBiblePassages(source, config) {
  const apiKey = process.env[source.apiKeyEnv || "APIBIBLE_KEY"]
  if (!apiKey) {
    logConnectorWarning(source.id, `${source.apiKeyEnv || "APIBIBLE_KEY"} nao configurada — pulando API.Bible`, new Error("missing key"))
    return []
  }
  const headers = { "api-key": apiKey }
  const documents = []

  for (const bibleRef of limitItems(source.bibleIds || [], 3)) {
    for (const passageId of limitItems(source.passages || [], config.limit)) {
      const params = new URLSearchParams({
        "content-type": "text",
        "include-notes": "false",
        "include-titles": "true",
        "include-chapter-numbers": "true",
        "include-verse-numbers": "true"
      })
      try {
        const url = `${source.apiBaseUrl}/bibles/${bibleRef.id}/passages/${encodeURIComponent(passageId)}?${params.toString()}`
        const data = await fetchJson(url, { headers, timeoutMs: 12000 })
        const passage = data?.data
        if (!passage?.content) continue

        documents.push(buildDocument(config, source, {
          title: `API.Bible: ${passage.reference} (${bibleRef.name})`,
          source: `https://scripture.api.bible`,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `Reference: ${passage.reference}`,
            `Translation: ${bibleRef.name}`,
            `Bible ID: ${bibleRef.id}`,
            "",
            normalizeWhitespace(passage.content)
          ].join("\n"),
          tags: [passageId, bibleRef.name, "API.Bible"],
          language: "en",
          summary: normalizeWhitespace(passage.content).slice(0, 280)
        }))
      } catch (error) {
        logConnectorWarning(source.id, `falha passagem ${passageId} (${bibleRef.name})`, error)
      }
    }
  }

  return documents
}

async function fetchBibleApiPassages(source, config) {
  const documents = []
  const translations = source.translations || ["kjv"]

  for (const passage of limitItems(source.passages || [], config.limit)) {
    for (const translation of translations.slice(0, 2)) {
      try {
        const encoded = encodeURIComponent(passage)
        const data = await fetchJson(`${source.apiBaseUrl}/${encoded}?translation=${translation}`, { timeoutMs: 12000 })
        if (!data?.text) continue

        documents.push(buildDocument(config, source, {
          title: `Bible API: ${data.reference} (${translation.toUpperCase()})`,
          source: `https://bible-api.com/${encoded}?translation=${translation}`,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `Reference: ${data.reference}`,
            `Translation: ${data.translation_name || translation.toUpperCase()}`,
            "",
            data.text
          ].join("\n"),
          tags: [passage, translation, "bible-api"],
          language: "en",
          summary: normalizeWhitespace(data.text).slice(0, 280)
        }))
      } catch (error) {
        logConnectorWarning(source.id, `falha passagem ${passage} (${translation})`, error)
      }
    }
  }

  return documents
}

async function fetchCanonApiChapters(source, config) {
  const documents = []

  for (const bookDef of source.books || []) {
    for (const chapter of limitItems(bookDef.chapters || [], 5)) {
      try {
        const url = `${source.apiBaseUrl}/${bookDef.book}/${chapter}.json`
        const data = await fetchJson(url, { timeoutMs: 12000 })
          // CanonAPI returns a top-level array of verse strings
          const verses = Array.isArray(data) ? data : (data?.verses || [])
          if (verses.length === 0) continue

          const verseText = verses.map((v, i) => `${i + 1}. ${v}`).join("\n")
        documents.push(buildDocument(config, source, {
          title: `Canon API: ${bookDef.book} ${chapter}`,
          source: url,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `Book: ${bookDef.book}`,
            `Chapter: ${chapter}`,
              `Verse count: ${verses.length}`,
            "",
            verseText
          ].join("\n"),
          tags: [bookDef.book, `chapter-${chapter}`, "canonapi"],
          language: "en",
            summary: verses.slice(0, 3).join(" ").slice(0, 280)
        }))
      } catch (error) {
        logConnectorWarning(source.id, `falha Canon API ${bookDef.book} ${chapter}`, error)
      }
    }
  }

  return documents
}

async function fetchBibleSdkVerses(source, config) {
  const documents = []

  for (const queryDef of limitItems(source.queries || [], config.limit)) {
    try {
      const concordance = queryDef.concordance !== false
      const url = `${source.apiBaseUrl}/api/books/${queryDef.book}/chapters/${queryDef.chapter}/verses${concordance ? "?concordance=true" : ""}`
      const data = await fetchJson(url, { timeoutMs: 15000 })
      const verses = Array.isArray(data) ? data : data?.verses || []
      if (verses.length === 0) continue

      const verseLines = verses.map(v => {
        const strongs = Array.isArray(v.strongNumbers) && v.strongNumbers.length > 0
          ? ` [Strong: ${v.strongNumbers.join(", ")}]`
          : ""
        return `${v.verse || v.number || ""}. ${v.text || v.content || ""}${strongs}`
      })

      documents.push(buildDocument(config, source, {
        title: `BibleSDK: ${queryDef.book} ${queryDef.chapter} (Strong concordance)`,
        source: `https://biblesdk.com/api/books/${queryDef.book}/chapters/${queryDef.chapter}/verses`,
        categories: source.categories,
        modules: source.modules,
        bibleStudyModules: source.bibleStudyModules,
        content: [
          `Book: ${queryDef.book}`,
          `Chapter: ${queryDef.chapter}`,
          `Concordance: ${concordance ? "Strong numbers included" : "basic"}`,
          "",
          verseLines.join("\n")
        ].join("\n"),
        tags: [queryDef.book, `chapter-${queryDef.chapter}`, "strongs", "concordance"],
        language: "en",
        summary: verseLines.slice(0, 3).join(" ").slice(0, 280)
      }))
    } catch (error) {
      logConnectorWarning(source.id, `falha BibleSDK ${queryDef.book} ${queryDef.chapter}`, error)
    }
  }

  return documents
}

async function fetchGithubRawDataset(source, config) {
  const documents = []

  for (const file of limitItems(source.files || [], config.limit)) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${source.dataRepo}/master/${file.path}`
      const response = await fetch(rawUrl, { headers: { "User-Agent": "GIOM-IA" } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()

      let content = ""
      if (file.format === "osis_xml") {
        const tagMatches = text.match(/<w[^>]*lemma="[^"]*"[^>]*>/g) || []
        content = tagMatches.slice(0, 300).map(wTag => {
          const lemma = (wTag.match(/lemma="([^"]*)"/) || [])[1] || ""
          const morph = (wTag.match(/morph="([^"]*)"/) || [])[1] || ""
          return lemma ? `Lemma: ${lemma} | Morph: ${morph}` : null
        }).filter(Boolean).join("\n") || text.slice(0, 3200)
      } else if (file.format === "morphgnt_tsv") {
        content = text.split("\n").filter(Boolean).slice(0, 250).map(line => {
          const p = line.split(" ")
          return p.length >= 6 ? `BCV:${p[0]} Word:${p[3]} Lemma:${p[5]} POS:${p[1]} Parse:${p[2]}` : null
        }).filter(Boolean).join("\n")
      } else {
        content = text.slice(0, 3200)
      }

      if (!content.trim()) continue

      documents.push(buildDocument(config, source, {
        title: `${source.name}: ${file.book}`,
        source: `https://github.com/${source.dataRepo}/blob/master/${file.path}`,
        categories: source.categories,
        modules: source.modules,
        bibleStudyModules: source.bibleStudyModules,
        content: [
          `Dataset: ${source.name}`,
          `Book: ${file.book}`,
          `Format: ${file.format}`,
          `Repository: ${source.dataRepo}`,
          `License: ${source.license}`,
          "",
          content
        ].join("\n"),
        tags: [file.book, file.format, "biblical-linguistics"],
        language: file.format === "osis_xml" ? "he" : "el",
        summary: `${source.name} morphological data for ${file.book}`
      }))
    } catch (error) {
      logConnectorWarning(source.id, `falha dataset ${file.book} de ${source.dataRepo}`, error)
    }
  }

  return documents
}

async function fetchCcelTexts(source, config) {
  const documents = []

  for (const text of limitItems(source.texts || [], config.limit)) {
    try {
      const url = `${source.apiBaseUrl}${text.path}`
      const response = await fetch(url, { headers: { "User-Agent": "GIOM-IA" } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()

      const stripped = normalizeWhitespace(
        html
          .replace(/<head[\s\S]*?<\/head>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z0-9#]+;/gi, " ")
      )
      if (!stripped || stripped.length < 100) continue

      documents.push(buildDocument(config, source, {
        title: text.title,
        source: url,
        categories: source.categories,
        modules: source.modules,
        bibleStudyModules: source.bibleStudyModules,
        author: text.author || null,
        content: [
          `Title: ${text.title}`,
          `Author: ${text.author || "Unknown"}`,
          `Source: CCEL - Christian Classics Ethereal Library`,
          `URL: ${url}`,
          "",
          stripped.slice(0, 3200)
        ].join("\n"),
        tags: [text.author || "ccel", "patristics", "church-classics"],
        language: "en",
        summary: stripped.slice(0, 280)
      }))
    } catch (error) {
      logConnectorWarning(source.id, `falha CCEL: ${text.title}`, error)
    }
  }

  return documents
}

async function fetchWorldBankIndicators(source, config) {
  const documents = []

  for (const indicator of limitItems(source.indicators || [], config.limit)) {
    try {
      const params = new URLSearchParams({ format: "json", per_page: "50", mrv: "10" })
      const url = `${source.apiBaseUrl}/indicator/${indicator.code}?${params.toString()}`
      const raw = await fetchJson(url, { timeoutMs: 12000 })
      const data = Array.isArray(raw) ? raw[1] : null
      if (!Array.isArray(data) || data.length === 0) continue

      const entries = data
        .filter(d => d.value !== null)
        .slice(0, 20)
        .map(d => `${d.country?.value || d.countryiso3code || "Global"} (${d.date}): ${d.value}`)
        .join("\n")

      documents.push(buildDocument(config, source, {
        title: `World Bank: ${indicator.name}`,
        source: `https://data.worldbank.org/indicator/${indicator.code}`,
        categories: source.categories,
        modules: source.modules,
        content: [
          `Indicator: ${indicator.name}`,
          `Code: ${indicator.code}`,
          `Source: World Bank Open Data`,
          "",
          entries
        ].join("\n"),
        tags: [indicator.code, "worldbank", "economics"],
        language: "en",
        summary: `World Bank: ${indicator.name}`
      }))
    } catch (error) {
      logConnectorWarning(source.id, `falha WorldBank ${indicator.code}`, error)
    }
  }

  return documents
}

async function fetchWikimediaCommons(source, config) {
  const documents = []

  for (const category of limitItems(source.categories_to_fetch || [], config.limit)) {
    try {
      const params = new URLSearchParams({
        action: "query",
        generator: "categorymembers",
        gcmtitle: `Category:${category}`,
        gcmtype: "file",
        gcmlimit: String(Math.min(config.limit, 20)),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        format: "json"
      })
      const data = await fetchJson(`${source.wikiBaseUrl}?${params.toString()}`, { timeoutMs: 15000 })

      for (const page of Object.values(data?.query?.pages || {})) {
        const info = page.imageinfo?.[0]
        if (!info?.url) continue
        const meta = info.extmetadata || {}
        const description = normalizeWhitespace((meta.ImageDescription?.value || "").replace(/<[^>]+>/g, ""))
        const artist = normalizeWhitespace((meta.Artist?.value || "Unknown").replace(/<[^>]+>/g, ""))
        const fileLicense = meta.LicenseShortName?.value || "unknown"
        const date = meta.DateTimeOriginal?.value || meta.Date?.value || ""
        if (!description && !page.title) continue

        documents.push(buildDocument(config, source, {
          title: `Wikimedia Commons: ${(page.title || "").replace("File:", "")}`,
          source: info.url,
          categories: source.categories,
          modules: source.modules,
          bibleStudyModules: source.bibleStudyModules,
          content: [
            `File: ${(page.title || "").replace("File:", "")}`,
            `Category: ${category}`,
            `Description: ${description || "No description"}`,
            `Artist: ${artist}`,
            `Date: ${date}`,
            `License: ${fileLicense}`,
            `Image URL: ${info.url}`
          ].join("\n"),
          license: fileLicense,
          tags: [category, "wikimedia-commons", "historical-image"],
          language: "en",
          summary: (description || `Historical image: ${category}`).slice(0, 280)
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha Wikimedia Commons: ${category}`, error)
    }
  }

  return documents
}

async function fetchOeisSequences(source, config) {
  const documents = []

  for (const query of limitItems(source.queries || [], config.limit)) {
    try {
      const params = new URLSearchParams({ q: query, fmt: "json", start: "0", n: "10" })
      const data = await fetchJson(`${source.apiBaseUrl}/search?${params.toString()}`, { timeoutMs: 12000 })

      for (const seq of limitItems(data?.results || [], 5)) {
          // OEIS returns a top-level array, not {results:[...]}
          const seqList = Array.isArray(data) ? data : (data?.results || [])

          for (const seq of limitItems(seqList, 5)) {
        const values = (seq.data || "").split(",").slice(0, 20).join(", ")
        const seqId = seq.number ? `A${String(seq.number).padStart(6, "0")}` : seq.id || "unknown"
        documents.push(buildDocument(config, source, {
          title: `OEIS ${seqId}: ${seq.name || "Sequence"}`,
          source: `https://oeis.org/${seqId}`,
          categories: source.categories,
          modules: source.modules,
          content: [
            `Sequence: ${seqId}`,
            `Name: ${seq.name || ""}`,
            `Query: ${query}`,
            `Values (first 20): ${values}`,
            `Formula: ${(seq.formula || []).slice(0, 2).join(" | ") || "none"}`,
            `URL: https://oeis.org/${seqId}`
          ].join("\n"),
          tags: [query, "oeis", "mathematics"],
          language: "en",
          summary: `${seqId}: ${seq.name || ""} — ${values}`
        }))
      }
    } catch (error) {
      logConnectorWarning(source.id, `falha OEIS: ${query}`, error)
    }
  }

  return documents
}

const CONNECTORS = {
  github_repository_search: fetchGitHubRepositorySearch,
  stackexchange_questions: fetchStackExchangeQuestions,
  mediawiki_extracts: fetchMediaWikiExtracts,
  sefaria_texts: fetchSefariaTexts,
  openlibrary_subjects: fetchOpenLibrarySubjects,
  gutendex_topics: fetchGutendexTopics,
  arxiv_papers: fetchArxivPapers,
  pubmed_eutils: fetchPubmedArticles,
  doaj_openaccess: fetchDoajJournals,
  overpass_geospatial: fetchOverpassGeospatial,
  apibible_passages: fetchApiBiblePassages,
  bibleapi_passages: fetchBibleApiPassages,
  canonapi_chapters: fetchCanonApiChapters,
  biblesdk_verses: fetchBibleSdkVerses,
  github_raw_dataset: fetchGithubRawDataset,
  ccel_texts: fetchCcelTexts,
  worldbank_indicators: fetchWorldBankIndicators,
  wikimedia_commons: fetchWikimediaCommons,
  oeis_search: fetchOeisSequences
}

async function writeSnapshot(outputDir, sourceId, documents) {
  await fs.mkdir(outputDir, { recursive: true })
  const filePath = path.join(outputDir, `${sourceId}.json`)
  await fs.writeFile(filePath, JSON.stringify(documents, null, 2), "utf8")
  return filePath
}

async function ingestDocuments(documents) {
  const { grootAdvancedRAG } = await import("../packages/ai-core/src/index.js")
  let inserted = 0

  for (const doc of documents) {
    const result = await grootAdvancedRAG.upsertKnowledge(doc.content, {
      source: doc.source,
      category: doc.category,
      categories: doc.categories,
      language: doc.language,
      title: doc.title,
      license: doc.license,
      modules: doc.modules,
      bibleStudyModules: doc.bibleStudyModules,
      sourceId: doc.sourceId,
      attributionRequired: doc.attributionRequired,
      fetchedAt: doc.fetchedAt,
      author: doc.author,
      summary: doc.summary,
      tags: doc.tags
    })

    if (result) inserted += 1
  }

  return inserted
}

async function run() {
  const config = parseArgs()
  const manifest = await loadManifest(config.manifestPath)
  let sources = manifest.sources.filter(source => source.enabled !== false)

  if (config.sourceFilter.length > 0) {
    const requested = new Set(config.sourceFilter)
    sources = sources.filter(source => requested.has(source.id))
  }

  if (config.listOnly) {
    console.log(JSON.stringify(sources.map(source => ({ id: source.id, kind: source.kind, name: source.name })), null, 2))
    return
  }

  if (sources.length === 0) {
    console.log("⚠️ Nenhuma fonte gratuita selecionada.")
    return
  }

  const summary = []

  for (const source of sources) {
    const connector = CONNECTORS[source.kind]
    if (!connector) {
      summary.push({ source: source.id, status: "skipped", reason: `connector desconhecido: ${source.kind}` })
      continue
    }

    try {
      console.log(`▶️ Coletando ${source.id} (${source.kind})`)
      const documents = await connector(source, config)
      let filePath = null
      let ingested = 0

      if (!config.dryRun) {
        filePath = await writeSnapshot(config.outputDir, source.id, documents)
      }

      if (config.ingest && documents.length > 0) {
        ingested = await ingestDocuments(documents)
      }

      summary.push({ source: source.id, status: "ok", documents: documents.length, file: filePath, ingested })
      console.log(`✅ ${source.id}: ${documents.length} documentos`)
    } catch (error) {
      summary.push({ source: source.id, status: "error", reason: error.message })
      console.log(`❌ ${source.id}: ${error.message}`)
    }
  }

  console.log(JSON.stringify({ generatedAt: isoDate(), dryRun: config.dryRun, ingest: config.ingest, summary }, null, 2))
}

run().catch(error => {
  console.error("❌ Falha ao bootstrapar fontes gratuitas:", error.message)
  process.exit(1)
})
