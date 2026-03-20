import { identity } from './identity.js'

export class Principles {
  constructor() {
    this.moralPrinciples = [
      {
        name: "beneficence",
        description: "Always act to benefit users and promote well-being",
        weight: 0.9,
        enforcement: "strict"
      },
      {
        name: "non_maleficence",
        description: "Never cause harm or enable harmful activities",
        weight: 0.95,
        enforcement: "absolute"
      },
      {
        name: "autonomy",
        description: "Respect user autonomy and decision-making",
        weight: 0.8,
        enforcement: "moderate"
      },
      {
        name: "justice",
        description: "Treat all users fairly and without bias",
        weight: 0.85,
        enforcement: "strict"
      },
      {
        name: "fidelity",
        description: "Be truthful, reliable, and maintain trust",
        weight: 0.9,
        enforcement: "strict"
      }
    ]
    
    this.technicalPrinciples = [
      {
        name: "security_first",
        description: "Prioritize security in all operations",
        weight: 0.95,
        enforcement: "absolute"
      },
      {
        name: "privacy_preservation",
        description: "Protect user privacy and data",
        weight: 0.9,
        enforcement: "strict"
      },
      {
        name: "performance_optimization",
        description: "Maintain optimal performance",
        weight: 0.7,
        enforcement: "moderate"
      },
      {
        name: "continuous_learning",
        description: "Always improve and adapt",
        weight: 0.8,
        enforcement: "strict"
      }
    ]
  }

  check(prompt, context = {}) {
    const violations = []
    const score = this.calculateCompliance(prompt, context)
    
    // Verificar princípios morais
    for (const principle of this.moralPrinciples) {
      const violation = this.checkPrinciple(principle, prompt, context)
      if (violation) {
        violations.push(violation)
      }
    }
    
    // Verificar princípios técnicos
    for (const principle of this.technicalPrinciples) {
      const violation = this.checkPrinciple(principle, prompt, context)
      if (violation) {
        violations.push(violation)
      }
    }
    
    return {
      compliant: violations.length === 0,
      score,
      violations,
      recommendation: this.getRecommendation(violations, score)
    }
  }

  checkPrinciple(principle, prompt, context) {
    const lowerPrompt = prompt.toLowerCase()
    
    // Padrões de violação para cada princípio
    const violationPatterns = {
      non_maleficence: [
        /hack|crack|exploit|malware|virus|attack|damage|destroy|harm|hurt/,
        /illegal|criminal|fraud|scam|theft|steal|rob/,
        /weapon|bomb|explosive|violence|kill|murder|suicide/,
        /discrimination|racism|sexism|harassment|bullying/
      ],
      privacy_preservation: [
        /password|credential|token|key|secret|private.*key/,
        /social.*security|credit.*card|bank.*account|personal.*data/,
        /spy|monitor|track.*without.*permission|surveillance/
      ],
      security_first: [
        /disable.*security|bypass.*protection|remove.*authentication/,
        /backdoor|unauthorized.*access|privilege.*escalation/
      ],
      fidelity: [
        /lie|deceive|mislead|fake|false.*information/,
        /pretend.*be.*someone.*else|impersonate/
      ]
    }
    
    const patterns = violationPatterns[principle.name] || []
    
    for (const pattern of patterns) {
      if (pattern.test(lowerPrompt)) {
        return {
          principle: principle.name,
          severity: principle.enforcement === 'absolute' ? 'critical' : 'high',
          pattern: pattern.source,
          description: `Violates principle: ${principle.description}`,
          weight: principle.weight
        }
      }
    }
    
    return null
  }

  calculateCompliance(prompt, context) {
    let totalWeight = 0
    let compliantWeight = 0
    
    const allPrinciples = [...this.moralPrinciples, ...this.technicalPrinciples]
    
    for (const principle of allPrinciples) {
      totalWeight += principle.weight
      
      const violation = this.checkPrinciple(principle, prompt, context)
      if (!violation) {
        compliantWeight += principle.weight
      }
    }
    
    return totalWeight > 0 ? compliantWeight / totalWeight : 1.0
  }

  getRecommendation(violations, score) {
    if (violations.length === 0) {
      return "Proceed - fully compliant with principles"
    }
    
    const criticalViolations = violations.filter(v => v.severity === 'critical')
    if (criticalViolations.length > 0) {
      return "BLOCKED - Critical principle violations detected"
    }
    
    if (score < 0.7) {
      return "BLOCKED - Too many principle violations"
    }
    
    if (score < 0.9) {
      return "PROCEED WITH CAUTION - Minor principle violations"
    }
    
    return "Proceed - minor issues acceptable"
  }

  getPrinciples() {
    return {
      moral: this.moralPrinciples,
      technical: this.technicalPrinciples
    }
  }

  addPrinciple(type, principle) {
    if (type === 'moral') {
      this.moralPrinciples.push(principle)
    } else if (type === 'technical') {
      this.technicalPrinciples.push(principle)
    }
  }

  removePrinciple(type, name) {
    if (type === 'moral') {
      this.moralPrinciples = this.moralPrinciples.filter(p => p.name !== name)
    } else if (type === 'technical') {
      this.technicalPrinciples = this.technicalPrinciples.filter(p => p.name !== name)
    }
  }
}

export const principles = new Principles()
