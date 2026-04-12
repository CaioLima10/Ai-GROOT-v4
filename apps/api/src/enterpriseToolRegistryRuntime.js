function buildRuntimeId(prefix = "tool") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeValue(value, depth = 0) {
  if (depth > 2) {
    return "[depth_limit]"
  }

  if (value == null) {
    return value
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => sanitizeValue(entry, depth + 1))
  }

  if (typeof value === "object") {
    return Object.entries(value).slice(0, 16).reduce((acc, [key, entry]) => {
      acc[key] = sanitizeValue(entry, depth + 1)
      return acc
    }, {})
  }

  return String(value)
}

function buildToolError(message, code, statusCode = 400, details = null) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  if (details) {
    error.details = details
  }
  return error
}

function pushBounded(store, entry, maxItems) {
  store.push(entry)
  if (store.length > maxItems) {
    store.splice(0, store.length - maxItems)
  }
}

function coercePrimitiveValue(schema, value) {
  if (value == null) {
    return value
  }

  if (schema?.coerce !== true) {
    return value
  }

  if (schema.type === "number" || schema.type === "integer") {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : value
  }

  if (schema.type === "boolean" && typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }

  return value
}

function validateAgainstSchema(schema, value, path = "input") {
  const normalizedSchema = schema && typeof schema === "object" ? schema : { type: "object" }
  const workingValue = value == null ? undefined : coercePrimitiveValue(normalizedSchema, value)

  if (workingValue == null) {
    if (Object.prototype.hasOwnProperty.call(normalizedSchema, "default")) {
      return {
        ok: true,
        value: normalizedSchema.default,
        errors: []
      }
    }

    if (normalizedSchema.required === true) {
      return {
        ok: false,
        errors: [`${path} is required`]
      }
    }

    return {
      ok: true,
      value: workingValue,
      errors: []
    }
  }

  if (normalizedSchema.type === "object") {
    if (!workingValue || typeof workingValue !== "object" || Array.isArray(workingValue)) {
      return {
        ok: false,
        errors: [`${path} must be an object`]
      }
    }

    const properties = normalizedSchema.properties && typeof normalizedSchema.properties === "object"
      ? normalizedSchema.properties
      : {}
    const requiredKeys = Array.isArray(normalizedSchema.required)
      ? normalizedSchema.required
      : []
    const additionalProperties = normalizedSchema.additionalProperties === true
    const result = {}
    const errors = []

    for (const requiredKey of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(workingValue, requiredKey)) {
        errors.push(`${path}.${requiredKey} is required`)
      }
    }

    for (const [key, propertyValue] of Object.entries(workingValue)) {
      const propertySchema = properties[key]
      if (!propertySchema) {
        if (!additionalProperties) {
          errors.push(`${path}.${key} is not allowed`)
        } else {
          result[key] = propertyValue
        }
        continue
      }

      const propertyValidation = validateAgainstSchema(propertySchema, propertyValue, `${path}.${key}`)
      if (!propertyValidation.ok) {
        errors.push(...propertyValidation.errors)
      } else if (propertyValidation.value !== undefined) {
        result[key] = propertyValidation.value
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        continue
      }
      if (Object.prototype.hasOwnProperty.call(workingValue, key)) {
        continue
      }
      if (Object.prototype.hasOwnProperty.call(propertySchema, "default")) {
        result[key] = propertySchema.default
      }
    }

    return {
      ok: errors.length === 0,
      value: errors.length === 0 ? result : undefined,
      errors
    }
  }

  if (normalizedSchema.type === "array") {
    if (!Array.isArray(workingValue)) {
      return {
        ok: false,
        errors: [`${path} must be an array`]
      }
    }

    const itemSchema = normalizedSchema.items || {}
    const minItems = Number(normalizedSchema.minItems || 0) || 0
    const maxItems = Number(normalizedSchema.maxItems || 0) || 0
    const errors = []

    if (workingValue.length < minItems) {
      errors.push(`${path} must contain at least ${minItems} item(s)`)
    }
    if (maxItems > 0 && workingValue.length > maxItems) {
      errors.push(`${path} must contain at most ${maxItems} item(s)`)
    }

    const result = workingValue.map((entry, index) => validateAgainstSchema(itemSchema, entry, `${path}[${index}]`))
    result.forEach((entry) => {
      if (!entry.ok) {
        errors.push(...entry.errors)
      }
    })

    return {
      ok: errors.length === 0,
      value: errors.length === 0 ? result.map((entry) => entry.value) : undefined,
      errors
    }
  }

  if (normalizedSchema.type === "string") {
    if (typeof workingValue !== "string") {
      return {
        ok: false,
        errors: [`${path} must be a string`]
      }
    }

    const minLength = Number(normalizedSchema.minLength || 0) || 0
    const maxLength = Number(normalizedSchema.maxLength || 0) || 0
    const enumValues = Array.isArray(normalizedSchema.enum) ? normalizedSchema.enum : null
    const errors = []

    if (workingValue.length < minLength) {
      errors.push(`${path} must contain at least ${minLength} character(s)`)
    }
    if (maxLength > 0 && workingValue.length > maxLength) {
      errors.push(`${path} must contain at most ${maxLength} character(s)`)
    }
    if (enumValues && !enumValues.includes(workingValue)) {
      errors.push(`${path} must be one of: ${enumValues.join(", ")}`)
    }

    return {
      ok: errors.length === 0,
      value: workingValue,
      errors
    }
  }

  if (normalizedSchema.type === "number" || normalizedSchema.type === "integer") {
    if (typeof workingValue !== "number" || Number.isNaN(workingValue)) {
      return {
        ok: false,
        errors: [`${path} must be a number`]
      }
    }

    if (normalizedSchema.type === "integer" && !Number.isInteger(workingValue)) {
      return {
        ok: false,
        errors: [`${path} must be an integer`]
      }
    }

    const minimum = Object.prototype.hasOwnProperty.call(normalizedSchema, "minimum")
      ? Number(normalizedSchema.minimum)
      : null
    const maximum = Object.prototype.hasOwnProperty.call(normalizedSchema, "maximum")
      ? Number(normalizedSchema.maximum)
      : null
    const errors = []

    if (minimum != null && workingValue < minimum) {
      errors.push(`${path} must be greater than or equal to ${minimum}`)
    }
    if (maximum != null && workingValue > maximum) {
      errors.push(`${path} must be lower than or equal to ${maximum}`)
    }

    return {
      ok: errors.length === 0,
      value: workingValue,
      errors
    }
  }

  if (normalizedSchema.type === "boolean") {
    if (typeof workingValue !== "boolean") {
      return {
        ok: false,
        errors: [`${path} must be a boolean`]
      }
    }

    return {
      ok: true,
      value: workingValue,
      errors: []
    }
  }

  return {
    ok: true,
    value: workingValue,
    errors: []
  }
}

