# 🚀 GUIA - CRIAR GITHUB TOKEN

## 📋 PASSO A PASSO

### 1️⃣ ACESSAR GITHUB
- URL: https://github.com/settings/tokens
- Login: gabeglds2-web@gmail.com
- Senha: Gabriel@10

### 2️⃣ CRIAR TOKEN
1. Clique em "Generate new token" → "Generate new token (classic)"
2. Nome: `GROOT-AI-Integration`
3. Expiration: `90 days`
4. Scopes (marque estes):
   - ✅ `public_repo` - Acessar repositórios públicos
   - ✅ `repo` - Acessar repositórios privados (se precisar)
   - ✅ `read:org` - Ler organizações

### 3️⃣ COPIAR TOKEN
- Copie o token gerado
- Salve em lugar seguro
- **NUNCA compartilhe este token**

### 4️⃣ ADICIONAR AO .ENV
```env
GITHUB_TOKEN=ghp_SEU_TOKEN_AQUI
```

---

## 🔧 ALTERNATIVA: SEM TOKEN

Se não quiser criar token, o sistema funciona com:
- ✅ Embeddings locais
- ✅ Memória normal
- ✅ Aprendizado básico
- ❌ Sem integração GitHub

---

## 📋 STATUS ATUAL

### ✅ COM TOKEN:
- GitHub integration ✅
- Aprende com repositórios ✅
- Código real ✅

### ❌ SEM TOKEN:
- Funciona normal ✅
- Aprende com interações ✅
- Sem GitHub ❌

**Opcional, mas recomendado para máximo poder!**
