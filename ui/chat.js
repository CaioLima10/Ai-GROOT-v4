// Official web source lives in apps/web/public. The ui/ folder is a legacy mirror.
const API_CONFIG = {
  BASE_URL: ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:3000" : "",
  TIMEOUT: 45000
}

const DEFAULT_PREFERENCES = {
  verbosity: "natural",
  examples: true,
  noEmojis: true,
  safetyLevel: "standard",
  ageGroup: "adult",
  theme: localStorage.getItem("groot-theme") || "dracula",
  assistantProfile: "auto",
  assistantProfileLocked: false,
  activeModules: [],
  moduleSelectionLocked: false,
  bibleStudyModules: [],
  agroWeatherAuto: false,
  agroWeatherLabel: "",
  agroWeatherLatitude: "",
  agroWeatherLongitude: "",
  agroWeatherDays: 3,
  promptPacks: [
    "chatgpt_reasoning",
    "github_copilot_engineering",
    "gemini_research"
  ]
}

const VIEW_META = {
  chat: { title: "Chat", eyebrow: "Workspace" },
  memory: { title: "Memória", eyebrow: "Histórico" },
  plan: { title: "Plano", eyebrow: "Conta" },
  help: { title: "Ajuda", eyebrow: "Suporte" },
  settings: { title: "Configurações", eyebrow: "Preferências" }
}

const WORKING_STATUS_MAP = {
  default: ["Processando", "Verificando", "Aplicando", "Trabalhando", "Quase lá"],
  image: ["Esboçando", "Renderizando", "Refinando", "Finalizando", "Quase lá"],
  document: ["Montando documento", "Formatando", "Aplicando estrutura", "Preparando prévia", "Quase lá"],
  upload: ["Lendo anexo", "Verificando arquivo", "Extraindo contexto", "Trabalhando na resposta", "Quase lá"]
}

const elements = {
  appShell: document.getElementById("appShell"),
  body: document.body,
  sidebarScrim: document.getElementById("sidebarScrim"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  pageTitle: document.getElementById("pageTitle"),
  pageEyebrow: document.getElementById("pageEyebrow"),
  backendStatus: document.getElementById("backendStatus"),
  exportChatBtn: document.getElementById("exportChatBtn"),
  topbarAccountBtn: document.getElementById("topbarAccountBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  profileTrigger: document.getElementById("profileTrigger"),
  profileMenu: document.getElementById("profileMenu"),
  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  userRole: document.getElementById("userRole"),
  menuAvatar: document.getElementById("menuAvatar"),
  menuName: document.getElementById("menuName"),
  menuPlan: document.getElementById("menuPlan"),
  openLoginBtn: document.getElementById("openLoginBtn"),
  switchAccountBtn: document.getElementById("switchAccountBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  themeDraculaBtn: document.getElementById("themeDraculaBtn"),
  themeGithubBtn: document.getElementById("themeGithubBtn"),
  themeDiscordBtn: document.getElementById("themeDiscordBtn"),
  themeLightBtn: document.getElementById("themeLightBtn"),
  chatView: document.getElementById("view-chat"),
  chat: document.getElementById("chat"),
  chatInner: document.getElementById("chatStreamInner"),
  composerShell: document.getElementById("composerShell"),
  chatProfileBadge: document.getElementById("chatProfileBadge"),
  chatModulesBadge: document.getElementById("chatModulesBadge"),
  chatResearchBadge: document.getElementById("chatResearchBadge"),
  chatUploadsBadge: document.getElementById("chatUploadsBadge"),
  promptChips: Array.from(document.querySelectorAll(".prompt-chip")),
  composerStatus: document.getElementById("composerStatus"),
  authStatus: document.getElementById("authStatus"),
  textarea: document.getElementById("msg"),
  sendBtn: document.getElementById("sendBtn"),
  attachBtn: document.getElementById("attachBtn"),
  fileInput: document.getElementById("fileInput"),
  filePreview: document.getElementById("filePreview"),
  voiceBtn: document.getElementById("voiceBtn"),
  memoryBadge: document.getElementById("memoryBadge"),
  memoryList: document.getElementById("memoryList"),
  learningList: document.getElementById("learningList"),
  currentPlanName: document.getElementById("currentPlanName"),
  planCurrentCard: document.getElementById("planCurrentCard"),
  planActionButtons: Array.from(document.querySelectorAll("[data-plan-action]")),
  helpBackendStatus: document.getElementById("helpBackendStatus"),
  helpAuthStatus: document.getElementById("helpAuthStatus"),
  helpUploadStatus: document.getElementById("helpUploadStatus"),
  helpResearchStatus: document.getElementById("helpResearchStatus"),
  helpPdfStatus: document.getElementById("helpPdfStatus"),
  helpImageGenStatus: document.getElementById("helpImageGenStatus"),
  verbositySelect: document.getElementById("verbositySelect"),
  examplesToggle: document.getElementById("examplesToggle"),
  emojiToggle: document.getElementById("emojiToggle"),
  safetySelect: document.getElementById("safetySelect"),
  ageGroupSelect: document.getElementById("ageGroupSelect"),
  themeSelect: document.getElementById("themeSelect"),
  agroWeatherAutoToggle: document.getElementById("agroWeatherAutoToggle"),
  agroWeatherLabelInput: document.getElementById("agroWeatherLabelInput"),
  agroWeatherLatitudeInput: document.getElementById("agroWeatherLatitudeInput"),
  agroWeatherLongitudeInput: document.getElementById("agroWeatherLongitudeInput"),
  agroWeatherDaysInput: document.getElementById("agroWeatherDaysInput"),
  assistantProfileSelect: document.getElementById("assistantProfileSelect"),
  promptPackToggles: Array.from(document.querySelectorAll("[data-prompt-pack-toggle]")),
  promptPackHint: document.getElementById("promptPackHint"),
  moduleToggles: Array.from(document.querySelectorAll("[data-module-toggle]")),
  bibleStudySettings: document.getElementById("bibleStudySettings"),
  bibleStudyToggles: Array.from(document.querySelectorAll("[data-bible-study-toggle]")),
  profileSettingsHint: document.getElementById("profileSettingsHint"),
  saveSettingsBtn: document.getElementById("saveSettings"),
  settingsStatus: document.getElementById("settingsStatus"),
  settingsAuthMode: document.getElementById("settingsAuthMode"),
  settingsUserLabel: document.getElementById("settingsUserLabel"),
  settingsOauthLabel: document.getElementById("settingsOauthLabel"),
  sidebarResearchStatus: document.getElementById("sidebarResearchStatus"),
  sidebarUploadStatus: document.getElementById("sidebarUploadStatus"),
  sidebarImageStatus: document.getElementById("sidebarImageStatus"),
  openLoginFromSettings: document.getElementById("openLoginFromSettings"),
  loginModal: document.getElementById("loginModal"),
  closeLoginBtn: document.getElementById("closeLoginBtn"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  emailLoginBtn: document.getElementById("emailLogin"),
  emailSignupBtn: document.getElementById("emailSignup"),
  googleLoginBtn: document.getElementById("googleLogin"),
  githubLoginBtn: document.getElementById("githubLogin"),
  loginStatus: document.getElementById("loginStatus"),
  toastStack: document.getElementById("toastStack")
}

const views = {
  chat: document.getElementById("view-chat"),
  memory: document.getElementById("view-memory"),
  plan: document.getElementById("view-plan"),
  help: document.getElementById("view-help"),
  settings: document.getElementById("view-settings")
}

const state = {
  config: null,
  health: null,
  supabase: null,
  user: null,
  authBackend: "local",
  currentView: "chat",
  preferences: { ...DEFAULT_PREFERENCES },
  chatHistory: [],
  pendingFile: null,
  pendingFileUrl: null,
  isSending: false,
  workingStatusTimer: null,
  workingStatusIndex: 0,
  currentWorkingMode: "default",
  speechRecognition: null,
  isRecording: false,
  speechBaseText: ""
}

document.addEventListener("DOMContentLoaded", init)

async function init() {
  bindEvents()
  hydratePreferences()
  applyPreferencesToUI()
  setTheme(state.preferences.theme || DEFAULT_PREFERENCES.theme)
  loadChatHistory()
  renderChatHistory()
  await loadConfig()
  await initAuth()
  initSpeechRecognition()
  await loadSystemHealth()
  await renderMemoryView()
  renderPlanView()
  updateHelpStatus()
  updateAuthUI()
  setView("chat")
}

function bindEvents() {
  elements.newChatBtn?.addEventListener("click", resetChat)
  elements.mobileMenuBtn?.addEventListener("click", () => toggleSidebar())
  elements.sidebarScrim?.addEventListener("click", () => toggleSidebar(false))

  elements.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setView(item.dataset.view || "chat")
      toggleSidebar(false)
    })
  })

  elements.profileTrigger?.addEventListener("click", (event) => {
    event.stopPropagation()
    toggleProfileMenu()
  })

  elements.profileMenu?.addEventListener("click", handleProfileMenuClick)
  elements.topbarAccountBtn?.addEventListener("click", handleAccountShortcut)
  elements.openLoginBtn?.addEventListener("click", openLoginModal)
  elements.openLoginFromSettings?.addEventListener("click", openLoginModal)
  elements.switchAccountBtn?.addEventListener("click", () => {
    closeProfileMenu()
    openLoginModal()
  })
  elements.logoutBtn?.addEventListener("click", logout)
  elements.themeDraculaBtn?.addEventListener("click", () => setTheme("dracula"))
  elements.themeGithubBtn?.addEventListener("click", () => setTheme("github_dark"))
  elements.themeDiscordBtn?.addEventListener("click", () => setTheme("discord"))
  elements.themeLightBtn?.addEventListener("click", () => setTheme("light"))
  elements.exportChatBtn?.addEventListener("click", exportChatAsPdf)

  elements.promptChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      elements.textarea.value = chip.dataset.prompt || ""
      autoResizeTextarea()
      syncChatMode()
      elements.textarea.focus()
    })
  })

  elements.textarea?.addEventListener("input", () => {
    autoResizeTextarea()
    syncChatMode()
  })

  elements.textarea?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  })

  elements.sendBtn?.addEventListener("click", sendMessage)
  elements.attachBtn?.addEventListener("click", () => elements.fileInput?.click())
  elements.fileInput?.addEventListener("change", handleFileSelected)
  elements.voiceBtn?.addEventListener("click", toggleVoiceInput)

  elements.chat?.addEventListener("click", async (event) => {
    const messageActionButton = event.target.closest("[data-message-action]")
    if (messageActionButton) {
      await handleMessageAction(messageActionButton)
      return
    }

    const documentToggle = event.target.closest("[data-document-toggle]")
    if (documentToggle) {
      toggleDocumentPreview(documentToggle.dataset.documentToggle || "")
      return
    }

    const fillButton = event.target.closest("[data-fill]")
    if (fillButton) {
      fillComposer(decodeURIComponent(fillButton.dataset.fill || ""))
      showToast("Conteúdo levado para o editor.", "success")
      return
    }

    const downloadTextButton = event.target.closest("[data-download-text]")
    if (downloadTextButton) {
      downloadTextContent(
        decodeURIComponent(downloadTextButton.dataset.downloadText || ""),
        downloadTextButton.dataset.fileName || "giom-snippet.txt",
        downloadTextButton.dataset.mimeType || "text/plain;charset=utf-8"
      )
      showToast("Arquivo preparado para download.", "success")
      return
    }

    const copyButton = event.target.closest("[data-copy]")
    if (!copyButton) return
    await copyText(decodeURIComponent(copyButton.dataset.copy || ""))
    showToast("Conteúdo copiado.", "success")
  })

  elements.loginModal?.addEventListener("click", (event) => {
    if (event.target === elements.loginModal) {
      closeLoginModal()
    }
  })

  elements.closeLoginBtn?.addEventListener("click", closeLoginModal)
  elements.emailLoginBtn?.addEventListener("click", handleEmailLogin)
  elements.emailSignupBtn?.addEventListener("click", handleEmailSignup)
  elements.googleLoginBtn?.addEventListener("click", () => handleOAuthLogin("google"))
  elements.githubLoginBtn?.addEventListener("click", () => handleOAuthLogin("github"))
  elements.saveSettingsBtn?.addEventListener("click", savePreferences)
  elements.assistantProfileSelect?.addEventListener("change", () => {
    updateProfileHint(getSelectedModulesFromUI())
  })
  elements.promptPackToggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      updatePromptPackHint(getSelectedPromptPacksFromUI())
    })
  })
  elements.moduleToggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const modules = getSelectedModulesFromUI()
      syncBibleStudyControls(modules)
      updateProfileHint(modules)
    })
  })
  elements.bibleStudyToggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      updateProfileHint(getSelectedModulesFromUI())
    })
  })

  elements.planActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.planAction
      if (action === "settings") {
        setView("settings")
      } else {
        showToast("Estrutura de billing pronta na interface, mas sem gateway real conectado ainda.", "warning")
      }
    })
  })

  document.addEventListener("click", (event) => {
    if (!elements.profileMenu?.contains(event.target) && !elements.profileTrigger?.contains(event.target)) {
      closeProfileMenu()
    }
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLoginModal()
      closeProfileMenu()
      toggleSidebar(false)
    }
  })
}

