# ☁️ Ai-GROOT Enterprise - Deploy em Nuvem GRÁTITA

**Guia completo para rodar Ai-GROOT na nuvem sem forçar seu PC!**

---

## 🏆 **Melhores Opções Gratuitas 2024-2026**

| Plataforma | Free Tier | Sleep Mode | Vantagens | Ideal Para |
|-----------|-----------|------------|-----------|------------|
| **Zeabur** 🥇 | $5/mês crédito | ❌ NÃO | 24/7 online, Docker, GitHub deploy | **Recomendado** |
| **Render** 🥈 | 750h/mês | ⚠️ 15min | PostgreSQL, SSL, CDN | Produção |
| **Oracle Cloud** 🥉 | VPS forever | ❌ NÃO | Controle total, 2 CPUs | Avançados |
| **Railway** | $5 crédito | ❌ NÃO | Simples, monorepo | Startups |
| **Vercel** | Serverless | ❌ NÃO | Edge, global | APIs serverless |

---

## 🚀 **Opção #1: Zeabur (Recomendado)**

### **✅ Vantagens:**
- **$5 crédito/mês para sempre**
- **SEM sleep mode** (24/7 online)
- **Deploy automático via GitHub**
- **Suporte a Docker**
- **Banco de dados gratuito**

### **⚡ Deploy Rápido (5 min):**

1. **Criar conta Zeabur**
   ```bash
   # Acesse: https://zeabur.com
   # GitHub login → Autorize repositório
   ```

2. **Fork do projeto**
   ```bash
   # Fork: https://github.com/yourusername/ai-groot
   # Configure suas API keys no fork
   ```

3. **Deploy automático**
   ```bash
   # Zeabur detecta automaticamente:
   # - package.json → Node.js
   # - Dockerfile → Docker
   # - Porta 3000 → Web service
   ```

4. **Configurar Environment Variables**
   ```bash
   # No dashboard Zeabur → Variables:
   GEMINI_API_KEY=sua_key
   OPENROUTER_API_KEY=sua_key
   GROQ_API_KEY=sua_key
   HUGGINGFACE_API_KEY=sua_key
   NODE_ENV=production
   ```

5. **URLs disponíveis:**
   ```
   Main: https://ai-groot.zeabur.app
   Admin: https://ai-groot.zeabur.app/admin
   Health: https://ai-groot.zeabur.app/health
   ```

---

## 🚀 **Opção #2: Render (Alternativa)**

### **✅ Vantagens:**
- **750 horas/mês gratuitas**
- **PostgreSQL 90 dias grátis**
- **SSL + CDN embutidos**
- **Background workers**

### **⚡ Deploy com Render.yaml:**

1. **Criar conta Render**
   ```bash
   # Acesse: https://render.com
   # GitHub login → New Web Service
   ```

2. **Conectar repositório**
   ```bash
   # Link: https://github.com/yourusername/ai-groot
   # Branch: main
   # Root Directory: /
   ```

3. **Configurar deploy**
   ```bash
   # Build Command: npm install
   # Start Command: node api/enterpriseServer.js
   # Plan: Free
   ```

4. **Environment Variables**
   ```bash
   # Configure no dashboard:
   NODE_ENV=production
   PORT=3000
   # API keys (configure manualmente)
   ```

5. **URLs disponíveis:**
   ```
   Main: https://ai-groot.onrender.com
   Admin: https://ai-groot.onrender.com/admin
   Health: https://ai-groot.onrender.com/health
   ```

---

## 🚀 **Opção #3: Oracle Cloud Free (Avançado)**

### **✅ Vantagens:**
- **VPS gratuito forever**
- **2 CPUs + 1GB RAM**
- **Controle total**
- **Sem limites de tempo**

### **⚡ Deploy Automatizado:**

1. **Criar conta Oracle Cloud**
   ```bash
   # Acesse: https://cloud.oracle.com/free
   # Cadastre-se (cartão necessário, mas não cobrado)
   ```

2. **Instalar OCI CLI**
   ```bash
   # Linux/Mac:
   bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"
   
   # Windows:
   # Baixe e instale o OCI CLI
   ```

3. **Configurar CLI**
   ```bash
   oci setup bootstrap
   # Siga as instruções para configurar
   ```

4. **Executar script de deploy**
   ```bash
   # Tornar executável:
   chmod +x deploy/oracle-cloud.sh
   
   # Executar deploy:
   ./deploy/oracle-cloud.sh
   ```

5. **Acessar instance**
   ```bash
   # SSH para a instance:
   ssh ubuntu@<PUBLIC_IP>
   
   # Configurar environment:
   sudo nano /opt/ai-groot/.env
   
   # Restart containers:
   sudo docker-compose restart
   ```

---

## 🐳 **Deploy com Docker (Universal)**

### **Build local:**
```bash
# Build imagem
docker build -t ai-groot-enterprise .

# Testar local
docker run -p 3000:3000 --env-file .env ai-groot-enterprise
```

