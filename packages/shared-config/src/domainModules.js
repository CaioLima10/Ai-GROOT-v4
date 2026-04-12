import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"

function toLiteSubmodules(submodules = []) {
  return submodules.map(submodule => ({
    id: submodule.id,
    label: submodule.label,
    summary: submodule.summary
  }))
}

function normalizeModuleKeywordText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hasNormalizedKeywordMatch(normalizedText = "", keywords = []) {
  return (Array.isArray(keywords) ? keywords : [])
    .some(keyword => {
      const normalizedKeyword = normalizeModuleKeywordText(keyword).trim()
      if (!normalizedKeyword) {
        return false
      }

      // Very short keywords like "bi", "ml", "ui", "ci" should only match as standalone tokens.
      if (/^[a-z0-9]{1,3}$/.test(normalizedKeyword)) {
        return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}(?=[^a-z0-9]|$)`).test(normalizedText)
      }

      return normalizedText.includes(normalizedKeyword)
    })
}

const MODULE_SUBMODULES = {
  developer: [
    {
      id: "backend_systems",
      label: "Backend & APIs",
      summary: "APIs, filas, streaming, concorrencia, integrações e desenho de serviços.",
      keywords: ["api", "backend", "endpoint", "fila", "queue", "sse", "stream", "worker", "microservico"],
      instructions: [
        "Priorize diagnostico de causa raiz, contratos HTTP, concorrencia, observabilidade e rollback.",
        "Diferencie correção tática, correção estrutural e risco operacional residual."
      ]
    },
    {
      id: "frontend_product_ui",
      label: "Frontend & Product UI",
      summary: "UX, UI, estados de tela, acessibilidade, performance e sistemas de interface.",
      keywords: ["frontend", "ui", "ux", "css", "react", "layout", "design system", "acessibilidade"],
      instructions: [
        "Pense em clareza de fluxo, hierarquia visual, acessibilidade, responsividade e risco de regressão de interface.",
        "Ao criticar UI, una produto, implementação, performance e legibilidade."
      ]
    },
    {
      id: "language_specialists",
      label: "Linguagens de Programacao",
      summary: "JavaScript, TypeScript, Python, Java, C#, Go, Rust, PHP e padroes por linguagem.",
      keywords: [
        "javascript", "typescript", "python", "java", "c#", "dotnet", "go", "golang", "rust", "php",
        "node", "linguagem", "padrão de linguagem", "padrao de linguagem"
      ],
      instructions: [
        "Explique idiomatismo, ecossistema, erro comum e tradeoff proprio de cada linguagem.",
        "Diferencie sintaxe, arquitetura, tooling, runtime e custo de manutencao."
      ]
    },
    {
      id: "framework_ecosystems",
      label: "Frameworks & Ecossistemas",
      summary: "Next.js, React, Express, NestJS, Spring, Django, FastAPI, Laravel e stacks modernas.",
      keywords: [
        "next.js", "nextjs", "react", "express", "nestjs", "nest", "spring", "spring boot",
        "django", "fastapi", "laravel", "vue", "angular"
      ],
      instructions: [
        "Trate framework como combinacao de convencao, produtividade, risco de lock-in e operacao.",
        "Ao comparar stacks, separe experiencia de dev, performance, arquitetura e deploy."
      ]
    },
    {
      id: "data_platforms",
      label: "Dados, SQL & Storage",
      summary: "Bancos, índices, cache, vetores, schema, consistência e performance de leitura/escrita.",
      keywords: ["sql", "postgres", "mysql", "redis", "supabase", "schema", "indice", "cache", "vector"],
      instructions: [
        "Explique modelagem, índice, consistência, latência, custo e migração com clareza.",
        "Destaque risco de dado corrompido, incompatibilidade de schema e invalidação."
      ]
    },
    {
      id: "cloud_devops",
      label: "Cloud, DevOps & Deploy",
      summary: "Deploy, containers, CI/CD, observabilidade, custo, escalabilidade e operações.",
      keywords: ["deploy", "render", "docker", "kubernetes", "aws", "azure", "gcp", "ci", "cd", "observabilidade"],
      instructions: [
        "Diferencie build, runtime, rede, segredos, cold start, autoscaling e health check.",
        "Quando houver incidente, una experimento, mitigação, rollback e operação contínua."
      ]
    },
    {
      id: "testing_quality",
      label: "Testes & Qualidade",
      summary: "Testes unitários, integração, smoke, regressão, contrato e validação contínua.",
      keywords: ["teste", "smoke", "jest", "vitest", "playwright", "cypress", "regressao", "contrato"],
      instructions: [
        "Responda com matriz de testes, risco coberto, falso positivo provável e critério de aceite.",
        "Ao falar de qualidade, cubra prevenção e monitoramento além do teste em si."
      ]
    },
    {
      id: "security_engineering",
      label: "Security Engineering",
      summary: "Secure coding, auth, segredos, upload hardening, OWASP e revisão defensiva.",
      keywords: ["jwt", "oauth", "owasp", "hardening", "secure coding", "auth", "secret", "csrf", "xss"],
      instructions: [
        "Atue como engenheiro de software com viés forte de segurança defensiva.",
        "Sempre explique ameaça, mitigação, verificação e impacto no fluxo de produto."
      ]
    },
    {
      id: "ai_ml_engineering",
      label: "AI & ML Engineering",
      summary: "Embeddings, RAG, avaliação, inferência, custo, alinhamento e pipelines de IA.",
      keywords: ["rag", "embedding", "llm", "inferencia", "inference", "vector", "prompt", "benchmark"],
      instructions: [
        "Diferencie qualidade de modelo, qualidade de pipeline, benchmark e percepção do usuário.",
        "Explique tradeoffs entre custo, latência, recall, precisão e governança."
      ]
    }
  ],
  history_archaeology: [
    {
      id: "historiography_method",
      label: "Historiografia & Metodo",
      summary: "Fonte primária, fonte secundária, crítica de fonte, cronologia e consenso.",
      keywords: ["historiografia", "fonte primaria", "fonte primária", "fonte secundaria", "consenso", "metodo historico"],
      instructions: [
        "Diferencie dado, leitura acadêmica, controvérsia e inferência popular.",
        "Seja explícito sobre força de evidência e limite do corpus."
      ]
    },
    {
      id: "ancient_near_east",
      label: "Antigo Oriente Proximo",
      summary: "Egito, Mesopotâmia, Levante, impérios e cronologias antigas.",
      keywords: ["levante", "assiria", "babilonia", "egito", "mesopotamia", "ugarit", "moabe", "israel antigo"],
      instructions: [
        "Situe povos e eventos em contexto regional e cronológico.",
        "Evite projeções modernas sobre política e religião antigas."
      ]
    },
    {
      id: "classical_world",
      label: "Mundo Classico",
      summary: "Grécia, Roma, helenismo, império e transmissão cultural.",
      keywords: ["roma", "romano", "grecia", "grécia", "helenismo", "bizancio", "classico", "clássico"],
      instructions: [
        "Relacione instituições, cultura material e contexto político sem simplificação excessiva.",
        "Diferencie o que é reconstrução de manual e o que é debate acadêmico vivo."
      ]
    },
    {
      id: "archaeology_field_methods",
      label: "Metodo Arqueologico",
      summary: "Escavação, estratigrafia, datação, contexto do achado e limites de interpretação.",
      keywords: ["escavacao", "escavação", "estratigrafia", "datação", "datacao", "contexto do achado", "ceramica"],
      instructions: [
        "Explique como contexto estratigráfico muda o peso de um achado.",
        "Não trate artefato isolado como prova total de narrativa ampla."
      ]
    },
    {
      id: "epigraphy_textual_witness",
      label: "Epigrafia & Testemunhos Textuais",
      summary: "Inscrições, manuscritos, paleografia e transmissão textual.",
      keywords: ["inscricao", "inscrição", "epigrafia", "manuscrito", "papiro", "paleografia", "estela"],
      instructions: [
        "Diferencie o texto material, a leitura proposta e a inferência histórica derivada.",
        "Se houver lacuna textual, diga claramente o que é restauração conjectural."
      ]
    }
  ],
  research: [
    {
      id: "research_design",
      label: "Pergunta & Desenho de Pesquisa",
      summary: "Formulação de pergunta, hipótese, recorte, método e critério de decisão.",
      keywords: ["metodo", "método", "hipotese", "hipótese", "pergunta de pesquisa", "desenho", "criterio"],
      instructions: [
        "Organize a investigação como pergunta, critério, evidência, risco e decisão provisória.",
        "Se a pergunta estiver ruim, melhore-a antes de responder o resto."
      ]
    },
    {
      id: "source_criticism",
      label: "Critica de Fontes",
      summary: "Autoridade, viés, conflito de interesse, atualidade e natureza da fonte.",
      keywords: ["fonte", "fontes", "paper", "artigo", "documento oficial", "source", "evidencia"],
      instructions: [
        "Classifique a fonte: oficial, acadêmica, jornalística, comercial ou opinativa.",
        "Explique qualidade da evidência e risco de overclaim."
      ]
    },
    {
      id: "literature_review",
      label: "Revisao de Literatura",
      summary: "Síntese de trabalhos, comparação de resultados, lacunas e linhas de consenso.",
      keywords: ["literatura", "review", "revisao", "state of the art", "consenso", "lacuna"],
      instructions: [
        "Compare abordagens, resultados, limitações e utilidade prática.",
        "Diferencie revisão descritiva de revisão analítica."
      ]
    },
    {
      id: "benchmark_evaluation",
      label: "Benchmark & Avaliacao",
      summary: "Métricas, experimentos, fairness, baseline, robustez e interpretação de resultado.",
      keywords: ["benchmark", "avaliacao", "evaluation", "metrica", "precision", "recall", "mrr", "score"],
      instructions: [
        "Explique o que a métrica mede, o que não mede e qual baseline faz sentido.",
        "Nunca trate score isolado como verdade total sem contexto experimental."
      ]
    },
    {
      id: "synthesis_reporting",
      label: "Sintese Executiva",
      summary: "Resumo para decisão, riscos, confiança, recomendação e próximos passos.",
      keywords: ["sintese", "síntese", "resumo executivo", "decisao", "decisão", "recomendacao", "recommendation"],
      instructions: [
        "Entregue fechamento claro: o que sabemos, o que não sabemos e o que fazer agora.",
        "Prefira decisão provisória bem justificada a falsa certeza."
      ]
    }
  ],
  cybersecurity: [
    {
      id: "appsec_secure_coding",
      label: "AppSec & Secure Coding",
      summary: "OWASP, validação de entrada, auth, sessão, upload, SSRF, XSS e injeções.",
      keywords: ["owasp", "xss", "csrf", "ssrf", "sql injection", "upload", "secure coding", "auth"],
      instructions: [
        "Responda como defensor de superfície de ataque, não como operador ofensivo.",
        "Una ameaça, mitigação, teste e critério de aceite."
      ]
    },
    {
      id: "cloud_identity",
      label: "Cloud, IAM & Segredos",
      summary: "IAM, segredos, chaves, least privilege, segmentação e postura em cloud.",
      keywords: ["iam", "secret", "segredo", "token", "cloud", "aws", "azure", "gcp", "least privilege"],
      instructions: [
        "Explique privilégio mínimo, rotação de credenciais, segmentação e blast radius.",
        "Se houver dado sensível, sempre fale de redacão, auditoria e retenção mínima."
      ]
    },
    {
      id: "incident_response",
      label: "Incident Response & Forense",
      summary: "Triagem, contenção, evidência, erradicação, recuperação e lições aprendidas.",
      keywords: ["incidente", "forense", "containment", "contenção", "triagem", "ioc", "recover", "postmortem"],
      instructions: [
        "Estruture em identificar, conter, preservar evidência, recuperar e revisar.",
        "Seja preciso sobre ordem operacional para não destruir trilha de auditoria."
      ]
    },
    {
      id: "threat_detection_monitoring",
      label: "Deteccao & Monitoramento",
      summary: "Logs, alertas, SIEM, sinais de abuso, correlação e resposta automatizada.",
      keywords: ["siem", "soc", "alerta", "deteccao", "detecção", "monitoramento", "telemetria", "ioc"],
      instructions: [
        "Diferencie sinal fraco, alerta acionável e falso positivo provável.",
        "Sempre conecte visibilidade com playbook de resposta."
      ]
    },
    {
      id: "privacy_data_protection",
      label: "Privacidade & Protecao de Dados",
      summary: "PII, retenção, minimização, LGPD, redacão e segurança de dados do usuário.",
      keywords: ["privacidade", "lgpd", "pii", "cpf", "dados sensiveis", "dados sensíveis", "retencao", "retenção"],
      instructions: [
        "Explique minimização, retenção, masking, consentimento e trilha de auditoria.",
        "Quando o dado for sensível, trate aprendizagem e analytics como risco de produto."
      ]
    }
  ],
  games_logic: [
    {
      id: "chess_training",
      label: "Xadrez & Treino",
      summary: "Aberturas, tática, finais, revisão de partidas e rotina de estudo.",
      keywords: ["xadrez", "mate", "abertura", "finais", "tatica", "tática", "blitz"],
      instructions: [
        "Ensine progressão, não só dica isolada.",
        "Explique princípio, erro comum e exercício prático."
      ]
    },
    {
      id: "logic_puzzles",
      label: "Logica & Quebra-cabecas",
      summary: "Campo minado, sudoku, dedução, probabilidade e raciocínio lógico.",
      keywords: ["logica", "lógica", "campo minado", "sudoku", "quebra cabeca", "deducao", "dedução"],
      instructions: [
        "Explicite o raciocínio por etapas curtas e verificáveis.",
        "Evite salto mental sem mostrar a regra usada."
      ]
    },
    {
      id: "rpg_systems",
      label: "RPG & Sistemas",
      summary: "Balanceamento, mecânicas, progressão, narrativa e construção de campanha.",
      keywords: ["rpg", "campanha", "mecanica", "mecânica", "narrativa", "balanceamento", "dnd"],
      instructions: [
        "Una regra, fantasia, equilíbrio e clareza para o jogador.",
        "Quando propor sistema, diga custo de complexidade e curva de entrada."
      ]
    },
    {
      id: "music_theory_practice",
      label: "Musica, Teoria & Treino",
      summary: "Teoria musical, ritmo, harmonia, estudo prático e música aplicada ao aprendizado.",
      keywords: ["musica", "música", "harmonia", "ritmo", "teoria musical", "treino musical", "cifra"],
      instructions: [
        "Ensine com progressão prática, escuta, teoria e exercício, não só com definição abstrata.",
        "Conecte conceito musical a treino diário e percepção auditiva."
      ]
    },
    {
      id: "game_design_balance",
      label: "Design & Balanceamento",
      summary: "Loops de jogo, risco/recompensa, progressão e clareza de decisão.",
      keywords: ["game design", "balance", "balanceamento", "loop", "meta", "progressao", "progressão"],
      instructions: [
        "Fale em sistema, feedback, dominância e experiência do jogador.",
        "Se houver solução ótima dominante, aponte o problema explicitamente."
      ]
    }
  ],
  math_science: [
    {
      id: "mathematics_foundations",
      label: "Matematica Pura & Aplicada",
      summary: "Álgebra, cálculo, geometria, lógica, prova, modelagem e intuição matemática.",
      keywords: ["algebra", "álgebra", "calculo", "cálculo", "teorema", "equacao", "equação", "geometria"],
      instructions: [
        "Explique definição, intuição, procedimento, verificação e erro comum.",
        "Se houver prova ou derivação, diga onde o argumento depende de hipótese."
      ]
    },
    {
      id: "statistics_data_analysis",
      label: "Estatistica & Dados",
      summary: "Probabilidade, inferência, teste, regressão, amostragem e leitura de métrica.",
      keywords: ["estatistica", "estatística", "probabilidade", "regressao", "regressão", "teste de hipotese", "amostra"],
      instructions: [
        "Diferencie correlação, causalidade, sinal, ruído e validade da amostra.",
        "Sempre relacione métrica à decisão prática."
      ]
    },
    {
      id: "physics_engineering",
      label: "Fisica & Engenharia",
      summary: "Mecânica, energia, ondas, eletricidade, sistemas físicos e ordem de grandeza.",
      keywords: ["fisica", "física", "mecanica", "mecânica", "energia", "eletricidade", "ondas", "termodinamica"],
      instructions: [
        "Use unidade, ordem de grandeza e checagem dimensional quando fizer sentido.",
        "Explique aproximação, limite do modelo e validade do resultado."
      ]
    },
    {
      id: "chemistry_materials",
      label: "Quimica & Materiais",
      summary: "Estrutura química, reações, materiais, processos e propriedades.",
      keywords: ["quimica", "química", "reacao", "reação", "molecula", "molécula", "material", "composto"],
      instructions: [
        "Explique mecanismo, propriedade, contexto experimental e risco de simplificação.",
        "Quando houver perigo químico, trate segurança como parte da resposta."
      ]
    },
    {
      id: "biology_life_science",
      label: "Biologia & Vida",
      summary: "Genética, fisiologia, ecologia, microbiologia e sistemas vivos.",
      keywords: ["biologia", "genetica", "genética", "fisiologia", "ecologia", "microbiologia", "celula", "célula"],
      instructions: [
        "Una escala biológica, mecanismo e contexto experimental.",
        "Diga claramente quando uma explicação é introdutória e quando entra em detalhe molecular."
      ]
    },
    {
      id: "ai_ml_math",
      label: "ML, Otimizacao & Rigor",
      summary: "Função de perda, generalização, validação, gradiente e interpretação de modelo.",
      keywords: ["machine learning", "ml", "loss", "otimizacao", "otimização", "gradiente", "overfitting", "modelo"],
      instructions: [
        "Diferencie intuição, formulação matemática e validação empírica.",
        "Explique o que é hipótese de modelo e o que é fato observado."
      ]
    },
    {
      id: "computational_science",
      label: "Modelagem Computacional",
      summary: "Simulação, experimentos computacionais, análise numérica e validação de modelos.",
      keywords: ["simulacao", "simulação", "modelo computacional", "analise numerica", "análise numérica", "metodo numerico", "método numérico"],
      instructions: [
        "Explique hipótese do modelo, discretização, estabilidade e validação contra dados ou casos-limite.",
        "Diferencie aproximação computacional de comportamento físico real."
      ]
    }
  ],
  agribusiness: [
    {
      id: "soil_fertility",
      label: "Solo & Fertilidade",
      summary: "Análise de solo, correção, fertilidade, textura, matéria orgânica e manejo.",
      keywords: ["solo", "fertilidade", "ph", "fósforo", "potassio", "potássio", "calagem", "gessagem"],
      instructions: [
        "Fale em diagnóstico, variabilidade espacial, risco agronômico e validação local.",
        "Não transforme recomendação geral em prescrição final de campo."
      ]
    },
    {
      id: "crop_health_protection",
      label: "Sanidade & Protecao de Culturas",
      summary: "Pragas, doenças, sintomas, monitoramento e tomada de decisão no campo.",
      keywords: ["praga", "doenca", "doença", "fungo", "inseto", "sanidade", "sintoma", "fitossanidade"],
      instructions: [
        "Explique observação, hipótese de causa, risco e validação agronômica.",
        "Se houver manejo sensível, recomende validação com profissional local."
      ]
    },
    {
      id: "precision_agriculture",
      label: "Agricultura de Precisao",
      summary: "Satélite, sensores, GPS, taxa variável, telemetria e zoneamento.",
      keywords: ["satelite", "satélite", "gps", "taxa variavel", "taxa variável", "telemetria", "mapa de produtividade"],
      instructions: [
        "Una dado, operação de máquina, risco de calibração e validação em talhão.",
        "Prefira plano gradual em vez de automação cega."
      ]
    },
    {
      id: "gps_guidance_telematics",
      label: "GPS, RTK & Telemetria",
      summary: "Piloto automatico, barra de luz, RTK, rastreio, rotas de maquina e leitura de telemetria.",
      keywords: ["gps agricola", "gps agricola", "rtk", "piloto automatico", "autosteer", "barra de luz", "telematica", "telemetria"],
      instructions: [
        "Explique precisao de sinal, calibracao, cobertura, falha operacional e valor real para a operacao.",
        "Diferencie mapa bonito de telemetria confiavel para decisao agronomica e logistica."
      ]
    },
    {
      id: "irrigation_water",
      label: "Irrigacao & Agua",
      summary: "Lâmina, déficit, manejo de água, clima e risco operacional.",
      keywords: ["irrigacao", "irrigação", "agua", "água", "lamina", "lâmina", "umidade", "evapotranspiracao"],
      instructions: [
        "Explique relação entre clima, solo, cultura e operação.",
        "Quando houver risco hídrico, destaque monitoramento e contingência."
      ]
    },
    {
      id: "weather_forecasting",
      label: "Previsao de Tempo & Clima",
      summary: "Chuva, janela operacional, risco climático, microclima e decisão agrícola baseada em tempo.",
      keywords: ["previsao do tempo", "previsão do tempo", "chuva", "clima", "janela operacional", "geada", "tempo agricola"],
      instructions: [
        "Conecte previsão, operação de campo, risco de perda e plano de contingência.",
        "Diferencie dado meteorológico, interpretação agronômica e decisão operacional."
      ]
    },
    {
      id: "harvest_operations",
      label: "Colheita Organizada",
      summary: "Planejamento de colheita, logística, capacidade de máquina, perdas e janelas operacionais.",
      keywords: ["colheita", "colheitadeira", "janela de colheita", "perda na colheita", "armazenagem", "escoamento"],
      instructions: [
        "Estruture em maturação, ordem de talhões, capacidade operacional, logística e risco de perda.",
        "Ao recomendar colheita, pense em máquina, clima, armazenagem e destino do produto."
      ]
    },
    {
      id: "smart_harvest_systems",
      label: "Colheita Inteligente",
      summary: "Telemetria, sensores, mapas de produtividade, automação e otimização da colheita.",
      keywords: ["colheita inteligente", "mapa de produtividade", "telemetria da colheita", "sensores na colheita", "piloto automatico"],
      instructions: [
        "Una sensores, dados de máquina, telemetria e decisão de rota ou velocidade.",
        "Explique ganho operacional, qualidade do dado e necessidade de calibração."
      ]
    },
    {
      id: "precision_harvest_logistics",
      label: "Colheita de Precisao & Logistica",
      summary: "Ordem de talhoes, perdas, armazenagem, transporte, fila de descarga e governanca operacional.",
      keywords: ["colheita de precisao", "colheita de precisão", "ordem de talhoes", "fila de descarga", "armazenagem", "transporte de graos", "perdas na colheita"],
      instructions: [
        "Integre clima, capacidade de maquina, qualidade do grao, armazenagem e transporte no mesmo plano.",
        "Ao falar de colheita de precisao, una monitor, perda, umidade, fila logistica e decisao por talhao."
      ]
    },
    {
      id: "agro_gpts_automation",
      label: "Agro GPTs & Automacao",
      summary: "Copilotos agro, dashboards, apps rurais, automação de relatórios e apoio inteligente ao campo.",
      keywords: ["gpt agro", "gpts agro", "app rural", "dashboard agro", "automacao agro", "relatorio de fazenda"],
      instructions: [
        "Pense em copilotos operacionais que integrem dados, rotina de campo e decisão do gestor.",
        "Diferencie automação útil, automação arriscada e validação humana necessária."
      ]
    },
    {
      id: "agro_business_management",
      label: "Gestao Agro",
      summary: "Custo, produtividade, logística, risco operacional e governança rural.",
      keywords: ["custo", "fazenda", "safra", "produtividade", "logistica", "logística", "gestao agro"],
      instructions: [
        "Integre dado técnico, caixa, risco e decisão operacional.",
        "Pense como gestor de operação, não só como explicador técnico."
      ]
    }
  ],
  finance: [
    {
      id: "personal_finance",
      label: "Financas Pessoais",
      summary: "Orçamento, dívida, reserva, risco, consumo e planejamento.",
      keywords: ["orcamento", "orçamento", "divida", "dívida", "reserva", "gasto", "renda", "cartao"],
      instructions: [
        "Explique decisão financeira com risco, prazo, liquidez e disciplina.",
        "Evite tom de recomendação individual absoluta."
      ]
    },
    {
      id: "corporate_finance",
      label: "Financas Corporativas",
      summary: "Caixa, CAPEX/OPEX, retorno, risco, resiliência e governança.",
      keywords: ["caixa", "capex", "opex", "empresa", "startup", "retorno", "governanca", "governança"],
      instructions: [
        "Diferencie custo contábil, custo econômico e risco estratégico.",
        "Responda como quem ajuda a decidir, não só a conceituar."
      ]
    },
    {
      id: "accounting_controls",
      label: "Contabilidade & Controles",
      summary: "DRE, balanço, fluxo de caixa, controles internos e consistência financeira.",
      keywords: ["dre", "balanco", "balanço", "fluxo de caixa", "contabilidade", "controle interno", "auditoria"],
      instructions: [
        "Explique a conexão entre indicador, risco e decisão.",
        "Se houver incerteza de classificação contábil, diga isso claramente."
      ]
    },
    {
      id: "valuation_investment",
      label: "Valuation & Investimento",
      summary: "Valuation, cenário, taxa, retorno, sensibilidade e carteira.",
      keywords: ["valuation", "wacc", "desconto", "investimento", "retorno", "portfolio", "portfólio", "acoes"],
      instructions: [
        "Mostre cenário, sensibilidade e limite de suposição.",
        "Não trate tese de investimento como certeza."
      ]
    },
    {
      id: "payments_fintech_apps",
      label: "Pagamentos, Sites & Apps Financeiros",
      summary: "PIX, cartão, boleto, checkout, conciliação, antifraude e fluxos financeiros em produtos digitais.",
      keywords: ["pix", "boleto", "cartao", "cartão", "checkout", "gateway", "fintech", "app financeiro", "site financeiro"],
      instructions: [
        "Una fluxo do usuário, conciliação, risco, antifraude e compliance operacional.",
        "Ao falar de produto financeiro digital, pense em jornada, taxa, liquidação e suporte."
      ]
    },
    {
      id: "billing_revenue_ops",
      label: "Billing, Receita & Assinaturas",
      summary: "Cobrança recorrente, faturas, MRR, inadimplência, pricing e operações de receita.",
      keywords: ["billing", "assinatura", "mrr", "receita recorrente", "fatura", "inadimplencia", "inadimplência", "pricing"],
      instructions: [
        "Explique como cobrança, preço, retenção e caixa se conectam.",
        "Diferencie regra de negócio, operação de receita e impacto financeiro."
      ]
    },
    {
      id: "banking_controls_compliance",
      label: "Controles Bancarios & Compliance",
      summary: "KYC, trilha de auditoria, reconciliação, risco operacional e controles de produto financeiro.",
      keywords: ["kyc", "compliance financeiro", "controle bancario", "controle bancário", "auditoria financeira", "reconciliacao", "reconciliação"],
      instructions: [
        "Pense em governança, trilha de auditoria, segregação de função e risco regulatório.",
        "Não trate operação financeira digital como mera interface; cubra controle e evidência."
      ]
    },
    {
      id: "macro_risk",
      label: "Macro, Mercado & Risco",
      summary: "Inflação, juros, câmbio, risco sistêmico e exposição operacional.",
      keywords: ["inflacao", "inflação", "juros", "cambio", "câmbio", "macro", "mercado", "exposicao"],
      instructions: [
        "Explique relação entre variável macro e impacto prático.",
        "Diga quando a leitura depende de dado atual e não de conhecimento estático."
      ]
    }
  ],
  product_design_ux: [
    {
      id: "ux_research",
      label: "UX Research",
      summary: "Entrevistas, jobs to be done, mapa de dor, fluxo do usuário e síntese de insight.",
      keywords: ["ux research", "pesquisa com usuario", "jobs to be done", "entrevista com usuario", "dor do usuario", "fluxo do usuario"],
      instructions: [
        "Trate insight de produto como evidência observada, hipótese e impacto na jornada.",
        "Diferencie opinião do time, dado de uso e achado de pesquisa."
      ]
    },
    {
      id: "ui_design_systems",
      label: "UI & Design Systems",
      summary: "Hierarquia visual, componentes, estados, responsividade, acessibilidade e consistência.",
      keywords: ["design system", "componente", "ui", "layout", "responsivo", "acessibilidade", "interface"],
      instructions: [
        "Pense em clareza visual, reuso, tokens, estados vazios e manutenção em escala.",
        "Conecte estética, performance, semântica e implementação."
      ]
    },
    {
      id: "ux_writing_content",
      label: "UX Writing & Conteudo",
      summary: "Microcopy, onboarding, mensagens de erro, instruções e clareza de interface.",
      keywords: ["ux writing", "microcopy", "mensagem de erro", "onboarding", "copy de produto", "texto de interface"],
      instructions: [
        "Escreva para reduzir fricção, ambiguidade e ansiedade do usuário.",
        "Ao revisar texto, una clareza, tom, confiança e contexto da ação."
      ]
    },
    {
      id: "product_strategy",
      label: "Produto & Estrategia",
      summary: "Priorização, hipóteses, roadmap, métricas, retenção e decisão de produto.",
      keywords: ["roadmap", "priorizacao", "priorização", "retencao", "retenção", "metrica de produto", "estrategia de produto"],
      instructions: [
        "Responda como PM com rigor de pesquisa, entrega e impacto.",
        "Diferencie hipótese de produto, experimento, métrica e decisão executiva."
      ]
    }
  ],
  data_ai_ml: [
    {
      id: "data_engineering",
      label: "Data Engineering",
      summary: "Pipelines, modelagem, ETL/ELT, qualidade, orquestração e consumo analítico.",
      keywords: ["etl", "elt", "pipeline de dados", "warehouse", "lake", "dbt", "airflow", "qualidade de dados"],
      instructions: [
        "Explique origem, transformação, contrato de dado, monitoramento e custo operacional.",
        "Diferencie conveniência de curto prazo e dívida estrutural de dado."
      ]
    },
    {
      id: "analytics_bi",
      label: "Analytics & BI",
      summary: "Métricas, dashboards, segmentação, experimentos e decisão orientada por dados.",
      keywords: ["bi", "dashboard", "metrica", "métrica", "segmentacao", "segmentação", "analytics"],
      instructions: [
        "Pergunte o que a métrica realmente apoia como decisão.",
        "Diferencie visibilidade, diagnóstico e inferência causal."
      ]
    },
    {
      id: "mlops_evaluation",
      label: "MLOps & Avaliacao",
      summary: "Treino, deploy, drift, monitoramento, benchmark, custo e confiabilidade.",
      keywords: ["mlops", "drift", "treino", "deploy de modelo", "benchmark de modelo", "monitoramento de modelo"],
      instructions: [
        "Una pipeline, benchmark, custo, latência, rollback e operação contínua.",
        "Não trate notebook validado como sistema pronto de produção."
      ]
    },
    {
      id: "llm_prompt_systems",
      label: "LLMs, Prompts & Agentes",
      summary: "RAG, prompts, memória, ferramentas, avaliação e comportamento de agentes.",
      keywords: ["llm", "prompt", "agente", "rag", "memoria de ia", "memória de ia", "ferramenta de ia"],
      instructions: [
        "Diferencie qualidade do modelo, qualidade do prompt e qualidade da orquestração.",
        "Sempre conecte comportamento do agente a avaliação e risco operacional."
      ]
    }
  ],
  education_pedagogy: [
    {
      id: "lesson_planning",
      label: "Planejamento de Aula",
      summary: "Objetivos, sequência didática, tempo, material, prática e fechamento.",
      keywords: ["planejamento de aula", "sequencia didatica", "sequência didática", "objetivo de aula", "plano de aula"],
      instructions: [
        "Estruture por objetivo, pré-requisito, atividade, evidência de aprendizagem e revisão.",
        "Adapte profundidade ao perfil do aluno."
      ]
    },
    {
      id: "assessment_feedback",
      label: "Avaliacao & Feedback",
      summary: "Critérios, rubrica, diagnóstico, feedback formativo e recuperação de aprendizagem.",
      keywords: ["avaliacao", "avaliação", "rubrica", "feedback formativo", "diagnostico pedagogico", "recuperacao de aprendizagem"],
      instructions: [
        "Diferencie medir conteúdo, medir processo e medir aplicação.",
        "Feedback deve orientar o próximo passo, não só julgar."
      ]
    },
    {
      id: "adaptive_teaching",
      label: "Ensino Adaptativo",
      summary: "Diferenciação por nível, ritmo, idade, base prévia e suporte individual.",
      keywords: ["ensino adaptativo", "diferenciacao", "diferenciação", "faixa etaria", "ritmo de aprendizagem", "nivel do aluno"],
      instructions: [
        "Explique como adaptar linguagem, exercício e profundidade sem perder o objetivo central.",
        "Pense em progressão pedagógica e segurança emocional do aluno."
      ]
    },
    {
      id: "curriculum_learning_path",
      label: "Curriculo & Trilha",
      summary: "Sequência de conteúdos, progressão, competências e formação de longo prazo.",
      keywords: ["curriculo", "currículo", "trilha de aprendizagem", "competencia", "competência", "progressao curricular"],
      instructions: [
        "Trate currículo como arquitetura de aprendizagem, não só lista de tópicos.",
        "Conecte conteúdo, sequência, avaliação e retenção."
      ]
    }
  ],
  operations_logistics: [
    {
      id: "process_mapping",
      label: "Processos & Mapeamento",
      summary: "Fluxos, gargalos, SLA, handoffs, padrão operacional e melhoria contínua.",
      keywords: ["processo", "fluxo operacional", "gargalo", "sla", "handoff", "padrao operacional", "padrão operacional"],
      instructions: [
        "Mapeie entrada, transformação, espera, risco e critério de saída.",
        "Diferencie problema de processo, capacidade e governança."
      ]
    },
    {
      id: "warehouse_distribution",
      label: "Armazem & Distribuicao",
      summary: "Estoque, armazenagem, picking, transporte, distribuição e custo logístico.",
      keywords: ["estoque", "armazem", "armazém", "picking", "distribuicao", "distribuição", "transporte", "frete"],
      instructions: [
        "Conecte lead time, custo, nível de serviço e risco operacional.",
        "Ao propor melhoria, explique impacto na operação real."
      ]
    },
    {
      id: "planning_procurement",
      label: "Planejamento & Suprimentos",
      summary: "Demanda, reposição, compras, capacidade, previsibilidade e resiliência operacional.",
      keywords: ["suprimentos", "compras", "reposicao", "reposição", "planejamento de demanda", "capacidade operacional"],
      instructions: [
        "Diferencie demanda prevista, demanda real, estoque de segurança e risco de ruptura.",
        "Explique tradeoff entre custo, disponibilidade e confiabilidade."
      ]
    },
    {
      id: "service_reliability_ops",
      label: "Confiabilidade Operacional",
      summary: "SLA, incidentes, continuidade, contingência e recuperação de operação.",
      keywords: ["confiabilidade operacional", "continuidade", "contingencia", "contingência", "incidente operacional", "recuperacao operacional"],
      instructions: [
        "Organize em prevenção, detecção, resposta, contingência e retomada.",
        "Pense em operação viva, não só processo ideal no papel."
      ]
    }
  ],
  medicine_health: [
    {
      id: "health_education",
      label: "Educacao em Saude",
      summary: "Explicação de conceitos de saúde, prevenção, hábitos e entendimento básico seguro.",
      keywords: ["saude", "saúde", "sintoma", "prevencao", "prevenção", "habito saudavel", "hábitos saudáveis"],
      instructions: [
        "Explique com clareza, cautela e sem transformar informação em diagnóstico.",
        "Sempre diga quando é necessário procurar atendimento profissional."
      ]
    },
    {
      id: "exam_literacy",
      label: "Leitura de Exames",
      summary: "Entendimento educacional de exames laboratoriais e de imagem sem diagnóstico definitivo.",
      keywords: ["exame", "hemograma", "laudo", "ressonancia", "ressonância", "ultrassom", "resultado de exame"],
      instructions: [
        "Trate leitura de exame como orientação educacional, não como parecer clínico final.",
        "Destaque limite, contexto clínico e necessidade de validação médica."
      ]
    },
    {
      id: "clinical_safety_triage",
      label: "Sinais de Alerta & Triagem",
      summary: "Reconhecimento de urgência, sinais de risco e encaminhamento seguro.",
      keywords: ["urgencia", "urgência", "emergencia", "emergência", "sinal de alerta", "triagem", "dor forte"],
      instructions: [
        "Se houver risco grave, priorize orientação de procura imediata de serviço de saúde.",
        "Não ofereça plano caseiro onde houver possibilidade de emergência."
      ]
    },
    {
      id: "public_health_prevention",
      label: "Saude Publica & Prevencao",
      summary: "Vacinação, prevenção, educação populacional e saúde coletiva.",
      keywords: ["vacinacao", "vacinação", "saude publica", "saúde pública", "prevencao", "prevenção", "epidemiologia"],
      instructions: [
        "Explique prevenção e comunicação de risco com responsabilidade.",
        "Diferencie medida individual, comunitária e institucional."
      ]
    }
  ],
  law_policy: [
    {
      id: "legal_reading_structure",
      label: "Leitura Juridica",
      summary: "Leitura de leis, contratos, cláusulas, estrutura normativa e interpretação básica.",
      keywords: ["lei", "contrato", "clausula", "cláusula", "norma", "regulacao", "regulação", "juridico"],
      instructions: [
        "Explique texto legal, efeito prático, ambiguidade e limite de interpretação.",
        "Não substitua advogado; apresente leitura educacional e pontos para validação profissional."
      ]
    },
    {
      id: "compliance_governance",
      label: "Compliance & Governanca",
      summary: "Políticas internas, controles, auditoria, risco regulatório e governança.",
      keywords: ["compliance", "governanca", "governança", "politica interna", "auditoria", "risco regulatorio", "risco regulatório"],
      instructions: [
        "Pense em trilha de decisão, documentação, controle e evidência.",
        "Diferencie regra jurídica, política interna e prática operacional."
      ]
    },
    {
      id: "privacy_regulation",
      label: "Privacidade & Regulacao",
      summary: "LGPD, bases legais, consentimento, retenção, dados sensíveis e obrigação organizacional.",
      keywords: ["lgpd", "dados sensiveis", "dados sensíveis", "base legal", "consentimento", "privacidade", "regulacao de dados"],
      instructions: [
        "Explique obrigação, risco, retenção, minimização e governança de dados.",
        "Diferencie obrigação legal, recomendação técnica e política de produto."
      ]
    },
    {
      id: "public_policy_analysis",
      label: "Politicas Publicas",
      summary: "Análise de políticas, desenho regulatório, impacto social e implementação institucional.",
      keywords: ["politica publica", "política pública", "regulacao", "regulação", "implementacao", "implementação institucional"],
      instructions: [
        "Estruture em objetivo, mecanismo, incentivos, impacto e risco de implementação.",
        "Diferencie texto formal de política, execução real e avaliação de resultado."
      ]
    }
  ]
}

export const DOMAIN_MODULES = {
  developer: {
    id: "developer",
    label: "Dev & Bugs",
    summary: "Codigo, arquitetura, bugs, linguagens, cloud, testes, GitHub e stack moderna.",
    keywords: [
      "codigo", "code", "bug", "erro", "github", "api", "react", "node", "sql", "deploy",
      "python", "java", "c#", "typescript", "javascript", "rust", "go", "php", "kotlin",
      "docker", "kubernetes", "aws", "azure", "gcp", "teste", "ci", "cd", "microservico"
    ],
    submodules: MODULE_SUBMODULES.developer,
    instructions: [
      "Pense como engenheiro de software senior e code reviewer exigente.",
      "Cubra causa, diagnostico, correcao, validacao, teste, observabilidade e prevencao.",
      "Se fizer sentido, forneca codigo, diff conceitual, plano de rollout e estrategia de rollback.",
      "Considere seguranca, desempenho, manutenibilidade, custo operacional e experiencia do usuario."
    ]
  },
  bible: {
    id: "bible",
    label: "Biblia & Teologia",
    summary: "Estudo biblico, idiomas originais, historia, igreja primitiva e teologia.",
    keywords: [
      "biblia", "bíblia", "teologia", "hebraico", "aramaico", "grego", "igreja", "pastor", "evangelho",
      "escatologia", "apocalipse", "milenio", "milênio", "arrebatamento", "angelologia", "angeologia",
      "anjos", "cristo", "jesus", "soteriologia", "cristologia", "eclesiologia", "pneumatologia",
      "pais da igreja", "patristica", "patrística", "historia da igreja", "história da igreja",
      "arqueologia biblica", "arqueologia bíblica", "moises", "moisés", "exodo", "êxodo"
    ],
    submodules: toLiteSubmodules(BIBLE_STUDY_MODULES),
    instructions: [
      "Atue como pesquisador biblico reverente, claro e criterioso.",
      "Diferencie texto biblico, contexto historico, tradicao protestante, tradicao catolica e discussoes academicas.",
      "Quando houver divergencia doutrinaria, diga claramente onde ha consenso e onde ha interpretacao.",
      "Se o usuario pedir uma linha pastoral especifica, explique a perspectiva sem fingir citacao literal ou fonte inexistente.",
      "Aja com profundidade em exegese, historia da igreja, teologia sistematica e arqueologia biblica."
    ]
  },
  history_archaeology: {
    id: "history_archaeology",
    label: "Historia & Arqueologia",
    summary: "Historiografia, arqueologia, cronologia, civilizacoes antigas e leitura critica de fontes.",
    keywords: [
      "historia", "história", "arqueologia", "arquiologia", "arqueologia biblica", "arqueologia bíblica",
      "historiador", "civilizacao", "civilização", "imperio", "império", "cronologia", "inscricao",
      "inscrição", "manuscrito", "escavacao", "escavação", "antiguidade", "roma", "egito", "mesopotamia",
      "levant", "historia da igreja", "história da igreja", "patristica", "patrística", "pais da igreja",
      "segundo templo", "moises", "moisés", "exodo", "êxodo"
    ],
    submodules: MODULE_SUBMODULES.history_archaeology,
    instructions: [
      "Use metodo historico: fonte primaria, fonte secundaria, contexto, cronologia, consenso e controversia.",
      "Diga o que a evidencia sustenta, ilustra, sugere ou nao permite concluir.",
      "Ao tratar arqueologia, diferencie achado material, interpretacao academica e uso apologetico.",
      "Nao apresente lenda, tradicao ou reconstrucoes populares como fato estabelecido."
    ]
  },
  research: {
    id: "research",
    label: "Pesquisa & Fontes",
    summary: "Metodo de pesquisa profissional, avaliacao de fontes, comparacao, sintese e verificacao.",
    keywords: [
      "pesquisa", "fonte", "fontes", "artigo", "paper", "estudo", "comparar fontes", "verifique",
      "navegador", "browser", "google", "bing", "yahoo", "web", "internet", "atualizado"
    ],
    submodules: MODULE_SUBMODULES.research,
    instructions: [
      "Adote disciplina de pesquisa profissional: defina pergunta, criterio, evidencias, limites e sintese.",
      "Explique quando um tema depende de dado atual, fonte primaria ou verificacao externa.",
      "Se houver acesso a busca externa, compare resultados; se nao houver, admita a limitacao com clareza.",
      "Diferencie documento oficial, literatura academica, noticia, opiniao e marketing."
    ]
  },
  cybersecurity: {
    id: "cybersecurity",
    label: "Ciberseguranca",
    summary: "Seguranca defensiva, hardening, incident response, secure coding, cloud e risco.",
    keywords: [
      "seguranca", "ciberseguranca", "cybersecurity", "phishing", "ransomware", "malware",
      "vulnerabilidade", "owasp", "criptografia", "iam", "soc", "siem", "forense", "pentest"
    ],
    submodules: MODULE_SUBMODULES.cybersecurity,
    instructions: [
      "Atue em modo defensivo, legal e etico por padrao.",
      "Foque em hardening, deteccao, triagem, resposta a incidentes, secure coding e reducao de risco.",
      "Explique ameaca, superficie de ataque, impacto, mitigacao, monitoramento e recuperacao.",
      "Recuse instrucoes ofensivas, fraude, malware, phishing, roubo de credenciais e invasao."
    ]
  },
  games_logic: {
    id: "games_logic",
    label: "Jogos & Logica",
    summary: "Xadrez, dama, campo minado, RPG, cubo magico e musica aplicada a estudo e treino.",
    keywords: ["xadrez", "dama", "campo minado", "rpg", "cubo", "musica", "tabuleiro", "abertura"],
    submodules: MODULE_SUBMODULES.games_logic,
    instructions: [
      "Explique regras, estrategia, erros comuns, treino e tomada de decisao.",
      "Use passos curtos, exemplos e exercicios quando o usuario estiver aprendendo."
    ]
  },
  math_science: {
    id: "math_science",
    label: "Matematica & Ciencias",
    summary: "Matematica, logica, fisica, quimica, biologia, ciencia e modelagem em varios niveis.",
    keywords: [
      "matematica", "logica", "fisica", "quimica", "biologia", "algoritmo", "programacao",
      "calculo", "algebra", "estatistica", "probabilidade", "ciencia", "cientifico", "equacao",
      "mecanica", "termodinamica", "genetica", "quimica organica"
    ],
    submodules: MODULE_SUBMODULES.math_science,
    instructions: [
      "Explique fundamento, intuicao, metodo, formula, exemplo, verificacao e erro comum.",
      "Escalone do basico ao avancado conforme o usuario pedir.",
      "Use metodo cientifico, unidades, ordem de grandeza e checagem dimensional quando relevante."
    ]
  },
  agribusiness: {
    id: "agribusiness",
    label: "Agronegocio",
    summary: "Solo, satelite, GPS, RTK, plantio, clima, colheita organizada, colheita de precisao, automacao agro e diagnostico operacional.",
    keywords: ["agro", "agronegocio", "solo", "plantio", "colheita", "gps", "rtk", "satelite", "fazenda", "clima", "previsao do tempo", "telemetria"],
    submodules: MODULE_SUBMODULES.agribusiness,
    instructions: [
      "Foque em diagnostico pratico, observacao de campo, monitoramento, produtividade e risco operacional.",
      "Quando houver recomendacao sensivel de manejo, diga que validacao local com agronomo e essencial.",
      "Una clima, operacao, tecnologia, logistica de colheita e decisao economica sempre que fizer sentido.",
      "Quando o tema for agricultura digital, conecte GPS, RTK, piloto automatico, telemetria, mapa de produtividade e validacao em campo."
    ]
  },
  finance: {
    id: "finance",
    label: "Financeiro",
    summary: "Financas pessoais, corporativas, operacoes de apps e sites, pagamentos, receita e risco.",
    keywords: ["financeiro", "financas", "investimento", "caixa", "orcamento", "contabilidade", "mercado", "pix", "boleto", "checkout"],
    submodules: MODULE_SUBMODULES.finance,
    instructions: [
      "Explique conceitos, risco, cenarios e impacto pratico.",
      "Nao trate como recomendacao regulatoria individual; destaque incerteza e necessidade de validacao profissional quando aplicavel.",
      "Seja forte em estrutura de decisao, caixa, risco, governanca, cenarios e leitura de indicadores.",
      "Quando o contexto for produto digital, una jornada, pagamentos, billing, antifraude e controle."
    ]
  },
  product_design_ux: {
    id: "product_design_ux",
    label: "Produto, UX & Design",
    summary: "Pesquisa de produto, UX, UI, design systems, copy, estrategia e acessibilidade.",
    keywords: ["produto", "ux", "ui", "design system", "onboarding", "pesquisa com usuario", "microcopy", "funnel"],
    submodules: MODULE_SUBMODULES.product_design_ux,
    instructions: [
      "Pense como combinacao de product manager, product designer e pesquisador de UX.",
      "Una pesquisa, fluxo, copy, acessibilidade, implementacao e impacto de negocio.",
      "Ao criticar uma tela ou fluxo, separe problema de entendimento, problema de decisao e problema de execucao."
    ]
  },
  data_ai_ml: {
    id: "data_ai_ml",
    label: "Dados, IA & MLOps",
    summary: "Dados, analytics, pipelines, LLMs, avaliacao, MLOps e governanca de IA.",
    keywords: ["dados", "data", "bi", "analytics", "machine learning", "mlops", "llm", "prompt", "rag", "modelo"],
    submodules: MODULE_SUBMODULES.data_ai_ml,
    instructions: [
      "Pense em qualidade de dado, qualidade de pipeline, qualidade de modelo e operacao em producao como camadas distintas.",
      "Sempre conecte experimento, benchmark, deploy, monitoramento e risco de negocio.",
      "Diferencie insight analitico, inferencia estatistica e decisao automatizada."
    ]
  },
  education_pedagogy: {
    id: "education_pedagogy",
    label: "Educacao & Pedagogia",
    summary: "Plano de aula, didatica, curriculo, avaliacao, ensino adaptativo e progressao de aprendizagem.",
    keywords: ["educacao", "pedagogia", "aula", "curriculo", "currículo", "aluno", "ensino", "aprendizagem"],
    submodules: MODULE_SUBMODULES.education_pedagogy,
    instructions: [
      "Ensine com progressao, clareza, adaptacao por nivel e evidencia de aprendizagem.",
      "Ao montar plano educacional, una objetivo, atividade, avaliacao, revisao e acompanhamento.",
      "Pense em seguranca emocional, ritmo do aluno e transferencia do conhecimento."
    ]
  },
  operations_logistics: {
    id: "operations_logistics",
    label: "Operacoes & Logistica",
    summary: "Processos, SLAs, cadeia logistica, estoque, confiabilidade e melhoria operacional.",
    keywords: ["operacoes", "operações", "logistica", "logística", "estoque", "sla", "processo", "suprimentos"],
    submodules: MODULE_SUBMODULES.operations_logistics,
    instructions: [
      "Responda como operador estrategico com foco em fluxo, gargalo, SLA, contingencia e confiabilidade.",
      "Ao propor mudanca, explique impacto em custo, lead time, qualidade e risco.",
      "Diferencie plano ideal, capacidade real e restricao da operacao."
    ]
  },
  medicine_health: {
    id: "medicine_health",
    label: "Saude & Medicina",
    summary: "Educacao em saude, leitura orientativa de exames, prevencao e triagem segura.",
    keywords: ["saude", "saúde", "medicina", "exame", "sintoma", "prevencao", "prevenção", "laudo"],
    submodules: MODULE_SUBMODULES.medicine_health,
    instructions: [
      "Atue com cautela alta, linguagem clara e limite profissional explicito.",
      "Nao forneca diagnostico definitivo nem substitua atendimento medico.",
      "Quando houver sinal de urgencia, priorize orientacao segura de procura imediata de ajuda profissional."
    ]
  },
  law_policy: {
    id: "law_policy",
    label: "Direito & Politicas Publicas",
    summary: "Leitura normativa, compliance, privacidade, estrutura regulatoria e analise de politicas publicas.",
    keywords: ["direito", "lei", "contrato", "compliance", "lgpd", "politica publica", "regulacao", "regulação"],
    submodules: MODULE_SUBMODULES.law_policy,
    instructions: [
      "Explique textos normativos com rigor, mas sem se apresentar como substituto de advogado.",
      "Diferencie leitura educacional, risco regulatorio, ponto de ambiguidade e necessidade de validacao profissional.",
      "Quando o tema tocar dados sensiveis, compliance ou politica publica, una regra, impacto e implementacao."
    ]
  }
}

export const DEFAULT_ACTIVE_MODULES = ["developer"]

function sanitizeSubmoduleSelection(moduleId, submoduleIds = []) {
  const module = DOMAIN_MODULES[moduleId]
  if (!module?.submodules?.length) return []

  const allowed = new Set(module.submodules.map(submodule => submodule.id))
  return Array.from(new Set(
    (Array.isArray(submoduleIds) ? submoduleIds : []).filter(submoduleId => allowed.has(submoduleId))
  ))
}

export function listDomainModules() {
  return Object.values(DOMAIN_MODULES).map(module => ({
    id: module.id,
    label: module.label,
    summary: module.summary,
    submodules: toLiteSubmodules(module.submodules || [])
  }))
}

export function getDomainModule(moduleId) {
  return DOMAIN_MODULES[moduleId] || null
}

export function getDomainModules(moduleIds = []) {
  return moduleIds
    .map(moduleId => getDomainModule(moduleId))
    .filter(Boolean)
}

export function getDomainSubmodule(moduleId, submoduleId) {
  const module = getDomainModule(moduleId)
  if (!module?.submodules?.length) return null
  return module.submodules.find(submodule => submodule.id === submoduleId) || null
}

export function getDomainSubmodules(moduleId, submoduleIds = []) {
  return sanitizeSubmoduleSelection(moduleId, submoduleIds)
    .map(submoduleId => getDomainSubmodule(moduleId, submoduleId))
    .filter(Boolean)
}

export function inferDomainModules(task = "", explicitModules = []) {
  const normalized = normalizeModuleKeywordText(task)
  const explicit = new Set(Array.isArray(explicitModules) ? explicitModules : [])

  Object.values(DOMAIN_MODULES).forEach(module => {
    if (hasNormalizedKeywordMatch(normalized, module.keywords)) {
      explicit.add(module.id)
    }
  })

  const hasBibleTopicCue = /\b(biblia|bible|teologia|evangelho|jesus|cristo|escatologia|apocalipse|milenio|arrebatamento|angelologia|angeologia|anjos|moises|exodo|patristica|doutrina)\b/.test(normalized)
  const hasBibleHistoryCue = /\b(arqueologia|arquiologia|historia da igreja|patristica|pais da igreja|segundo templo|moises|exodo|egito|levante|epigrafia|manuscrito)\b/.test(normalized)
  const hasResearchCue = /\b(fonte|fontes|evidencia|evidencias|consenso|historiografia|epigrafia|inscricao|inscricoes|cronologia)\b/.test(normalized)

  if (hasBibleTopicCue) {
    explicit.add("bible")
  }

  if (explicit.has("bible") && hasBibleHistoryCue) {
    explicit.add("history_archaeology")
  }

  if ((explicit.has("bible") || explicit.has("history_archaeology") || hasBibleTopicCue) && hasResearchCue) {
    explicit.add("research")
  }

  if (explicit.size === 0) {
    explicit.add(DEFAULT_ACTIVE_MODULES[0])
  }

  return Array.from(explicit)
}

export function inferDomainSubmodules(task = "", activeModules = [], explicitSelections = {}) {
  const normalized = normalizeModuleKeywordText(task)
  const active = Array.isArray(activeModules) ? activeModules : []
  const selected = {}

  active.forEach(moduleId => {
    const module = getDomainModule(moduleId)
    if (!module?.submodules?.length || moduleId === "bible") {
      return
    }

    const explicitIds = sanitizeSubmoduleSelection(moduleId, explicitSelections?.[moduleId] || [])
    const inferredIds = module.submodules
      .filter(submodule => hasNormalizedKeywordMatch(normalized, submodule.keywords))
      .map(submodule => submodule.id)

    const merged = Array.from(new Set([...explicitIds, ...inferredIds]))
    if (merged.length > 0) {
      selected[moduleId] = merged
    }
  })

  return selected
}
