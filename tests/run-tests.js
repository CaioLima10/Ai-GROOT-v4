// EXECUTOR DE TESTES - GROOT 9.0
import { runTests } from './groot-suite.test.js'
import { askGroot } from '../grootCore.js'

console.log('🧪 GROOT 9.0 - Test Suite Runner')
console.log('=====================================\n')

// Quick functionality test
async function quickTest() {
  console.log('⚡ Teste Rápido de Funcionalidade...')
  try {
    const response = await askGroot('Teste rápido')
    if (response && response.success) {
      console.log('✅ Funcionalidade básica OK')
      return true
    } else {
      console.log('❌ Funcionalidade básica FALHOU')
      return false
    }
  } catch (error) {
    console.log(`💥 Erro no teste rápido: ${error.message}`)
    return false
  }
}

// Main execution
async function main() {
  const basicWorks = await quickTest()
  
  if (!basicWorks) {
    console.log('\n❌ Teste básico falhou. Verifique o grootCore.js antes de continuar.')
    process.exit(1)
  }
  
  console.log('\n🚀 Iniciando suite completa de testes...\n')
  
  const results = await runTests()
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0)
}

main().catch(error => {
  console.error(`💥 Erro fatal no executor de testes: ${error.message}`)
  process.exit(1)
})
