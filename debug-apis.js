import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

console.log("🔍 DEBUG COMPLETO DAS APIs DE IA")
console.log("=".repeat(50))

// Verificar todas as API keys
const apiKeys = {
  GROQ: process.env.GROQ_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  OPENROUTER: process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY,
  HUGGINGFACE: process.env.HUGGINGFACE_API_KEY
}

console.log("📋 Status das API Keys:")
Object.entries(apiKeys).forEach(([name, key]) => {
  console.log(`  ${name}: ${key ? `✅ (${key.length} chars)` : '❌ Não encontrada'}`)
})

// Teste isolado de cada API
async function testGroq() {
  console.log("\n🧪 Testando Groq API...")
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant", // Modelo atual 2024
        messages: [
          {
            role: "system",
            content: "Você é um assistente técnico."
          },
          {
            role: "user",
            content: "Explique JavaScript em uma frase."
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    )

    console.log("✅ Groq SUCESSO!")
    console.log("Status:", response.status)
    console.log("Response:", response.data.choices?.[0]?.message?.content)
    return true
  } catch (error) {
    console.error("❌ Groq FALHOU:")
    console.error("Status:", error.response?.status)
    console.error("Error:", error.response?.data || error.message)
    return false
  }
}

async function testOpenRouter() {
  console.log("\n🧪 Testando OpenRouter API...")
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "system",
            content: "Você é um assistente técnico."
          },
          {
            role: "user",
            content: "Explique JavaScript em uma frase."
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Ai-GROOT Test"
        },
        timeout: 30000
      }
    )

    console.log("✅ OpenRouter SUCESSO!")
    console.log("Status:", response.status)
    console.log("Response:", response.data.choices?.[0]?.message?.content)
    return true
  } catch (error) {
    console.error("❌ OpenRouter FALHOU:")
    console.error("Status:", error.response?.status)
    console.error("Error:", error.response?.data || error.message)
    return false
  }
}

async function testGemini() {
  console.log("\n🧪 Testando Gemini API...")
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: "Explique JavaScript em uma frase."
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      }
    )

    console.log("✅ Gemini SUCESSO!")
    console.log("Status:", response.status)
    console.log("Response:", response.data.candidates?.[0]?.content?.parts?.[0]?.text)
    return true
  } catch (error) {
    console.error("❌ Gemini FALHOU:")
    console.error("Status:", error.response?.status)
    console.error("Error:", error.response?.data || error.message)
    return false
  }
}

async function testHuggingFace() {
  console.log("\n🧪 Testando HuggingFace API...")
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        inputs: "<s>[INST] Explique JavaScript em uma frase. [/INST]",
        parameters: {
          temperature: 0.7,
          max_new_tokens: 100,
          return_full_text: false
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    )

    console.log("✅ HuggingFace SUCESSO!")
    console.log("Status:", response.status)
    console.log("Response:", response.data?.[0]?.generated_text)
    return true
  } catch (error) {
    console.error("❌ HuggingFace FALHOU:")
    console.error("Status:", error.response?.status)
    console.error("Error:", error.response?.data || error.message)
    return false
  }
}

// Executar testes
async function runAllTests() {
  const results = {}

  if (apiKeys.GROQ) results.groq = await testGroq()
  if (apiKeys.OPENROUTER) results.openrouter = await testOpenRouter()
  if (apiKeys.GEMINI) results.gemini = await testGemini()
  if (apiKeys.HUGGINGFACE) results.huggingface = await testHuggingFace()

  console.log("\n📊 RESUMO FINAL:")
  console.log("=".repeat(50))
  Object.entries(results).forEach(([name, success]) => {
    console.log(`${name.toUpperCase()}: ${success ? '✅ FUNCIONA' : '❌ FALHA'}`)
  })

  const workingCount = Object.values(results).filter(Boolean).length
  console.log(`\n🎯 ${workingCount} de ${Object.keys(results).length} APIs funcionando`)

  if (workingCount === 0) {
    console.log("\n🔧 SOLUÇÕES:")
    console.log("1. Obtenha API keys válidas em:")
    console.log("   - Groq: https://groq.com")
    console.log("   - OpenRouter: https://openrouter.ai/keys")
    console.log("   - Gemini: https://makersuite.google.com/app/apikey")
    console.log("   - HuggingFace: https://huggingface.co/settings/tokens")
    console.log("2. Adicione as keys no .env")
    console.log("3. Reinicie o servidor")
  }
}

runAllTests().catch(console.error)
