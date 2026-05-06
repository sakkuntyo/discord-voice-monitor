const path = require("node:path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { WebSocketServer } = require("ws");

const WS_HOST = "127.0.0.1";
const WS_PORT = 3939;

let mainWindow = null;
let latestSnapshot = {
  source: "vencord",
  connected: false,
  channel: null,
  guildId: null,
  members: [],
  updatedAt: null
};

function broadcastSnapshot() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("voice-monitor:snapshot", latestSnapshot);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Discord Voice Monitor",
    width: 520,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startWebSocketServer() {
  const wss = new WebSocketServer({
    host: WS_HOST,
    port: WS_PORT
  });

  wss.on("connection", ws => {
    latestSnapshot = {
      ...latestSnapshot,
      connected: true
    };
    broadcastSnapshot();

    ws.on("message", raw => {
      try {
        const nextSnapshot = JSON.parse(raw.toString("utf8"));
        latestSnapshot = {
          ...nextSnapshot,
          connected: true
        };
        broadcastSnapshot();
      } catch (error) {
        console.error("Failed to parse incoming snapshot:", error);
      }
    });

    ws.on("close", () => {
      latestSnapshot = {
        ...latestSnapshot,
        connected: false
      };
      broadcastSnapshot();
    });
  });

  wss.on("listening", () => {
    console.log(`Voice monitor WebSocket server listening on ws://${WS_HOST}:${WS_PORT}`);
  });

  wss.on("error", error => {
    console.error("WebSocket server error:", error);
  });
}

app.whenReady().then(() => {
  startWebSocketServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("voice-monitor:get-snapshot", () => latestSnapshot);
