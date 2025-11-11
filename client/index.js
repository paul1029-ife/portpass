import WebSocket from "ws";
import fetch from "node-fetch";

export async function startTunnel(localPort, tunnelServer, clientId) {
  const ws = new WebSocket(`${tunnelServer}?id=${clientId}`);

  ws.on("open", () => {
    console.log(`
🚀 Tunnel active!
🔗 Public URL: ${tunnelServer.replace("wss", "https")}/${clientId}/
↩️ Forwarding → http://localhost:${localPort}
    `);
  });

  ws.on("message", async (data) => {
    const { method, path, headers } = JSON.parse(data);

    try {
      const response = await fetch(`http://localhost:${localPort}/${path}`, {
        method,
        headers,
      });
      const body = await response.text();

      ws.send(
        JSON.stringify({
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        })
      );
    } catch (err) {
      ws.send(
        JSON.stringify({
          status: 502,
          headers: { "content-type": "text/plain" },
          body: "Bad Gateway: local server unreachable",
        })
      );
    }
  });

  ws.on("close", () => console.log("❌ Tunnel closed"));
  ws.on("error", (err) => console.error("WebSocket error:", err.message));
}