async function apiRequest(endpoint, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT)

  try {
    return await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function loadConfig() {
  try {
    const response = await apiRequest("/config")
    if (!response.ok) return
    state.config = await response.json()
    const maxBytes = state.config?.uploads?.maxBytes || 2_000_000
    elements.helpUploadStatus.textContent = `Até ${formatBytes(maxBytes)}`
    applyUploadAccept()
    refreshCapabilityUI()
  } catch {
    state.config = null
    applyUploadAccept()
    refreshCapabilityUI()
  }
}

function getConfiguredUploadAccept() {
  const accept = state.config?.uploads?.accept
  if (Array.isArray(accept) && accept.length > 0) {
    return accept.join(",")
  }
  if (typeof accept === "string" && accept.trim()) {
    return accept
  }
  return "image/*,.pdf,.zip,.docx,.xlsx,.pptx,.txt,.md,.svg,.json,.jsonl,.js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.c,.cpp,.h,.cs,.php,.rb,.html,.css,.xml,.yml,.yaml,.log,.tsv,.csv,.sql"
}

function applyUploadAccept() {
  if (elements.fileInput) {
    elements.fileInput.accept = getConfiguredUploadAccept()
  }
}

function describeResearchStatus() {
  const liveSources = state.config?.research?.liveSources || []
  if (liveSources.length > 0) {
    return `Web ao vivo: ${liveSources.join(", ")}`
  }
  return "Memoria + RAG"
}

function describeUploadStatus() {
  const supportedKinds = state.config?.uploads?.supportedKinds || []
  if (supportedKinds.length > 0) {
    return supportedKinds
      .map((kind) => {
        if (kind === "image_ocr") return "image/OCR"
        if (kind === "zip") return "zip"
        return kind
      })
      .join(" | ")
  }
  return "text | code | pdf | zip | image"
}

function refreshCapabilityUI() {
  const profileName = elements.assistantProfileSelect?.selectedOptions?.[0]?.textContent || "Professor Genial"
  const modules = getSelectedModulesFromUI()
  const liveResearch = state.config?.research?.mode === "live"
  const weatherLabel = describeAgroWeatherStatus()
  const pdfReady = Boolean(state.config?.features?.pdfParsing || state.config?.uploads?.supports?.pdf)
  const officeReady = Boolean(
    state.config?.uploads?.supports?.docx
    || state.config?.uploads?.supports?.xlsx
    || state.config?.uploads?.supports?.pptx
  )
  const nativeDocsReady = Boolean(state.config?.features?.documentGeneration || state.config?.ai?.documentGeneration?.enabled)
  const imageReady = Boolean(state.config?.features?.imageGeneration || state.config?.ai?.imageGeneration?.enabled)
  const uploadLabel = state.config?.uploads?.maxBytes
    ? `${describeUploadStatus()} • ${formatBytes(state.config.uploads.maxBytes)}`
    : describeUploadStatus()

  if (elements.chatProfileBadge) {
    elements.chatProfileBadge.textContent = `Perfil: ${profileName}`
  }
  if (elements.chatModulesBadge) {
    elements.chatModulesBadge.textContent = `Modulos: ${modules.join(", ") || "developer"}`
  }
  if (elements.chatResearchBadge) {
    elements.chatResearchBadge.textContent = liveResearch
      ? `Pesquisa: ${describeResearchStatus()}${weatherLabel ? ` • ${weatherLabel}` : ""}`
      : "Pesquisa: memoria + RAG"
  }
  if (elements.chatUploadsBadge) {
    elements.chatUploadsBadge.textContent = `Uploads: ${uploadLabel}`
  }

  if (elements.helpResearchStatus) {
    elements.helpResearchStatus.textContent = liveResearch
      ? `${describeResearchStatus()}${weatherLabel ? ` • ${weatherLabel}` : ""}`
      : "Interna / curada"
  }
  if (elements.helpPdfStatus) {
    elements.helpPdfStatus.textContent = pdfReady ? "Ativo" : "Inativo"
  }
  if (elements.helpImageGenStatus) {
    elements.helpImageGenStatus.textContent = imageReady ? "Ativa" : "Aguardando provider"
  }
  if (elements.sidebarResearchStatus) {
    elements.sidebarResearchStatus.textContent = liveResearch ? "Ao vivo" : "Interna"
  }
  if (elements.sidebarUploadStatus) {
    elements.sidebarUploadStatus.textContent = nativeDocsReady
      ? "PDF + Office + docs"
      : (officeReady ? "PDF + Office + imagem" : (pdfReady ? "PDF + imagem" : "Texto"))
  }
  if (elements.sidebarImageStatus) {
    elements.sidebarImageStatus.textContent = imageReady ? "Ativo" : "Desativado"
  }
}

async function loadSystemHealth() {
  try {
    const response = await apiRequest("/health")
    if (!response.ok) throw new Error("Backend offline")
    state.health = await response.json()
    elements.backendStatus.textContent = "Backend online"
    elements.helpBackendStatus.textContent = `${state.health.service || "GIOM"} • online`
  } catch {
    state.health = null
    elements.backendStatus.textContent = "Backend indisponível"
    elements.helpBackendStatus.textContent = "Indisponível"
  }
}

function setView(view) {
  state.currentView = view in views ? view : "chat"

  Object.entries(views).forEach(([name, node]) => {
    node.classList.toggle("active", name === state.currentView)
  })

  elements.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === state.currentView)
  })

  const meta = VIEW_META[state.currentView]
  elements.pageTitle.textContent = meta.title
  elements.pageEyebrow.textContent = meta.eyebrow

  if (state.currentView === "memory") renderMemoryView()
  if (state.currentView === "plan") renderPlanView()
  if (state.currentView === "help") updateHelpStatus()
  if (state.currentView === "settings") {
    applyPreferencesToUI()
    updateAuthUI()
  }
}

function toggleSidebar(force) {
  const open = typeof force === "boolean" ? force : !elements.appShell.classList.contains("sidebar-open")
  elements.appShell.classList.toggle("sidebar-open", open)
  elements.sidebarScrim.classList.toggle("hidden", !open)
}

function toggleProfileMenu(force) {
  const open = typeof force === "boolean" ? force : elements.profileMenu.classList.contains("hidden")
  elements.profileMenu.classList.toggle("hidden", !open)
  elements.profileTrigger?.setAttribute("aria-expanded", String(open))
}

function closeProfileMenu() {
  toggleProfileMenu(false)
}

function handleProfileMenuClick(event) {
  const button = event.target.closest("[data-action]")
  if (!button) return

  if (button.dataset.action === "profile-settings") setView("settings")
  if (button.dataset.action === "profile-plan") setView("plan")
  if (button.dataset.action === "profile-help") setView("help")
  closeProfileMenu()
}

function handleAccountShortcut() {
  if (state.user) {
    setView("settings")
    return
  }
  openLoginModal()
}

function openLoginModal() {
  closeProfileMenu()
  elements.loginModal.classList.remove("hidden")
  elements.emailInput?.focus()
}

function closeLoginModal() {
  elements.loginModal.classList.add("hidden")
  setLoginStatus("")
}

function setLoginStatus(message, isError = false) {
  if (!elements.loginStatus) return
  elements.loginStatus.textContent = message
  elements.loginStatus.style.color = isError ? "var(--danger)" : "var(--muted)"
}

function setSettingsStatus(message, isError = false) {
  if (!elements.settingsStatus) return
  elements.settingsStatus.textContent = message
  elements.settingsStatus.style.color = isError ? "var(--danger)" : "var(--muted)"
}

function setComposerStatus(message, isError = false) {
  if (!elements.composerStatus) return
  elements.composerStatus.textContent = message
  elements.composerStatus.style.color = isError ? "var(--danger)" : "var(--muted)"
}

function updateHelpStatus() {
  elements.helpAuthStatus.textContent = state.supabase
    ? (state.user ? "Supabase autenticado" : "Supabase disponível")
    : "Modo local"
  elements.helpUploadStatus.textContent =
    state.config?.uploads?.maxBytes ? `Até ${formatBytes(state.config.uploads.maxBytes)}` : "Disponível"
  refreshCapabilityUI()
}

function updateAuthUI() {
  const user = state.user
  const displayName = getUserDisplayName()
  const planName = getUserPlan()
  const roleLabel = user ? `${getProviderLabel(user.provider)} • ${planName}` : "Modo local"

  elements.userAvatar.textContent = getUserInitial()
  elements.userName.textContent = displayName
  elements.userRole.textContent = roleLabel
  elements.menuAvatar.textContent = getUserInitial()
  elements.menuName.textContent = displayName
  elements.menuPlan.textContent = `Plano ${planName}`
  elements.topbarAccountBtn.textContent = user ? "Conta" : "Entrar"
  elements.authStatus.textContent = state.supabase
    ? "OAuth GitHub e Google disponível."
    : "Login local ativo. OAuth depende do Supabase."
  elements.settingsAuthMode.textContent = state.supabase ? "Supabase" : "Local"
  elements.settingsUserLabel.textContent = user ? user.email : "Visitante"
  elements.settingsOauthLabel.textContent = state.supabase ? "Disponível" : "Aguardando configuração"

  elements.openLoginBtn.classList.toggle("hidden", Boolean(user))
  elements.switchAccountBtn.classList.toggle("hidden", !user)
  elements.logoutBtn.classList.toggle("hidden", !user)
  elements.googleLoginBtn.disabled = !state.supabase
  elements.githubLoginBtn.disabled = !state.supabase
  elements.googleLoginBtn.style.opacity = state.supabase ? "1" : "0.65"
  elements.githubLoginBtn.style.opacity = state.supabase ? "1" : "0.65"
  renderPlanView()
  updateHelpStatus()
  refreshCapabilityUI()
}

function renderPlanView() {
  elements.currentPlanName.textContent = getUserPlan()
  elements.planCurrentCard.classList.add("current")
}

function hydratePreferences() {
  const stored = readJson(getPreferencesKey(), DEFAULT_PREFERENCES)
  state.preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, ...stored })
}

function normalizePreferences(preferences = {}) {
  const normalized = { ...preferences }

  if (!normalized.assistantProfile || normalized.assistantProfile === "adaptive_teacher") {
    if (normalized.assistantProfileLocked !== true) {
      normalized.assistantProfile = "auto"
      normalized.assistantProfileLocked = false
    }
  }

  if (normalized.assistantProfile === "auto") {
    normalized.assistantProfileLocked = false
  }

  if (!Array.isArray(normalized.activeModules)) {
    normalized.activeModules = []
  }

  const isLegacyDefaultDeveloperOnly =
    normalized.moduleSelectionLocked !== true &&
    normalized.activeModules.length === 1 &&
    normalized.activeModules[0] === "developer"

  if (isLegacyDefaultDeveloperOnly) {
    normalized.activeModules = []
    normalized.moduleSelectionLocked = false
  }

  normalized.agroWeatherAuto = normalized.agroWeatherAuto === true
  normalized.agroWeatherLabel = String(normalized.agroWeatherLabel || "").trim()
  normalized.agroWeatherLatitude = String(normalized.agroWeatherLatitude || "").trim()
  normalized.agroWeatherLongitude = String(normalized.agroWeatherLongitude || "").trim()

  const parsedDays = Number.parseInt(normalized.agroWeatherDays, 10)
  normalized.agroWeatherDays = Number.isFinite(parsedDays)
    ? Math.max(1, Math.min(parsedDays, 7))
    : 3

  return normalized
}