function buildPublicToolDescriptor(tool, context = {}) {
  const enabled = typeof tool.enabled === "function" ? Boolean(tool.enabled(context)) : true

  return {
    id: tool.id,
    title: tool.title,
    description: tool.description,
    category: tool.category || "general",
    timeoutMs: tool.timeoutMs,
    grounding: tool.grounding || null,
    inputSchema: tool.inputSchema || { type: "object", properties: {} },
    outputDescription: tool.outputDescription || null,
    enabled
  }
}

export function createEnterpriseToolRegistry(options = {}) {
  const tools = new Map()
  const executions = []
  const maxExecutions = Math.max(50, Number(options.maxExecutions || 400))
  const logger = options.logger || null
  const traceStore = options.traceStore || null

  function registerTool(definition = {}) {
    const id = String(definition.id || "").trim()
    if (!id) {
      throw new Error("Tool id is required")
    }

    tools.set(id, {
      timeoutMs: Math.max(100, Number(definition.timeoutMs || 5_000)),
      inputSchema: definition.inputSchema || { type: "object", properties: {} },
      category: definition.category || "general",
      grounding: definition.grounding || null,
      outputDescription: definition.outputDescription || null,
      ...definition,
      id
    })

    return tools.get(id)
  }

  function getTool(toolId) {
    return tools.get(String(toolId || "").trim()) || null
  }

  function listTools(context = {}) {
    return Array.from(tools.values()).map((tool) => buildPublicToolDescriptor(tool, context))
  }

  function getRecentExecutions(limit = 30) {
    return executions
      .slice()
      .sort((left, right) => Date.parse(right.finishedAt || right.startedAt || 0) - Date.parse(left.finishedAt || left.startedAt || 0))
      .slice(0, Math.max(1, Math.min(Number(limit || 30) || 30, 100)))
  }

  function getSummary() {
    return {
      totalTools: tools.size,
      enabledTools: listTools().filter((tool) => tool.enabled).length,
      executions: {
        total: executions.length,
        errors: executions.filter((entry) => entry.status === "error").length
      }
    }
  }

  async function executeTool(toolId, input = {}, context = {}) {
    const tool = getTool(toolId)
    if (!tool) {
      throw buildToolError("Tool nao encontrada", "TOOL_NOT_FOUND", 404)
    }

    if (typeof tool.enabled === "function" && !tool.enabled(context)) {
      throw buildToolError("Tool nao habilitada nesta execucao", "TOOL_DISABLED", 503)
    }

    const validation = validateAgainstSchema(tool.inputSchema, input, "input")
    if (!validation.ok) {
      throw buildToolError(
        "Payload invalido para a tool solicitada",
        "TOOL_INPUT_INVALID",
        400,
        validation.errors
      )
    }

    const requestId = String(context.requestId || buildRuntimeId("toolreq")).trim()
    const traceId = String(context.traceId || "").trim() || null
    const startedAtMs = Date.now()
    const startedAt = new Date(startedAtMs).toISOString()
    const executionId = buildRuntimeId("toolrun")

    try {
      const runner = async ({ signal } = {}) => tool.execute(validation.value || {}, {
        ...context,
        signal
      })

      const output = traceStore
        ? await traceStore.withTrace({
          requestId,
          traceId,
          name: `tool:${tool.id}`,
          kind: "tool",
          timeoutMs: tool.timeoutMs,
          metadata: {
            toolId: tool.id,
            category: tool.category,
            grounding: tool.grounding?.mode || null
          }
        }, runner)
        : await runner()

      const finishedAtMs = Date.now()
      const execution = {
        executionId,
        toolId: tool.id,
        requestId,
        traceId,
        category: tool.category,
        status: "ok",
        durationMs: finishedAtMs - startedAtMs,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        input: sanitizeValue(validation.value || {}),
        output: sanitizeValue(output),
        grounding: tool.grounding || null
      }

      pushBounded(executions, execution, maxExecutions)
      logger?.info?.(requestId, "TOOL_EXECUTED", {
        toolId: tool.id,
        executionId,
        durationMs: execution.durationMs
      })

      return {
        success: true,
        executionId,
        toolId: tool.id,
        requestId,
        traceId,
        durationMs: execution.durationMs,
        grounding: tool.grounding || null,
        output
      }
    } catch (error) {
      const finishedAtMs = Date.now()
      const execution = {
        executionId,
        toolId: tool.id,
        requestId,
        traceId,
        category: tool.category,
        status: "error",
        durationMs: finishedAtMs - startedAtMs,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        input: sanitizeValue(validation.value || {}),
        error: {
          message: getErrorMessage(error),
          code: error?.code || null,
          details: error?.details || null
        },
        grounding: tool.grounding || null
      }

      pushBounded(executions, execution, maxExecutions)
      logger?.error?.(requestId, "TOOL_EXECUTION_FAILED", {
        toolId: tool.id,
        executionId,
        error: execution.error.message,
        code: execution.error.code
      })
      throw error
    }
  }

  return {
    executeTool,
    getRecentExecutions,
    getSummary,
    getTool,
    listTools,
    registerTool
  }
}
