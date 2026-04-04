import assert from "node:assert/strict"
import test from "node:test"

import { resolveOperationalRuntimeShortcut } from "../apps/api/src/enterpriseOperationalShortcutsRuntime.js"

test("operational shortcuts return explicit short reply deterministically", () => {
  const response = resolveOperationalRuntimeShortcut("Responda apenas: ok.", {})
  assert.equal(response, "ok")
})

test("operational shortcuts recall thread-local facts", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Qual e meu nome e qual assunto estamos tratando?",
    {
      conversationHistory: [
        {
          role: "user",
          content: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado."
        }
      ]
    }
  )

  assert.match(String(response || ""), /Marina/i)
  assert.match(String(response || ""), /onboarding de clientes/i)
})

test("operational shortcuts prefer session-local history over merged retrieval history", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Qual e meu nome e qual assunto estamos tratando?",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Meu nome e Marina e estamos tratando de onboarding de clientes."
        }
      ],
      conversationHistory: [
        {
          role: "user",
          content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis."
        }
      ]
    }
  )

  assert.match(String(response || ""), /Marina/i)
  assert.match(String(response || ""), /onboarding de clientes/i)
  assert.doesNotMatch(String(response || ""), /Gabriel|Genesis/i)
})

test("operational shortcuts honor strict thread isolation for recall questions", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?",
    {
      memoryProfile: {
        knownFacts: {
          name: "Gabriel",
          currentGoal: "Livro de Genesis"
        }
      },
      conversationHistory: []
    }
  )

  assert.match(String(response || ""), /ainda nao|voce ainda nao/i)
  assert.doesNotMatch(String(response || ""), /Gabriel|Genesis/i)
})

test("operational shortcuts ignore merged history when strict recall has no local thread context", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?",
    {
      sessionConversationHistory: [],
      conversationHistory: [
        {
          role: "user",
          content: "Meu nome e Gabriel e estamos estudando o Livro de Genesis."
        }
      ]
    }
  )

  assert.match(String(response || ""), /ainda nao|voce ainda nao/i)
  assert.doesNotMatch(String(response || ""), /Gabriel|Genesis/i)
})

test("operational shortcuts answer capability question without provider fallback", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?",
    {
      researchCapabilities: {
        mode: "offline",
        liveSources: []
      },
      capabilityMatrix: {
        sections: {
          files: { items: [] },
          generation: { items: [] },
          privacy: { items: [] }
        }
      }
    }
  )

  assert.match(String(response || ""), /nao|não/i)
  assert.match(String(response || ""), /pesquisa|google|web ao vivo/i)
})

test("operational shortcuts rewrite capability tone follow-up using latest local capability context", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Responda isso de forma profissional, sem parecer um robo.",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?"
        },
        {
          role: "assistant",
          content: "Hoje eu nao tenho navegacao web geral via Google ao vivo."
        }
      ],
      researchCapabilities: {
        mode: "offline",
        liveSources: ["Weather", "Sports"]
      }
    }
  )

  assert.match(String(response || ""), /google|mem[oó]ria conversacional|base curada/i)
  assert.doesNotMatch(String(response || ""), /Qual e a sua primeira pergunta|Estou aqui para ajudar/i)
})

test("operational shortcuts provide a concise API latency plan from local continuity", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Com esse foco, me de 3 frentes objetivas para comecar.",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Estamos revisando uma API Node para reduzir latencia e melhorar clareza para o time."
        }
      ]
    }
  )

  assert.match(String(response || ""), /1\.|2\.|3\./i)
  assert.match(String(response || ""), /latencia|cache|gargalo|dependencia|dependência/i)
})

test("operational shortcuts detail the API second point with explicit metrics language", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Pegue o segundo ponto e detalhe sem repetir a lista inteira.",
    {
      sessionConversationHistory: [
        {
          role: "assistant",
          content: "1. Meça o caminho real da requisicao: p95/p99, taxa de erro e tempo gasto em banco, cache e chamadas externas. 2. Ache os gargalos dominantes."
        }
      ]
    }
  )

  assert.match(String(response || ""), /metric|medir|p95|p99/i)
  assert.doesNotMatch(String(response || ""), /1\..*2\..*3\./i)
})

test("operational shortcuts simplify the API plan for a small team and one-week window", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Nosso time e pequeno, entao simplifique isso para algo que caiba em uma semana.",
    {
      sessionConversationHistory: [
        {
          role: "assistant",
          content: "Eu detalharia o segundo ponto assim: primeiro mapeie a rota por etapa, depois defina as metricas que voce vai medir desde o inicio, como latencia p95 e p99, taxa de erro e tempo por dependencia externa."
        },
        {
          role: "assistant",
          content: "Comece medindo latencia p95 e p99 da rota, taxa de erro e tempo por dependencia externa."
        }
      ]
    }
  )

  assert.match(String(response || ""), /semana|enxut|gargalo|dependencia|dependência|payload/i)
  assert.doesNotMatch(String(response || ""), /Princ[ií]pios B[aá]sicos|Conversa Continua/i)
})