function labelForAssistantProfile(profileId = "auto") {
  const labels = {
    auto: "Auto Adaptativo",
    adaptive_teacher: "Professor Genial",
    senior_engineer: "Senior Engineer",
    concise_operator: "Objetivo Premium",
    research_mentor: "Analista Pesquisador",
    expert_polymath: "Polimata Profissional"
  }

  return labels[profileId] || "Auto Adaptativo"
}

function applyPreferencesToUI() {
  elements.verbositySelect.value = state.preferences.verbosity
  elements.examplesToggle.checked = Boolean(state.preferences.examples)
  elements.emojiToggle.checked = !state.preferences.noEmojis
  elements.safetySelect.value = state.preferences.safetyLevel
  elements.ageGroupSelect.value = state.preferences.ageGroup
  elements.themeSelect.value = state.preferences.theme
  elements.agroWeatherAutoToggle.checked = Boolean(state.preferences.agroWeatherAuto)
  elements.agroWeatherLabelInput.value = state.preferences.agroWeatherLabel || ""
  elements.agroWeatherLatitudeInput.value = state.preferences.agroWeatherLatitude || ""
  elements.agroWeatherLongitudeInput.value = state.preferences.agroWeatherLongitude || ""
  elements.agroWeatherDaysInput.value = String(state.preferences.agroWeatherDays || 3)
  elements.assistantProfileSelect.value = state.preferences.assistantProfile || DEFAULT_PREFERENCES.assistantProfile
  applyPromptPackPreferences(state.preferences.promptPacks || DEFAULT_PREFERENCES.promptPacks)
  applyModulePreferences(state.preferences.activeModules || DEFAULT_PREFERENCES.activeModules)
  applyBibleStudyPreferences(state.preferences.bibleStudyModules || DEFAULT_PREFERENCES.bibleStudyModules)
  setTheme(state.preferences.theme)
  refreshCapabilityUI()
}

function applyPromptPackPreferences(activePromptPacks = []) {
  const selected = new Set(Array.isArray(activePromptPacks) && activePromptPacks.length
    ? activePromptPacks
    : DEFAULT_PREFERENCES.promptPacks)

  elements.promptPackToggles.forEach((toggle) => {
    toggle.checked = selected.has(toggle.dataset.promptPackToggle)
  })

  updatePromptPackHint(Array.from(selected))
}

function applyModulePreferences(activeModules = []) {
  const selected = new Set(Array.isArray(activeModules) && activeModules.length ? activeModules : DEFAULT_PREFERENCES.activeModules)
  elements.moduleToggles.forEach((toggle) => {
    toggle.checked = selected.has(toggle.dataset.moduleToggle)
  })
  syncBibleStudyControls(Array.from(selected))
  updateProfileHint(Array.from(selected))
}

function applyBibleStudyPreferences(activeModules = []) {
  const selected = new Set(Array.isArray(activeModules) ? activeModules : [])
  elements.bibleStudyToggles.forEach((toggle) => {
    toggle.checked = selected.has(toggle.dataset.bibleStudyToggle)
  })
}

function getSelectedPromptPacksFromUI() {
  const promptPacks = elements.promptPackToggles
    .filter((toggle) => toggle.checked)
    .map((toggle) => toggle.dataset.promptPackToggle)

  if (promptPacks.length > 0) return promptPacks
  return [...DEFAULT_PREFERENCES.promptPacks]
}

function getSelectedModulesFromUI() {
  return elements.moduleToggles
    .filter((toggle) => toggle.checked)
    .map((toggle) => toggle.dataset.moduleToggle)
}

function getSelectedBibleStudyModulesFromUI() {
  if (!getSelectedModulesFromUI().includes("bible")) {
    return []
  }

  return elements.bibleStudyToggles
    .filter((toggle) => toggle.checked)
    .map((toggle) => toggle.dataset.bibleStudyToggle)
}

function syncBibleStudyControls(activeModules = []) {
  const bibleEnabled = activeModules.includes("bible")
  elements.bibleStudySettings?.classList.toggle("hidden", !bibleEnabled)
}

function updateProfileHint(activeModules = []) {
  if (!elements.profileSettingsHint) return
  const selectedProfile = elements.assistantProfileSelect?.value || DEFAULT_PREFERENCES.assistantProfile
  const profileName = labelForAssistantProfile(selectedProfile)
  const bibleModules = getSelectedBibleStudyModulesFromUI()
  const bibleHint = activeModules.includes("bible") && bibleModules.length > 0
    ? ` Foco bíblico: ${bibleModules.join(", ")}.`
    : ""
  const profileHint = selectedProfile === "auto"
    ? `Perfil em auto: o GIOM detecta a intenção e escolhe o melhor estilo de resposta.`
    : `Perfil travado: ${profileName}.`
  const modulesHint = activeModules.length > 0
    ? `Módulos fixados: ${activeModules.join(", ")}.`
    : "Módulos em auto: o GIOM ativa conhecimento por intenção e usa developer como fallback quando nada específico for detectado."
  elements.profileSettingsHint.textContent = `${profileHint} ${modulesHint}${bibleHint}`
  refreshCapabilityUI()
}

function updatePromptPackHint(activePromptPacks = []) {
  if (!elements.promptPackHint) return
  elements.promptPackHint.textContent = `Prompt packs ativos: ${activePromptPacks.join(", ")}. Eles refinam raciocinio, engenharia e pesquisa sem depender de prompts proprietarios de terceiros.`
  refreshCapabilityUI()
}

async function savePreferences() {
  const selectedAssistantProfile = elements.assistantProfileSelect.value
  const selectedModules = getSelectedModulesFromUI()
  state.preferences = {
    verbosity: elements.verbositySelect.value,
    examples: elements.examplesToggle.checked,
    noEmojis: !elements.emojiToggle.checked,
    safetyLevel: elements.safetySelect.value,
    ageGroup: elements.ageGroupSelect.value,
    theme: elements.themeSelect.value,
    agroWeatherAuto: elements.agroWeatherAutoToggle.checked,
    agroWeatherLabel: elements.agroWeatherLabelInput.value.trim(),
    agroWeatherLatitude: elements.agroWeatherLatitudeInput.value.trim(),
    agroWeatherLongitude: elements.agroWeatherLongitudeInput.value.trim(),
    agroWeatherDays: Math.max(1, Math.min(Number.parseInt(elements.agroWeatherDaysInput.value, 10) || 3, 7)),
    assistantProfile: selectedAssistantProfile,
    assistantProfileLocked: selectedAssistantProfile !== "auto",
    promptPacks: getSelectedPromptPacksFromUI(),
    activeModules: selectedModules,
    moduleSelectionLocked: selectedModules.length > 0,
    bibleStudyModules: getSelectedBibleStudyModulesFromUI()
  }

  writeJson(getPreferencesKey(), state.preferences)
  setTheme(state.preferences.theme)
  updatePromptPackHint(state.preferences.promptPacks)
  updateProfileHint(state.preferences.activeModules)
  refreshCapabilityUI()
  setSettingsStatus("Preferências salvas localmente.")

  if (state.supabase && state.user) {
    try {
      const { error } = await state.supabase
        .from("user_profiles")
        .upsert({
          user_id: state.user.id,
          preferences: state.preferences,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      setSettingsStatus("Preferências salvas no Supabase.")
    } catch {
      setSettingsStatus("Salvei localmente, mas falhei ao sincronizar com o Supabase.", true)
    }
  }
}

function setTheme(theme) {
  state.preferences.theme = theme
  elements.body.dataset.theme = theme
  localStorage.setItem("groot-theme", theme)
  if (elements.themeSelect.value !== theme) {
    elements.themeSelect.value = theme
  }
  elements.themeDraculaBtn.classList.toggle("active", theme === "dracula")
  elements.themeGithubBtn.classList.toggle("active", theme === "github_dark")
  elements.themeDiscordBtn.classList.toggle("active", theme === "discord")
  elements.themeLightBtn.classList.toggle("active", theme === "light")
  writeJson(getPreferencesKey(), state.preferences)
  refreshCapabilityUI()
}

async function initAuth() {
  const canUseSupabase = Boolean(
    state.config?.supabaseUrl &&
    state.config?.supabaseAnonKey &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  )

  if (!canUseSupabase) {
    state.supabase = null
    state.authBackend = "local"
    restoreLegacyLocalSession()
    return
  }

  state.supabase = window.supabase.createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  state.authBackend = "supabase"

  try {
    const { data } = await state.supabase.auth.getSession()
    if (data?.session?.user) {
      await setCurrentUser(data.session.user, "supabase")
    }
  } catch {
    state.supabase = null
    state.authBackend = "local"
    restoreLegacyLocalSession()
    return
  }

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await setCurrentUser(session.user, "supabase")
      closeLoginModal()
    } else if (state.supabase) {
      await setCurrentUser(null)
    }
    cleanAuthUrl()
  })

  cleanAuthUrl()
}

function cleanAuthUrl() {
  const hash = window.location.hash || ""
  const search = window.location.search || ""
  if (
    hash.includes("access_token") ||
    hash.includes("refresh_token") ||
    search.includes("code=") ||
    hash.includes("error_description")
  ) {
    history.replaceState({}, document.title, window.location.pathname)
  }
}

function buildAgroWeatherContext() {
  if (!state.preferences.agroWeatherAuto) return null

  const latitude = Number.parseFloat(state.preferences.agroWeatherLatitude)
  const longitude = Number.parseFloat(state.preferences.agroWeatherLongitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return {
    enabled: true,
    label: state.preferences.agroWeatherLabel || "",
    latitude,
    longitude,
    days: Math.max(1, Math.min(Number.parseInt(state.preferences.agroWeatherDays, 10) || 3, 7)),
    timezone: "auto"
  }
}

function describeAgroWeatherStatus() {
  if (!state.preferences.agroWeatherAuto) return ""

  const weatherContext = buildAgroWeatherContext()
  if (!weatherContext) {
    return state.config?.features?.weatherForecast ? "Clima agro: configurar local" : ""
  }

  return `Clima agro: ${weatherContext.label || `${weatherContext.latitude.toFixed(2)}, ${weatherContext.longitude.toFixed(2)}`}`
}

function restoreLegacyLocalSession() {
  const session = readJson("groot-local-session-v2", null) || migrateLegacyUser()
  if (!session) {
    updateAuthUI()
    return
  }

  state.user = normalizeLocalUser(session)
  hydratePreferences()
  applyPreferencesToUI()
  loadChatHistory()
  renderChatHistory()
  updateAuthUI()
}

function migrateLegacyUser() {
  const legacy = readJson("groot-user", null)
  if (!legacy?.email) return null

  const migrated = {
    id: legacy.id || crypto.randomUUID(),
    email: legacy.email,
    displayName: legacy.email.split("@")[0],
    provider: legacy.provider || "local",
    plan: legacy.plan || "Free",
    authType: "local",
    createdAt: legacy.created_at || new Date().toISOString()
  }

  writeJson("groot-local-session-v2", migrated)
  return migrated
}

async function setCurrentUser(user, source = "local") {
  state.user = user ? normalizeUser(user, source) : null

  if (!state.user && !state.supabase) {
    localStorage.removeItem("groot-local-session-v2")
  }

  hydratePreferences()
  await syncRemotePreferences()
  applyPreferencesToUI()
  loadChatHistory()
  renderChatHistory()
  await renderMemoryView()
  updateAuthUI()
}

async function syncRemotePreferences() {
  if (!state.supabase || !state.user) return

  try {
    const { data, error } = await state.supabase
      .from("user_profiles")
      .select("preferences")
      .eq("user_id", state.user.id)
      .single()

    if (error && error.code !== "PGRST116") {
      return
    }

    if (data?.preferences) {
      state.preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, ...state.preferences, ...data.preferences })
      writeJson(getPreferencesKey(), state.preferences)
    }
  } catch {
    // ignore sync failure
  }
}

