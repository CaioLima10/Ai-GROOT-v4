import assert from "node:assert/strict"
import test from "node:test"

import { GrootMemoryConnector } from "../packages/ai-core/src/grootMemoryConnector.js"

test("groot memory connector strips polluted profile facts and keeps valid learned facts", async () => {
  const connector = new GrootMemoryConnector()
  connector.isConnected = false
  connector.supabase = null

  connector.updateLocalProfile("u_profile", {
    style: "natural",
    name: "qual livro estamos estudando agora",
    knownFacts: {
      name: "qual livro estamos estudando agora",
      currentGoal: "Livro de Genesis"
    }
  })

  const profile = connector.getLocalProfile("u_profile")

  assert.equal(profile.preferences.name, undefined)
  assert.equal(profile.preferences.knownFacts?.name, undefined)
  assert.equal(profile.preferences.knownFacts?.currentGoal, "Livro de Genesis")
})

test("groot memory connector learns direct identity and goal facts without absorbing recall questions", async () => {
  const connector = new GrootMemoryConnector()
  connector.isConnected = false
  connector.supabase = null

  const context = await connector.getContextForPrompt("u_context", {
    conversationHistory: [
      {
        role: "user",
        content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis. Responda apenas: entendido."
      },
      {
        role: "assistant",
        content: "Entendido."
      },
      {
        role: "user",
        content: "Qual e meu nome e qual livro estamos estudando agora?"
      }
    ]
  })

  assert.equal(context.knownFacts.name, "Gabriel")
  assert.equal(context.knownFacts.currentGoal, "o Livro de Genesis")
  assert.equal(context.knownFactsText.includes("qual livro estamos estudando agora"), false)
})

test("groot memory connector classifies follow-up references and resolves the active focus", async () => {
  const connector = new GrootMemoryConnector()
  connector.isConnected = false
  connector.supabase = null

  const context = await connector.getContextForPrompt("u_follow_up", {
    conversationHistory: [
      {
        role: "user",
        content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis."
      },
      {
        role: "assistant",
        content: "Entendido."
      },
      {
        role: "user",
        content: "Continue nesse assunto e explique esse livro em 2 pontos."
      }
    ]
  })

  assert.equal(context.conversationState.mode, "follow_up")
  assert.match(String(context.conversationState.resolvedFocus || ""), /Genesis/i)
  assert.ok(Array.isArray(context.conversationState.referenceSignals))
  assert.ok(context.conversationState.referenceSignals.some((signal) => /continue|esse livro/i.test(signal)))
})

test("groot memory connector detects explicit topic shift without dragging stale context", async () => {
  const connector = new GrootMemoryConnector()
  connector.isConnected = false
  connector.supabase = null

  const context = await connector.getContextForPrompt("u_topic_shift", {
    conversationHistory: [
      {
        role: "user",
        content: "Explique Joao 15 em linguagem pastoral."
      },
      {
        role: "assistant",
        content: "Joao 15 mostra permanencia em Cristo e fruto espiritual."
      },
      {
        role: "user",
        content: "Agora mudando de assunto, me explique latencia de API em termos simples."
      }
    ]
  })

  assert.equal(context.conversationState.mode, "topic_shift")
  assert.ok(Array.isArray(context.conversationState.latestDomains))
  assert.ok(context.conversationState.latestDomains.includes("codigo"))
  assert.match(String(context.conversationState.summary || ""), /mudanca de assunto/i)
})

test("groot memory connector learns active thread topic from 'estamos tratando de'", async () => {
  const connector = new GrootMemoryConnector()
  connector.isConnected = false
  connector.supabase = null

  const context = await connector.getContextForPrompt("u_thread_goal", {
    conversationHistory: [
      {
        role: "user",
        content: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado."
      },
      {
        role: "assistant",
        content: "Registrado."
      },
      {
        role: "user",
        content: "Qual e meu nome e qual assunto estamos tratando?"
      }
    ]
  })

  assert.equal(context.knownFacts.name, "Marina")
  assert.equal(context.knownFacts.currentGoal, "onboarding de clientes")
})