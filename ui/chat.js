const button = document.getElementById("sendBtn")
const textarea = document.getElementById("msg")
const chat = document.getElementById("chat")
const themeToggle = document.getElementById("themeToggle")
const ageModal = document.getElementById("ageModal")
const ageBanner = document.getElementById("ageBanner")
const ageBadge = document.getElementById("ageBadge")
const loginBtn = document.getElementById("loginBtn")
const loginModal = document.getElementById("loginModal")
const closeLogin = document.getElementById("closeLogin")
const emailInput = document.getElementById("emailInput")
const passwordInput = document.getElementById("passwordInput")
const emailLogin = document.getElementById("emailLogin")
const emailSignup = document.getElementById("emailSignup")
const googleLogin = document.getElementById("googleLogin")
const githubLogin = document.getElementById("githubLogin")
const loginStatus = document.getElementById("loginStatus")
const userName = document.getElementById("userName")
const userRole = document.getElementById("userRole")
const userAvatar = document.getElementById("userAvatar")
const userDropdown = document.getElementById("userDropdown")
const logoutBtn = document.getElementById("logoutBtn")
const switchAccount = document.getElementById("switchAccount")
const newChat = document.getElementById("newChat")
const navItems = document.querySelectorAll(".nav-item")
const viewChat = document.getElementById("view-chat")
const viewMemory = document.getElementById("view-memory")
const viewDocs = document.getElementById("view-docs")
const viewSettings = document.getElementById("view-settings")
const viewMetrics = document.getElementById("view-metrics")
const memoryList = document.getElementById("memoryList")
const learningList = document.getElementById("learningList")
const verbositySelect = document.getElementById("verbositySelect")
const examplesToggle = document.getElementById("examplesToggle")
const emojiToggle = document.getElementById("emojiToggle")
const safetySelect = document.getElementById("safetySelect")
const saveSettings = document.getElementById("saveSettings")
const settingsStatus = document.getElementById("settingsStatus")
const refreshMetrics = document.getElementById("refreshMetrics")
const metricTotal = document.getElementById("metricTotal")
const metricSuccess = document.getElementById("metricSuccess")
const metricAvg = document.getElementById("metricAvg")
const metricCache = document.getElementById("metricCache")
const metricUptime = document.getElementById("metricUptime")
const adminKeyInput = document.getElementById("adminKeyInput")
const saveAdminKey = document.getElementById("saveAdminKey")
const metricsStatus = document.getElementById("metricsStatus")
const providersList = document.getElementById("providersList")
const errorsList = document.getElementById("errorsList")
const uploadBtn = document.getElementById("uploadBtn")
const fileInput = document.getElementById("fileInput")
const uploadStatus = document.getElementById("uploadStatus")

const state = {
  theme: localStorage.getItem("groot-theme") || "dark",
  ageGroup: localStorage.getItem("groot-age-group") || null,
  supabase: null,
  user: null,
  preferences: {},
  adminProtected: false,
  lastUpload: null,
  currentChatHistory: []
}

// Funções para gerenciar histórico por usuário
function getUserStorageKey() {
  const userId = state.user?.email || "visitante"
  return `groot-chat-history-${userId.replace(/[^a-zA-Z0-9]/g, "_")}`
}

function saveChatHistory() {
  const key = getUserStorageKey()
  try {
    localStorage.setItem(key, JSON.stringify(state.currentChatHistory))
  } catch (e) {
    console.warn("Erro ao salvar histórico:", e)
  }
}

function loadChatHistory() {
  const key = getUserStorageKey()
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      state.currentChatHistory = JSON.parse(saved)
      renderChatHistory()
    } else {
      state.currentChatHistory = []
      chat.innerHTML = ""
    }
  } catch (e) {
    console.warn("Erro ao carregar histórico:", e)
    state.currentChatHistory = []
    chat.innerHTML = ""
  }
}

function renderChatHistory() {
  chat.innerHTML = ""
  state.currentChatHistory.forEach(msg => {
    const message = document.createElement("div")
    message.className = `message ${msg.role}${msg.isError ? " error" : ""}`
    message.innerHTML = formatMessage(msg.content)
    chat.appendChild(message)
  })
  chat.scrollTop = chat.scrollHeight
}

