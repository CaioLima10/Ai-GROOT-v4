function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeText(value, maxLength = 240) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return ""
  }

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function uniqueStrings(values = [], limit = 12) {
  return Array.from(
    new Set(
      normalizeArray(values)
        .map((value) => normalizeText(value, 120))
        .filter(Boolean)
    )
  ).slice(0, limit)
}

function normalizeTurn(entry = {}) {
  const normalized = normalizeObject(entry)
  const role = normalized.role === "assistant" ? "assistant" : "user"
  const content = normalizeText(normalized.content, 1_200)
  if (!content) {
    return null
  }

  return {
    role,
    content,
    created_at: normalized.created_at || normalized.createdAt || new Date().toISOString()
  }
}

function dedupeTurns(turns = [], limit = 18) {
  const seen = new Set()
  const normalizedTurns = normalizeArray(turns)
    .map(normalizeTurn)
    .filter(Boolean)
    .filter((turn) => {
      const signature = `${turn.role}:${turn.content}`
      if (seen.has(signature)) {
        return false
      }

      seen.add(signature)
      return true
    })

  return normalizedTurns.slice(-Math.max(2, Number(limit || 18) || 18))
}

function buildSessionKey(userId, sessionId = null) {
  return `${String(userId || "anonymous")}::${String(sessionId || "default")}`
}

function sortByUpdatedAt(items = []) {
  return normalizeArray(items).sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || 0) || 0
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || 0) || 0
    return rightTime - leftTime
  })
}

function toUserTurns(turns = []) {
  return normalizeArray(turns)
    .filter((turn) => turn?.role === "user")
    .map((turn) => normalizeText(turn.content, 180))
    .filter(Boolean)
}

function inferOpenTasks(turns = [], limit = 4) {
  const actionablePattern = /\b(vamos|preciso|quero|me ajude|me ajuda|implemente|corrija|adicione|crie|estruture|planeje|resolva|resolver|melhore|pesquise|compare|analise|organize|continue|retome)\b/i

  return uniqueStrings(
    toUserTurns(turns)
      .filter((content) => actionablePattern.test(content))
      .slice(-6),
    limit
  )
}

function inferRecentRequests(turns = [], limit = 3) {
  return uniqueStrings(toUserTurns(turns).slice(-limit), limit)
}

function mergeProfilePreferences(base = {}, patch = {}) {
  const existing = normalizeObject(base)
  const incoming = normalizeObject(patch)
  const mergedKnownFacts = normalizeObject(existing.knownFacts)

  Object.entries(normalizeObject(incoming.knownFacts)).forEach(([key, value]) => {
    const normalized = normalizeText(value, 120)
    if (normalized) {
      mergedKnownFacts[key] = normalized
    }
  })

  return {
    ...existing,
    ...incoming,
    knownFacts: mergedKnownFacts,
    activeModules: uniqueStrings([...(existing.activeModules || []), ...(incoming.activeModules || [])], 12),
    bibleStudyModules: uniqueStrings([...(existing.bibleStudyModules || []), ...(incoming.bibleStudyModules || [])], 12),
    promptPacks: uniqueStrings([...(existing.promptPacks || []), ...(incoming.promptPacks || [])], 12),
    recentTopics: uniqueStrings([...(existing.recentTopics || []), ...(incoming.recentTopics || [])], 12),
    currentTasks: uniqueStrings([...(existing.currentTasks || []), ...(incoming.currentTasks || [])], 6)
  }
}

function buildProfilePatch({
  existingProfile,
  context,
  metadata,
  userId,
  sessionId,
  updatedAt,
  openTasks,
  recentTopics
}) {
  const profile = normalizeObject(existingProfile)
  const knownFacts = normalizeObject(context?.knownFacts)
  const conversationState = normalizeObject(context?.conversationState)
  const assistantProfile = normalizeText(metadata?.assistantProfile, 80)
  const locale = normalizeText(
    metadata?.locale
      || metadata?.language
      || profile.locale
      || knownFacts.locale,
    32
  )

  return mergeProfilePreferences(profile, {
    knownFacts,
    assistantProfile: assistantProfile || profile.assistantProfile || null,
    activeModules: normalizeArray(metadata?.activeModules),
    domainSubmodules: normalizeObject(metadata?.domainSubmodules),
    bibleStudyModules: normalizeArray(metadata?.bibleStudyModules),
    promptPacks: normalizeArray(metadata?.promptPacks),
    locale: locale || undefined,
    currentGoal: normalizeText(
      knownFacts.currentGoal
        || profile.currentGoal
        || conversationState.resolvedFocus
        || openTasks[0],
      140
    ),
    recentTopics,
    currentTasks: openTasks,
    conversationMode: normalizeText(conversationState.mode, 48),
    lastIntent: normalizeText(conversationState.latestIntent, 80),
    lastFocus: normalizeText(conversationState.resolvedFocus, 140),
    knownFactsText: normalizeText(context?.knownFactsText, 280),
    lastSessionId: sessionId || profile.lastSessionId || null,
    lastInteractionAt: updatedAt,
    userId: String(userId || "anonymous")
  })
}

