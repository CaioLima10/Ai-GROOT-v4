import { principles } from './principles.js'

export class Security {
  constructor() {
    this.threatPatterns = [
      {
        type: "injection",
        patterns: [
          /union.*select|drop.*table|delete.*from|insert.*into/i,
          /<script|javascript:|onload=|onerror=/i,
          /\${|eval\(|exec\(|system\(/i
        ],
        severity: "critical",
        action: "block"
      },
      {
        type: "privilege_escalation",
        patterns: [
          /sudo|su|root|admin|administrator/i,
          /chmod.*777|chown.*root/i,
          /backdoor|reverse.*shell|netcat|nc.*-l/i
        ],
        severity: "high",
        action: "block"
      },
      {
        type: "data_exfiltration",
        patterns: [
          /exfiltrate|steal.*data|dump.*database/i,
          /email.*all.*users|export.*sensitive/i,
          /copy.*to.*external|transfer.*outside/i
        ],
        severity: "high",
        action: "block"
      },
      {
        type: "system_compromise",
        patterns: [
          /format.*c:|rm.*-rf.*/i,
          /shutdown|reboot.*now|halt/i,
          /kill.*all.*process|pkill.*-9/i
        ],
        severity: "critical",
        action: "block"
      }
    ]
    
    this.safeCommands = [
      'npm', 'node', 'python', 'pip', 'git', 'ls', 'dir', 'cat', 'echo',
      'mkdir', 'cp', 'mv', 'grep', 'find', 'ps', 'top', 'df', 'du'
    ]
    
    this.securityLogs = []
    this.blockedAttempts = 0
    this.securityLevel = "high"
  }

  blockDanger(prompt, context = {}) {
    const threats = this.detectThreats(prompt)
    
    if (threats.length > 0) {
      const criticalThreats = threats.filter(t => t.severity === 'critical')
      
      // Logar tentativa
      this.logSecurityEvent({
        timestamp: Date.now(),
        prompt: this.sanitizeForLog(prompt),
        threats,
        context,
        blocked: true
      })
      
      this.blockedAttempts++
      
      if (criticalThreats.length > 0) {
        return {
          blocked: true,
          reason: "Critical security threat detected",
          threats: criticalThreats,
          action: "BLOCKED"
        }
      }
      
      return {
        blocked: true,
        reason: "Security violation detected",
        threats,
        action: "BLOCKED"
      }
    }
    
    return { blocked: false }
  }

  detectThreats(prompt) {
    const detected = []
    const lowerPrompt = prompt.toLowerCase()
    
    for (const threat of this.threatPatterns) {
      for (const pattern of threat.patterns) {
        if (pattern.test(lowerPrompt)) {
          detected.push({
            type: threat.type,
            severity: threat.severity,
            action: threat.action,
            pattern: pattern.source,
            matched: lowerPrompt.match(pattern.source)?.[0] || ""
          })
        }
      }
    }
    
    return detected
  }

  validateCommand(command) {
    const commandParts = command.trim().split(' ')
    const baseCommand = commandParts[0]
    
    // Verificar se comando está na lista segura
    if (!this.safeCommands.includes(baseCommand)) {
      return {
        safe: false,
        reason: `Command "${baseCommand}" not in safe commands list`,
        action: "BLOCKED"
      }
    }
    
    // Verificar argumentos perigosos
    const dangerousArgs = [
      '-rf', '--recursive', '--force', 'sudo', 'su', '&&', '||',
      '>', '>>', '<', '|', '`', '$(', '${'
    ]
    
    for (const arg of commandParts) {
      if (dangerousArgs.some(dangerous => arg.includes(dangerous))) {
        return {
          safe: false,
          reason: `Dangerous argument detected: "${arg}"`,
          action: "BLOCKED"
        }
      }
    }
    
    return { safe: true }
  }

  sanitizeForLog(text) {
    // Remover informações sensíveis para logging
    return text
      .replace(/password\s*[:=]\s*\S+/gi, 'password=***')
      .replace(/token\s*[:=]\s*\S+/gi, 'token=***')
      .replace(/key\s*[:=]\s*\S+/gi, 'key=***')
      .replace(/secret\s*[:=]\s*\S+/gi, 'secret=***')
      .substring(0, 200) // Limitar tamanho
  }

  logSecurityEvent(event) {
    this.securityLogs.push(event)
    
    // Manter apenas últimos 1000 logs
    if (this.securityLogs.length > 1000) {
      this.securityLogs = this.securityLogs.slice(-1000)
    }
    
    console.log(`🔒 Security Event: ${event.threats?.[0]?.type || 'unknown'} - ${event.blocked ? 'BLOCKED' : 'ALLOWED'}`)
  }

  getSecurityStatus() {
    const recentLogs = this.securityLogs.slice(-100)
    const recentBlocks = recentLogs.filter(log => log.blocked).length
    
    return {
      securityLevel: this.securityLevel,
      blockedAttempts: this.blockedAttempts,
      recentBlocks,
      threatPatterns: this.threatPatterns.length,
      safeCommands: this.safeCommands.length,
      recentActivity: recentLogs.slice(-10)
    }
  }

  addThreatPattern(threat) {
    this.threatPatterns.push(threat)
    console.log(`🔒 Added threat pattern: ${threat.type}`)
  }

  removeThreatPattern(type) {
    this.threatPatterns = this.threatPatterns.filter(t => t.type !== type)
    console.log(`🔒 Removed threat pattern: ${type}`)
  }

  addSafeCommand(command) {
    if (!this.safeCommands.includes(command)) {
      this.safeCommands.push(command)
      console.log(`🔒 Added safe command: ${command}`)
    }
  }

  removeSafeCommand(command) {
    this.safeCommands = this.safeCommands.filter(cmd => cmd !== command)
    console.log(`🔒 Removed safe command: ${command}`)
  }

  setSecurityLevel(level) {
    const validLevels = ["low", "medium", "high", "critical"]
    if (validLevels.includes(level)) {
      this.securityLevel = level
      console.log(`🔒 Security level set to: ${level}`)
    }
  }

  clearSecurityLogs() {
    this.securityLogs = []
    this.blockedAttempts = 0
    console.log("🧹 Security logs cleared")
  }

  exportSecurityData() {
    return {
      threatPatterns: this.threatPatterns,
      safeCommands: this.safeCommands,
      securityLevel: this.securityLevel,
      stats: this.getSecurityStatus(),
      exportTimestamp: Date.now()
    }
  }
}

export const security = new Security()
