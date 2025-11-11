import express from "express";
import { WebSocketServer } from "ws";
import httpProxy from "http-proxy";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const proxy = httpProxy.createProxyServer({});
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = new URL(
    req.url,
    `http://${req.headers.host}`
  ).searchParams.get("id");
  clients.set(clientId, ws);
  console.log(`🔌 Client connected: ${clientId}`);

  ws.on("close", () => {
    clients.delete(clientId);
    console.log(`❌ Client disconnected: ${clientId}`);
  });
});

app.all("/:id/*", (req, res) => {
  const client = clients.get(req.params.id);
  if (!client) return res.status(404).send("Tunnel not active");

  const payload = {
    method: req.method,
    path: req.params[0],
    headers: req.headers,
  };

  client.send(JSON.stringify(payload));

  client.once("message", (msg) => {
    const { status, headers, body } = JSON.parse(msg);
    res.writeHead(status, headers);
    res.end(body);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Tunnel server running on port ${PORT}`);
});
