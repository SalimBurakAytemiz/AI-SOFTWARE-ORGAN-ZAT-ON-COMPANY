// Disposable fixture service used by the Agent Runtime proof workflow.
// It exists only so a task ("add a GET /health endpoint") has somewhere to land.
import { createServer } from "node:http";

export function handler(req, res) {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: "demo-service" }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  createServer(handler).listen(port, () => {
    console.log(`demo-service listening on :${port}`);
  });
}
