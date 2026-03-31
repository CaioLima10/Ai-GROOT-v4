export function sanitizeDocumentTitle(value = "", fallback = "Documento GIOM") {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized || fallback
}

export function buildDocumentDraftPrompt(prompt, format, options = {}) {
  const locale = String(options.locale || "pt-BR")
  const style = String(options.style || "natural")
  const focusAreas = Array.isArray(options.activeModules) && options.activeModules.length > 0
    ? options.activeModules.join(", ")
    : "general"
  const requestedTitle = sanitizeDocumentTitle(options.title || "", "")
  const formatLabel = String(format || "").toUpperCase()

  const formatInstructions = {
    pdf: "Escreva um texto final bem estruturado, com titulo, secoes curtas e paragrafos limpos para exportacao em PDF.",
    docx: "Escreva um conteudo final profissional, em secoes claras, pronto para virar DOCX.",
    xlsx: "Escreva preferencialmente uma tabela em markdown ou CSV simples quando fizer sentido; se nao fizer, entregue linhas objetivas que possam virar planilha.",
    pptx: "Estruture o conteudo como apresentacao executiva com titulo e blocos curtos por slide.",
    svg: "Escreva um conteudo visual curto, com frases fortes e pouco texto por linha.",
    html: "Entregue um conteudo direto e estruturado, sem scripts.",
    json: "Entregue JSON valido, sem markdown e sem comentarios.",
    md: "Entregue markdown limpo, sem cercas de codigo.",
    txt: "Entregue texto puro limpo, sem markdown."
  }

  return [
    `Crie o conteudo final de um documento ${formatLabel}.`,
    requestedTitle ? `Titulo desejado: ${requestedTitle}.` : null,
    `Idioma principal: ${locale}.`,
    `Estilo de saida: ${style}.`,
    `Areas de foco desta conversa: ${focusAreas}.`,
    formatInstructions[format] || "Entregue um documento claro, profissional e pronto para exportacao.",
    "Regras:",
    "1. Nao descreva o que voce esta fazendo.",
    "2. Nao use cercas de codigo, salvo se o proprio formato pedir texto bruto.",
    "3. Entregue apenas o conteudo final do documento.",
    "4. Se houver risco ou conteudo proibido, recuse com seguranca em vez de produzir o documento.",
    `Objetivo do documento: ${prompt}`
  ].filter(Boolean).join("\n")
}
