const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001"

async function askStream(question, sessionId) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const response = await fetch(`${apiBaseUrl}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "copilot_stream_validation",
        ...(sessionId ? { "X-Session-Id": sessionId } : {})
      },
      body: JSON.stringify({
        question,
        sessionId,
        context: {
          channel: "copilot_stream_validation",
          migrationStage: 4,
          sessionId
        }
      }),
      signal: controller.signal
    })

    if (!response.ok || !response.body) {
      return {
        status: response.status,
        answer: await response.text().catch(() => "")
      }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let finalPayload = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const packets = buffer.split("\n\n")
      buffer = packets.pop() || ""

      for (const packet of packets) {
        const lines = packet.split(/\r?\n/)
        let event = "message"
        const dataLines = []

        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim()
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
        }

        if (!dataLines.length) continue
        const data = JSON.parse(dataLines.join("\n"))
        if (event === "complete") {
          finalPayload = data
        }
      }
    }

    return {
      status: response.status,
      answer: String(finalPayload?.response || "").trim(),
      handler: finalPayload?.metadata?.askRoute?.handler || "",
      intent: finalPayload?.metadata?.askRoute?.intent || "",
      routeType: finalPayload?.metadata?.askRoute?.routeType || "",
      provider: finalPayload?.metadata?.provider || ""
    }
  } finally {
    clearTimeout(timeout)
  }
}

const cases = [
  { id: "eng_seed", sessionId: "sess_eng_stream", question: "Estamos revisando uma API Node para reduzir latencia e melhorar clareza para o time. Responda apenas: combinado." },
  { id: "eng_plan", sessionId: "sess_eng_stream", question: "Com esse foco, me de 3 frentes objetivas para comecar." },
  { id: "eng_second_point", sessionId: "sess_eng_stream", question: "Pegue o segundo ponto e detalhe sem repetir a lista inteira." },
  { id: "eng_small_team", sessionId: "sess_eng_stream", question: "Nosso time e pequeno, entao simplifique isso para algo que caiba em uma semana." },
  { id: "eng_topic_shift_jwt", sessionId: "sess_eng_stream", question: "Mudando de assunto: explique JWT para um gerente de produto, sem jargao." },
  { id: "eng_return", sessionId: "sess_eng_stream", question: "Agora volte ao plano da API e feche em duas frases executivas." },
  { id: "cap_live_web", sessionId: "sess_cap_stream", question: "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?" },
  { id: "cap_professional_tone", sessionId: "sess_cap_stream", question: "Responda isso de forma profissional, sem parecer um robo." },
  { id: "cap_current_data_rule", sessionId: "sess_cap_stream", question: "Se eu pedir um dado muito atual, como voce deve responder?" },
  { id: "bible_seed", sessionId: "sess_bible_stream", question: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice. Responda apenas: ok." },
  { id: "bible_theme", sessionId: "sess_bible_stream", question: "Qual e o eixo central desse capitulo em 3 linhas curtas?" },
  { id: "bible_application", sessionId: "sess_bible_stream", question: "Aplique isso para alguem ansioso, mas sem soar artificial." },
  { id: "bible_reference_text", sessionId: "sess_bible_stream", question: "Quando eu disser 'esse texto', continue em Romanos 8. Esse texto fala mais de culpa ou de seguranca?" },
  { id: "bible_study_plan", sessionId: "sess_bible_stream", question: "Agora outro assunto: me monte um estudo biblico semanal de 4 blocos." },
  { id: "memory_save", sessionId: "sess_memory_stream", question: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado." },
  { id: "memory_recall", sessionId: "sess_memory_stream", question: "Qual e meu nome e qual assunto estamos tratando?" },
  { id: "memory_other_thread", sessionId: "sess_memory_other_stream", question: "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?" }
]

for (const item of cases) {
  const result = await askStream(item.question, item.sessionId)
  console.log(`\n${item.id}`)
  console.log(`status=${result.status}`)
  console.log(`handler=${result.handler}`)
  console.log(`intent=${result.intent}`)
  console.log(`routeType=${result.routeType}`)
  console.log(`provider=${result.provider}`)
  console.log(`answer=${result.answer}`)
}