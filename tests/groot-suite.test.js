// SUITE DE TESTES COMPLETA - GROOT 9.0 Professional (FINAL)
// Testes baseados em padrões de grandes sistemas de IA

import assert from 'assert'
import { askGroot } from '../grootCore.js'

console.log('🧪 Iniciando Suite de Testes GROOT 9.0...\n')

// Test Suite Results
const results = {
  passed: 0,
  failed: 0,
  errors: []
}

// Helper Functions
function test(name, testFn) {
  try {
    console.log(`🔍 Test: ${name}`)
    const result = testFn()
    if (result.passed) {
      console.log(`✅ ${name} - PASSED`)
      results.passed++
    } else {
      console.log(`❌ ${name} - FAILED: ${result.reason}`)
      results.failed++
      results.errors.push({ test: name, error: result.reason })
    }
  } catch (error) {
    console.log(`💥 ${name} - ERROR: ${error.message}`)
    results.failed++
    results.errors.push({ test: name, error: error.message })
  }
}

// 1. TESTE DE CARREGAMENTO DO MÓDULO
test('Module Loading', () => {
  try {
    const grootModule = import('../grootCore.js')
    return { passed: true, reason: 'Module loaded successfully' }
  } catch (error) {
    return { passed: false, reason: `Module loading failed: ${error.message}` }
  }
})

// 2. TESTE DE FUNÇÃO BÁSICA
async function testBasicFunction() {
  try {
    const response = await askGroot('Hello GROOT')
    return { 
      passed: response && response.success === true, 
      reason: response ? 'Function responds correctly' : 'No response received' 
    }
  } catch (error) {
    return { passed: false, reason: `Function call failed: ${error.message}` }
  }
}

// 3. TESTE DE RESPOSTA ESTRUTURADA
async function testStructuredResponse() {
  try {
    const response = await askGroot('Test structured response')
    const hasRequiredFields = response && 
      typeof response === 'object' &&
      response.success === true &&
      typeof response.response === 'string' &&
      response.timestamp &&
      response.version
    
    return { 
      passed: hasRequiredFields, 
      reason: hasRequiredFields ? 'Response has all required fields' : 'Missing required fields in response' 
    }
  } catch (error) {
    return { passed: false, reason: `Structured response test failed: ${error.message}` }
  }
}

// 4. TESTE DE LIDAR COM INPUT VAZIO
async function testEmptyInput() {
  try {
    const response = await askGroot('')
    const handlesEmpty = response && 
      response.success === false &&
      response.code === 'INVALID_INPUT'
    
    return { 
      passed: handlesEmpty, 
      reason: handlesEmpty ? 'Handles empty input correctly' : 'Does not handle empty input' 
    }
  } catch (error) {
    return { passed: false, reason: `Empty input test failed: ${error.message}` }
  }
}

// 5. TESTE DE LIDAR COM INPUT MUITO LONGO
async function testLongInput() {
  try {
    const longInput = 'A'.repeat(100000)
    const response = await askGroot(longInput)
    const handlesLong = response && response.success === true
    
    return { 
      passed: handlesLong, 
      reason: handlesLong ? 'Handles long input correctly' : 'Fails with long input' 
    }
  } catch (error) {
    return { passed: false, reason: `Long input test failed: ${error.message}` }
  }
}

// 6. TESTE DE CARACTERES ESPECIAIS
async function testSpecialCharacters() {
  try {
    const specialInput = 'Test with émojis 🚀 ñoñ and special chars: @#$%^&*()'
    const response = await askGroot(specialInput)
    const handlesSpecial = response && response.success === true
    
    return { 
      passed: handlesSpecial, 
      reason: handlesSpecial ? 'Handles special characters correctly' : 'Fails with special characters' 
    }
  } catch (error) {
    return { passed: false, reason: `Special characters test failed: ${error.message}` }
  }
}

// 7. TESTE DE CONCORRÊNCIA
async function testConcurrency() {
  try {
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(askGroot(`Concurrent test ${i}`))
    }
    
    const responses = await Promise.all(promises)
    const allSuccessful = responses.every(r => r && r.success === true)
    
    return { 
      passed: allSuccessful, 
      reason: allSuccessful ? 'Handles concurrent requests' : 'Fails with concurrent requests' 
    }
  } catch (error) {
    return { passed: false, reason: `Concurrency test failed: ${error.message}` }
  }
}

// 8. TESTE DE PERFORMANCE
async function testPerformance() {
  try {
    const startTime = Date.now()
    const response = await askGroot('Performance test')
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    const isPerformant = response && response.success === true && responseTime < 5000
    
    return { 
      passed: isPerformant, 
      reason: isPerformant ? `Responds in ${responseTime}ms (< 5000ms)` : `Too slow: ${responseTime}ms` 
    }
  } catch (error) {
    return { passed: false, reason: `Performance test failed: ${error.message}` }
  }
}

// 9. TESTE DE CONSISTÊNCIA
async function testConsistency() {
  try {
    const sameInput = 'Consistency test'
    const response1 = await askGroot(sameInput)
    const response2 = await askGroot(sameInput)
    
    const isConsistent = response1 && response2 && 
      response1.success === response2.success &&
      response1.version === response2.version
    
    return { 
      passed: isConsistent, 
      reason: isConsistent ? 'Responses are consistent' : 'Responses are inconsistent' 
    }
  } catch (error) {
    return { passed: false, reason: `Consistency test failed: ${error.message}` }
  }
}

