function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getCompatResponseText(answer) {
  if (typeof answer === "string") return answer
  return answer?.response ?? answer?.answer ?? ""
}

export function registerEnterpriseCompatRoutes(app, deps) {
  const {
    crypto,
    listCompatModels,
    AI_MODEL_OWNER,
    resolveCompatModel,
    buildQuestionFromMessages,
    buildQuestionFromGeminiContents,
    flattenMessageContent,
    estimateUsage,
    askGroot,
    getCompatContext
  } = deps

  app.get("/v1/models", (_req, res) => {
    res.json({
      object: "list",
      data: listCompatModels().map((model) => ({
        id: model.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: AI_MODEL_OWNER
      }))
    })
  })

  app.post("/v1/chat/completions", async (req, res) => {
    try {
      const { model = "groot-1-free", messages = [] } = req.body || {}
      const preset = resolveCompatModel(model)
      const question = buildQuestionFromMessages(messages)

      if (!question) {
        return res.status(400).json({ error: { message: "messages vazio", type: "invalid_request_error" } })
      }

      const answer = await askGroot(question, getCompatContext(model, {
        requestId: `compat_${Date.now()}`,
        assistantProfile: preset.profile,
        activeModules: preset.modules
      }))

      const responseText = getCompatResponseText(answer)

      res.json({
        id: `chatcmpl_${crypto.randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: responseText
            },
            finish_reason: "stop"
          }
        ],
        usage: estimateUsage(responseText)
      })
    } catch (error) {
      res.status(500).json({
        error: {
          message: getErrorMessage(error),
          type: "server_error"
        }
      })
    }
  })

  app.post("/v1/responses", async (req, res) => {
    try {
      const { model = "groot-1-free", input = "", instructions = "" } = req.body || {}
      const preset = resolveCompatModel(model)
      const question = Array.isArray(input)
        ? input
          .map((item) => typeof item === "string" ? item : flattenMessageContent(item?.content || item?.text || ""))
          .join("\n")
        : String(input || "")

      if (!question.trim()) {
        return res.status(400).json({ error: { message: "input vazio", type: "invalid_request_error" } })
      }

      const answer = await askGroot(question, getCompatContext(model, {
        requestId: `resp_${Date.now()}`,
        assistantProfile: preset.profile,
        activeModules: preset.modules,
        instructions
      }))

      const responseText = getCompatResponseText(answer)

      res.json({
        id: `resp_${crypto.randomUUID()}`,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        status: "completed",
        model,
        output_text: responseText,
        output: [
          {
            id: `msg_${crypto.randomUUID()}`,
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: responseText,
                annotations: []
              }
            ]
          }
        ],
        usage: estimateUsage(responseText)
      })
    } catch (error) {
      res.status(500).json({
        error: {
          message: getErrorMessage(error),
          type: "server_error"
        }
      })
    }
  })

  app.post(/^\/v1beta\/models\/([^:]+):generateContent$/, async (req, res) => {
    try {
      const model = req.params[0] || "groot-1-free"
      const question = buildQuestionFromGeminiContents(req.body?.contents || [])
      const systemInstruction = Array.isArray(req.body?.systemInstruction?.parts)
        ? req.body.systemInstruction.parts.map((part) => part?.text || "").filter(Boolean).join("\n")
        : ""

      if (!question.trim()) {
        return res.status(400).json({ error: { message: "contents vazio", status: "INVALID_ARGUMENT" } })
      }

      const answer = await askGroot(question, getCompatContext(model, {
        requestId: `gem_${Date.now()}`,
        instructions: systemInstruction
      }))

      const responseText = getCompatResponseText(answer)

      res.json({
        candidates: [
          {
            index: 0,
            content: {
              role: "model",
              parts: [{ text: responseText }]
            },
            finishReason: "STOP"
          }
        ],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: Math.max(1, Math.ceil(responseText.length / 4)),
          totalTokenCount: Math.max(1, Math.ceil(responseText.length / 4))
        },
        modelVersion: model
      })
    } catch (error) {
      res.status(500).json({
        error: {
          message: getErrorMessage(error),
          status: "INTERNAL"
        }
      })
    }
  })
}