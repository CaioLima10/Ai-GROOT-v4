export function decodeXmlEntities(text = ""): string {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\n")
}

export function normalizeTextForDeduplication(text = ""): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function dedupeParagraphs(paragraphs: string[] = []): string[] {
  const seen = new Set<string>()
  const items: string[] = []

  for (const paragraph of paragraphs) {
    const normalized = normalizeTextForDeduplication(paragraph)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    items.push(String(paragraph).trim())
  }

  return items
}