function buildSummaryText({
  context,
  profilePatch,
  openTasks,
  recentTopics,
  turns
}) {
  const parts = []
  const knownFacts = normalizeObject(profilePatch?.knownFacts)
  const displayName = normalizeText(
    knownFacts.preferredName
      || knownFacts.name
      || profilePatch?.preferredName
      || "",
    80
  )
  const focus = normalizeText(
    profilePatch?.currentGoal
      || context?.conversationState?.resolvedFocus
      || "",
    160
  )
  const stateSummary = normalizeText(context?.conversationState?.summary, 220)
  const contextSummary = normalizeText(context?.contextSummary, 220)
  const knownFactsText = normalizeText(context?.knownFactsText, 220)
  const recentRequests = inferRecentRequests(turns, 3)

  if (displayName) {
    parts.push(`Usuario: ${displayName}`)
  }

  if (focus) {
    parts.push(`Foco atual: ${focus}`)
  }

  if (openTasks.length > 0) {
    parts.push(`Tarefas em aberto: ${openTasks.join(" | ")}`)
  }

  if (recentTopics.length > 0) {
    parts.push(`Topicos recentes: ${recentTopics.join(", ")}`)
  }

  if (knownFactsText) {
    parts.push(`Fatos confirmados: ${knownFactsText}`)
  }

  if (stateSummary) {
    parts.push(`Estado da conversa: ${stateSummary}`)
  }

  if (contextSummary) {
    parts.push(`Resumo operacional: ${contextSummary}`)
  }

  if (recentRequests.length > 0) {
    parts.push(`Pedidos recentes: ${recentRequests.join(" | ")}`)
  }

  return normalizeText(parts.join(" | "), 1_000)
}

function buildSnapshotRecord({
  userId,
  sessionId,
  updatedAt,
  turns,
  context,
  profilePatch,
  summaryText,
  metadata,
  persistedSummaryAt = null
}) {
  const recentTopics = uniqueStrings([
    ...(context?.conversationState?.latestTopics || []),
    ...(context?.conversationState?.priorTopics || [])
  ], 10)
  const openTasks = inferOpenTasks(turns, 4)
  const signature = normalizeArray(turns)
    .map((turn) => `${turn.role}:${turn.content}`)
    .join(" || ")

  return {
    userId: String(userId || "anonymous"),
    sessionId: sessionId || null,
    updatedAt,
    persistedSummaryAt,
    turnCount: normalizeArray(turns).length,
    totalChars: signature.length,
    signature,
    summary: summaryText,
    profile: profilePatch,
    knownFacts: normalizeObject(context?.knownFacts),
    knownFactsText: normalizeText(context?.knownFactsText, 280),
    conversationState: normalizeObject(context?.conversationState),
    recentConversationText: normalizeText(context?.recentConversationText?.replace(/\n/g, " | "), 320),
    openTasks,
    recentTopics,
    metadata: {
      requestId: metadata?.requestId || null,
      provider: metadata?.provider || null,
      assistantProfile: metadata?.assistantProfile || null,
      streaming: Boolean(metadata?.streaming),
      askRoute: normalizeObject(metadata?.askRoute),
      locale: metadata?.locale || metadata?.language || null
    }
  }
}