function addToHistory(role, content, isError = false) {
  state.currentChatHistory.push({ role, content, isError, timestamp: Date.now() })
  saveChatHistory()
}

document.body.dataset.theme = state.theme

button.addEventListener("click", send)
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    send()
  }
})

themeToggle.addEventListener("click", toggleTheme)
loginBtn.addEventListener("click", () => showModal(loginModal))

// Fechar modal com botão X
if (closeLogin) {
  closeLogin.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    loginModal.classList.add("hidden")
    console.log("Modal fechado!")
  })
}

// Fechar modal ao clicar fora
loginModal.addEventListener("click", (event) => {
  if (event.target === loginModal) {
    loginModal.classList.add("hidden")
  }
})
newChat.addEventListener("click", () => {
  chat.innerHTML = ""
  state.currentChatHistory = []
  saveChatHistory()
})

if (uploadBtn && fileInput) {
  uploadBtn.addEventListener("click", () => fileInput.click())
  fileInput.addEventListener("change", handleUpload)
}

navItems.forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view))
})

ageModal.addEventListener("click", (event) => {
  if (event.target === ageModal) {
    hideModal(ageModal)
    return
  }
  if (event.target.dataset.age) {
    setAgeGroup(event.target.dataset.age)
  }
})

loginModal.addEventListener("click", (event) => {
  if (event.target === loginModal) {
    hideModal(loginModal)
  }
})

ageBadge.addEventListener("click", () => showModal(ageModal))

function showModal(modal) {
  modal.classList.remove("hidden")
  modal.style.display = "flex"
}

function hideModal(modal) {
  modal.classList.add("hidden")
  modal.style.display = "none"
}

function setUploadStatus(message, isError = false) {
  if (!uploadStatus) return
  uploadStatus.textContent = message || ""
  uploadStatus.classList.toggle("error", !!isError)
}

function setLoginStatus(message, isError = false) {
  if (!loginStatus) return
  loginStatus.textContent = message || ""
  loginStatus.classList.toggle("error", !!isError)
}

