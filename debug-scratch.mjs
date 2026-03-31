// ARQUIVO DE DEBUG COM EXTENSÃO .MJS
console.log('🧪 TESTE 9: DEBUG COM .MJS')

try {
  console.log('1. Importando express...')
  import express from 'express'
  console.log('✅ Express importado:', typeof express)
  
  console.log('2. Criando app...')
  const app = express()
  console.log('✅ App criado')
  
  app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: '.mjs funciona!' })
  })
  
  app.listen(3004, () => {
    console.log('✅ Servidor .mjs rodando em http://localhost:3004')
  })
  
} catch (e) {
  console.error('❌ Erro:', e.message)
}
