const baseUrl = process.env.GIOM_VERIFY_BASE_URL || "http://127.0.0.1:3001"

async function ask(question, sessionId, userId) {
  const response = await fetch(`${baseUrl}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question,
      sessionId,
      context: {
        sessionId,
        userId
      }
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

const capabilityUser = `cap-user-${Date.now()}`
const memoryUser = `mem-user-${Date.now()}`
const bibleUser = `bible-user-${Date.now()}`

const results = {
  capability1: await ask("Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?", "cap-thread", capabilityUser),
  capability2: await ask("Responda isso de forma profissional, sem parecer um robo.", "cap-thread", capabilityUser),
  capability3: await ask("Entao diga em termos praticos o que voce consegue fazer bem nesta execucao.", "cap-thread", capabilityUser),
  capability4: await ask("Se eu pedir um dado muito atual, como voce deve responder?", "cap-thread", capabilityUser),
  bible: await ask("Vou te passar Romanos 8 na NAA. Por enquanto, responda apenas: ok.", "bible-thread", bibleUser),
  memorySave: await ask("Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado.", "mem-thread", memoryUser),
  memoryRecall: await ask("Qual e meu nome e qual assunto estamos tratando?", "mem-thread", memoryUser),
  memoryOtherThread: await ask("Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?", "mem-other-thread", memoryUser)
}

for (const [label, payload] of Object.entries(results)) {
  const handler = payload?.metadata?.askRoute?.handler || "unknown"
  const intent = payload?.metadata?.askRoute?.intent || "unknown"
  const answer = String(payload?.response || payload?.answer || "").replace(/\s+/g, " ").trim()
  console.log(`${label}\nhandler=${handler}\nintent=${intent}\nanswer=${answer}\n`)
}