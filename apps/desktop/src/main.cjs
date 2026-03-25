const path = require("path")
const { app, BrowserWindow } = require("electron")

function createWindow() {

  const win = new BrowserWindow({
    width: 1200,
    height: 800
  })

  win.loadFile(path.join(__dirname, "..", "..", "web", "public", "index.html"))

}

app.whenReady().then(createWindow)
