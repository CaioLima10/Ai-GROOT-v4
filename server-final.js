import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { askGroot } from './grootCore.js'

const app = express()
const PORT = 3000

// corrigir __dirname no ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// servir front-end
app.use(express.static(path.join(__dirname, 'ui')))

// abrir index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'))
})

// rota da IA
app.post('/ask', async (req, res) => {
  try {
    const { prompt } = req.body
    const response = await askGroot(prompt, {}) // Adicionar contexto vazio
    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'erro interno' })
  }
})

app.listen(PORT, () => {
  console.log(`✅ Server rodando em http://localhost:${PORT}`)
})