function cleanAuthUrl() {
  const hash = window.location.hash || ""
  const search = window.location.search || ""
  const hasAuthHash = hash.includes("access_token") || hash.includes("refresh_token") || hash.includes("error_description")
  const hasAuthCode = search.includes("code=") || search.includes("error_description")
  if (hasAuthHash || hasAuthCode) {
    history.replaceState({}, document.title, window.location.pathname)
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark"
  document.body.dataset.theme = state.theme
  localStorage.setItem("groot-theme", state.theme)
}

function setAgeGroup(group) {
  state.ageGroup = group
  localStorage.setItem("groot-age-group", group)
  updateAgeUI()
  hideModal(ageModal)
}

function updateAgeUI() {
  if (!state.ageGroup) {
    ageBanner.classList.add("hidden")
    ageBadge.textContent = "Idade"
    return
  }

  const isMinor = state.ageGroup === "minor"
  ageBadge.textContent = isMinor ? "Menor" : "18+"
  ageBanner.textContent = isMinor
    ? "Modo jovem ativo: linguagem e conteúdo filtrados para segurança."
    : "Modo adulto ativo: respostas completas e técnicas."
  ageBanner.classList.remove("hidden")
}

function initAgeGate() {
  const birthMonth = document.getElementById("birthMonth")
  const birthYear = document.getElementById("birthYear")
  const confirmAgeBtn = document.getElementById("confirmAge")

  if (birthYear) {
    const currentYear = new Date().getFullYear()
    // Ano máximo é o ano atual - 13 (para maior de 13 anos)
    // Não incluir o ano atual para evitar menores de 13 anos
    const maxYear = currentYear - 13
    for (let year = maxYear; year >= 1950; year--) {
      const option = document.createElement("option")
      option.value = year
      option.textContent = year
      birthYear.appendChild(option)
    }
  }

  if (confirmAgeBtn) {
    confirmAgeBtn.addEventListener("click", () => {
      const month = birthMonth?.value
      const year = birthYear?.value

      if (!month || !year) {
        alert("Por favor, selecione mês e ano de nascimento.")
        return
      }

      const birthDate = new Date(parseInt(year), parseInt(month) - 1)
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

      const group = age >= 18 ? "adult" : "minor"
      state.ageGroup = group
      state.birthMonth = month
      state.birthYear = year
      state.age = age

      localStorage.setItem("groot-age-group", group)
      localStorage.setItem("groot-birth-month", month)
      localStorage.setItem("groot-birth-year", year)
      localStorage.setItem("groot-age", age.toString())

      updateAgeUI()
      ageModal.classList.add("hidden")
      ageModal.style.display = "none"
    })
  }

  // Carregar dados salvos
  const savedAgeGroup = localStorage.getItem("groot-age-group")
  if (savedAgeGroup) {
    state.ageGroup = savedAgeGroup
    state.birthMonth = localStorage.getItem("groot-birth-month")
    state.birthYear = localStorage.getItem("groot-birth-year")
    state.age = parseInt(localStorage.getItem("groot-age") || "0")
  }

  updateAgeUI()
  if (!state.ageGroup) {
    ageModal.classList.remove("hidden")
    ageModal.style.display = "flex"
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatMessage(text) {
  const blocks = []
  let safe = String(text || "")

  // Detectar e formatar LINKS
  safe = safe.replace(/(https?:\/\/[^\s<]+)/gi, (match, url) => {
    const urlId = `url_${Date.now()}_${Math.random().toString(36).substr(0, 6)}`
    blocks.push({ type: 'url', content: url, id: urlId })
    return `__URL_${urlId}__`
  })

  // Detectar e formatar BLOCOS DE CÓDIGO
  safe = safe.replace(/```(\w*)\n?([\s\S]*?)\n?```/g, (match, lang, code) => {
    const index = blocks.length
    blocks.push({ type: 'code', content: code.trim(), language: lang || 'text' })
    return `__CODE_BLOCK_${index}__`
  })

  // Detectar e formatar CÓDIGO INLINE
  safe = safe.replace(/`([^`]+)`/g, (match, code) => {
    const codeId = `code_${Date.now()}_${Math.random().toString(36).substr(0, 6)}`
    blocks.push({ type: 'inline-code', content: code.trim(), id: codeId })
    return `__INLINE_CODE_${codeId}__`
  })

  // Detectar DOCUMENTOS (menções a arquivos, documentos, etc.)
  safe = safe.replace(/\[([^\]]+\.(pdf|doc|docx|txt|md|csv|xlsx|ppt|pptx)[^\]]*)\]/gi, (match, doc) => {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(0, 6)}`
    blocks.push({ type: 'document', content: doc, id: docId })
    return `__DOCUMENT_${docId}__`
  })

  safe = escapeHtml(safe).replace(/\n/g, "<br>")

  // Renderizar blocos especiais
  blocks.forEach((block, index) => {
    if (block.type === 'url') {
      safe = safe.replace(`__URL_${block.id}__`, `
        <div class="link-block">
          <a href="${block.content}" target="_blank" rel="noopener noreferrer" class="link-content">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54 5.54l1.04 1.01L10 14.54l1.04 1.01A5 5 0 0 0 10 13z"/>
              <path d="M18 9h-6V4h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/>
            </svg>
            <span class="link-text">${block.content.length > 50 ? block.content.substring(0, 47) + '...' : block.content}</span>
          </a>
          <button class="copy-btn" onclick="copyToClipboard('${block.content.replace(/'/g, "\\'")}', 'link')" title="Copiar link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/>
            </svg>
          </button>
        </div>
      `)
    } else if (block.type === 'code') {
      safe = safe.replace(`__CODE_BLOCK_${index}__`, `
        <div class="code-block">
          <div class="code-header">
            <span class="code-language">${block.language}</span>
            <button class="copy-btn" onclick="copyToClipboard(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, 'code')" title="Copiar código">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/>
              </svg>
            </button>
          </div>
          <pre class="code-content"><code class="language-${block.language}">${escapeHtml(block.content)}</code></pre>
        </div>
      `)
    } else if (block.type === 'inline-code') {
      safe = safe.replace(`__INLINE_CODE_${block.id}__`, `
        <code class="inline-code" onclick="copyToClipboard('${block.content.replace(/'/g, "\\'")}', 'inline-code')" title="Copiar código">
          ${escapeHtml(block.content)}
        </code>
      `)
    } else if (block.type === 'document') {
      safe = safe.replace(`__DOCUMENT_${block.id}__`, `
        <div class="document-block">
          <div class="document-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,2V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          <span class="document-name">${block.content}</span>
          <button class="copy-btn" onclick="copyToClipboard('${block.content}', 'document')" title="Copiar nome do documento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/>
            </svg>
          </button>
        </div>
      `)
    } else {
      // Código antigo para blocos normais
      safe = safe.replace(`__CODE_BLOCK_${index}__`, `<pre><code>${escapeHtml(block.content)}</code></pre>`)
    }
  })

  return safe
}