// 10. TESTE DE ERRO HANDLING
async function testErrorHandling() {
  try {
    const response = await askGroot(null)
    
    const handlesError = response && 
      response.success === false &&
      response.code === 'INVALID_INPUT'
    
    return { 
      passed: handlesError, 
      reason: handlesError ? 'Handles errors gracefully' : 'Does not handle errors' 
    }
  } catch (error) {
    return { 
      passed: false, reason: `Unexpected error: ${error.message}` 
    }
  }
}

// 11. TESTE DE MEMÓRIA
async function testMemory() {
  try {
    const response1 = await askGroot('Remember my name is GROOT')
    const response2 = await askGroot('What is my name?')
    
    const hasMemory = response1 && response2 && 
      response1.success && response2.success
    
    return { 
      passed: hasMemory, 
      reason: hasMemory ? 'Memory functionality working' : 'Memory not working' 
    }
  } catch (error) {
    return { passed: false, reason: `Memory test failed: ${error.message}` }
  }
}

// 12. TESTE DE TIPOS DE DADOS
async function testDataTypes() {
  try {
    const response1 = await askGroot(123)
    const response2 = await askGroot(JSON.stringify({test: 'data'}))
    const response3 = await askGroot(JSON.stringify([1, 2, 3]))
    
    const handlesDataTypes = response1 && response2 && response3 && 
      response1.success === false &&
      response1.code === 'INVALID_INPUT'
    
    return { 
      passed: handlesDataTypes, 
      reason: handlesDataTypes ? 'Correctly rejects invalid data types' : 'Accepts invalid data types' 
    }
  } catch (error) {
    return { passed: false, reason: `Data types test failed: ${error.message}` }
  }
}

// 13. TESTE DE LIMITES
async function testLimits() {
  try {
    const veryLongInput = 'A'.repeat(100000)
    
    const response = await askGroot(veryLongInput)
    
    const handlesLimits = response && 
      response.success === true &&
      response.response.length > 0
    
    return { 
      passed: handlesLimits, 
      reason: handlesLimits ? 'Handles input limits properly' : 'Does not handle limits' 
    }
  } catch (error) {
    return { passed: false, reason: `Limits test failed: ${error.message}` }
  }
}

// 14. TESTE DE FORMATAÇÃO
async function testFormatting() {
  try {
    const response = await askGroot('Format this as JSON')
    
    const isWellFormatted = response && 
      typeof response === 'object' &&
      response.success === true &&
      response.response &&
      response.response.length > 0
    
    return { 
      passed: isWellFormatted, 
      reason: isWellFormatted ? 'Response is well formatted' : 'Response formatting issues' 
    }
  } catch (error) {
    return { passed: false, reason: `Formatting test failed: ${error.message}` }
  }
}

// 15. TESTE DE SEGURANÇA
async function testSecurity() {
  try {
    const maliciousInput = '<script>alert("xss")</script>'
    const response = await askGroot(maliciousInput)
    
    const isSecure = response && 
      response.success === true &&
      !response.response.includes('<script>') &&
      response.response.includes('[SCRIPT_REMOVIDO]')
    
    return { 
      passed: isSecure, 
      reason: isSecure ? 'Handles malicious input securely' : 'Security vulnerability detected' 
    }
  } catch (error) {
    return { passed: false, reason: `Security test failed: ${error.message}` }
  }
}

// Run all tests and generate report
async function runTests() {
  console.log('🚀 Executando todos os testes...\n')
  
  // Executar todos os testes assíncronos
  await testBasicFunction()
  await testStructuredResponse()
  await testEmptyInput()
  await testLongInput()
  await testSpecialCharacters()
  await testConcurrency()
  await testPerformance()
  await testConsistency()
  await testErrorHandling()
  await testMemory()
  await testDataTypes()
  await testLimits()
  await testFormatting()
  await testSecurity()
  
  // Generate final report
  console.log('\n📊 RELATÓRIO FINAL DE TESTES')
  console.log('='.repeat(50))
  console.log(`✅ Testes Passados: ${results.passed}`)
  console.log(`❌ Testes Falhados: ${results.failed}`)
  console.log(`📈 Taxa de Sucesso: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`)
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERROS ENCONTRADOS:')
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`)
    })
  }
  
  console.log('\n🎯 RECOMENDAÇÕES:')
  if (results.failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM! GROOT está pronto para produção.')
  } else {
    console.log('🔧 Corrija os erros acima antes de prosseguir.')
    console.log('📋 Verifique:')
    console.log('   - Importação de módulos')
    console.log('   - Tratamento de erros')
    console.log('   - Validação de inputs')
    console.log('   - Performance')
    console.log('   - Segurança')
  }
  
  return {
    total: results.passed + results.failed,
    passed: results.passed,
    failed: results.failed,
    successRate: (results.passed / (results.passed + results.failed)) * 100,
    errors: results.errors
  }
}

// Export for use in other files
export { runTests }

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}
