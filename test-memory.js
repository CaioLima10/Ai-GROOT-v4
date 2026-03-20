// Teste completo do sistema de memória GROOT
console.log('🔍 INICIANDO TESTE COMPLETO DA MEMÓRIA GROOT...')

async function testMemorySystem() {
  console.log('\n=== TESTE 1: Supabase Client ===')
  try {
    // Testar se Supabase client está funcionando
    const { default: supabase } = await import('./db/supabase.js')
    console.log('✅ Supabase client importado:', typeof supabase)
    
    // Testar método from
    const fromMethod = supabase.from
    console.log('✅ Método from existe:', typeof fromMethod)
    
    // Testar método select
    const testQuery = supabase.from('memory').select('*')
    console.log('✅ Método select funciona:', !!testQuery)
    
    // Testar método ilike
    const ilikeMethod = testQuery.ilike
    console.log('✅ Método ilike existe:', typeof ilikeMethod)
    
    // Testar método like
    const likeMethod = testQuery.like
    console.log('✅ Método like existe:', typeof likeMethod)
    
    // Tentar executar query completa
    if (typeof ilikeMethod === 'function') {
      console.log('🔍 Testando ilike...')
      const result = await testQuery.ilike('text', '%test%').limit(5)
      console.log('✅ ilike executou:', result)
    } else if (typeof likeMethod === 'function') {
      console.log('🔍 Testando like...')
      const result = await testQuery.like('text', '%test%').limit(5)
      console.log('✅ like executou:', result)
    } else {
      console.log('❌ Nenhum método de busca disponível')
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE 1:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n=== TESTE 2: SupabaseMemory Class ===')
  try {
    // Testar import da classe
    const { default: SupabaseMemory } = await import('./memory/supabaseMemory.js')
    console.log('✅ SupabaseMemory importada:', typeof SupabaseMemory)
    
    // Criar instância
    const memory = new SupabaseMemory()
    console.log('✅ Instância criada:', !!memory)
    
    // Verificar propriedades
    console.log('✅ Tem supabase:', !!memory.supabase)
    console.log('✅ Tem tableName:', !!memory.tableName)
    
    // Testar save
    console.log('🔍 Testando save...')
    await memory.save('Teste de memória', 'test')
    console.log('✅ Save executou')
    
    // Testar search
    console.log('🔍 Testando search...')
    const searchResult = await memory.search('Teste')
    console.log('✅ Search executou:', searchResult)
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE 2:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n=== TESTE 3: Mind Integration ===')
  try {
    // Testar se mind consegue usar memória
    const { default: mind } = await import('./coreMind/mind.js')
    console.log('✅ Mind importado:', typeof mind)
    
    // Testar recallMemories
    console.log('🔍 Testando recallMemories...')
    const memories = await mind.recallMemories('JavaScript')
    console.log('✅ recallMemories executou:', memories.length, 'memories')
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE 3:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n=== TESTE 4: Full Integration ===')
  try {
    // Testar GROOT completo com memória
    const { askGroot } = await import('./grootCore.js')
    console.log('✅ GROOT importado')
    
    // Fazer pergunta que deve usar memória
    console.log('🔍 Testando GROOT com memória...')
    const response = await askGroot('Lembre-se que meu nome é Gabe e me chame pelo nome.')
    console.log('✅ GROOT respondeu:', response.success)
    console.log('📝 Resposta:', response.response?.substring(0, 100) + '...')
    
    // Fazer segunda pergunta para testar se lembrou
    console.log('🔍 Testando se GROOT lembrou...')
    const response2 = await askGroot('Qual é o meu nome?')
    console.log('✅ GROOT respondeu:', response2.success)
    console.log('📝 Resposta 2:', response2.response?.substring(0, 100) + '...')
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE 4:', error.message)
    console.error('Stack:', error.stack)
  }

  console.log('\n=== RESUMO DOS TESTES ===')
  console.log('✅ Testes concluídos. Verifique os logs acima para identificar erros.')
}

testMemorySystem()