// Função global para copiar para clipboard
window.copyToClipboard = function (text, type = 'text') {
  navigator.clipboard.writeText(text).then(() => {
    // Feedback visual
    const toast = document.createElement('div')
    toast.className = 'copy-toast'
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
        <path d="M20 6l-7 7"/>
      </svg>
      ${type === 'code' ? 'Código copiado!' : type === 'link' ? 'Link copiado!' : 'Texto copiado!'}
    `
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.opacity = '0'
      setTimeout(() => document.body.removeChild(toast), 300)
    }, 2000)
  }).catch(err => {
    console.error('Erro ao copiar:', err)
  })
}

function appendMessage(role, content, isError = false, meta = {}) {
  const message = document.createElement("div")
  message.className = `message ${role}${isError ? " error" : ""}`
  message.innerHTML = formatMessage(content)
  if (role === "ai" && !isError && meta.requestId) {
    const feedback = document.createElement("div")
    feedback.className = "feedback"
    const up = document.createElement("button")
    const down = document.createElement("button")
    up.textContent = "Útil"
    down.textContent = "Não útil"
    up.className = "ghost small"
    down.className = "ghost small"
    up.addEventListener("click", async () => {
      await sendFeedback(meta.requestId, 1)
      up.disabled = true
      down.disabled = true
    })
    down.addEventListener("click", async () => {
      await sendFeedback(meta.requestId, 0)
      up.disabled = true
      down.disabled = true
    })
    feedback.appendChild(up)
    feedback.appendChild(down)
    message.appendChild(feedback)
  }
  chat.appendChild(message)
  chat.scrollTop = chat.scrollHeight

  // Salvar no histórico do usuário
  addToHistory(role, content, isError)
}

function setView(view) {
  const map = {
    chat: viewChat,
    memory: viewMemory,
    metrics: viewMetrics,
    docs: viewDocs,
    settings: viewSettings
  }

  Object.values(map).forEach((el) => el.classList.remove("active"))
  map[view]?.classList.add("active")

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view)
  })

  if (view === "memory") {
    loadMemory()
  }

  if (view === "metrics") {
    loadMetrics()
  }

  if (view === "settings") {
    loadPreferences()
  }
}

function renderEmpty(list, message) {
  list.innerHTML = ""
  const item = document.createElement("div")
  item.className = "list-item"
  item.textContent = message
  list.appendChild(item)
}

function truncate(text, max = 120) {
  const value = String(text || "")
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0s"
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}m ${rest}s`
}

async function loadMetrics() {
  metricsStatus.textContent = ""
  const adminKey = localStorage.getItem("groot-admin-key")
  if (adminKey) {
    adminKeyInput.value = adminKey
  }

  const headers = {}
  if (adminKey) {
    headers["X-Admin-Key"] = adminKey
  }

  if (state.adminProtected && !adminKey) {
    metricsStatus.textContent = "Admin key necessária para visualizar métricas."
    return
  }

  try {
    const response = await fetch("/metrics/json", { headers })
    if (response.status === 401) {
      metricsStatus.textContent = "Admin key necessária para ver métricas."
      return
    }
    if (!response.ok) {
      metricsStatus.textContent = "Erro ao carregar métricas."
      return
    }

    const data = await response.json()
    const summary = data.summary || {}

    metricTotal.textContent = summary.requests?.total ?? 0
    const successRate = summary.requests?.total
      ? ((summary.requests.successful / summary.requests.total) * 100).toFixed(1)
      : 0
    metricSuccess.textContent = `${successRate}%`
    metricAvg.textContent = `${summary.requests?.avgResponseTime ?? 0}ms`
    metricCache.textContent = `${summary.cache?.hitRate ?? 0}%`
    metricUptime.textContent = formatDuration(summary.uptime || 0)

    providersList.innerHTML = ""
    const providers = data.providers || {}
    const providerEntries = Object.entries(providers)
    if (providerEntries.length === 0) {
      renderEmpty(providersList, "Sem dados de providers.")
    } else {
      providerEntries.forEach(([name, stats]) => {
        const node = document.createElement("div")
        node.className = "list-item"
        node.innerHTML = `
          <div class="list-title">${name}</div>
          <div class="list-body">Requests: ${stats.requests} | Sucesso: ${stats.successRate}%</div>
          <div class="list-meta">Tempo médio: ${stats.avgResponseTime || 0}ms</div>
        `
        providersList.appendChild(node)
      })
    }

    errorsList.innerHTML = ""
    const errors = data.errors || {}
    const errorEntries = Object.entries(errors)
    if (errorEntries.length === 0) {
      renderEmpty(errorsList, "Nenhum erro recente.")
    } else {
      errorEntries.forEach(([type, stats]) => {
        const node = document.createElement("div")
        node.className = "list-item"
        node.innerHTML = `
          <div class="list-title">${type}</div>
          <div class="list-body">Ocorrências: ${stats.count}</div>
          <div class="list-meta">${stats.recentSample?.message || ""}</div>
        `
        errorsList.appendChild(node)
      })
    }
  } catch (error) {
    metricsStatus.textContent = "Falha ao carregar métricas."
  }
}

async function loadMemory() {
  if (!state.supabase || !state.user) {
    renderEmpty(memoryList, "Faça login para ver sua memória.")
    renderEmpty(learningList, "Faça login para ver seus padrões.")
    return
  }

  const { data: memory, error } = await state.supabase
    .from("conversations")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    renderEmpty(memoryList, "Não foi possível carregar a memória.")
  } else if (!memory?.length) {
    renderEmpty(memoryList, "Sem conversas por enquanto.")
  } else {
    memoryList.innerHTML = ""
    memory.forEach((item) => {
      const node = document.createElement("div")
      node.className = "list-item"
      node.innerHTML = `
        <div class="list-title">${truncate(item.user_message, 80)}</div>
        <div class="list-body">${truncate(item.ai_response, 140)}</div>
        <div class="list-meta">${new Date(item.created_at).toLocaleString()}</div>
      `
      memoryList.appendChild(node)
    })
  }

  const { data: patterns, error: patternError } = await state.supabase
    .from("learning_patterns")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  if (patternError) {
    renderEmpty(learningList, "Não foi possível carregar padrões.")
  } else if (!patterns?.length) {
    renderEmpty(learningList, "Sem padrões aprendidos ainda.")
  } else {
    learningList.innerHTML = ""
    patterns.forEach((item) => {
      const node = document.createElement("div")
      node.className = "list-item"
      node.innerHTML = `
        <div class="list-title">${item.pattern_type}</div>
        <div class="list-body">${truncate(JSON.stringify(item.pattern_data), 140)}</div>
        <div class="list-meta">${new Date(item.created_at).toLocaleString()}</div>
      `
      learningList.appendChild(node)
    })
  }
}

async function loadPreferences() {
  settingsStatus.textContent = ""
  if (!state.supabase || !state.user) {
    settingsStatus.textContent = "Faça login para ajustar preferências."
    return
  }

  const { data, error } = await state.supabase
    .from("user_profiles")
    .select("preferences")
    .eq("user_id", state.user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    settingsStatus.textContent = "Erro ao carregar preferências."
    return
  }

  const prefs = data?.preferences || {}
  state.preferences = prefs
  verbositySelect.value = prefs.verbosity || "natural"
  examplesToggle.checked = !!prefs.examples
  emojiToggle.checked = !prefs.noEmojis
  safetySelect.value = prefs.safetyLevel || "standard"
}

saveSettings.addEventListener("click", async () => {
  settingsStatus.textContent = ""
  if (!state.supabase || !state.user) {
    settingsStatus.textContent = "Faça login para salvar."
    return
  }

  const prefs = {
    ...state.preferences,
    verbosity: verbositySelect.value,
    examples: examplesToggle.checked,
    noEmojis: !emojiToggle.checked,
    safetyLevel: safetySelect.value
  }

  const { error } = await state.supabase
    .from("user_profiles")
    .upsert({
      user_id: state.user.id,
      preferences: prefs,
      updated_at: new Date().toISOString()
    })

  if (error) {
    settingsStatus.textContent = "Erro ao salvar."
  } else {
    settingsStatus.textContent = "Preferências salvas."
    state.preferences = prefs
  }
})

saveAdminKey.addEventListener("click", () => {
  const value = adminKeyInput.value.trim()
  if (value) {
    localStorage.setItem("groot-admin-key", value)
    metricsStatus.textContent = "Admin key salva localmente."
  } else {
    localStorage.removeItem("groot-admin-key")
    metricsStatus.textContent = "Admin key removida."
  }
})

refreshMetrics.addEventListener("click", () => {
  loadMetrics()
})

async function send() {
  const message = textarea.value.trim()
  if (!message) return

  appendMessage("user", message)
  textarea.value = ""

  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": state.user?.id || localStorage.getItem("groot-user-id") || "default_user"
      },
      body: JSON.stringify({
        question: message,
        context: {
          ageGroup: state.ageGroup,
          uiTheme: state.theme,
          locale: navigator.language,
          uploadId: state.lastUpload?.id || null,
          uploadName: state.lastUpload?.name || null,
          uploadType: state.lastUpload?.type || null
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      appendMessage("ai", `Erro: ${data.error}`, true)
    } else if (data.response) {
      appendMessage("ai", data.response, false, { requestId: data.requestId })
    } else {
      appendMessage("ai", "Resposta inválida da IA", true)
    }
    if (state.lastUpload) {
      state.lastUpload = null
      setUploadStatus("")
    }
  } catch (error) {
    console.error("Erro no frontend:", error)
    appendMessage("ai", `Falha ao comunicar com Ai-GROOT: ${error.message}`, true)
  }
}

async function sendFeedback(requestId, rating) {
  try {
    await fetch("/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": state.user?.id || localStorage.getItem("groot-user-id") || "default_user"
      },
      body: JSON.stringify({
        requestId,
        rating
      })
    })
  } catch (error) {
    console.warn("Falha ao enviar feedback:", error.message)
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/config")
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch (error) {
    console.warn("Falha ao carregar config:", error.message)
    return null
  }
}

