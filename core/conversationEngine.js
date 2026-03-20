import { detectIntent } from './utils/helpers.js'

export async function naturalResponse(response, intent = null) {
  // Se tiver intenção, personalizar resposta
  if (intent) {
    return await formatContextualResponse(response, intent)
  }

  // Resposta padrão melhorada
  return `
🤖 **Ai-GROOT Enterprise v2.1**

${response}

---

**🚀 Minhas capacidades avançadas:**
• 📚 **Aprendizado contínuo** - Aprendo com cada interação
• 🔍 **Análise profunda de código** - AST, métricas e sugestões
• 🧠 **NLP avançado** - Entendo contexto e intenções
• 💾 **Memória vetorial** - Lembro de conversas anteriores
• ⚡ **Multi-provider IA** - Groq, OpenRouter, Gemini e mais

**💬 Posso ajudar com:**
• Análise e refatoração de código
• Debugging e resolução de bugs
• Arquitetura e melhores práticas
• Explicações técnicas detalhadas
• Geração de código otimizado

---
*Ai-GROOT Enterprise - IA que evolui com você* 🎯
`
}

async function formatContextualResponse(response, intent) {
  const contextualResponses = {
    greeting: `
👋 **Oi! Sou Ai-GROOT Enterprise!**

Estou ótimo e pronto para ajudar com desenvolvimento de software! 🚀

${response}

**O que você quer explorar hoje?**
• 📝 Análise de código
• 🐛 Debugging de problemas
• 🏗️ Arquitetura de software
• 📚 Melhores práticas
• ⚡ Otimização de performance

---
*Sua IA especialista que aprende continuamente!* 💡
`,

    code_help: `
💻 **Análise de Código**

${response}

**🔍 O que analisei:**
• Estrura e complexidade
• Possíveis bugs e vulnerabilidades
• Métricas de qualidade
• Sugestões de melhoria

**📊 Informações técnicas:**
• Complexidade ciclomática
• Índice de maintainability
• Technical debt estimado

---
*Código analisado com IA avançada!* 🎯
`,

    error_help: `
🐛 **Resolução de Erros**

${response}

**🔧 Processo de debugging:**
1. ✅ Erro identificado
2. 🔍 Causa raiz analisada
3. 💡 Solução proposta
4. 📚 Explicação detalhada

**🛠️ Recursos adicionais:**
• Documentação relevante
• Exemplos de código corrigido
• Melhores práticas para evitar

---
*Bug resolvido com precisão!* ✨
`,

    analysis: `
📊 **Análise Completa**

${response}

**🔍 Análise realizada:**
• Análise estrutural (AST)
• Métricas de qualidade
• Code smells detectados
• Sugestões de refatoração

**📈 Resultados:**
• Maintainability Index
• Complexidade calculada
• Technical Debt
• Coverage estimado

---
*Análise profissional com IA!* 📈
`,

    general: `
🤖 **Ai-GROOT Enterprise**

${response}

**🚀 Sobre mim:**
Sou uma IA especialista em desenvolvimento de software com capacidades avançadas de aprendizado e análise.

**💡 Minhas especialidades:**
• Desenvolvimento web e mobile
• Arquitetura de software
• DevOps e Cloud
• Machine Learning
• Boas práticas e padrões

**🧠 Aprendo continuamente:**
Cada interação me torna mais inteligente e capaz!

---
*Seu parceiro de desenvolvimento!* 🎯
`
  }

  const template = contextualResponses[intent.type] || contextualResponses.general

  // Se tiver análise de código, adicionar insights
  if (intent.hasCode) {
    return template.replace('**🔍 Análise realizada:**', '**🔍 Análise de código detectada:**')
  }

  return template
}