function normalizeUser(user, source) {
  if (source === "supabase") {
    return {
      id: user.id,
      email: user.email || "usuario@sessao.local",
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuário",
      provider: user.app_metadata?.provider || "email",
      plan: user.user_metadata?.plan || "Free",
      authType: "supabase"
    }
  }

  return normalizeLocalUser(user)
}

function normalizeLocalUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    provider: user.provider || "local",
    plan: user.plan || "Free",
    authType: "local"
  }
}

async function handleEmailLogin() {
  const email = elements.emailInput.value.trim().toLowerCase()
  const password = elements.passwordInput.value

  if (!email || !password) {
    setLoginStatus("Preencha email e senha.", true)
    return
  }

  setLoginStatus("Entrando...")

  if (state.supabase) {
    const { error } = await state.supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginStatus(error.message, true)
      return
    }
    setLoginStatus("")
    closeLoginModal()
    return
  }

  try {
    const users = readJson("groot-local-users-v2", [])
    const candidate = users.find((item) => item.email === email)
    if (!candidate) {
      throw new Error("Conta local não encontrada.")
    }

    const passwordHash = await hashPassword(password)
    if (candidate.passwordHash !== passwordHash) {
      throw new Error("Senha incorreta.")
    }

    const session = {
      id: candidate.id,
      email: candidate.email,
      displayName: candidate.displayName,
      provider: "local",
      plan: candidate.plan || "Free"
    }

    writeJson("groot-local-session-v2", session)
    await setCurrentUser(session, "local")
    setLoginStatus("")
    closeLoginModal()
    showToast("Login local realizado.", "success")
  } catch (error) {
    setLoginStatus(error.message || "Falha ao entrar.", true)
  }
}

async function handleEmailSignup() {
  const email = elements.emailInput.value.trim().toLowerCase()
  const password = elements.passwordInput.value

  if (!email || !password) {
    setLoginStatus("Preencha email e senha.", true)
    return
  }

  if (password.length < 6) {
    setLoginStatus("Use pelo menos 6 caracteres.", true)
    return
  }

  setLoginStatus("Criando conta...")

  if (state.supabase) {
    const { data, error } = await state.supabase.auth.signUp({ email, password })
    if (error) {
      setLoginStatus(error.message, true)
      return
    }

    if (!data?.session) {
      setLoginStatus("Conta criada. Confira seu email para confirmar.", false)
      return
    }

    setLoginStatus("")
    closeLoginModal()
    return
  }

  try {
    const users = readJson("groot-local-users-v2", [])
    if (users.some((item) => item.email === email)) {
      throw new Error("Este email já está cadastrado.")
    }

    const newUser = {
      id: crypto.randomUUID(),
      email,
      displayName: email.split("@")[0],
      passwordHash: await hashPassword(password),
      provider: "local",
      plan: "Free",
      createdAt: new Date().toISOString()
    }

    users.push(newUser)
    writeJson("groot-local-users-v2", users)
    writeJson("groot-local-session-v2", newUser)
    await setCurrentUser(newUser, "local")
    setLoginStatus("")
    closeLoginModal()
    showToast("Conta local criada com sucesso.", "success")
  } catch (error) {
    setLoginStatus(error.message || "Falha ao criar conta.", true)
  }
}

async function handleOAuthLogin(provider) {
  if (!state.supabase) {
    setLoginStatus("Configure o Supabase para ativar GitHub e Google.", true)
    showToast("OAuth requer Supabase configurado no backend.", "warning")
    return
  }

  setLoginStatus(`Redirecionando para ${provider === "github" ? "GitHub" : "Google"}...`)

  const { error } = await state.supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  })

  if (error) {
    setLoginStatus(error.message, true)
  }
}

async function logout() {
  closeProfileMenu()

  if (state.supabase) {
    await state.supabase.auth.signOut()
  }

  localStorage.removeItem("groot-local-session-v2")
  localStorage.removeItem("groot-user")
  await setCurrentUser(null)
  showToast("Sessão encerrada.", "success")
}

function getAnonymousUserId() {
  let id = localStorage.getItem("groot-anonymous-id")
  if (!id) {
    id = `visitor_${crypto.randomUUID()}`
    localStorage.setItem("groot-anonymous-id", id)
  }
  return id
}

function getScopeId() {
  return state.user?.id || getAnonymousUserId()
}

function getHistoryKey() {
  return `groot-chat-history:${getScopeId()}`
}

function getPreferencesKey() {
  return `groot-preferences:${getScopeId()}`
}

function loadChatHistory() {
  const stored = readJson(getHistoryKey(), [])
  state.chatHistory = Array.isArray(stored)
    ? stored.map((message) => normalizeChatMessage(message))
    : []
}

function saveChatHistory() {
  writeJson(
    getHistoryKey(),
    state.chatHistory.map((message) => ({
      ...message,
      imageDataUrl: message.imageDataUrl && message.imageDataUrl.length < 120_000
        ? message.imageDataUrl
        : null,
      documentDataUrl: message.documentDataUrl && message.documentDataUrl.length < 180_000
        ? message.documentDataUrl
        : null,
      documentPreviewText: message.documentPreviewText && message.documentPreviewText.length < 90_000
        ? message.documentPreviewText
        : "",
      weatherSummary: message.weatherSummary && message.weatherSummary.length < 2_400
        ? message.weatherSummary
        : "",
      weatherLocationLabel: message.weatherLocationLabel || "",
      weatherProvider: message.weatherProvider || "",
      weatherForecastDays: message.weatherForecastDays || null,
      weatherError: message.weatherError || null,
      assistantProfileResolved: message.assistantProfileResolved || null,
      activeModulesResolved: Array.isArray(message.activeModulesResolved) ? message.activeModulesResolved.slice(0, 6) : [],
      bibleStudyModulesResolved: Array.isArray(message.bibleStudyModulesResolved) ? message.bibleStudyModulesResolved.slice(0, 8) : []
    }))
  )
}

function resetChat() {
  state.chatHistory = []
  saveChatHistory()
  getChatContentNode().innerHTML = ""
  clearPendingFile()
  elements.textarea.value = ""
  autoResizeTextarea()
  syncChatMode()
  setView("chat")
  setComposerStatus("Novo chat pronto.")
}

function getChatContentNode() {
  return elements.chatInner || elements.chat
}

function normalizeChatMessage(message = {}) {
  return {
    id: message.id || crypto.randomUUID(),
    role: message.role || "assistant",
    content: String(message.content || ""),
    createdAt: message.createdAt || new Date().toISOString(),
    isError: Boolean(message.isError),
    requestId: message.requestId || null,
    imageDataUrl: message.imageDataUrl || null,
    mimeType: message.mimeType || null,
    documentDataUrl: message.documentDataUrl || null,
    documentFileName: message.documentFileName || null,
    documentMimeType: message.documentMimeType || null,
    documentFormat: message.documentFormat || null,
    documentPreviewText: message.documentPreviewText || "",
    weatherSummary: message.weatherSummary || "",
    weatherLocationLabel: message.weatherLocationLabel || "",
    weatherProvider: message.weatherProvider || "",
    weatherForecastDays: message.weatherForecastDays || null,
    weatherError: message.weatherError || null,
    assistantProfileResolved: message.assistantProfileResolved || null,
    activeModulesResolved: Array.isArray(message.activeModulesResolved) ? message.activeModulesResolved : [],
    bibleStudyModulesResolved: Array.isArray(message.bibleStudyModulesResolved) ? message.bibleStudyModulesResolved : []
  }
}

function addMessageToHistory(role, content, meta = {}) {
  state.chatHistory.push({
    id: meta.id || crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    isError: Boolean(meta.isError),
    requestId: meta.requestId || null,
    imageDataUrl: meta.imageDataUrl || null,
    mimeType: meta.mimeType || null,
    documentDataUrl: meta.documentDataUrl || null,
    documentFileName: meta.documentFileName || null,
    documentMimeType: meta.documentMimeType || null,
    documentFormat: meta.documentFormat || null,
    documentPreviewText: meta.documentPreviewText || "",
    weatherSummary: meta.weatherSummary || "",
    weatherLocationLabel: meta.weatherLocationLabel || "",
    weatherProvider: meta.weatherProvider || "",
    weatherForecastDays: meta.weatherForecastDays || null,
    weatherError: meta.weatherError || null,
    assistantProfileResolved: meta.assistantProfileResolved || null,
    activeModulesResolved: Array.isArray(meta.activeModulesResolved) ? meta.activeModulesResolved : [],
    bibleStudyModulesResolved: Array.isArray(meta.bibleStudyModulesResolved) ? meta.bibleStudyModulesResolved : []
  })
  saveChatHistory()
}

function buildDocumentNode(message = {}) {
  if (!message.documentDataUrl || !message.documentFileName) {
    return null
  }

  const wrap = document.createElement("div")
  wrap.className = "message-document"

  const summary = document.createElement("div")
  summary.className = "message-document-summary"

  const icon = document.createElement("div")
  icon.className = "message-document-icon"
  icon.textContent = String(message.documentFormat || "DOC").toUpperCase()

  const copy = document.createElement("div")
  copy.className = "message-document-copy"

  const title = document.createElement("strong")
  title.textContent = message.documentFileName

  const meta = document.createElement("span")
  meta.textContent = message.documentMimeType || "application/octet-stream"

  const toolbar = document.createElement("div")
  toolbar.className = "message-document-toolbar"

  const previewId = `document-preview-${message.id || crypto.randomUUID()}`
  if (canPreviewDocument(message)) {
    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "message-document-button"
    toggle.dataset.documentToggle = previewId
    toggle.dataset.openLabel = "Ocultar prévia"
    toggle.dataset.closedLabel = "Ver prévia"
    toggle.setAttribute("aria-expanded", "false")
    toggle.textContent = "Ver prévia"
    toolbar.appendChild(toggle)

    const copyPreview = document.createElement("button")
    copyPreview.type = "button"
    copyPreview.className = "message-document-button"
    copyPreview.dataset.copy = encodeURIComponent(message.documentPreviewText)
    copyPreview.textContent = "Copiar prévia"
    toolbar.appendChild(copyPreview)

    const editPreview = document.createElement("button")
    editPreview.type = "button"
    editPreview.className = "message-document-button"
    editPreview.dataset.fill = encodeURIComponent(message.documentPreviewText)
    editPreview.textContent = "Editar"
    toolbar.appendChild(editPreview)
  }

  const action = document.createElement("a")
  action.className = "message-document-action"
  action.href = message.documentDataUrl
  action.download = message.documentFileName
  action.textContent = "Baixar arquivo"

  copy.appendChild(title)
  copy.appendChild(meta)
  summary.appendChild(icon)
  summary.appendChild(copy)

  if (toolbar.childElementCount > 0) {
    toolbar.appendChild(action)
    wrap.appendChild(summary)
    wrap.appendChild(toolbar)
  } else {
    wrap.appendChild(summary)
    wrap.appendChild(action)
  }

  if (canPreviewDocument(message)) {
    const preview = document.createElement("div")
    preview.id = previewId
    preview.className = "message-document-preview hidden"
    preview.innerHTML = formatMessage(message.documentPreviewText)
    wrap.appendChild(preview)
  }

  return wrap
}

function buildMediaNode(message = {}) {
  if (!message.imageDataUrl) {
    return null
  }

  const media = document.createElement("figure")
  media.className = "message-media"

  const image = document.createElement("img")
  image.src = message.imageDataUrl
  image.alt = message.content || "Imagem gerada pelo GIOM"
  media.appendChild(image)

  const toolbar = document.createElement("div")
  toolbar.className = "message-media-toolbar"

  const open = document.createElement("a")
  open.href = message.imageDataUrl
  open.target = "_blank"
  open.rel = "noreferrer"
  open.className = "message-document-button"
  open.textContent = "Abrir"

  const download = document.createElement("a")
  download.href = message.imageDataUrl
  download.download = buildDownloadFileName(message, message.mimeType || "image/png")
  download.className = "message-document-action"
  download.textContent = "Baixar imagem"

  toolbar.appendChild(open)
  toolbar.appendChild(download)
  media.appendChild(toolbar)

  return media
}

