const ISSUE_RULES = [
  {
    code: "TOO_SHORT",
    test: ({ answer }) => String(answer || "").trim().length < 20
  },
  {
    code: "UNCERTAIN_LANGUAGE",
    test: ({ answer }) => /\btalvez\b|\bprovavelmente\b|\bacho\b/i.test(String(answer || ""))
  },
  {
    code: "LOW_CONFIDENCE",
    test: ({ answer }) => /nao sei|não sei|sem certeza/i.test(String(answer || ""))
  }
]

export async function critiqueResponse({ question = "", answer = "" } = {}) {
  const issues = []
  for (const rule of ISSUE_RULES) {
    if (rule.test({ question, answer })) issues.push(rule.code)
  }

  return {
    hasIssues: issues.length > 0,
    issues
  }
}
