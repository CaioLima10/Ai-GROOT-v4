# 🤖 Ai-GROOT - IA para Desenvolvedores

Uma inteligência artificial especializada em ajudar desenvolvedores a resolver bugs, erros de dependências, problemas de build e desafios de programação.

## 🚀 Funcionalidades

- **Debug de código**: Identifica e corrige bugs em JavaScript, Node.js, React, TypeScript
- **Problemas de dependências**: Ajuda com npm, yarn, erros de instalação
- **Erros de build**: Resolve problemas de compilação e ambiente
- **Assistente técnico**: Suporte para Electron, frameworks e ferramentas dev

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- API Key da Groq (obtenha em [groq.com](https://groq.com))

## 🔧 Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/CaioLima10/Ai-GROOT-v4.git
   cd Ai-GROOT
   ```

2. **Instale dependências**
   ```bash
   npm install
   ```

3. **Configure a API Key**
   ```bash
   # Copie o arquivo .env.example para .env
   cp .env.example .env
   
   # Edite o arquivo .env com sua API Key
   GROQ_API_KEY=sua_api_key_aqui
   PORT=3000
   ```

## 🎯 Uso

### Modo Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### Scripts Úteis

```bash
# Iniciar servidor
npm start

# Matar processo na porta 3000
npm run kill-port

# Ver logs (se configurado)
npm run logs

# Iniciar versão Electron
npm run electron
```

## 🏗️ Estrutura do Projeto

```
Ai-GROOT/
├── api/
│   └── server.js          # Servidor Express
├── core/
│   ├── aiBrain.js         # Cérebro da IA
│   ├── multiAI.js         # Interface com API Groq
│   └── conversationEngine.js # Formatação de respostas
├── ui/
│   ├── index.html         # Interface web
│   ├── chat.js           # Lógica do frontend
│   └── style.css         # Estilos
├── .env                  # Variáveis de ambiente
├── package.json          # Dependências e scripts
└── README.md            # Documentação
```

## 🔍 Fluxo de Funcionamento

1. Usuário digita pergunta na interface
2. Frontend envia POST `/ask` para o backend
3. Server.js valida e processa a requisição
4. aiBrain.js formata o prompt com contexto
5. multiAI.js envia para API Groq com retry automático
6. Resposta é formatada e retornada ao frontend
7. Interface exibe a resposta formatada

## 🛠️ Recursos Técnicos

### Backend
- **Express**: Servidor web REST API
- **CORS**: Habilita requisições cross-origin
- **Axios**: Cliente HTTP para API Groq
- **dotenv**: Gerenciamento de variáveis de ambiente

### Frontend
- **JavaScript puro**: Sem frameworks, vanilla JS
- **Fetch API**: Comunicação com backend
- **CSS3**: Interface responsiva e moderna

### IA
- **Groq API**: Modelo Mixtral-8x7b-32768
- **Retry automático**: 3 tentativas com exponential backoff
- **Timeout**: 30 segundos por requisição
- **Validação robusta**: Verificação de estrutura de resposta

## 🚨 Tratamento de Erros

### Frontend
- Validação de resposta HTTP
- Tratamento específico para diferentes tipos de erro
- Interface amigável para mensagens de erro

### Backend
- Validação de input (tamanho, conteúdo)
- Logging estruturado com timestamps
- Graceful shutdown
- Tratamento de EADDRINUSE

### API Groq
- Retry automático com exponential backoff
- Timeout configurável
- Validação de estrutura de resposta
- Tratamento específico para erros de autenticação

## 🔧 Melhorias Implementadas

### Correções Principais
- ✅ **Problema undefined**: Corrigido ID do botão e validação de resposta
- ✅ **EADDRINUSE**: Implementado graceful shutdown e tratamento de erro
- ✅ **Tratamento de erros**: Validação robusta em todo o fluxo
- ✅ **Retry automático**: 3 tentativas para falhas de API

### Melhorias Arquiteturais
- ✅ **Logging estruturado**: Timestamps e níveis de log
- ✅ **Timeout**: 30 segundos para evitar travamentos
- ✅ **Validação**: Input sanitization e limites
- ✅ **UI Responsiva**: Design moderno e mobile-friendly
- ✅ **Error boundaries**: Tratamento graceful de falhas

## 🐛 Solução de Problemas

### Porta em uso (EADDRINUSE)
```bash
# Opção 1: Matar processo
npm run kill-port

# Opção 2: Usar porta diferente
PORT=3001 npm run dev
```

### API Key inválida
```bash
# Verifique se a API Key está correta no .env
echo $GROQ_API_KEY
```

### Respostas undefined
- Verifique console do navegador para erros
- Confirme que a API Key é válida
- Teste conectividade com API Groq

## 📝 Variáveis de Ambiente

```bash
# .env
GROQ_API_KEY=gsk_sua_chave_aqui
PORT=3000
NODE_ENV=development  # ou production
```

## 🚀 Deploy

### Produção
```bash
# Setar ambiente
export NODE_ENV=production

# Iniciar servidor
npm start
```

### Docker (futuro)
```dockerfile
# Dockerfile (planejado)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie branch para feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit changes (`git commit -am 'Add nova funcionalidade'`)
4. Push para branch (`git push origin feature/nova-funcionalidade`)
5. Abra Pull Request

## 📄 Licença

MIT License - veja arquivo LICENSE para detalhes

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no console
2. Confirme configuração do .env
3. Teste API Key da Groq
4. Abra issue com detalhes do erro

---

**Desenvolvido com ❤️ para a comunidade de desenvolvedores**
