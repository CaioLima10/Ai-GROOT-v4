// ARQUIVO DE DEBUG TEMPORÁRIO
console.log('🧪 TESTE 6: DEBUG COM ARQUIVO TEMPORÁRIO')

try {
  console.log('1. Importando express...')
  import express from 'express'
  console.log('✅ Express importado:', typeof express)
  
  console.log('2. Importando path...')
  import path from 'path'
  console.log('✅ Path importado')
  
  console.log('3. Importando url...')
  import { fileURLToPath } from 'url'
  console.log('✅ URL importado')
  
  console.log('4. Importando GROOT...')
  import('./groot-quantum.js').then(() => {
    console.log('✅ GROOT importado com sucesso!')
  }).catch(e => {
    console.error('❌ Erro ao importar GROOT:', e.message)
    console.error('❌ Stack:', e.stack)
  })
  
  console.log('5. Criando app Express...')
  const app = express()
  console.log('✅ App criado:', typeof app)
  
  console.log('6. Configurando middleware...')
  app.use(express.json({ limit: '10mb' }))
  console.log('✅ Middleware JSON configurado')
  
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))
  console.log('✅ Middleware URL-encoded configurado')
  
  console.log('7. Configurando rota teste...')
  app.get('/debug', (req, res) => {
    res.json({ status: 'ok', message: 'debug funciona' })
  })
  console.log('✅ Rota debug configurada')
  
  console.log('8. Iniciando servidor...')
  app.listen(3003, () => {
    console.log('✅ Servidor debug rodando em http://localhost:3003')
    console.log('✅ Acesse http://localhost:3003/debug para testar')
  })
  
} catch (e) {
  console.error('❌ Erro geral:', e.message)
  console.error('❌ Stack:', e.stack)
}
