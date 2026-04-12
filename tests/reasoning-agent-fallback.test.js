import assert from "node:assert/strict"
import test from "node:test"

import { ReasoningAgent } from "../agents/reasoningAgent.js"

test("reasoning agent continuation fallback uses learned focus instead of echoing the prompt", () => {
  const agent = new ReasoningAgent()

  const response = agent.buildConversationalOfflineFallback(
    "Continue no mesmo assunto e faca 3 topicos curtos sobre esse livro.",
    {
      knownFacts: {
        name: "Gabriel",
        currentGoal: "o Livro de Genesis"
      },
      recentConversationText: [
        "Usuario: Meu nome e Gabriel e estamos estudando o Livro de Genesis. Responda apenas: entendido.",
        "GIOM: Entendido.",
        "Usuario: Qual e meu nome e qual livro estamos estudando agora?",
        "GIOM: Seu nome e Gabriel e seu foco atual e o Livro de Genesis."
      ].join("\n")
    },
    {}
  )

  assert.match(response, /1\./)
  assert.match(response, /Genesis/i)
  assert.equal(/Continuando de onde paramos:/i.test(response), false)
})

test("reasoning agent professional continuity fallback uses resolved focus without robotic phrasing", () => {
  const agent = new ReasoningAgent()

  const response = agent.buildConversationalOfflineFallback(
    "continue nesse assunto com aplicacao pratica",
    {
      conversationState: {
        mode: "follow_up",
        resolvedFocus: "arquitetura de API"
      },
      recentConversationText: [
        "Usuario: Quero melhorar a arquitetura de API do meu backend.",
        "GIOM: O primeiro passo e organizar contexto, contratos e observabilidade."
      ].join("\n")
    },
    {}
  )

  assert.match(response, /arquitetura de API/i)
  assert.equal(/Continuando de onde paramos:/i.test(response), false)
  assert.equal(/qual ponto exato quer retomar/i.test(response), false)
})