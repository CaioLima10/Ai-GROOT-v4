export class ExperienceStore {
  constructor() {
    this.experiences = new Map()
    this.patterns = new Map()
    this.skills = new Map()
    this.insights = []
    this.maxExperiences = 10000
    this.experienceCount = 0
  }

  add(experience) {
    const id = this.generateExperienceId()
    const experienceRecord = {
      id,
      timestamp: Date.now(),
      type: experience.type || 'general',
      context: experience.context || {},
      input: experience.input || '',
      output: experience.output || '',
      outcome: experience.outcome || 'unknown',
      success: experience.success !== false,
      confidence: experience.confidence || 0.5,
      lessons: experience.lessons || [],
      tags: experience.tags || [],
      metadata: experience.metadata || {}
    }
    
    this.experiences.set(id, experienceRecord)
    this.experienceCount++
    
    // Extrair padrões
    this.extractPatterns(experienceRecord)
    
    // Atualizar skills
    this.updateSkills(experienceRecord)
    
    // Gerar insights
    this.generateInsights(experienceRecord)
    
    // Manter limite de experiências
    this.maintainLimit()
    
    console.log(`💾 Experience added: ${experienceRecord.type} (${this.experienceCount} total)`)
    
    return experienceRecord
  }

  generateExperienceId() {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  extractPatterns(experience) {
    const key = this.generatePatternKey(experience)
    
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        key,
        type: experience.type,
        occurrences: 0,
        successRate: 0,
        averageConfidence: 0,
        lastSeen: 0,
        examples: []
      })
    }
    
    const pattern = this.patterns.get(key)
    pattern.occurrences++
    pattern.lastSeen = experience.timestamp
    
    // Atualizar taxa de sucesso
    const allExperiences = Array.from(this.experiences.values())
      .filter(exp => this.generatePatternKey(exp) === key)
    
    const successful = allExperiences.filter(exp => exp.success).length
    pattern.successRate = successful / allExperiences.length
    
    // Atualizar confiança média
    pattern.averageConfidence = allExperiences.reduce((sum, exp) => sum + exp.confidence, 0) / allExperiences.length
    
    // Manter exemplos recentes
    pattern.examples.unshift(experience.id)
    if (pattern.examples.length > 5) {
      pattern.examples = pattern.examples.slice(0, 5)
    }
  }

  generatePatternKey(experience) {
    const parts = [
      experience.type,
      experience.context.category || 'general',
      experience.context.difficulty || 'medium'
    ]
    
    return parts.join('_')
  }

  updateSkills(experience) {
    // Identificar skills baseadas na experiência
    const skills = this.identifySkills(experience)
    
    skills.forEach(skill => {
      if (!this.skills.has(skill)) {
        this.skills.set(skill, {
          name: skill,
          level: 0,
          experience: 0,
          successRate: 0,
          lastUsed: 0,
          examples: []
        })
      }
      
      const skillRecord = this.skills.get(skill)
      skillRecord.experience++
      skillRecord.lastUsed = experience.timestamp
      
      // Atualizar nível (0-100)
      skillRecord.level = Math.min(100, skillRecord.experience * 2)
      
      // Atualizar taxa de sucesso
      const allSkillExperiences = Array.from(this.experiences.values())
        .filter(exp => this.identifySkills(exp).includes(skill))
      
      const successful = allSkillExperiences.filter(exp => exp.success).length
      skillRecord.successRate = allSkillExperiences.length > 0 ? successful / allSkillExperiences.length : 0
      
      // Manter exemplos
      skillRecord.examples.unshift(experience.id)
      if (skillRecord.examples.length > 3) {
        skillRecord.examples = skillRecord.examples.slice(0, 3)
      }
    })
  }

  identifySkills(experience) {
    const skills = []
    
    // Skills baseadas no tipo
    const typeSkills = {
      'coding': ['javascript', 'programming', 'debugging', 'code_analysis'],
      'problem_solving': ['analysis', 'troubleshooting', 'optimization'],
      'learning': ['research', 'adaptation', 'knowledge_integration'],
      'communication': ['explanation', 'documentation', 'clarity'],
      'autonomous': ['planning', 'execution', 'self_improvement']
    }
    
    if (typeSkills[experience.type]) {
      skills.push(...typeSkills[experience.type])
    }
    
    // Skills baseadas no contexto
    if (experience.context.technologies) {
      skills.push(...experience.context.technologies)
    }
    
    if (experience.context.domain) {
      skills.push(experience.context.domain)
    }
    
    // Skills baseadas nas tags
    if (experience.tags) {
      skills.push(...experience.tags)
    }
    
    return [...new Set(skills)] // Remover duplicatas
  }

  generateInsights(experience) {
    // Gerar insights baseados na experiência
    const insights = []
    
    // Insight sobre sucesso/falha
    if (experience.success && experience.confidence > 0.8) {
      insights.push({
        type: 'success_pattern',
        description: `High confidence success in ${experience.type}`,
        confidence: 0.9,
        applicable: true
      })
    } else if (!experience.success && experience.confidence > 0.8) {
      insights.push({
        type: 'failure_pattern',
        description: `High confidence failure in ${experience.type}`,
        confidence: 0.8,
        applicable: true
      })
    }
    
    // Insight sobre padrões
    const pattern = this.patterns.get(this.generatePatternKey(experience))
    if (pattern && pattern.occurrences > 5) {
      if (pattern.successRate > 0.8) {
        insights.push({
          type: 'reliable_pattern',
          description: `Reliable pattern in ${experience.type} (${pattern.successRate.toFixed(1)}% success)`,
          confidence: pattern.successRate,
          applicable: true
        })
      } else if (pattern.successRate < 0.3) {
        insights.push({
          type: 'unreliable_pattern',
          description: `Unreliable pattern in ${experience.type} (${pattern.successRate.toFixed(1)}% success)`,
          confidence: 1 - pattern.successRate,
          applicable: true
        })
      }
    }
    
    // Adicionar insights ao registro
    experience.insights = insights
    
    // Manter insights globais
    this.insights.push(...insights.map(insight => ({
      ...insight,
      experienceId: experience.id,
      timestamp: experience.timestamp
    })))
    
    // Manter apenas insights recentes
    if (this.insights.length > 1000) {
      this.insights = this.insights.slice(-1000)
    }
  }

  maintainLimit() {
    if (this.experiences.size > this.maxExperiences) {
      // Remover experiências mais antigas
      const sortedExperiences = Array.from(this.experiences.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)
      
      const toRemove = sortedExperiences.slice(0, this.experiences.size - this.maxExperiences)
      
      toRemove.forEach(([id]) => {
        this.experiences.delete(id)
      })
      
      console.log(`🗑️ Removed ${toRemove.length} old experiences`)
    }
  }

  findSimilar(context, limit = 5) {
    const similar = []
    
    for (const [id, experience] of this.experiences.entries()) {
      const similarity = this.calculateSimilarity(context, experience)
      
      if (similarity > 0.3) {
        similar.push({
          id,
          experience,
          similarity
        })
      }
    }
    
    // Ordenar por similaridade
    similar.sort((a, b) => b.similarity - a.similarity)
    
    return similar.slice(0, limit)
  }

  calculateSimilarity(context, experience) {
    let similarity = 0
    
    // Similaridade de tipo
    if (context.type === experience.type) {
      similarity += 0.3
    }
    
    // Similaridade de contexto
    if (context.category === experience.context.category) {
      similarity += 0.2
    }
    
    // Similaridade de tags
    if (context.tags && experience.tags) {
      const commonTags = context.tags.filter(tag => experience.tags.includes(tag))
      similarity += (commonTags.length / Math.max(context.tags.length, experience.tags.length)) * 0.2
    }
    
    // Similaridade de input
    if (context.input && experience.input) {
      const inputWords = context.input.toLowerCase().split(/\s+/)
      const expWords = experience.input.toLowerCase().split(/\s+/)
      const commonWords = inputWords.filter(word => expWords.includes(word))
      
      if (inputWords.length > 0) {
        similarity += (commonWords.length / inputWords.length) * 0.3
      }
    }
    
    return similarity
  }

  getExperience(id) {
    return this.experiences.get(id)
  }

  getExperiencesByType(type, limit = 50) {
    const experiences = Array.from(this.experiences.values())
      .filter(exp => exp.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
    
    return experiences.slice(0, limit)
  }

  getPatterns() {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.occurrences - a.occurrences)
  }

  getSkills() {
    return Array.from(this.skills.values())
      .sort((a, b) => b.level - a.level)
  }

  getInsights(type = null, limit = 20) {
    let insights = this.insights
    
    if (type) {
      insights = insights.filter(insight => insight.type === type)
    }
    
    return insights
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  getStats() {
    const recentExperiences = Array.from(this.experiences.values())
      .filter(exp => Date.now() - exp.timestamp < 24 * 60 * 60 * 1000) // últimas 24h
    
    const successRate = this.experiences.size > 0 
      ? Array.from(this.experiences.values()).filter(exp => exp.success).length / this.experiences.size 
      : 0
    
    return {
      totalExperiences: this.experiences.size,
      recentExperiences: recentExperiences.length,
      successRate: (successRate * 100).toFixed(1) + '%',
      totalPatterns: this.patterns.size,
      totalSkills: this.skills.size,
      totalInsights: this.insights.length,
      averageConfidence: this.calculateAverageConfidence(),
      topSkills: this.getSkills().slice(0, 5),
      recentInsights: this.getInsights(null, 5)
    }
  }

  calculateAverageConfidence() {
    if (this.experiences.size === 0) return 0
    
    const totalConfidence = Array.from(this.experiences.values())
      .reduce((sum, exp) => sum + exp.confidence, 0)
    
    return (totalConfidence / this.experiences.size).toFixed(3)
  }

  clearExperiences() {
    this.experiences.clear()
    this.patterns.clear()
    this.skills.clear()
    this.insights = []
    this.experienceCount = 0
    console.log('🧹 Experience store cleared')
  }

  exportExperienceData() {
    return {
      experiences: Array.from(this.experiences.values()),
      patterns: this.getPatterns(),
      skills: this.getSkills(),
      insights: this.insights,
      stats: this.getStats(),
      exportTimestamp: Date.now()
    }
  }
}

export const experienceStore = new ExperienceStore()