function buildMessageSignalsNode(message = {}) {
  const signals = []

  if (message.assistantProfileResolved) {
    signals.push(`Perfil: ${labelForAssistantProfile(message.assistantProfileResolved)}`)
  }

  if (Array.isArray(message.activeModulesResolved) && message.activeModulesResolved.length > 0) {
    signals.push(`Modulos: ${message.activeModulesResolved.slice(0, 3).join(", ")}`)
  }

  if (message.weatherSummary) {
    signals.push(message.weatherError ? "Clima: fallback tecnico" : "Clima: ao vivo")
  }

  if (!signals.length) {
    return null
  }

  const wrap = document.createElement("div")
  wrap.className = "message-signals"

  signals.forEach((item) => {
    const chip = document.createElement("span")
    chip.className = "message-signal"
    chip.textContent = item
    wrap.appendChild(chip)
  })

  return wrap
}

function buildWeatherRuntimeNode(message = {}) {
  if (!message.weatherSummary) {
    return null
  }

  const wrap = document.createElement("section")
  wrap.className = `weather-runtime-card${message.weatherError ? " warning" : ""}`

  const title = document.createElement("strong")
  title.textContent = message.weatherError ? "Clima agro solicitado, mas incompleto" : "Clima agro aplicado nesta resposta"

  const meta = document.createElement("div")
  meta.className = "weather-runtime-meta"
  meta.textContent = [
    message.weatherLocationLabel || "Local não identificado",
    message.weatherForecastDays ? `${message.weatherForecastDays} dias` : null,
    message.weatherProvider || null
  ].filter(Boolean).join(" • ")

  const body = document.createElement("div")
  body.className = "weather-runtime-copy"
  body.innerHTML = formatMessage(message.weatherSummary)

  wrap.appendChild(title)
  if (meta.textContent) {
    wrap.appendChild(meta)
  }
  wrap.appendChild(body)
  return wrap
}

function buildMessageActions(message = {}) {
  const actions = document.createElement("div")
  actions.className = "message-actions"

  const sourceText = message.documentPreviewText || message.content || ""
  const messageId = message.id || ""

  actions.appendChild(
    buildMessageActionButton("Copiar", "copy", messageId)
  )

  actions.appendChild(
    buildMessageActionButton(message.role === "user" ? "Editar" : "Levar ao editor", "fill", messageId)
  )

  actions.appendChild(
    buildMessageActionButton("Baixar txt", "download", messageId)
  )

  if (message.role === "assistant" && sourceText) {
    actions.appendChild(
      buildMessageActionButton("Usar como prompt", "prompt", messageId)
    )
  }

  return actions
}

function buildMessageActionButton(label, action, messageId) {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "message-action-btn"
  button.dataset.messageAction = action
  button.dataset.messageId = messageId
  button.textContent = label
  return button
}

function renderChatHistory() {
  getChatContentNode().innerHTML = ""

  state.chatHistory.forEach((message) => {
    getChatContentNode().appendChild(buildMessageNode(message))
  })

  syncChatMode()
  scrollChatToBottom()
}

function buildMessageNode(message) {
  const node = document.createElement("article")
  node.className = `message ${message.role}`
  node.dataset.messageId = message.id || ""

  const avatar = document.createElement("div")
  avatar.className = "message-avatar"
  avatar.textContent = message.role === "user" ? getUserInitial() : "G"

  const body = document.createElement("div")
  body.className = "message-body"

  const meta = document.createElement("div")
  meta.className = "message-meta"
  meta.textContent = `${message.role === "user" ? "Você" : "GIOM"} • ${formatTime(message.createdAt)}`

  const signals = buildMessageSignalsNode(message)
  const media = buildMediaNode(message)
  const weatherRuntimeNode = buildWeatherRuntimeNode(message)

  const text = document.createElement("div")
  text.className = "message-text"
  text.innerHTML = formatMessage(message.content)

  if (message.isError) {
    body.style.borderColor = "rgba(255, 139, 139, 0.26)"
  }

  body.appendChild(meta)
  if (signals) {
    body.appendChild(signals)
  }
  if (media) {
    body.appendChild(media)
  }
  const documentNode = buildDocumentNode(message)
  if (documentNode) {
    body.appendChild(documentNode)
  }
  if (weatherRuntimeNode) {
    body.appendChild(weatherRuntimeNode)
  }
  body.appendChild(text)
  body.appendChild(buildMessageActions(message))
  node.appendChild(avatar)
  node.appendChild(body)

  return node
}

function appendThinkingMessage(mode = "default") {
  const node = document.createElement("article")
  node.className = "message assistant"

  const avatar = document.createElement("div")
  avatar.className = "message-avatar"
  avatar.textContent = "G"

  const body = document.createElement("div")
  body.className = "message-body"
  body.innerHTML = `
    <div class="message-meta">GIOM • pensando</div>
    <div class="message-text">
      <div class="thinking-bubble">
        <span class="thinking-status">Processando</span>
        <div class="leaf-loader">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `

  node.appendChild(avatar)
  node.appendChild(body)
  getChatContentNode().appendChild(node)
  startWorkingState(node, mode)
  scrollChatToBottom()
  return node
}

function replaceThinkingMessage(node, content, isError = false, metaExtras = {}) {
  stopWorkingState()
  const replacement = buildMessageNode(normalizeChatMessage({
    id: metaExtras.id || crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    isError,
    requestId: metaExtras.requestId || null,
    imageDataUrl: metaExtras.imageDataUrl || null,
    mimeType: metaExtras.mimeType || null,
    documentDataUrl: metaExtras.documentDataUrl || null,
    documentFileName: metaExtras.documentFileName || null,
    documentMimeType: metaExtras.documentMimeType || null,
    documentFormat: metaExtras.documentFormat || null,
    documentPreviewText: metaExtras.documentPreviewText || "",
    weatherSummary: metaExtras.weatherSummary || "",
    weatherLocationLabel: metaExtras.weatherLocationLabel || "",
    weatherProvider: metaExtras.weatherProvider || "",
    weatherForecastDays: metaExtras.weatherForecastDays || null,
    weatherError: metaExtras.weatherError || null,
    assistantProfileResolved: metaExtras.assistantProfileResolved || null,
    activeModulesResolved: Array.isArray(metaExtras.activeModulesResolved) ? metaExtras.activeModulesResolved : [],
    bibleStudyModulesResolved: Array.isArray(metaExtras.bibleStudyModulesResolved) ? metaExtras.bibleStudyModulesResolved : []
  }))
  node.replaceWith(replacement)
  scrollChatToBottom()
  return replacement
}

function updateThinkingMessage(node, content, status = "respondendo") {
  const meta = node.querySelector(".message-meta")
  const text = node.querySelector(".message-text")
  stopWorkingState(false)
  setSendButtonWorking(true, "Respondendo")
  if (meta) {
    meta.textContent = `GIOM • ${status}`
  }
  if (text) {
    text.innerHTML = `<p>${escapeHtml(String(content || "")).replace(/\n/g, "<br>")}</p>`
  }
  scrollChatToBottom()
}

function startWorkingState(node, mode = "default") {
  stopWorkingState(false)
  state.currentWorkingMode = mode
  state.workingStatusIndex = 0
  const statuses = WORKING_STATUS_MAP[mode] || WORKING_STATUS_MAP.default
  updateThinkingStatus(node, statuses[0])
  setSendButtonWorking(true, statuses[0])

  state.workingStatusTimer = window.setInterval(() => {
    state.workingStatusIndex = (state.workingStatusIndex + 1) % statuses.length
    const label = statuses[state.workingStatusIndex]
    updateThinkingStatus(node, label)
    setSendButtonWorking(true, label)
  }, 1650)
}

function stopWorkingState(resetSendButton = true) {
  if (state.workingStatusTimer) {
    window.clearInterval(state.workingStatusTimer)
    state.workingStatusTimer = null
  }

  if (resetSendButton) {
    setSendButtonWorking(false)
  }
}

function updateThinkingStatus(node, label) {
  const status = node?.querySelector(".thinking-status")
  if (status) {
    status.textContent = label
  }
}

function setSendButtonWorking(isWorking, label = "Enviar") {
  if (!elements.sendBtn) return
  elements.sendBtn.classList.toggle("is-working", Boolean(isWorking))
  elements.composerShell?.classList.toggle("is-working", Boolean(isWorking))
  const statusLabel = elements.sendBtn.querySelector(".send-btn-status")
  if (statusLabel) {
    statusLabel.textContent = isWorking ? label : "Enviar"
  }
}

function findMessageById(messageId = "") {
  return state.chatHistory.find((message) => message.id === messageId) || null
}

async function handleMessageAction(button) {
  const action = button.dataset.messageAction || ""
  const message = findMessageById(button.dataset.messageId || "")
  if (!message) return

  const sourceText = message.documentPreviewText || message.content || ""
  if (!sourceText && action !== "download") return

  if (action === "copy") {
    await copyText(sourceText)
    showToast("Conteúdo copiado.", "success")
    return
  }

  if (action === "fill" || action === "prompt") {
    fillComposer(sourceText)
    showToast(action === "prompt" ? "Conteúdo enviado como prompt base." : "Conteúdo levado para o editor.", "success")
    return
  }

  if (action === "download") {
    downloadTextContent(
      sourceText,
      buildDownloadFileName(message, "text/plain"),
      "text/plain;charset=utf-8"
    )
    showToast("Arquivo preparado para download.", "success")
  }
}

function toggleDocumentPreview(previewId = "") {
  if (!previewId) return
  const preview = document.getElementById(previewId)
  if (!preview) return

  const willOpen = preview.classList.contains("hidden")
  preview.classList.toggle("hidden", !willOpen)

  document.querySelectorAll(`[data-document-toggle="${previewId}"]`).forEach((button) => {
    button.setAttribute("aria-expanded", String(willOpen))
    button.textContent = willOpen
      ? (button.dataset.openLabel || "Ocultar prévia")
      : (button.dataset.closedLabel || "Ver prévia")
  })

  if (willOpen) {
    scrollChatToBottom()
  }
}

function fillComposer(text = "") {
  elements.textarea.value = String(text || "").trim()
  autoResizeTextarea()
  syncChatMode()
  elements.textarea.focus()
}

function downloadTextContent(text = "", fileName = "giom-snippet.txt", mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([String(text || "")], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function canPreviewDocument(message = {}) {
  return Boolean(String(message.documentPreviewText || "").trim())
}

function buildDownloadFileName(message = {}, mimeType = "text/plain") {
  if (message.documentFileName) {
    return message.documentFileName
  }

  const base = String(
    message.role === "user"
      ? (message.content || "pergunta")
      : (message.documentPreviewText || message.content || "resposta")
  )
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)

  const extension = mimeType.startsWith("image/")
    ? (mimeType.split("/")[1] || "png")
    : "txt"

  return `${base || "giom-export"}.${extension}`
}

function syncChatMode() {
  const hasMessages = state.chatHistory.length > 0
  const hasDraft = Boolean(elements.textarea.value.trim()) || Boolean(state.pendingFile)
  elements.chatView.dataset.chatMode = hasMessages || hasDraft ? "conversation" : "landing"
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    elements.chat.scrollTop = elements.chat.scrollHeight
  })
}

function removeThinkingMessage(node) {
  node?.remove()
}

function autoResizeTextarea() {
  if (!elements.textarea) return
  elements.textarea.style.height = "auto"
  elements.textarea.style.height = `${Math.min(elements.textarea.scrollHeight, 180)}px`
}

function disableComposer(disabled) {
  state.isSending = disabled
  elements.sendBtn.disabled = disabled
  elements.attachBtn.disabled = disabled
  elements.voiceBtn.disabled = disabled
  elements.textarea.disabled = disabled
  elements.composerShell?.classList.toggle("is-working", Boolean(disabled))
  if (!disabled) {
    stopWorkingState()
  }
}

