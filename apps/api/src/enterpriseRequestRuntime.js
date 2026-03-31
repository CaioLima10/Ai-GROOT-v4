export function flattenMessageContent(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""

  return content
    .map(item => {
      if (typeof item === "string") return item
      if (item?.text) return item.text
      if (item?.type === "input_text" && item?.text) return item.text
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

export function buildQuestionFromMessages(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return ""

  const transcript = messages
    .map(message => {
      const content = flattenMessageContent(message?.content)
      if (!content) return ""
      return `${message.role || "user"}: ${content}`
    })
    .filter(Boolean)
    .join("\n")

  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message?.role === "user")

  const lastUserText = flattenMessageContent(lastUserMessage?.content)
  if (!transcript) return lastUserText

  return [
    "Considere o historico abaixo e responda a ultima mensagem do usuario.",
    transcript,
    "",
    "Ultima mensagem do usuario:",
    lastUserText || transcript
  ].join("\n")
}

export function buildQuestionFromGeminiContents(contents = []) {
  if (typeof contents === "string") return contents
  if (!Array.isArray(contents)) return ""

  const lines = contents.map(item => {
    const parts = Array.isArray(item?.parts) ? item.parts : []
    const text = parts
      .map(part => part?.text || "")
      .filter(Boolean)
      .join("\n")

    if (!text) return ""
    return `${item?.role || "user"}: ${text}`
  }).filter(Boolean)

  return lines.join("\n")
}

export function estimateUsage(text = "") {
  const outputTokens = Math.max(1, Math.ceil(String(text || "").length / 4))
  return {
    prompt_tokens: 0,
    completion_tokens: outputTokens,
    total_tokens: outputTokens
  }
}
