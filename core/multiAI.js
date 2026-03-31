import { aiProviders } from "./aiProviders.js"

// Thin delegation layer — all logic lives in aiProviders
export async function askMultiAI(question, options = {}) {
  return await aiProviders.askMultiAI(question, options)
}
