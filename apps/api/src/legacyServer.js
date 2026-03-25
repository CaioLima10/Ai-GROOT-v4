import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { askGroot } from "../../../grootCore.js"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// Corrige __dirname no ESModules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WEB_PUBLIC_DIR = existsSync(path.resolve(__dirname, "../../web/public"))
  ? path.resolve(__dirname, "../../web/public")
  : path.resolve(__dirname, "../../../ui")

// Servir interface da IA
app.use(express.static(WEB_PUBLIC_DIR))

// rota teste
app.get("/api", (req, res) => {
  res.json({ status: "GIOM online 🤖" })
})

// rota da IA
app.post("/ask", async (req, res) => {

  try {

    const { question } = req.body
    const answer = await askGroot(question)
    res.json({ answer: answer.response })

  } catch (error) {

    console.error("❌ Erro na IA:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })

    const statusCode = error.response?.status || 500
    const errorCode = error.code || "INTERNAL_ERROR"

    res.status(statusCode).json({
      error: "Erro ao processar sua pergunta",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
      code: errorCode
    })

  }

})

const PORT = process.env.PORT || 3002

const server = app.listen(PORT, () => {
  console.log(`🤖 GIOM rodando em http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM recebido, encerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🔄 SIGINT recebido, encerrando servidor...')
  server.close(() => {
    console.log('✅ Servidor encerrado')
    process.exit(0)
  })
})

// Tratar erros de servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso. Tente:`)
    console.error(`   npm run dev -- --port ${PORT + 1}`)
    console.error(`   ou mate o processo: npx kill-port ${PORT}`)
  } else {
    console.error('❌ Erro no servidor:', error)
  }
  process.exit(1)
})
