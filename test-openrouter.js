import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

console.log("🧪 Teste isolado do OpenRouter")
const openRouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY
console.log("🔍 API Key:", openRouterKey ? "✅ Encontrada" : "❌ Não encontrada")

if (!openRouterKey) {
  console.error("❌ ERRO: OPENROUTER_KEY não encontrada no .env")
  process.exit(1)
}

async function testOpenRouter() {
  try {
    console.log("🔄 Enviando requisição para OpenRouter...")
    
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "user",
            content: "Explique o que é JavaScript em uma frase."
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Ai-GROOT Test"
        },
        timeout: 30000
      }
    )

    console.log("✅ SUCESSO!")
    console.log("Status:", response.status)
    console.log("Response:", response.data)
    
    if (response.data?.choices?.[0]?.message?.content) {
      console.log("📝 Resposta da IA:", response.data.choices[0].message.content)
    }

  } catch (error) {
    console.error("❌ ERRO:")
    console.error("Status:", error.response?.status)
    console.error("Status Text:", error.response?.statusText)
    console.error("Data:", error.response?.data)
    console.error("Message:", error.message)
    
    if (error.response?.status === 401) {
      console.log("\n🔍 SOLUÇÃO para 401:")
      console.log("1. Verifique se a API key está correta")
      console.log("2. Vá para https://openrouter.ai/keys")
      console.log("3. Copie uma key válida")
      console.log("4. Cole no .env: OPENROUTER_KEY=sua_key_aqui")
    }
  }
}

testOpenRouter()
