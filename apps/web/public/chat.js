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
  theme: localStorage.getItem("groot-theme") || "dark",
  assistantProfile: "adaptive_teacher",
  activeModules: ["developer"],
  bibleStudyModules: []
}

const VIEW_META = {
  chat: { title: "Chat", eyebrow: "Workspace" },
  memory: { title: "Memória", eyebrow: "Histórico" },
  plan: { title: "Plano", eyebrow: "Conta" },
  help: { title: "Ajuda", eyebrow: "Suporte" },
  settings: { title: "Configurações", eyebrow: "Preferências" }
}

const elements = {
  appShell: document.getElementById("appShell"),
  body: document.body,
  sidebarScrim: document.getElementById("sidebarScrim"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  pageTitle: document.getElementById("pageTitle"),
  pageEyebrow: document.getElementById("pageEyebrow"),
  backendStatus: document.getElementById("backendStatus"),
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
  themeDarkBtn: document.getElementById("themeDarkBtn"),
  themeLightBtn: document.getElementById("themeLightBtn"),
  chatView: document.getElementById("view-chat"),
  chat: document.getElementById("chat"),
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
  verbositySelect: document.getElementById("verbositySelect"),
  examplesToggle: document.getElementById("examplesToggle"),
  emojiToggle: document.getElementById("emojiToggle"),
  safetySelect: document.getElementById("safetySelect"),
  ageGroupSelect: document.getElementById("ageGroupSelect"),
  themeSelect: document.getElementById("themeSelect"),
  assistantProfileSelect: document.getElementById("assistantProfileSelect"),
  moduleToggles: Array.from(document.querySelectorAll("[data-module-toggle]")),
  bibleStudySettings: document.getElementById("bibleStudySettings"),
  bibleStudyToggles: Array.from(document.querySelectorAll("[data-bible-study-toggle]")),
  profileSettingsHint: document.getElementById("profileSettingsHint"),
  saveSettingsBtn: document.getElementById("saveSettings"),
  settingsStatus: document.getElementById("settingsStatus"),
  settingsAuthMode: document.getElementById("settingsAuthMode"),
  settingsUserLabel: document.getElementById("settingsUserLabel"),
  settingsOauthLabel: document.getElementById("settingsOauthLabel"),
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
  elements.themeDarkBtn?.addEventListener("click", () => setTheme("dark"))
  elements.themeLightBtn?.addEventListener("click", () => setTheme("light"))

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
  } catch {
    state.config = null
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
}

function renderPlanView() {
  elements.currentPlanName.textContent = getUserPlan()
  elements.planCurrentCard.classList.add("current")
}

function hydratePreferences() {
  const stored = readJson(getPreferencesKey(), DEFAULT_PREFERENCES)
  state.preferences = { ...DEFAULT_PREFERENCES, ...stored }
}

function applyPreferencesToUI() {
  elements.verbositySelect.value = state.preferences.verbosity
  elements.examplesToggle.checked = Boolean(state.preferences.examples)
  elements.emojiToggle.checked = !state.preferences.noEmojis
  elements.safetySelect.value = state.preferences.safetyLevel
  elements.ageGroupSelect.value = state.preferences.ageGroup
  elements.themeSelect.value = state.preferences.theme
  elements.assistantProfileSelect.value = state.preferences.assistantProfile || DEFAULT_PREFERENCES.assistantProfile
  applyModulePreferences(state.preferences.activeModules || DEFAULT_PREFERENCES.activeModules)
  applyBibleStudyPreferences(state.preferences.bibleStudyModules || DEFAULT_PREFERENCES.bibleStudyModules)
  setTheme(state.preferences.theme)
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

function getSelectedModulesFromUI() {
  const modules = elements.moduleToggles
    .filter((toggle) => toggle.checked)
    .map((toggle) => toggle.dataset.moduleToggle)

  if (modules.length > 0) return modules
  return [...DEFAULT_PREFERENCES.activeModules]
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
  const profileName = elements.assistantProfileSelect?.selectedOptions?.[0]?.textContent || "Professor Genial"
  const bibleModules = getSelectedBibleStudyModulesFromUI()
  const bibleHint = activeModules.includes("bible") && bibleModules.length > 0
    ? ` Foco bíblico: ${bibleModules.join(", ")}.`
    : ""
  elements.profileSettingsHint.textContent = `Perfil ativo: ${profileName}. Módulos: ${activeModules.join(", ") || "developer"}.${bibleHint}`
}

async function savePreferences() {
  state.preferences = {
    verbosity: elements.verbositySelect.value,
    examples: elements.examplesToggle.checked,
    noEmojis: !elements.emojiToggle.checked,
    safetyLevel: elements.safetySelect.value,
    ageGroup: elements.ageGroupSelect.value,
    theme: elements.themeSelect.value,
    assistantProfile: elements.assistantProfileSelect.value,
    activeModules: getSelectedModulesFromUI(),
    bibleStudyModules: getSelectedBibleStudyModulesFromUI()
  }

  writeJson(getPreferencesKey(), state.preferences)
  setTheme(state.preferences.theme)
  updateProfileHint(state.preferences.activeModules)
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
  elements.themeDarkBtn.classList.toggle("active", theme === "dark")
  elements.themeLightBtn.classList.toggle("active", theme === "light")
  writeJson(getPreferencesKey(), state.preferences)
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
      state.preferences = { ...DEFAULT_PREFERENCES, ...state.preferences, ...data.preferences }
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
  state.chatHistory = readJson(getHistoryKey(), [])
}

function saveChatHistory() {
  writeJson(getHistoryKey(), state.chatHistory)
}

function resetChat() {
  state.chatHistory = []
  saveChatHistory()
  elements.chat.innerHTML = ""
  clearPendingFile()
  elements.textarea.value = ""
  autoResizeTextarea()
  syncChatMode()
  setView("chat")
  setComposerStatus("Novo chat pronto.")
}

function addMessageToHistory(role, content, meta = {}) {
  state.chatHistory.push({
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    isError: Boolean(meta.isError),
    requestId: meta.requestId || null
  })
  saveChatHistory()
}

function renderChatHistory() {
  elements.chat.innerHTML = ""

  state.chatHistory.forEach((message) => {
    elements.chat.appendChild(buildMessageNode(message))
  })

  syncChatMode()
  scrollChatToBottom()
}

function buildMessageNode(message) {
  const node = document.createElement("article")
  node.className = `message ${message.role}`

  const avatar = document.createElement("div")
  avatar.className = "message-avatar"
  avatar.textContent = message.role === "user" ? getUserInitial() : "G"

  const body = document.createElement("div")
  body.className = "message-body"

  const meta = document.createElement("div")
  meta.className = "message-meta"
  meta.textContent = `${message.role === "user" ? "Você" : "GIOM"} • ${formatTime(message.createdAt)}`

  const text = document.createElement("div")
  text.className = "message-text"
  text.innerHTML = formatMessage(message.content)

  if (message.isError) {
    body.style.borderColor = "rgba(255, 139, 139, 0.26)"
  }

  body.appendChild(meta)
  body.appendChild(text)
  node.appendChild(avatar)
  node.appendChild(body)

  return node
}

function appendThinkingMessage() {
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
        <span>Processando</span>
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
  elements.chat.appendChild(node)
  scrollChatToBottom()
  return node
}

function replaceThinkingMessage(node, content, isError = false) {
  const meta = node.querySelector(".message-meta")
  const text = node.querySelector(".message-text")
  if (meta) {
    meta.textContent = `GIOM • ${formatTime(new Date().toISOString())}`
  }
  if (text) {
    text.innerHTML = formatMessage(content)
  }
  if (isError) {
    node.querySelector(".message-body").style.borderColor = "rgba(255, 139, 139, 0.26)"
  }
  scrollChatToBottom()
}

function updateThinkingMessage(node, content, status = "respondendo") {
  const meta = node.querySelector(".message-meta")
  const text = node.querySelector(".message-text")
  if (meta) {
    meta.textContent = `GIOM • ${status}`
  }
  if (text) {
    text.innerHTML = `<p>${escapeHtml(String(content || "")).replace(/\n/g, "<br>")}</p>`
  }
  scrollChatToBottom()
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
}

async function sendMessage() {
  const rawText = elements.textarea.value.trim()
  const file = state.pendingFile
  if (!rawText && !file) return
  if (state.isSending) return

  const userDisplayText = buildUserDisplayText(rawText, file)

  setView("chat")
  addMessageToHistory("user", userDisplayText)
  elements.chat.appendChild(buildMessageNode(state.chatHistory[state.chatHistory.length - 1]))
  scrollChatToBottom()

  const question = rawText || `Analise o arquivo "${file.name}" e resuma o que é importante.`

  elements.textarea.value = ""
  autoResizeTextarea()
  syncChatMode()
  disableComposer(true)
  setComposerStatus(file ? "Enviando anexo e consultando a IA..." : "Consultando a IA...")

  const thinking = appendThinkingMessage()

  try {
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
      activeModules: state.preferences.activeModules,
      bibleStudyModules: state.preferences.bibleStudyModules,
      uploadId: upload?.id || null,
      uploadName: upload?.name || null,
      uploadType: upload?.type || null
    }

    const { answer, payload } = await requestAssistantResponse(question, requestContext, (partialText) => {
      if (!partialText) return
      updateThinkingMessage(thinking, partialText)
      setComposerStatus("Transmitindo resposta...")
    })

    replaceThinkingMessage(thinking, answer)
    addMessageToHistory("assistant", answer, { requestId: payload.requestId })
    await persistConversationRemote(userDisplayText, answer, payload, upload)

    if (upload?.name) {
      setComposerStatus(`Anexo ${upload.name} processado com sucesso.`)
    } else {
      setComposerStatus("Resposta recebida.")
    }
  } catch (error) {
    const fallback = "Não consegui processar a solicitação agora. Verifique backend, login ou anexo e tente novamente."
    replaceThinkingMessage(thinking, fallback, true)
    addMessageToHistory("assistant", fallback, { isError: true })
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
            metadata: parsed.data?.metadata || null
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
        response: finalAnswer
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

function handleFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

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
  const preview = state.pendingFileUrl
    ? `<img class="file-thumb" src="${state.pendingFileUrl}" alt="${escapeHtml(file.name)}">`
    : `<div class="file-icon">📎</div>`

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
    `Tema: ${state.preferences.theme === "dark" ? "Dark" : "Light"}`,
    `Segurança: ${state.preferences.safetyLevel === "strict" ? "Restrita" : "Padrão"}`,
    `Faixa etária: ${state.preferences.ageGroup === "minor" ? "13-17" : "18+"}`,
    `Perfil da IA: ${state.preferences.assistantProfile || "adaptive_teacher"}`,
    `Módulos: ${(state.preferences.activeModules || DEFAULT_PREFERENCES.activeModules).join(", ")}`,
    `Foco bíblico: ${(state.preferences.bibleStudyModules || []).join(", ") || "nenhum"}`,
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
  let html = escapeHtml(String(text || "")).replace(/\r\n/g, "\n")

  html = html.replace(/```([a-z0-9_-]+)?\n?([\s\S]*?)```/gi, (_match, language = "texto", code = "") => {
    const copyValue = encodeURIComponent(code)
    const block = `
      <div class="code-block">
        <div class="code-header">
          <span>${escapeHtml(language)}</span>
          <button class="copy-btn" type="button" data-copy="${copyValue}">Copiar</button>
        </div>
        <pre><code>${escapeHtml(code.trim())}</code></pre>
      </div>
    `
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
    codeBlocks.push(block)
    return placeholder
  })

  html = html.replace(/`([^`\n]+)`/g, "<code class=\"inline-code\">$1</code>")
  html = html.replace(/(https?:\/\/[^\s<]+)/g, "<a href=\"$1\" target=\"_blank\" rel=\"noreferrer\">$1</a>")
  html = html
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("")

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block)
  })

  return html
}

function extractAnswer(payload) {
  return payload?.data?.response ||
    payload?.response ||
    payload?.answer ||
    payload?.reply ||
    payload?.message ||
    ""
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
