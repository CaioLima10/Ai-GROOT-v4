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
const userName = document.getElementById("userName")
const userRole = document.getElementById("userRole")
const userAvatar = document.getElementById("userAvatar")
const newChat = document.getElementById("newChat")
const navItems = document.querySelectorAll(".nav-item")
const viewChat = document.getElementById("view-chat")
const viewMemory = document.getElementById("view-memory")
const viewDocs = document.getElementById("view-docs")
const viewSettings = document.getElementById("view-settings")
const memoryList = document.getElementById("memoryList")
const learningList = document.getElementById("learningList")
const verbositySelect = document.getElementById("verbositySelect")
const examplesToggle = document.getElementById("examplesToggle")
const emojiToggle = document.getElementById("emojiToggle")
const safetySelect = document.getElementById("safetySelect")
const saveSettings = document.getElementById("saveSettings")
const settingsStatus = document.getElementById("settingsStatus")

const state = {
  theme: localStorage.getItem("groot-theme") || "dark",
  ageGroup: localStorage.getItem("groot-age-group") || null,
  supabase: null,
  user: null,
  preferences: {}
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
closeLogin.addEventListener("click", () => hideModal(loginModal))
newChat.addEventListener("click", () => {
  chat.innerHTML = ""
})

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
}

function hideModal(modal) {
  modal.classList.add("hidden")
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
  let safe = String(text || "").replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = blocks.length
    blocks.push(escapeHtml(code.trim()))
    return `__CODE_BLOCK_${index}__`
  })

  safe = escapeHtml(safe).replace(/\n/g, "<br>")

  blocks.forEach((block, index) => {
    safe = safe.replace(`__CODE_BLOCK_${index}__`, `<pre><code>${block}</code></pre>`)
  })

  return safe
}

function appendMessage(role, content, isError = false) {
  const message = document.createElement("div")
  message.className = `message ${role}${isError ? " error" : ""}`
  message.innerHTML = formatMessage(content)
  chat.appendChild(message)
  chat.scrollTop = chat.scrollHeight
}

function setView(view) {
  const map = {
    chat: viewChat,
    memory: viewMemory,
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
          locale: navigator.language
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
      appendMessage("ai", data.response)
    } else {
      appendMessage("ai", "Resposta inválida da IA", true)
    }
  } catch (error) {
    console.error("Erro no frontend:", error)
    appendMessage("ai", `Falha ao comunicar com Ai-GROOT: ${error.message}`, true)
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
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || !window.supabase) {
    loginBtn.textContent = "Entrar"
    loginBtn.disabled = true
    userRole.textContent = "Auth indisponível"
    return
  }

  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)

  const { data } = await state.supabase.auth.getSession()
  state.user = data?.session?.user || null
  updateUserUI()

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user || null
    updateUserUI()
    if (state.user) {
      loadPreferences()
    }
  })

  emailLogin.addEventListener("click", async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) return
    await state.supabase.auth.signInWithPassword({ email, password })
    hideModal(loginModal)
  })

  emailSignup.addEventListener("click", async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) return
    await state.supabase.auth.signUp({ email, password })
    hideModal(loginModal)
  })

  googleLogin.addEventListener("click", async () => {
    await state.supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    })
  })

  githubLogin.addEventListener("click", async () => {
    await state.supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin }
    })
  })
}

function updateUserUI() {
  if (state.user) {
    userName.textContent = state.user.email || "Usuário"
    userRole.textContent = "Autenticado"
    userAvatar.textContent = (state.user.email || "U").slice(0, 1).toUpperCase()
    loginBtn.textContent = "Sair"
    loginBtn.disabled = false
    loginBtn.onclick = async () => {
      await state.supabase?.auth.signOut()
      state.user = null
      updateUserUI()
    }
    localStorage.setItem("groot-user-id", state.user.id)
  } else {
    userName.textContent = "Visitante"
    userRole.textContent = "Sem login"
    userAvatar.textContent = "G"
    loginBtn.textContent = "Entrar"
    loginBtn.onclick = () => showModal(loginModal)
  }
}

function initAgeGate() {
  updateAgeUI()
  if (!state.ageGroup) {
    showModal(ageModal)
  }
}

initAgeGate()
initAuth()
setView("chat")