export function createEnterpriseLongMemoryRuntime(options = {}) {
  const connector = options.connector || null
  if (!connector || typeof connector.getContextForPrompt !== "function") {
    throw new Error("createEnterpriseLongMemoryRuntime requires connector.getContextForPrompt")
  }

  if (typeof connector.updateUserProfile !== "function") {
    throw new Error("createEnterpriseLongMemoryRuntime requires connector.updateUserProfile")
  }

  if (typeof connector.saveSummary !== "function") {
    throw new Error("createEnterpriseLongMemoryRuntime requires connector.saveSummary")
  }

  const runtimeSessionMemoryStore = options.runtimeSessionMemoryStore || null
  const logger = options.logger || null
  const profileSnapshots = new Map()
  const sessionSnapshots = new Map()
  const recentCompactions = []
  const maxProfileSnapshots = Math.max(20, Number(options.maxProfileSnapshots || 200))
  const maxSessionSnapshots = Math.max(20, Number(options.maxSessionSnapshots || 300))
  const maxRecentCompactions = Math.max(20, Number(options.maxRecentCompactions || 100))
  const summaryTurnThreshold = Math.max(4, Number(options.summaryTurnThreshold || 8))
  const summaryCharThreshold = Math.max(250, Number(options.summaryCharThreshold || 900))
  const summaryCooldownMs = Math.max(10_000, Number(options.summaryCooldownMs || 45_000))
  const recentHistoryLimit = Math.max(8, Number(options.recentHistoryLimit || 14))

  function trimMap(map, limit) {
    const entries = sortByUpdatedAt(Array.from(map.entries()).map(([key, value]) => ({ key, ...value })))
    if (entries.length <= limit) {
      return
    }

    entries.slice(limit).forEach((entry) => {
      map.delete(entry.key)
    })
  }

  function log(level, event, payload = {}) {
    if (!logger || typeof logger[level] !== "function") {
      return
    }

    try {
      logger[level](payload.requestId || "memory_runtime", event, payload)
    } catch {
      // logging must never block request handling
    }
  }

  function rememberProfile(userId, profile, summary = "") {
    const key = String(userId || "anonymous")
    profileSnapshots.set(key, {
      key,
      userId: key,
      updatedAt: new Date().toISOString(),
      profile,
      summary: normalizeText(summary, 320)
    })
    trimMap(profileSnapshots, maxProfileSnapshots)
  }

  function rememberSession(snapshot) {
    const key = buildSessionKey(snapshot.userId, snapshot.sessionId)
    sessionSnapshots.set(key, {
      key,
      ...snapshot
    })
    trimMap(sessionSnapshots, maxSessionSnapshots)
  }

  function recordCompaction(snapshot, persisted) {
    recentCompactions.unshift({
      userId: snapshot.userId,
      sessionId: snapshot.sessionId,
      updatedAt: snapshot.updatedAt,
      persisted: Boolean(persisted),
      summary: normalizeText(snapshot.summary, 220),
      requestId: snapshot.metadata?.requestId || null
    })
    recentCompactions.splice(maxRecentCompactions)
  }

  function getStmTurns(userId, sessionId = null) {
    if (!runtimeSessionMemoryStore || typeof runtimeSessionMemoryStore.getRecentTurns !== "function") {
      return []
    }

    return runtimeSessionMemoryStore.getRecentTurns({
      userId,
      sessionId,
      limit: recentHistoryLimit
    })
  }

  function buildMergedTurns({ userId, sessionId, question, responseText, conversationHistory = [] }) {
    const fromRequest = normalizeArray(conversationHistory)
    const fromStm = getStmTurns(userId, sessionId)
    const currentTurns = []

    if (normalizeText(question, 1_200)) {
      currentTurns.push({
        role: "user",
        content: normalizeText(question, 1_200)
      })
    }

    if (normalizeText(responseText, 1_200)) {
      currentTurns.push({
        role: "assistant",
        content: normalizeText(responseText, 1_200)
      })
    }

    return dedupeTurns([...fromRequest, ...fromStm, ...currentTurns], recentHistoryLimit)
  }

  async function buildSnapshot({
    userId,
    sessionId = null,
    question = "",
    responseText = "",
    conversationHistory = [],
    metadata = {}
  }) {
    const safeUserId = String(userId || "anonymous")
    const updatedAt = new Date().toISOString()
    const turns = buildMergedTurns({
      userId: safeUserId,
      sessionId,
      question,
      responseText,
      conversationHistory
    })

    const context = await connector.getContextForPrompt(safeUserId, {
      limit: recentHistoryLimit,
      sessionId: sessionId || null,
      activeModules: normalizeArray(metadata.activeModules),
      bibleStudyModules: normalizeArray(metadata.bibleStudyModules),
      conversationHistory: turns
    })

    const recentTopics = uniqueStrings([
      ...(context?.conversationState?.latestTopics || []),
      ...(context?.conversationState?.priorTopics || [])
    ], 10)
    const openTasks = inferOpenTasks(turns, 4)
    const profilePatch = buildProfilePatch({
      existingProfile: context?.userProfile,
      context,
      metadata,
      userId: safeUserId,
      sessionId,
      updatedAt,
      openTasks,
      recentTopics
    })
    const summaryText = buildSummaryText({
      context,
      profilePatch,
      openTasks,
      recentTopics,
      turns
    })

    return buildSnapshotRecord({
      userId: safeUserId,
      sessionId,
      updatedAt,
      turns,
      context,
      profilePatch: {
        ...profilePatch,
        lastSessionSummary: summaryText
      },
      summaryText,
      metadata
    })
  }

  function shouldPersistSummary(snapshot, force = false) {
    if (force) {
      return true
    }

    const currentKey = buildSessionKey(snapshot.userId, snapshot.sessionId)
    const previous = sessionSnapshots.get(currentKey)
    if (!previous) {
      return snapshot.turnCount >= summaryTurnThreshold || snapshot.totalChars >= summaryCharThreshold
    }

    const signatureChanged = previous.signature !== snapshot.signature
    const cooldownElapsed = !previous.persistedSummaryAt
      || ((Date.now() - Date.parse(previous.persistedSummaryAt || 0)) >= summaryCooldownMs)

    return Boolean(
      signatureChanged
      && cooldownElapsed
      && (snapshot.turnCount >= summaryTurnThreshold || snapshot.totalChars >= summaryCharThreshold)
    )
  }

  async function persistSnapshot(snapshot, options = {}) {
    const safeMetadata = {
      sessionId: snapshot.sessionId,
      requestId: snapshot.metadata?.requestId || null,
      provider: snapshot.metadata?.provider || null,
      assistantProfile: snapshot.metadata?.assistantProfile || null,
      streaming: Boolean(snapshot.metadata?.streaming),
      askRoute: snapshot.metadata?.askRoute || null,
      openTasks: snapshot.openTasks,
      recentTopics: snapshot.recentTopics,
      turnCount: snapshot.turnCount,
      totalChars: snapshot.totalChars,
      summaryType: "session_compaction"
    }

    const persistedProfile = await connector.updateUserProfile(snapshot.userId, snapshot.profile)
    const shouldSaveSummary = shouldPersistSummary(snapshot, options.force === true)
    let persistedSummaryAt = null

    if (shouldSaveSummary) {
      await connector.saveSummary(snapshot.userId, snapshot.summary, safeMetadata)
      persistedSummaryAt = new Date().toISOString()
    }

    const persistedSnapshot = {
      ...snapshot,
      persistedSummaryAt
    }

    rememberProfile(snapshot.userId, persistedProfile?.preferences || snapshot.profile, snapshot.summary)
    rememberSession(persistedSnapshot)
    recordCompaction(persistedSnapshot, shouldSaveSummary)

    return {
      profile: persistedProfile?.preferences || snapshot.profile,
      summarySaved: shouldSaveSummary,
      summarySavedAt: persistedSummaryAt
    }
  }

  async function updateFromConversation(payload = {}) {
    const safePayload = normalizeObject(payload)
    const userId = String(safePayload.userId || "anonymous")
    const sessionId = safePayload.sessionId ? String(safePayload.sessionId) : null
    const question = normalizeText(safePayload.question, 1_200)
    const responseText = normalizeText(safePayload.responseText, 1_200)
    if (!question && !responseText) {
      return {
        success: false,
        skipped: true,
        reason: "EMPTY_MEMORY_TURN"
      }
    }

    try {
      const snapshot = await buildSnapshot({
        userId,
        sessionId,
        question,
        responseText,
        conversationHistory: safePayload.conversationHistory,
        metadata: safePayload.metadata
      })
      const persisted = await persistSnapshot(snapshot, safePayload)

      log("info", "LONG_MEMORY_UPDATED", {
        requestId: safePayload?.metadata?.requestId || null,
        userId,
        sessionId,
        summarySaved: persisted.summarySaved,
        turnCount: snapshot.turnCount
      })

      return {
        success: true,
        userId,
        sessionId,
        profile: persisted.profile,
        sessionSummary: {
          summary: snapshot.summary,
          updatedAt: snapshot.updatedAt,
          persistedSummaryAt: persisted.summarySavedAt,
          turnCount: snapshot.turnCount,
          recentTopics: snapshot.recentTopics,
          openTasks: snapshot.openTasks,
          conversationState: snapshot.conversationState
        }
      }
    } catch (error) {
      log("warn", "LONG_MEMORY_UPDATE_FAILED", {
        requestId: safePayload?.metadata?.requestId || null,
        userId,
        sessionId,
        error: error?.message || "long_memory_update_failed"
      })
      throw error
    }
  }

  async function compactSession(payload = {}) {
    return updateFromConversation({
      ...payload,
      force: true
    })
  }

  async function getProfileSnapshot(userId, options = {}) {
    const safeUserId = String(userId || "anonymous")
    const sessionId = options?.sessionId ? String(options.sessionId) : null
    const snapshot = await buildSnapshot({
      userId: safeUserId,
      sessionId,
      conversationHistory: options?.conversationHistory,
      metadata: options?.metadata
    })

    rememberProfile(safeUserId, snapshot.profile, snapshot.summary)
    if (sessionId) {
      rememberSession(snapshot)
    }

    const latestSummary = await connector.getLatestSummary(safeUserId)
    return {
      success: true,
      userId: safeUserId,
      profile: snapshot.profile,
      latestSummary: latestSummary?.summary || snapshot.summary || "",
      sessionSummary: sessionId
        ? {
          sessionId,
          summary: snapshot.summary,
          updatedAt: snapshot.updatedAt,
          turnCount: snapshot.turnCount,
          openTasks: snapshot.openTasks,
          recentTopics: snapshot.recentTopics,
          conversationState: snapshot.conversationState
        }
        : null
    }
  }

  async function updateProfile(userId, patch = {}) {
    const safeUserId = String(userId || "anonymous")
    const existing = await connector.getUserProfile(safeUserId)
    const merged = mergeProfilePreferences(existing?.preferences, patch)
    const saved = await connector.updateUserProfile(safeUserId, merged)
    const latestSummary = await connector.getLatestSummary(safeUserId)

    rememberProfile(safeUserId, saved?.preferences || merged, latestSummary?.summary || "")

    return {
      success: true,
      userId: safeUserId,
      profile: saved?.preferences || merged,
      latestSummary: latestSummary?.summary || ""
    }
  }

  async function getSessionSummary(userId, sessionId, options = {}) {
    const safeUserId = String(userId || "anonymous")
    const safeSessionId = sessionId ? String(sessionId) : null
    const cached = sessionSnapshots.get(buildSessionKey(safeUserId, safeSessionId))
    if (cached && !options?.refresh) {
      return {
        success: true,
        userId: safeUserId,
        sessionId: safeSessionId,
        sessionSummary: {
          sessionId: cached.sessionId,
          summary: cached.summary,
          updatedAt: cached.updatedAt,
          persistedSummaryAt: cached.persistedSummaryAt || null,
          turnCount: cached.turnCount,
          totalChars: cached.totalChars,
          recentTopics: cached.recentTopics,
          openTasks: cached.openTasks,
          conversationState: cached.conversationState,
          knownFacts: cached.knownFacts
        }
      }
    }

    const snapshot = await buildSnapshot({
      userId: safeUserId,
      sessionId: safeSessionId,
      conversationHistory: options?.conversationHistory,
      metadata: options?.metadata
    })
    rememberSession(snapshot)

    return {
      success: true,
      userId: safeUserId,
      sessionId: safeSessionId,
      sessionSummary: {
        sessionId: snapshot.sessionId,
        summary: snapshot.summary,
        updatedAt: snapshot.updatedAt,
        turnCount: snapshot.turnCount,
        totalChars: snapshot.totalChars,
        recentTopics: snapshot.recentTopics,
        openTasks: snapshot.openTasks,
        conversationState: snapshot.conversationState,
        knownFacts: snapshot.knownFacts
      }
    }
  }

  function listRecentProfiles(limit = 20) {
    return sortByUpdatedAt(Array.from(profileSnapshots.values()))
      .slice(0, Math.max(1, Number(limit || 20) || 20))
      .map((entry) => ({
        userId: entry.userId,
        updatedAt: entry.updatedAt,
        profile: entry.profile,
        summary: entry.summary
      }))
  }

  function listRecentSessions(limit = 20) {
    return sortByUpdatedAt(Array.from(sessionSnapshots.values()))
      .slice(0, Math.max(1, Number(limit || 20) || 20))
      .map((entry) => ({
        userId: entry.userId,
        sessionId: entry.sessionId,
        updatedAt: entry.updatedAt,
        persistedSummaryAt: entry.persistedSummaryAt || null,
        turnCount: entry.turnCount,
        totalChars: entry.totalChars,
        recentTopics: entry.recentTopics,
        openTasks: entry.openTasks,
        summary: entry.summary,
        conversationState: entry.conversationState,
        metadata: entry.metadata
      }))
  }

  function getSummary() {
    return {
      enabled: true,
      profilesTracked: profileSnapshots.size,
      sessionSnapshots: sessionSnapshots.size,
      recentCompactions: recentCompactions.length,
      thresholds: {
        summaryTurnThreshold,
        summaryCharThreshold,
        summaryCooldownMs
      }
    }
  }

  return {
    updateFromConversation,
    compactSession,
    getProfileSnapshot,
    updateProfile,
    getSessionSummary,
    listRecentProfiles,
    listRecentSessions,
    getRecentCompactions: (limit = 20) => recentCompactions.slice(0, Math.max(1, Number(limit || 20) || 20)),
    getSummary
  }
}