async function sendMessage() {
  const rawText = elements.textarea.value.trim()
  const file = state.pendingFile
  if (!rawText && !file) return
  if (state.isSending) return

  const imageCommand = parseImageCommand(rawText)
  const imageMode = Boolean(imageCommand)
  const documentCommand = parseDocumentCommand(rawText)
  const documentMode = Boolean(documentCommand)
  const workingMode = imageMode ? "image" : (documentMode ? "document" : (file ? "upload" : "default"))
  const userDisplayText = buildUserDisplayText(rawText, file)

  setView("chat")
  addMessageToHistory("user", userDisplayText)
  getChatContentNode().appendChild(buildMessageNode(state.chatHistory[state.chatHistory.length - 1]))
  scrollChatToBottom()

  const question = imageMode
    ? imageCommand.prompt
    : documentMode
      ? documentCommand.prompt
    : (rawText || `Analise o arquivo "${file.name}" e resuma o que é importante.`)

  elements.textarea.value = ""
  autoResizeTextarea()
  syncChatMode()
  disableComposer(true)
  setComposerStatus(
    imageMode
      ? "Gerando imagem..."
      : documentMode
        ? `Gerando ${documentCommand.format.toUpperCase()}...`
      : (file ? "Enviando anexo e consultando a IA..." : "Consultando a IA...")
  )

  const thinking = appendThinkingMessage(workingMode)

  try {
    if (imageMode && file) {
      throw new Error("A geração de imagem ainda não usa anexo junto. Envie só o prompt com /image.")
    }
    if (documentMode && file) {
      throw new Error("A geração de documento ainda não usa anexo junto. Envie só o comando com o prompt.")
    }

    const upload = file ? await uploadPendingFile(file) : null
    const requestContext = {
      ageGroup: state.preferences.ageGroup,
      uiTheme: state.preferences.theme,
      locale: navigator.language,
      verbosity: state.preferences.verbosity,
      examples: state.preferences.examples,
      noEmojis: state.preferences.noEmojis,
      safetyLevel: state.preferences.safetyLevel,
      assistantProfile: state.preferences.assistantProfile,
      promptPacks: state.preferences.promptPacks,
      activeModules: state.preferences.activeModules,
      bibleStudyModules: state.preferences.bibleStudyModules,
      weatherLocation: buildAgroWeatherContext(),
      uploadId: upload?.id || null,
      uploadName: upload?.name || null,
      uploadType: upload?.type || null
    }

    if (imageMode) {
      const generated = await requestImageGeneration(question, requestContext, imageCommand)
      const assistantId = crypto.randomUUID()
      const appliedControls = generated.payload?.controls || {}
      const caption = [
        `Imagem gerada para: ${question}`,
        appliedControls.stylePreset ? `Preset visual: ${appliedControls.stylePreset}.` : null,
        appliedControls.aspectRatio ? `Proporcao: ${appliedControls.aspectRatio}.` : null,
        appliedControls.width && appliedControls.height ? `Tamanho alvo: ${appliedControls.width}x${appliedControls.height}.` : null
      ].filter(Boolean).join("\n\n")
      replaceThinkingMessage(thinking, caption, false, {
        id: assistantId,
        requestId: generated.payload?.requestId || null,
        imageDataUrl: generated.imageDataUrl,
        mimeType: generated.mimeType
      })
      addMessageToHistory("assistant", caption, {
        id: assistantId,
        requestId: generated.payload?.requestId || null,
        imageDataUrl: generated.imageDataUrl,
        mimeType: generated.mimeType
      })
      await persistConversationRemote(userDisplayText, caption, generated.payload, null)
      setComposerStatus("Imagem gerada.")
      return
    }

    if (documentMode) {
      const generated = await requestDocumentGeneration(question, documentCommand.format, requestContext)
      const assistantId = crypto.randomUUID()
      const caption = [
        `Documento ${generated.fileName} pronto.`,
        `Formato: ${generated.format.toUpperCase()}.`,
        generated.previewText ? `Previa:\n${generated.previewText}` : null
      ].filter(Boolean).join("\n\n")

      replaceThinkingMessage(thinking, caption, false, {
        id: assistantId,
        requestId: generated.payload?.requestId || null,
        documentDataUrl: generated.documentDataUrl,
        documentFileName: generated.fileName,
        documentMimeType: generated.mimeType,
        documentFormat: generated.format,
        documentPreviewText: generated.previewText
      })
      addMessageToHistory("assistant", caption, {
        id: assistantId,
        requestId: generated.payload?.requestId || null,
        documentDataUrl: generated.documentDataUrl,
        documentFileName: generated.fileName,
        documentMimeType: generated.mimeType,
        documentFormat: generated.format,
        documentPreviewText: generated.previewText
      })
      await persistConversationRemote(userDisplayText, caption, generated.payload, null)
      setComposerStatus(`Documento ${generated.fileName} gerado.`)
      return
    }

    const { answer, payload } = await requestAssistantResponse(question, requestContext, (partialText) => {
      if (!partialText) return
      updateThinkingMessage(thinking, partialText)
      setComposerStatus("Transmitindo resposta...")
    })

    const assistantId = crypto.randomUUID()
    const responseMeta = extractResponseMeta(payload)
    replaceThinkingMessage(thinking, answer, false, {
      id: assistantId,
      ...responseMeta
    })
    addMessageToHistory("assistant", answer, {
      id: assistantId,
      ...responseMeta
    })
    await persistConversationRemote(userDisplayText, answer, payload, upload)

    if (upload?.name) {
      setComposerStatus(`Anexo ${upload.name} processado com sucesso.`)
    } else {
      setComposerStatus("Resposta recebida.")
    }
  } catch (error) {
    const fallback = "Não consegui processar a solicitação agora. Verifique backend, login ou anexo e tente novamente."
    const assistantId = crypto.randomUUID()
    replaceThinkingMessage(thinking, fallback, true, {
      id: assistantId
    })
    addMessageToHistory("assistant", fallback, {
      id: assistantId,
      isError: true
    })
    setComposerStatus(error.message || "Falha ao enviar.", true)
  } finally {
    disableComposer(false)
    clearPendingFile()
    syncChatMode()
    scrollChatToBottom()
    if (state.currentView === "memory") {
      renderMemoryView()
    }
  }
}

function isImageCommand(text = "") {
  return Boolean(parseImageCommand(text))
}

function extractImagePrompt(text = "") {
  return parseImageCommand(text)?.prompt || ""
}

