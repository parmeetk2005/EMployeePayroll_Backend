// services/socketService.js
const WebSocket = require("ws");
const { getRedis } = require("./redisClient");

let wss = null;
let clients = new Set();

function initSocket(server) {
  wss = new WebSocket.Server({ server });

  console.log("WebSocket server started...");

  wss.on("connection", (ws) => {
    console.log("WS client connected");
    clients.add(ws);

    ws.send(JSON.stringify({ message: "Connected to Payroll WS" }));

    ws.on("close", () => {
      clients.delete(ws);
      console.log("Client disconnected");
    });
  });

  // Redis pub/sub to broadcast payroll events
  (async () => {
    try {
      const redis = getRedis();
      const sub = redis.duplicate();
      await sub.connect();

      await sub.subscribe("payroll:channel", (msg) => {
        const payload = JSON.parse(msg);
        broadcast(payload);
      });

      console.log("WS: subscribed to payroll:channel");
    } catch (err) {
      console.error("WS Redis sub error:", err);
    }
  })();

  return wss;
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

module.exports = { initSocket };
