#!/bin/bash

# 🚀 GROOT AUTO-DEPLOY SCRIPT
# Este script faz deploy automático para GitHub → Render

echo "🌳 GROOT AI - Auto Deploy Script"
echo "=================================="

# Verificar status
echo "📋 Verificando status do Git..."
git status

# Adicionar novas mudanças
echo "📝 Adicionando arquivos..."
git add .

# Fazer commit
echo "💿 Criando commit..."
git commit -m "🚀 Auto-Deploy: GROOT AI v3.0 - Production Ready

✅ Features:
- Intelligence Real: LLM Groq + Gemini
- Memory Persistent: Supabase + Vector DB
- Embeddings Advanced: pgvector 384 dims
- Web Interface: Chat Moderna
- Analytics: Monitoring Complete
- Auth System: Multi-users Ready
- Deploy: Production Online

🌐 URL: https://ai-groot.onrender.com
🎯 Status: 🟢 Fully Operational"

# Push para GitHub
echo "📤 Enviando para GitHub..."
git push origin main

echo "✅ Deploy iniciado automaticamente!"
echo "🌐 Acompanhe em: https://dashboard.render.com"
echo "🚀 URL final: https://ai-groot.onrender.com"
echo "🎉 GROOT AI está sendo atualizado!"