async function initAuth() {
  const config = await loadConfig()
  if (config) {
    state.adminProtected = !!config.adminProtected
  }
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) {
    loginBtn.textContent = "Entrar"
    loginBtn.disabled = true
    userRole.textContent = "Auth indisponível"
    return
  }

  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })

  const { data } = await state.supabase.auth.getSession()
  state.user = data?.session?.user || null
  updateUserUI()
  loadChatHistory() // Carregar histórico do usuário atual
  cleanAuthUrl()

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null
    updateUserUI()
    if (state.user) {
      loadPreferences()
      loadChatHistory() // Carregar histórico do usuário
      loginModal.classList.add("hidden")
      loginModal.style.display = "none"
    }
    cleanAuthUrl()
  })

  emailLogin.addEventListener("click", async () => {
    setLoginStatus("Entrando...")
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) {
      setLoginStatus("Preencha email e senha.", true)
      return
    }
    try {
      const { error } = await state.supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setLoginStatus(error.message, true)
        return
      }
      hideModal(loginModal)
    } catch (err) {
      setLoginStatus("Erro: " + err.message, true)
    }
  })

  emailSignup.addEventListener("click", async () => {
    setLoginStatus("Criando conta...")
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) {
      setLoginStatus("Preencha email e senha.", true)
      return
    }
    try {
      const { data: signUpData, error } = await state.supabase.auth.signUp({ email, password })
      if (error) {
        setLoginStatus(error.message, true)
        return
      }
      if (!signUpData?.session) {
        setLoginStatus("Conta criada! Verifique seu email para confirmar.", false)
        return
      }
      hideModal(loginModal)
    } catch (err) {
      setLoginStatus("Erro: " + err.message, true)
    }
  })

  googleLogin.addEventListener("click", async () => {
    setLoginStatus("")
    const { error } = await state.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setLoginStatus("Falha ao iniciar login com Google.", true)
    }
  })

  githubLogin.addEventListener("click", async () => {
    setLoginStatus("")
    const { error } = await state.supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setLoginStatus("Falha ao iniciar login com GitHub.", true)
    }
  })
}

