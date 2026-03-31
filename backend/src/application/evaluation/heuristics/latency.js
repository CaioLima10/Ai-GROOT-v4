export function computeLatencyScore(latencyMs = 0) {
  const latency = Number(latencyMs) || 0
  if (latency <= 0) return 1
  if (latency < 200) return 1
  if (latency < 500) return 0.75
  if (latency < 1000) return 0.45
  if (latency < 2000) return 0.25
  return 0.1
}
