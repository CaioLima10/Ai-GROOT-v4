const button = document.getElementById("sendBtn")
const textarea = document.getElementById("msg")
const chat = document.getElementById("chat")

button.addEventListener("click", send)

async function send() {

  const message = textarea.value.trim()

  if (!message) return

  chat.innerHTML += `<div class="user">👨‍💻 ${message}</div>`

  textarea.value = ""

  try {

    const response = await fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: message
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.error) {
      chat.innerHTML += `<div class="ai error">❌ Erro: ${data.error}</div>`
    } else if (data.response) {
      chat.innerHTML += `<div class="ai">${data.response}</div>`
    } else {
      chat.innerHTML += `<div class="ai error">❌ Resposta inválida da IA</div>`
    }

  } catch (error) {

    console.error("Erro no frontend:", error)
    chat.innerHTML += `<div class="ai error">❌ Falha ao comunicar com Ai-GROOT: ${error.message}</div>`

  }

}