function updateUserUI() {
  if (state.user) {
    userName.textContent = state.user.email || "Usuário"
    userRole.textContent = "Autenticado"
    userAvatar.textContent = (state.user.email || "U").slice(0, 1).toUpperCase()
    loginBtn.textContent = state.user.email?.split('@')[0] || "Usuário"
    loginBtn.disabled = false
    userDropdown.classList.remove("hidden")
    localStorage.setItem("groot-user-id", state.user.id)
  } else {
    userName.textContent = "Visitante"
    userRole.textContent = "Sem login"
    userAvatar.textContent = "G"
    loginBtn.textContent = "Entrar"
    loginBtn.onclick = () => showModal(loginModal)
    userDropdown.classList.add("hidden")
  }
}

// Event listeners do menu de usuário
if (loginBtn) {
  loginBtn.addEventListener("click", (e) => {
    if (state.user) {
      e.stopPropagation()
      userDropdown.classList.toggle("hidden")
    } else {
      showModal(loginModal)
    }
  })
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await state.supabase?.auth.signOut()
    state.user = null
    userDropdown.classList.add("hidden")
    updateUserUI()
    loadChatHistory() // Carregar histórico do visitante
  })
}

if (switchAccount) {
  switchAccount.addEventListener("click", () => {
    userDropdown.classList.add("hidden")
    // Limpar campos do formulário
    if (emailInput) emailInput.value = ""
    if (passwordInput) passwordInput.value = ""
    if (loginStatus) loginStatus.textContent = ""
    // Abrir modal
    showModal(loginModal)
    // Focar no campo de email
    setTimeout(() => {
      if (emailInput) emailInput.focus()
    }, 100)
  })
}

