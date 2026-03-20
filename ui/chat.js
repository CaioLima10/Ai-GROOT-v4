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

const state = {
  theme: localStorage.getItem("groot-theme") || "dark",
  ageGroup: localStorage.getItem("groot-age-group") || null,
  supabase: null,
  user: null
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
