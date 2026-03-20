const vscode = require("vscode")

function activate(context) {
  const command = vscode.commands.registerCommand("groot.openChat", () => {
    const panel = vscode.window.createWebviewPanel(
      "grootChat",
      "GROOT AI",
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    )

    const config = vscode.workspace.getConfiguration("groot")
    const endpoint = config.get("endpoint")
    const enableConnection = config.get("enableConnection")

    panel.webview.html = getWebviewHtml(endpoint, enableConnection)
  })

  context.subscriptions.push(command)
}

function getWebviewHtml(endpoint, enableConnection) {
  const connectionStatus = enableConnection
    ? `Conexão habilitada para ${endpoint}`
    : "Conexão desativada (modo preview)"

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>GROOT AI</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0b0f14;
            color: #e5e7eb;
            padding: 16px;
          }
          .card {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 18px;
            font-weight: 700;
          }
          .muted {
            color: #9aa4b2;
            font-size: 12px;
          }
          textarea {
            width: 100%;
            min-height: 120px;
            border-radius: 10px;
            border: 1px solid #1f2937;
            background: #0f172a;
            color: #e5e7eb;
            padding: 12px;
          }
          button {
            margin-top: 12px;
            padding: 10px 14px;
            border: none;
            border-radius: 10px;
            background: #7c9bff;
            color: #0b0f14;
            font-weight: 700;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">GROOT AI - VSCode</div>
          <div class="muted">${connectionStatus}</div>
        </div>
        <div class="card">
          <textarea placeholder="Descreva o bug ou peça ajuda com seu código..."></textarea>
          <button>Enviar (preview)</button>
        </div>
        <div class="card muted">
          WebView pronta. Conexão real será habilitada quando você ativar a opção no settings.
        </div>
      </body>
    </html>
  `
}

function deactivate() {}

module.exports = { activate, deactivate }