function readCommandOption(input = "", flag = "") {
  const patterns = [
    new RegExp(`(?:^|\\s)--${flag}\\s+\"([^\"]+)\"`, "i"),
    new RegExp(`(?:^|\\s)--${flag}\\s+'([^']+)'`, "i"),
    new RegExp(`(?:^|\\s)--${flag}\\s+([^\\s]+)`, "i")
  ]

  for (const pattern of patterns) {
    const match = String(input || "").match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return ""
}

function stripCommandOption(input = "", flag = "") {
  return String(input || "")
    .replace(new RegExp(`(?:^|\\s)--${flag}\\s+\"[^\"]+\"`, "ig"), " ")
    .replace(new RegExp(`(?:^|\\s)--${flag}\\s+'[^']+'`, "ig"), " ")
    .replace(new RegExp(`(?:^|\\s)--${flag}\\s+[^\\s]+`, "ig"), " ")
}

function parseImageSizeOption(value = "") {
  const match = String(value || "").trim().match(/^(\d{2,4})x(\d{2,4})$/i)
  if (!match) return {}

  return {
    width: Number(match[1]),
    height: Number(match[2])
  }
}

function parseImageCommand(text = "") {
  const raw = String(text || "").trim()
  if (!/^\/(?:image|img)\s+/i.test(raw)) {
    return null
  }

  let body = raw.replace(/^\/(?:image|img)\s+/i, "").trim()
  const stylePreset = readCommandOption(body, "style")
  body = stripCommandOption(body, "style")

  const negativePrompt = readCommandOption(body, "negative")
  body = stripCommandOption(body, "negative")

  const aspectRatio = readCommandOption(body, "ratio")
  body = stripCommandOption(body, "ratio")

  const sizeToken = readCommandOption(body, "size")
  body = stripCommandOption(body, "size")

  const seedToken = readCommandOption(body, "seed")
  body = stripCommandOption(body, "seed")

  const prompt = body.replace(/\s+/g, " ").trim()
  if (!prompt) {
    return null
  }

  const size = parseImageSizeOption(sizeToken)
  const seed = seedToken ? Number.parseInt(seedToken, 10) : null

  return {
    prompt,
    stylePreset: stylePreset || "",
    negativePrompt: negativePrompt || "",
    aspectRatio: aspectRatio || "",
    width: Number.isFinite(size.width) ? size.width : null,
    height: Number.isFinite(size.height) ? size.height : null,
    seed: Number.isFinite(seed) ? seed : null
  }
}

function parseDocumentCommand(text = "") {
  const input = String(text || "").trim()
  let match = input.match(/^\/(pdf|docx|xlsx|pptx|svg|html|md|txt|json)\s+([\s\S]+)$/i)
  if (match) {
    return {
      format: match[1].toLowerCase(),
      prompt: match[2].trim()
    }
  }

  match = input.match(/^\/(?:doc|document|file)\s+(pdf|docx|xlsx|pptx|svg|html|md|txt|json)\s+([\s\S]+)$/i)
  if (match) {
    return {
      format: match[1].toLowerCase(),
      prompt: match[2].trim()
    }
  }

  return null
}

async function requestImageGeneration(prompt, context = {}, imageCommand = {}) {
  const profileName = elements.assistantProfileSelect?.selectedOptions?.[0]?.textContent || "GIOM"
  const style = [
    `Visual language inspired by ${context.uiTheme || "dracula"} interface design`,
    `Assistant profile: ${profileName}`,
    `Focus areas: ${(context.activeModules || []).join(", ") || "general"}`,
    imageCommand.stylePreset ? `Requested preset: ${imageCommand.stylePreset}` : ""
  ].join(". ")

  const response = await apiRequest("/generate/image", {
    method: "POST",
    headers: {
      "X-User-Id": getScopeId()
    },
    body: JSON.stringify({
      prompt,
      style,
      stylePreset: imageCommand.stylePreset || "",
      negativePrompt: imageCommand.negativePrompt || "",
      aspectRatio: imageCommand.aspectRatio || "",
      width: imageCommand.width || null,
      height: imageCommand.height || null,
      seed: imageCommand.seed ?? null,
      locale: context.locale || navigator.language
    })
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(payload?.error || "Falha ao gerar imagem.")
  }

  const image = payload?.image
  if (!image?.base64) {
    throw new Error("Resposta vazia da geração de imagem.")
  }

  return {
    imageDataUrl: `data:${image.mimeType || "image/png"};base64,${image.base64}`,
    mimeType: image.mimeType || "image/png",
    payload
  }
}

function buildDocumentTitle(prompt = "", format = "pdf") {
  const base = String(prompt || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!base) {
    return `Documento GIOM ${String(format || "pdf").toUpperCase()}`
  }

  const clipped = base.split(" ").slice(0, 8).join(" ")
  return clipped.charAt(0).toUpperCase() + clipped.slice(1)
}

async function requestDocumentGeneration(prompt, format, context = {}) {
  const response = await apiRequest("/generate/document", {
    method: "POST",
    headers: {
      "X-User-Id": getScopeId()
    },
    body: JSON.stringify({
      prompt,
      format,
      title: buildDocumentTitle(prompt, format),
      locale: context.locale || navigator.language,
      context
    })
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(payload?.error || "Falha ao gerar documento.")
  }

  const document = payload?.document
  if (!document?.base64) {
    throw new Error("Resposta vazia da geração de documento.")
  }

  return {
    documentDataUrl: `data:${document.mimeType || "application/octet-stream"};base64,${document.base64}`,
    fileName: document.fileName || `giom-document.${format}`,
    mimeType: document.mimeType || "application/octet-stream",
    format: document.format || format,
    previewText: payload?.previewText || document.previewText || "",
    payload
  }
}

async function requestAssistantResponse(question, context, onProgress) {
  if (state.config?.features?.streaming) {
    try {
      return await requestAssistantResponseStream(question, context, onProgress)
    } catch (error) {
      console.warn("Streaming falhou, voltando para resposta padrão.", error)
    }
  }

  return await requestAssistantResponseStandard(question, context)
}

async function requestAssistantResponseStandard(question, context) {
  const response = await apiRequest("/ask", {
    method: "POST",
    headers: {
      "X-User-Id": getScopeId()
    },
    body: JSON.stringify({
      question,
      context
    })
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(payload?.error || `Erro HTTP ${response.status}`)
  }

  const answer = extractAnswer(payload)
  if (!answer) {
    throw new Error("Resposta vazia do servidor.")
  }

  return { answer, payload }
}

async function requestAssistantResponseStream(question, context, onProgress) {
  const response = await fetch(`${API_CONFIG.BASE_URL}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": getScopeId()
    },
    body: JSON.stringify({
      question,
      context
    })
  })

  if (!response.ok || !response.body) {
    const payload = await safeJson(response)
    throw new Error(payload?.error || `Erro HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let requestId = null
  let finalAnswer = ""
  let streamMeta = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const packets = buffer.split("\n\n")
    buffer = packets.pop() || ""

    for (const packet of packets) {
      const parsed = parseSSEPacket(packet)
      if (!parsed) continue

      if (parsed.event === "meta") {
        requestId = parsed.data?.requestId || requestId
        streamMeta = {
          ...(streamMeta || {}),
          ...(parsed.data || {})
        }
        continue
      }

      if (parsed.event === "chunk") {
        finalAnswer = parsed.data?.fullText || `${finalAnswer}${parsed.data?.chunk || ""}`
        onProgress?.(finalAnswer, parsed.data)
        continue
      }

      if (parsed.event === "complete") {
        requestId = parsed.data?.requestId || requestId
        finalAnswer = parsed.data?.response || finalAnswer
        return {
          answer: finalAnswer,
          payload: {
            requestId,
            response: finalAnswer,
            metadata: {
              ...(streamMeta || {}),
              ...(parsed.data?.metadata || {})
            }
          }
        }
      }

      if (parsed.event === "error") {
        throw new Error(parsed.data?.error || "Falha no streaming")
      }
    }
  }

  if (finalAnswer.trim()) {
    return {
      answer: finalAnswer,
      payload: {
        requestId,
        response: finalAnswer,
        metadata: streamMeta || null
      }
    }
  }

  throw new Error("Streaming encerrado sem resposta.")
}

function parseSSEPacket(packet) {
  const lines = String(packet || "").split(/\r?\n/)
  let event = "message"
  const dataLines = []

  lines.forEach((line) => {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
      return
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  })

  if (dataLines.length === 0) {
    return null
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n"))
    }
  } catch {
    return null
  }
}

function buildUserDisplayText(text, file) {
  const parts = []
  if (text) parts.push(text)
  if (file) parts.push(`Anexo: ${file.name}`)
  return parts.join("\n\n")
}

async function uploadPendingFile(file) {
  const maxBytes = state.config?.uploads?.maxBytes || 2_000_000
  if (file.size > maxBytes) {
    throw new Error(`O anexo excede ${formatBytes(maxBytes)}.`)
  }

  const base64 = await readFileAsBase64(file)
  const response = await apiRequest("/upload", {
    method: "POST",
    headers: {
      "X-User-Id": getScopeId()
    },
    body: JSON.stringify({
      name: file.name,
      type: file.type || "application/octet-stream",
      data: base64
    })
  })

  const payload = await safeJson(response)
  if (!response.ok) {
    throw new Error(payload?.error || "Falha ao enviar anexo.")
  }

  return payload
}

function getFileExtension(filename = "") {
  const parts = String(filename || "").toLowerCase().split(".")
  return parts.length > 1 ? `.${parts.pop()}` : ""
}

function isSupportedUploadFile(file) {
  const acceptRules = getConfiguredUploadAccept()
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  if (acceptRules.length === 0) return true

  const extension = getFileExtension(file.name)
  return acceptRules.some((rule) => {
    if (rule === "image/*") {
      return String(file.type || "").startsWith("image/")
    }
    return extension === rule
  })
}

function getUploadTypeLabel() {
  const supportedKinds = state.config?.uploads?.supportedKinds || ["text", "code", "pdf", "image"]
  return supportedKinds
    .map((kind) => kind === "image_ocr" ? "image/OCR" : kind)
    .join(", ")
}

function handleFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (!isSupportedUploadFile(file)) {
    showToast(`Tipo de arquivo ainda não suportado. Tipos ativos: ${getUploadTypeLabel()}.`, "warning")
    elements.fileInput.value = ""
    return
  }

  const maxBytes = state.config?.uploads?.maxBytes || 2_000_000
  if (file.size > maxBytes) {
    showToast(`O arquivo excede ${formatBytes(maxBytes)}.`, "error")
    elements.fileInput.value = ""
    return
  }

  clearPendingFile()
  state.pendingFile = file
  if (file.type.startsWith("image/")) {
    state.pendingFileUrl = URL.createObjectURL(file)
  }

  renderFilePreview()
  syncChatMode()
  setComposerStatus(`Anexo pronto: ${file.name}`)
}

function clearPendingFile() {
  if (state.pendingFileUrl) {
    URL.revokeObjectURL(state.pendingFileUrl)
  }
  state.pendingFile = null
  state.pendingFileUrl = null
  if (elements.fileInput) {
    elements.fileInput.value = ""
  }
  renderFilePreview()
}

function renderFilePreview() {
  if (!state.pendingFile) {
    elements.filePreview.classList.add("hidden")
    elements.filePreview.innerHTML = ""
    return
  }

  const file = state.pendingFile
  const extension = getFileExtension(file.name)
  const iconMap = {
    ".pdf": "PDF",
    ".docx": "DOCX",
    ".xlsx": "XLSX",
    ".pptx": "PPTX",
    ".md": "MD",
    ".svg": "SVG",
    ".json": "{}",
    ".js": "</>",
    ".ts": "TS",
    ".tsx": "TSX",
    ".jsx": "JSX",
    ".csv": "CSV",
    ".sql": "SQL"
  }
  const preview = state.pendingFileUrl
    ? `<img class="file-thumb" src="${state.pendingFileUrl}" alt="${escapeHtml(file.name)}">`
    : `<div class="file-icon">${iconMap[extension] || "FILE"}</div>`

  elements.filePreview.classList.remove("hidden")
  elements.filePreview.innerHTML = `
    <div class="file-chip">
      ${preview}
      <div class="file-copy">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatBytes(file.size)}</span>
      </div>
      <button class="remove-file-btn" id="removePendingFileBtn" type="button" aria-label="Remover anexo">✕</button>
    </div>
  `

  document.getElementById("removePendingFileBtn")?.addEventListener("click", () => {
    clearPendingFile()
    syncChatMode()
  })
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    return
  }

  state.speechRecognition = new SpeechRecognition()
  state.speechRecognition.lang = "pt-BR"
  state.speechRecognition.interimResults = true
  state.speechRecognition.continuous = true
  state.speechRecognition.maxAlternatives = 1

  state.speechRecognition.onstart = () => {
    state.speechBaseText = elements.textarea.value.trim()
  }

  state.speechRecognition.onresult = (event) => {
    let transcript = ""

    for (let index = 0; index < event.results.length; index += 1) {
      const chunk = event.results[index]?.[0]?.transcript || ""
      transcript += ` ${chunk}`
    }

    const merged = [state.speechBaseText, transcript.trim()].filter(Boolean).join(" ").trim()
    elements.textarea.value = merged
    autoResizeTextarea()
    syncChatMode()
    elements.textarea.focus()
  }

  state.speechRecognition.onend = () => {
    state.isRecording = false
    elements.voiceBtn.classList.remove("is-recording")
    setComposerStatus(elements.textarea.value.trim() ? "Ditado concluído." : "Microfone finalizado.")
  }

  state.speechRecognition.onerror = (event) => {
    state.isRecording = false
    elements.voiceBtn.classList.remove("is-recording")

    const messageMap = {
      "not-allowed": "Permissão de microfone negada.",
      "service-not-allowed": "O navegador bloqueou o serviço de voz.",
      "network": "Falha de rede no reconhecimento de voz.",
      "no-speech": "Nenhuma fala detectada. Tente falar mais perto do microfone.",
      "audio-capture": "Não consegui acessar seu microfone."
    }

    showToast(messageMap[event.error] || "Falha no ditado por voz.", "warning")
  }
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return true
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    showToast("Seu navegador ou a página bloquearam o microfone.", "warning")
    return false
  }
}

async function toggleVoiceInput() {
  if (!state.speechRecognition) {
    showToast("Ditado por voz não disponível neste navegador.", "warning")
    return
  }

  if (state.isRecording) {
    state.speechRecognition.stop()
    state.isRecording = false
    elements.voiceBtn.classList.remove("is-recording")
    return
  }

  const canUseMic = await ensureMicrophoneAccess()
  if (!canUseMic) {
    return
  }

  state.isRecording = true
  elements.voiceBtn.classList.add("is-recording")
  setComposerStatus("Ouvindo... fale normalmente.")
  state.speechRecognition.start()
}

async function renderMemoryView() {
  const remoteEntries = await loadRemoteConversations()
  const localPairs = buildLocalConversationPairs()
  const entries = remoteEntries.length ? remoteEntries : localPairs

  elements.memoryBadge.textContent = remoteEntries.length ? "Supabase" : "Local"

  if (!entries.length) {
    elements.memoryList.innerHTML = `
      <div class="memory-item">
        <strong>Nenhuma conversa salva ainda</strong>
        <small>Assim que você conversar com o GIOM, o histórico aparece aqui.</small>
      </div>
    `
  } else {
    elements.memoryList.innerHTML = entries
      .slice(0, 12)
      .map((entry) => `
        <div class="memory-item">
          <strong>${escapeHtml(entry.prompt)}</strong>
          <small>${escapeHtml(entry.response)}</small>
          <small>${formatTime(entry.createdAt)}</small>
        </div>
      `)
      .join("")
  }

  const patterns = [
    `Detalhamento: ${labelForVerbosity(state.preferences.verbosity)}`,
    `Tema: ${labelForTheme(state.preferences.theme)}`,
    `Segurança: ${state.preferences.safetyLevel === "strict" ? "Restrita" : "Padrão"}`,
    `Faixa etária: ${state.preferences.ageGroup === "minor" ? "13-17" : "18+"}`,
    `Perfil da IA: ${labelForAssistantProfile(state.preferences.assistantProfile || "auto")}`,
    `Prompt packs: ${(state.preferences.promptPacks || DEFAULT_PREFERENCES.promptPacks).join(", ")}`,
    `Módulos: ${(state.preferences.activeModules || []).join(", ") || "auto por intenção"}`,
    `Foco bíblico: ${(state.preferences.bibleStudyModules || []).join(", ") || "nenhum"}`,
    `Clima agro: ${describeAgroWeatherStatus() || "desligado"}`,
    `Autenticação: ${state.supabase ? "Supabase / OAuth" : "Local"}`,
    `Mensagens salvas: ${state.chatHistory.length}`
  ]

  elements.learningList.innerHTML = patterns
    .map((item) => `
      <div class="pattern-item">
        <strong>${escapeHtml(item)}</strong>
      </div>
    `)
    .join("")
}

async function loadRemoteConversations() {
  if (!state.supabase || !state.user) {
    return []
  }

  try {
    const { data, error } = await state.supabase
      .from("conversations")
      .select("*")
      .eq("user_id", state.user.id)
      .order("created_at", { ascending: false })
      .limit(12)

    if (error || !Array.isArray(data)) {
      return []
    }

    return data.map((entry) => ({
      prompt: entry.user_message,
      response: entry.ai_response,
      createdAt: entry.created_at
    }))
  } catch {
    return []
  }
}