// Fechar dropdown ao clicar fora
document.addEventListener("click", (e) => {
  if (userDropdown && !userDropdown.contains(e.target) && e.target !== loginBtn) {
    userDropdown.classList.add("hidden")
  }
})

initAgeGate()
initAuth()
setView("chat")

async function handleUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const maxBytes = 2_000_000
  if (file.size > maxBytes) {
    setUploadStatus("Arquivo muito grande (máx 2MB).", true)
    fileInput.value = ""
    return
  }

  setUploadStatus("Enviando arquivo...")
  try {
    const base64 = await readFileAsBase64(file)
    const response = await fetch("/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": state.user?.id || localStorage.getItem("groot-user-id") || "default_user"
      },
      body: JSON.stringify({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: base64
      })
    })

    if (!response.ok) {
      setUploadStatus("Falha ao enviar arquivo.", true)
      return
    }

    const data = await response.json()
    state.lastUpload = data
    const expires = data.expiresAt ? new Date(data.expiresAt).toLocaleTimeString() : "em breve"
    setUploadStatus(`📎 ${data.name} pronto para análise (expira ${expires})`)

    // Adicionar mensagem visual no chat
    appendMessage("user", `📎 Enviei o arquivo: ${data.name}`)
    appendMessage("ai", `📎 Recebi seu arquivo "${data.name}"! Pode me pedir para:\n- Analisar o conteúdo\n- Descrever o que tem no arquivo\n- Explicar partes específicas\n- Resumir informações importantes\n\nO que você gostaria que eu faça com este arquivo?`)
  } catch (error) {
    setUploadStatus("Erro no upload. Tente novamente.", true)
  } finally {
    fileInput.value = ""
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      const base64 = result.split(",")[1] || ""
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