### **Docker Compose:**
```bash
# Subir todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f ai-groot
```

### **Push para Registry:**
```bash
# Tag para Docker Hub
docker tag ai-groot-enterprise yourusername/ai-groot:latest

# Push
docker push yourusername/ai-groot:latest
```

---

## 🔧 **Configuração de API Keys**

### **Obter API Keys Gratuitas:**

1. **Google Gemini**
   ```bash
   # Acesse: https://makersuite.google.com/app/apikey
   # 1M tokens/dia gratuitos
   ```

2. **OpenRouter**
   ```bash
   # Acesse: https://openrouter.ai/keys
   # Múltiplos modelos gratuitos
   ```

3. **Groq**
   ```bash
   # Acesse: https://groq.com
   # Mixtral 8x7b gratuito
   ```

4. **Hugging Face**
   ```bash
   # Acesse: https://huggingface.co/settings/tokens
   # Modelos open-source
   ```

### **Variáveis de Ambiente:**
```bash
# .env (configure na nuvem)
GEMINI_API_KEY=AIzaSy...
OPENROUTER_API_KEY=sk-or-v1...
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...

NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=*
```

---

## 📊 **Monitoramento na Nuvem**

### **Health Checks:**
```bash
# Verificar saúde
curl https://ai-groot.zeabur.app/health

# Métricas Prometheus
curl https://ai-groot.zeabur.app/metrics

# Logs em tempo real
curl https://ai-groot.zeabur.app/logs
```

### **Dashboard Admin:**
```bash
# Acessar painel
https://ai-groot.zeabur.app/admin

# Features:
# - System status
# - Request metrics  
# - Provider health
# - Cache performance
# - Live logs
```

---

## 🔄 **CI/CD Automático**

### **GitHub Actions (Zeabur):**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Zeabur
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Zeabur
        uses: zeabur/setup-deploy@v1
        with:
          token: ${{ secrets.ZEABUR_TOKEN }}
```

### **Render Auto-Deploy:**
```bash
# Render detecta automaticamente:
# - Push para main
# - Pull requests
# - Build automático
# - Zero downtime deploy
```

---

## 💡 **Dicas de Performance**

### **Otimizar para Cloud:**
```javascript
// api/enterpriseServer.js
// Configurar timeout para cloud
app.use((req, res, next) => {
  req.setTimeout(30000) // 30s timeout
  res.setTimeout(30000)
  next()
})

// Health check rápido
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})
```

### **Cache na Cloud:**
```javascript
// Aproveitar cache da plataforma
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/metrics') {
    res.set('Cache-Control', 'public, max-age=60')
  }
  next()
})
```

---

## 🆘 **Troubleshooting**

### **Problemas Comuns:**

1. **Sleep Mode (Render)**
   ```bash
   # Solução: Upgrade para paid plan ($7/mês)
   # Ou usar Zeabur (sem sleep)
   ```

2. **API Keys não funcionam**
   ```bash
   # Verificar se keys estão configuradas
   # Testar localmente primeiro
   # Verificar limits dos providers
   ```

3. **Deploy falha**
   ```bash
   # Verificar logs do deploy
   # Testar build localmente
   # Verificar package.json scripts
   ```

4. **Performance lenta**
   ```bash
   # Habilitar cache
   # Usar CDN (Render/Zeabur)
   # Otimizar Docker image
   ```

---

## 🔒 **Segurança na Cloud**

### **Best Practices:**
```bash
# 1. Never commit .env
echo ".env" >> .gitignore

# 2. Use secrets da plataforma
# Configure API keys no dashboard

# 3. HTTPS automático
# Zeabur/Render fornecem SSL grátis

# 4. Rate limiting
# Já implementado no código

# 5. CORS configurado
# ALLOWED_ORIGINS configurado
```

---

## 📈 **Escalabilidade**

### **Free Limits:**
- **Zeabur**: $5/mês crédito
- **Render**: 750h/mês
- **Oracle**: 2 CPUs + 1GB RAM
- **Railway**: $5/mês crédito

### **Quando Upgrade:**
```bash
# > 1000 requests/day → Considerar paid
# > 10 concurrent users → Upgrade RAM
# > 100MB responses → Upgrade bandwidth
```

---

## 🎯 **Recomendação Final**

### **Para Iniciar:**
1. **Zeabur** - Mais fácil, sem sleep, $5 crédito
2. **Render** - Bom para produção, PostgreSQL grátis
3. **Oracle** - Controle total, mas complexo

### **Setup Recomendado:**
```bash
# 1. Fork projeto no GitHub
# 2. Configurar API keys
# 3. Deploy no Zeabur
# 4. Testar endpoints
# 5. Configurar domínio personalizado
```

**🚀 Ai-GROOT na nuvem em 5 minutos!**

---

*Deploy指南 atualizado para 2024-2026*
