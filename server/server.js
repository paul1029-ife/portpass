import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = new URL(
    req.url,
    `http://${req.headers.host}`
  ).searchParams.get("id");

  if (!clientId) {
    console.warn("Client connection rejected: No ID provided in query.");
    ws.close();
    return;
  }

  const clientData = {
    ws,
    pendingRequests: new Map(),
  };
  clients.set(clientId, clientData);
  console.log(`🔌 Client connected: ${clientId}`);

  ws.on("message", (msg) => {
    try {
      const metaLength = msg.readUInt32BE(0);
      const metaJSON = msg.subarray(4, 4 + metaLength).toString("utf8");
      const { status, headers, requestId } = JSON.parse(metaJSON);
      const bodyBuffer = msg.subarray(4 + metaLength);

      const res = clientData.pendingRequests.get(requestId);

      if (!res) {
        console.warn(`[${requestId}] Received response for unknown request`);
        return;
      }

      console.log(
        `📤 [${requestId}] Response: ${status} (${bodyBuffer.length} bytes)`
      );
      res.writeHead(status, headers);
      res.end(bodyBuffer);
      clientData.pendingRequests.delete(requestId);
    } catch (e) {
      console.error("Error parsing binary message from client:", e);
    }
  });

  ws.on("close", () => {
    clientData.pendingRequests.forEach((res) => {
      res.status(503).send("Tunnel client disconnected.");
    });
    clients.delete(clientId);
    console.log(`❌ Client disconnected: ${clientId}`);
  });
});

app.use("/:id", (req, res) => {
  const clientData = clients.get(req.params.id);
  if (!clientData) {
    console.log(`Request for unknown ID: ${req.params.id}`);
    return res.status(404).send("Tunnel not active");
  }

  console.log(
    `📥 ${req.method} ${req.path}${
      req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""
    }`
  );

  const requestId = crypto.randomBytes(12).toString("hex");

  const payload = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
  };

  clientData.pendingRequests.set(requestId, res);

  clientData.ws.send(JSON.stringify(payload));
});

app.get("/", (req, res) => {
  res.send(`Tunnel server is active. ${clients.size} client(s) connected.`);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Tunnel server running on port ${PORT}`);
});
