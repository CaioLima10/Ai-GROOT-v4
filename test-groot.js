// Teste do GROOT 9.0 Professional
import { askGroot } from './grootCore.js'

console.log('🌳 Iniciando teste do GROOT 9.0 Professional...')

async function testGroot() {
  try {
    console.log('\n=== TESTE 1: Apresentação ===')
    const response1 = await askGroot('Oi, como você está? Apresente-se por favor.')
    console.log('ID:', response1.id)
    console.log('Versão:', response1.version)
    console.log('Source:', response1.source)
    console.log('Confidence:', response1.confidence)
    console.log('Capabilities:', response1.capabilities)
    console.log('Response:', response1.response)
    
    console.log('\n=== TESTE 2: Capacidades Técnicas ===')
    const response2 = await askGroot('Crie uma função JavaScript que calcula fibonacci de forma recursiva')
    console.log('Source:', response2.source)
    console.log('Mode:', response2.mode)
    console.log('Response:', response2.response?.substring(0, 200) + '...')
    
    console.log('\n=== TESTE 3: Planner ===')
    const response3 = await askGroot('Planeje como criar uma API REST completa com Node.js')
    console.log('Source:', response3.source)
    console.log('Plan:', response3.plan?.validatedPlan?.steps?.length || 0, 'steps')
    console.log('Response:', response3.response?.substring(0, 200) + '...')
    
    console.log('\n=== TESTE 4: Tools ===')
    const response4 = await askGroot('Que horas são e qual a versão do sistema?')
    console.log('Source:', response4.source)
    console.log('Response:', response4.response)
    
    console.log('\n=== TESTE 5: Status do Sistema ===')
    const { getStatus } = await import('./core/aiBrain.js')
    const status = await getStatus()
    console.log('Status:', status.core?.name, status.core?.version)
    console.log('Capabilities:', status.core?.capabilities)
    console.log('System Health:', status.system?.health)
    
    console.log('\n✅ Todos os testes concluídos!')
    
  } catch (error) {
    console.error('❌ Erro no teste:', error)
    console.error('Stack:', error.stack)
  }
}

testGroot()
