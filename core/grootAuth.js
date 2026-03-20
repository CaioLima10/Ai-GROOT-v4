// GROOT AUTHENTICATION SYSTEM - JWT + User Management
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { grootMemoryConnector } from './grootMemoryConnector.js'

export class GrootAuth {
  constructor() {
    this.supabase = grootMemoryConnector.supabase
    this.jwtSecret = process.env.JWT_SECRET || 'groot-secret-key'
    this.tokenExpiry = '7d'
  }

  // 📝 REGISTRAR NOVO USUÁRIO
  async register(email, password, name) {
    try {
      // Verificar se usuário já existe
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (existingUser) {
        throw new Error('Usuário já existe')
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10)

      // Criar usuário
      const { data: user, error } = await this.supabase
        .from('users')
        .insert({
          email,
          password: hashedPassword,
          name,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Criar perfil inicial
      await this.supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          preferences: {
            style: 'natural',
            name: name,
            level: 'beginner'
          }
        })

      // Gerar token
      const token = this.generateToken(user)

      console.log(`✅ Usuário registrado: ${email}`)
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    } catch (error) {
      console.error('❌ Erro no registro:', error.message)
      throw error
    }
  }

  // 🔐 LOGIN DO USUÁRIO
  async login(email, password) {
    try {
      // Buscar usuário
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !user) {
        throw new Error('Credenciais inválidas')
      }

      // Verificar senha
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        throw new Error('Credenciais inválidas')
      }

      // Gerar token
      const token = this.generateToken(user)

      console.log(`✅ Login realizado: ${email}`)
      
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    } catch (error) {
      console.error('❌ Erro no login:', error.message)
      throw error
    }
  }

  // 🎫 GERAR TOKEN JWT
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name
      },
      this.jwtSecret,
      { expiresIn: this.tokenExpiry }
    )
  }

  // 🔍 VERIFICAR TOKEN
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret)
    } catch (error) {
      throw new Error('Token inválido')
    }
  }

  // 👤 OBTER PERFIL DO USUÁRIO
  async getUserProfile(userId) {
    try {
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email, name, created_at')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      const { data: profile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (profileError) throw profileError

      return {
        ...user,
        preferences: profile.preferences
      }
    } catch (error) {
      console.error('❌ Erro ao obter perfil:', error.message)
      throw error
    }
  }

  // 📊 OBTER ESTATÍSTICAS DO USUÁRIO
  async getUserStats(userId) {
    try {
      const [conversationsCount, knowledgeCount] = await Promise.all([
        this.supabase
          .from('conversations')
          .select('count', { count: 'exact' })
          .eq('user_id', userId),
        
        this.supabase
          .from('knowledge_embeddings')
          .select('count', { count: 'exact' })
          .eq('metadata->>userId', userId)
      ])

      return {
        totalConversations: conversationsCount.count || 0,
        knowledgeContributed: knowledgeCount.count || 0,
        joinDate: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error)
      return {
        totalConversations: 0,
        knowledgeContributed: 0,
        joinDate: new Date().toISOString()
      }
    }
  }

  // 🔄 ATUALIZAR PERFIL
  async updateProfile(userId, preferences) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          preferences,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) throw error

      console.log(`✅ Perfil atualizado: ${userId}`)
      return data[0]
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error.message)
      throw error
    }
  }
}

// Middleware de autenticação
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  try {
    const auth = new GrootAuth()
    const decoded = auth.verifyToken(token)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' })
  }
}

export const grootAuth = new GrootAuth()