test("operational shortcuts keep the API executive close even after trimmed local history", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Agora volte ao plano da API e feche em duas frases executivas.",
    {
      sessionConversationHistory: [
        {
          role: "assistant",
          content: "1. Meça o caminho real da requisicao: p95/p99, taxa de erro e tempo gasto em banco, cache e chamadas externas."
        },
        {
          role: "assistant",
          content: "Eu detalharia o segundo ponto assim: primeiro mapeie a rota por etapa, depois defina as metricas que voce vai medir desde o inicio, como latencia p95 e p99, taxa de erro e tempo por dependencia externa."
        },
        {
          role: "assistant",
          content: "JWT e um comprovante assinado que o sistema entrega depois do login para lembrar quem o usuario e nas proximas acoes."
        }
      ]
    }
  )

  assert.match(String(response || ""), /latencia|priorize|prioridade|gargalo|rota/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("operational shortcuts keep JWT explanation in product language", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Mudando de assunto: explique JWT para um gerente de produto, sem jargao.",
    {}
  )

  assert.match(String(response || ""), /login|acesso|permiss/i)
  assert.doesNotMatch(String(response || ""), /desenvolvedor junior|observacao avancada/i)
})

test("operational shortcuts summarize Romanos 8 theme without contamination", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Qual e o eixo central desse capitulo em 3 linhas curtas?",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice."
        }
      ]
    }
  )

  assert.match(String(response || ""), /romanos|esp[ií]rito|seguran/i)
  assert.doesNotMatch(String(response || ""), /regras de conversa|giom/i)
})

test("operational shortcuts apply Romanos 8 pastorally to an anxious person", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Aplique isso para alguem ansioso, mas sem soar artificial.",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice."
        },
        {
          role: "assistant",
          content: "Romanos 8 sai da culpa para a seguranca em Cristo."
        }
      ]
    }
  )

  assert.match(String(response || ""), /ansios|medo|seguran|descanso|firmeza/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("operational shortcuts answer Romanos 8 guilt versus security directly", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Quando eu disser 'esse texto', continue em Romanos 8. Esse texto fala mais de culpa ou de seguranca?",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice."
        }
      ]
    }
  )

  assert.match(String(response || ""), /seguran/i)
  assert.doesNotMatch(String(response || ""), /24 versiculos|Romanos 8 \(NAA\) 1/i)
})

test("operational shortcuts provide a four-block weekly Bible study plan", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Agora outro assunto: me monte um estudo biblico semanal de 4 blocos.",
    {}
  )

  assert.match(String(response || ""), /1\.|2\.|3\.|4\./i)
  assert.match(String(response || ""), /leitura|observa|aplica|ora[cç][aã]o|revis[aã]o/i)
  assert.doesNotMatch(String(response || ""), /culpa|seguran/i)
})

test("operational shortcuts answer current time and date deterministically with runtime clock", () => {
  const response = resolveOperationalRuntimeShortcut(
    "qual horario de agora , dia mes e ano",
    {
      runtimeClock: {
        nowMs: Date.parse("2026-03-31T23:25:00Z"),
        timezone: "America/Sao_Paulo"
      }
    }
  )

  assert.match(String(response || ""), /20:25/i)
  assert.match(String(response || ""), /31\/03\/2026/i)
  assert.doesNotMatch(String(response || ""), /jogo|partida|agenda esportiva/i)
})

test("operational shortcuts resolve simple arithmetic even inside a brief summary phrasing", () => {
  const response = resolveOperationalRuntimeShortcut(
    "resuma rapidamente quanto e 2 + 2",
    {}
  )

  assert.match(String(response || ""), /2\s*\+\s*2/i)
  assert.match(String(response || ""), /4|quatro/i)
  assert.doesNotMatch(String(response || ""), /Nao consegui responder/i)
})

test("operational shortcuts summarize upload follow-up without generating document artifact", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Faca um resumo curto disso em 2 linhas.",
    {
      sessionConversationHistory: [
        {
          role: "assistant",
          content: "O objetivo principal do arquivo e validar leitura fiel de anexos no runtime."
        }
      ]
    }
  )

  assert.match(String(response || ""), /leitura fiel|anexos|runtime|validar/i)
  assert.doesNotMatch(String(response || ""), /sou o giom|documento/i)
})

test("operational shortcuts turn spreadsheet follow-up into a short in-chat schedule", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Agora monte um cronograma simples em 3 etapas com base nessa planilha, sem criar arquivo.",
    {
      sessionConversationHistory: [
        {
          role: "assistant",
          content: "O item com status em teste e OCR local."
        }
      ]
    }
  )

  assert.match(String(response || ""), /1\.|2\.|3\./i)
  assert.match(String(response || ""), /ocr|planilha|follow|obrigatorio|obrigatório/i)
})

test("operational shortcuts keep onboarding priorities concise and executive", () => {
  const response = resolveOperationalRuntimeShortcut(
    "Com esse assunto, me de 2 prioridades iniciais em tom executivo.",
    {
      sessionConversationHistory: [
        {
          role: "user",
          content: "Meu nome e Marina e estamos tratando de onboarding de clientes."
        }
      ]
    }
  )

  assert.match(String(response || ""), /1\.|2\./i)
  assert.match(String(response || ""), /onboarding|cliente|follow-up|prazo|bloqueio/i)
})