async function persistConversationRemote(userMessage, aiResponse, payload, upload) {
  if (!state.supabase || !state.user) {
    return
  }

  // O backend já persiste a conversa usando o mesmo userId; evitar duplicidade aqui.
  if (payload?.requestId) {
    return
  }

  try {
    await state.supabase.from("conversations").insert({
      user_id: state.user.id,
      user_message: userMessage,
      ai_response: aiResponse,
      metadata: {
        requestId: payload?.requestId || null,
        uploadName: upload?.name || null,
        assistantProfile: state.preferences.assistantProfile,
        promptPacks: state.preferences.promptPacks,
        activeModules: state.preferences.activeModules,
        bibleStudyModules: state.preferences.bibleStudyModules
      }
    })
  } catch {
    // best effort sync
  }
}

function buildLocalConversationPairs() {
  const pairs = []

  for (let index = 0; index < state.chatHistory.length; index += 1) {
    const entry = state.chatHistory[index]
    if (entry.role !== "user") continue

    const reply = state.chatHistory
      .slice(index + 1)
      .find((candidate) => candidate.role === "assistant")

    pairs.push({
      prompt: entry.content,
      response: reply?.content || "Sem resposta associada.",
      createdAt: reply?.createdAt || entry.createdAt
    })
  }

  return pairs.reverse()
}

function formatMessage(text) {
  const codeBlocks = []
  let source = String(text || "").replace(/\r\n/g, "\n")

  source = source.replace(/```([a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (_match, language = "texto", code = "") => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
    codeBlocks.push(renderCodeBlock(language, code))
    return placeholder
  })

  let html = source
    .split(/\n{2,}/)
    .map((segment) => formatMessageSegment(segment.trim()))
    .join("")

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block)
  })

  return html
}

function renderCodeBlock(language = "texto", code = "") {
  const copyValue = encodeURIComponent(String(code || ""))
  return `
    <div class="code-block">
      <div class="code-header">
        <span>${escapeHtml(language)}</span>
        <button class="copy-btn" type="button" data-copy="${copyValue}">Copiar</button>
      </div>
      <pre><code>${escapeHtml(String(code || "").trim())}</code></pre>
    </div>
  `
}

function formatMessageSegment(segment = "") {
  if (!segment) return ""
  if (/^__CODE_BLOCK_\d+__$/.test(segment)) {
    return segment
  }

  const table = parseMarkdownTableSegment(segment)
  if (table) {
    return renderMarkdownTableSegment(table, segment)
  }

  const timeline = parseTimelineSegment(segment)
  if (timeline) {
    return renderTimelineSegment(timeline)
  }

  const steps = parseStepListSegment(segment)
  if (steps) {
    return renderStepListSegment(steps)
  }

  const bullets = parseBulletListSegment(segment)
  if (bullets) {
    return renderBulletListSegment(bullets)
  }

  const verse = parseVerseSegment(segment)
  if (verse) {
    return renderVerseSegment(verse)
  }

  return `<p>${formatInlineContent(segment).replace(/\n/g, "<br>")}</p>`
}

function formatInlineContent(content = "") {
  let html = escapeHtml(String(content || ""))
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>")
  html = html.replace(/`([^`\n]+)`/g, "<code class=\"inline-code\">$1</code>")
  html = html.replace(/(https?:\/\/[^\s<]+)/g, "<a href=\"$1\" target=\"_blank\" rel=\"noreferrer\">$1</a>")
  return html
}

function parseMarkdownTableSegment(segment = "") {
  const lines = String(segment || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 3) return null
  if (!lines[0].includes("|")) return null
  if (!/^\|?[\s:-|]+\|?$/.test(lines[1])) return null

  const splitRow = (row) => row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())

  const headers = splitRow(lines[0])
  const rows = lines.slice(2).map(splitRow).filter((row) => row.some(Boolean))

  if (!headers.length || !rows.length) return null

  return { headers, rows }
}

function renderMarkdownTableSegment(table, source = "") {
  const csv = [
    table.headers.join(","),
    ...table.rows.map((row) => row.join(","))
  ].join("\n")

  return `
    <div class="rich-table-wrap">
      <div class="rich-table-toolbar">
        <span>Tabela</span>
        <div class="rich-table-actions">
          <button class="copy-btn" type="button" data-copy="${encodeURIComponent(source)}">Copiar</button>
          <button class="copy-btn" type="button" data-download-text="${encodeURIComponent(csv)}" data-file-name="giom-table.csv" data-mime-type="text/csv;charset=utf-8">Baixar CSV</button>
        </div>
      </div>
      <table class="rich-table">
        <thead>
          <tr>${table.headers.map((header) => `<th>${formatInlineContent(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${table.rows.map((row) => `
            <tr>${table.headers.map((_header, index) => `<td>${formatInlineContent(row[index] || "")}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `
}

function parseTimelineSegment(segment = "") {
  const lines = String(segment || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return null

  const items = lines.map((line) => {
    const clean = line.replace(/^[-*]\s*/, "")
    const match = clean.match(/^(.{2,40}?)(?:\s*[-–:]\s*)(.+)$/)
    if (!match) return null
    return {
      label: match[1].trim(),
      detail: match[2].trim()
    }
  }).filter(Boolean)

  if (items.length < 2) return null

  const hasTimeSignal = items.some((item) => /(\d|a\.?\s?c\.?|d\.?\s?c\.?|século|periodo|período|reino|era|exilio|êxodo|tempo)/i.test(`${item.label} ${item.detail}`))
  return hasTimeSignal ? items : null
}

function renderTimelineSegment(items = []) {
  return `
    <div class="timeline-block">
      ${items.map((item) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <strong>${formatInlineContent(item.label)}</strong>
            <p>${formatInlineContent(item.detail)}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `
}

function parseStepListSegment(segment = "") {
  const lines = String(segment || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length || !lines.every((line) => /^\d+\.\s+/.test(line))) {
    return null
  }

  return lines.map((line) => line.replace(/^\d+\.\s+/, "").trim()).filter(Boolean)
}

function renderStepListSegment(items = []) {
  return `
    <div class="steps-block">
      ${items.map((item, index) => `
        <div class="step-card">
          <span class="step-index">${index + 1}</span>
          <div class="step-copy">${formatInlineContent(item)}</div>
        </div>
      `).join("")}
    </div>
  `
}

function parseBulletListSegment(segment = "") {
  const lines = String(segment || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length || !lines.every((line) => /^[-*]\s+/.test(line))) {
    return null
  }

  return lines.map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean)
}

function renderBulletListSegment(items = []) {
  return `
    <div class="steps-block bullets">
      ${items.map((item) => `
        <div class="step-card">
          <span class="step-index bullet"></span>
          <div class="step-copy">${formatInlineContent(item)}</div>
        </div>
      `).join("")}
    </div>
  `
}

function parseVerseSegment(segment = "") {
  const lines = String(segment || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return null

  const match = lines[0].match(/^((?:[1-3]\s*)?[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,4}\s+\d+:\d+(?:-\d+)?)(?:\s*\(([^)]+)\))?(?:\s*[-–:]\s*(.+))?$/)
  if (!match) return null

  const reference = match[1].trim()
  const version = (match[2] || "").trim()
  const inlineText = (match[3] || "").trim()
  const verseText = [inlineText, ...lines.slice(1)].filter(Boolean).join(" ").trim()

  if (!verseText) return null

  return { reference, version, text: verseText }
}

function renderVerseSegment(verse) {
  const copyValue = encodeURIComponent(`${verse.reference}${verse.version ? ` (${verse.version})` : ""} — ${verse.text}`)
  return `
    <div class="verse-card">
      <div class="verse-card-head">
        <div>
          <span class="verse-reference">${formatInlineContent(verse.reference)}</span>
          ${verse.version ? `<small class="verse-version">${formatInlineContent(verse.version)}</small>` : ""}
        </div>
        <button class="copy-btn" type="button" data-copy="${copyValue}">Copiar verso</button>
      </div>
      <p class="verse-text">${formatInlineContent(verse.text)}</p>
    </div>
  `
}

function extractAnswer(payload) {
  return payload?.data?.response ||
    payload?.response ||
    payload?.answer ||
    payload?.reply ||
    payload?.message ||
    ""
}

function extractResponseMeta(payload = {}) {
  const metadata = payload?.metadata || {}
  const weather = metadata.weatherUsed || payload?.weatherUsed || null

  return {
    requestId: payload?.requestId || metadata.requestId || null,
    assistantProfileResolved: metadata.assistantProfile || null,
    activeModulesResolved: Array.isArray(metadata.activeModules) ? metadata.activeModules : [],
    bibleStudyModulesResolved: Array.isArray(metadata.bibleStudyModules) ? metadata.bibleStudyModules : [],
    weatherSummary: weather?.summary || "",
    weatherLocationLabel: weather?.locationLabel || "",
    weatherProvider: weather?.provider || "",
    weatherForecastDays: weather?.forecastDays || null,
    weatherError: weather?.error || null
  }
}

function getUserDisplayName() {
  return state.user?.displayName || "Visitante"
}

function getUserInitial() {
  const label = getUserDisplayName()
  return label.trim().charAt(0).toUpperCase() || "G"
}

function getProviderLabel(provider) {
  if (provider === "github") return "GitHub"
  if (provider === "google") return "Google"
  if (provider === "email") return "Email"
  return "Local"
}

function getUserPlan() {
  return state.user?.plan || "Free"
}

function labelForVerbosity(value) {
  if (value === "short") return "Curto e objetivo"
  if (value === "detailed") return "Detalhado"
  return "Natural"
}

function labelForTheme(value) {
  if (value === "dracula") return "Dracula"
  if (value === "github_dark") return "GitHub Dark"
  if (value === "discord") return "Discord Night"
  if (value === "light") return "Light"
  return value || "Dracula"
}

function exportChatAsPdf() {
  if (!state.chatHistory.length) {
    showToast("Converse com o GIOM antes de exportar.", "warning")
    return
  }

  const exportWindow = window.open("", "_blank", "noopener,noreferrer")
  if (!exportWindow) {
    showToast("O navegador bloqueou a janela de exportacao.", "warning")
    return
  }

  const cards = state.chatHistory
    .map((message) => `
      <article class="export-card ${message.role}">
        <header>
          <strong>${message.role === "user" ? "Voce" : "GIOM"}</strong>
          <span>${escapeHtml(formatTime(message.createdAt))}</span>
        </header>
        ${message.imageDataUrl ? `<img src="${message.imageDataUrl}" alt="Imagem gerada">` : ""}
        <div class="export-content">${formatMessage(message.content)}</div>
      </article>
    `)
    .join("")

  exportWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>GIOM Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; background: #ffffff; }
          h1 { margin: 0 0 10px; }
          p.meta { color: #4b5563; margin: 0 0 24px; }
          .export-card { border: 1px solid #d1d5db; border-radius: 16px; padding: 18px; margin-bottom: 14px; }
          .export-card.user { background: #eff6ff; }
          .export-card header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; color: #4b5563; font-size: 13px; }
          .export-card img { max-width: 100%; border-radius: 14px; margin-bottom: 12px; }
          .export-content p { margin: 0 0 10px; }
          .export-content pre { background: #111827; color: #f9fafb; padding: 14px; border-radius: 12px; overflow: auto; }
          .export-content code { font-family: Consolas, monospace; }
        </style>
      </head>
      <body>
        <h1>GIOM Studio</h1>
        <p class="meta">Exportado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
        ${cards}
        <script>window.addEventListener("load", () => window.print())<\/script>
      </body>
    </html>
  `)
  exportWindow.document.close()
}

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      resolve(result.split(",")[1] || "")
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function hashPassword(password) {
  if (!window.crypto?.subtle) {
    return btoa(unescape(encodeURIComponent(password)))
  }

  const bytes = new TextEncoder().encode(password)
  const digest = await window.crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("")
}

function safeJson(response) {
  return response
    .json()
    .catch(() => null)
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  })
}

function formatBytes(bytes) {
  if (!bytes) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const helper = document.createElement("textarea")
  helper.value = text
  helper.style.position = "fixed"
  helper.style.opacity = "0"
  document.body.appendChild(helper)
  helper.focus()
  helper.select()
  document.execCommand("copy")
  document.body.removeChild(helper)
}

function showToast(message, type = "success") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.textContent = message
  elements.toastStack.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 4200)
}
