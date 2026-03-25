export function detectBug(log) {

  if (log.includes("node-gyp"))
    return "Erro de compilação de dependência nativa"

  if (log.includes("electron-builder"))
    return "Erro no build do Electron"

  return "Erro desconhecido"

}