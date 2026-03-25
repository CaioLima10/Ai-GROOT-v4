import axios from "axios"
import dotenv from "dotenv"
import { aiProviders } from "./aiProviders.js"

dotenv.config()

const MAX_RETRIES = 3
const TIMEOUT = 30000 // 30 segundos

// Sistema legado mantido para compatibilidade
export async function askMultiAI(question, options = {}) {
  return await aiProviders.askMultiAI(question, options)
}

// export async function askMultiAI(question) {

//   for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
//     try {
//       console.log(` Tentativa ${attempt}/${MAX_RETRIES} - Enviando para API Groq...`)

//       const response = await axios.post(
//         "https://api.groq.com/openai/v1/chat/completions",
//         {
//           model: "mixtral-8x7b-32768",
//           messages: [
//             {
//               role: "system",
//               content: "You are Ai-GROOT, an advanced AI developer assistant specialized in debugging, systems, programming languages, frameworks, and developer tooling. Always provide clear, actionable responses."
//             },
//             {
//               role: "user",
//               content: question
//             }
//           ],
//           temperature: 0.7,
//           max_tokens: 2000
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
//             "Content-Type": "application/json"
//           },
//           timeout: TIMEOUT
//         }
//       )

//       // Validar estrutura da resposta
//       if (!response.data?.choices?.[0]?.message?.content) {
//         throw new Error("Resposta inválida da API Groq")
//       }

//       const answer = response.data.choices[0].message.content
//       console.log(` Resposta recebida: ${answer.length} caracteres`)

//       return answer

//     } catch (error) {
//       console.error(` Tentativa ${attempt} falhou:`, error.message)

//       // Se for último erro ou erro de autenticação, propagar
//       if (attempt === MAX_RETRIES || error.response?.status === 401) {
//         throw new Error(`Falha na API Groq: ${error.message}`)
//       }

//       // Esperar antes de tentar novamente (exponential backoff)
//       const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
//       console.log(` Aguardando ${delay}ms antes de tentar novamente...`)
//       await new Promise(resolve => setTimeout(resolve, delay))
//     }
//   }
// }
