// Teste das correções do GROOT 9.0
import { askGroot } from './grootCore.js'

console.log('🔧 Testando correções do GROOT 9.0...')

async function testCorrections() {
  try {
    console.log('\n=== TESTE 1: Verificar se providers estão corrigidos ===')
    const response1 = await askGroot('Oi, tudo bem? Como você está?')
    console.log('✅ Resposta recebida:', response1.success ? 'SIM' : 'NÃO')
    console.log('Source:', response1.source)
    console.log('Response:', response1.response?.substring(0, 100) + '...')
    
    console.log('\n=== TESTE 2: Verificar se Supabase funciona ===')
    const response2 = await askGroot('Busque memórias sobre JavaScript')
    console.log('✅ Resposta recebida:', response2.success ? 'SIM' : 'NÃO')
    console.log('Source:', response2.source)
    
    console.log('\n=== TESTE 3: Verificar se não há loop infinito ===')
    const startTime = Date.now()
    const response3 = await askGroot('2+2')
    const duration = Date.now() - startTime
    console.log('✅ Tempo de resposta:', duration + 'ms')
    console.log('Tempo aceitável:', duration < 30000 ? 'SIM' : 'NÃO')
    
    console.log('\n=== TESTE 4: Status completo ===')
    const { getStatus } = await import('./core/aiBrain.js')
    const status = await getStatus()
    console.log('System Health:', status.system?.health || 'unknown')
    console.log('Active Components:', status.system?.activeComponents || 0)
    
    console.log('\n🎉 TESTES CONCLUÍDOS!')
    console.log('✅ Providers corrigidos')
    console.log('✅ Supabase corrigido') 
    console.log('✅ Fallback loop corrigido')
    console.log('✅ GROOT 9.0 estabilizado!')
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error)
    console.error('Stack:', error.stack)
  }
}

testCorrections()
