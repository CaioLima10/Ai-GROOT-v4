import { BIBLE_STUDY_MODULES } from "./bibleStudyModules.js"

function toLiteSubmodules(submodules = []) {
  return submodules.map(submodule => ({
    id: submodule.id,
    label: submodule.label,
    summary: submodule.summary
  }))
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
      id: "macro_risk",
      label: "Macro, Mercado & Risco",
      summary: "Inflação, juros, câmbio, risco sistêmico e exposição operacional.",
      keywords: ["inflacao", "inflação", "juros", "cambio", "câmbio", "macro", "mercado", "exposicao"],
      instructions: [
        "Explique relação entre variável macro e impacto prático.",
        "Diga quando a leitura depende de dado atual e não de conhecimento estático."
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
    keywords: ["biblia", "teologia", "hebraico", "aramaico", "grego", "igreja", "pastor", "evangelho"],
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
      "historia", "arqueologia", "historiador", "civilizacao", "imperio", "cronologia", "inscricao",
      "manuscrito", "escavacao", "antiguidade", "roma", "egito", "mesopotamia", "levant"
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
    summary: "Solo, satelite, GPS, plantio, colheita, agricultura de precisao e diagnostico operacional.",
    keywords: ["agro", "agronegocio", "solo", "plantio", "colheita", "gps", "satelite", "fazenda"],
    submodules: MODULE_SUBMODULES.agribusiness,
    instructions: [
      "Foque em diagnostico pratico, observacao de campo, monitoramento, produtividade e risco operacional.",
      "Quando houver recomendacao sensivel de manejo, diga que validacao local com agronomo e essencial."
    ]
  },
  finance: {
    id: "finance",
    label: "Financeiro",
    summary: "Financas pessoais, corporativas, operacoes, risco e contexto global/local.",
    keywords: ["financeiro", "financas", "investimento", "caixa", "orcamento", "contabilidade", "mercado"],
    submodules: MODULE_SUBMODULES.finance,
    instructions: [
      "Explique conceitos, risco, cenarios e impacto pratico.",
      "Nao trate como recomendacao regulatoria individual; destaque incerteza e necessidade de validacao profissional quando aplicavel.",
      "Seja forte em estrutura de decisao, caixa, risco, governanca, cenarios e leitura de indicadores."
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
  const normalized = String(task || "").toLowerCase()
  const explicit = new Set(Array.isArray(explicitModules) ? explicitModules : [])

  Object.values(DOMAIN_MODULES).forEach(module => {
    if (module.keywords.some(keyword => normalized.includes(keyword))) {
      explicit.add(module.id)
    }
  })

  if (explicit.size === 0) {
    explicit.add(DEFAULT_ACTIVE_MODULES[0])
  }

  return Array.from(explicit)
}

export function inferDomainSubmodules(task = "", activeModules = [], explicitSelections = {}) {
  const normalized = String(task || "").toLowerCase()
  const active = Array.isArray(activeModules) ? activeModules : []
  const selected = {}

  active.forEach(moduleId => {
    const module = getDomainModule(moduleId)
    if (!module?.submodules?.length || moduleId === "bible") {
      return
    }

    const explicitIds = sanitizeSubmoduleSelection(moduleId, explicitSelections?.[moduleId] || [])
    const inferredIds = module.submodules
      .filter(submodule => submodule.keywords.some(keyword => normalized.includes(keyword)))
      .map(submodule => submodule.id)

    const merged = Array.from(new Set([...explicitIds, ...inferredIds]))
    if (merged.length > 0) {
      selected[moduleId] = merged
    }
  })

  return selected
}
