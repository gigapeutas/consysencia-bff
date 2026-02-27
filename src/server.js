import http from "http";

const PORT = process.env.PORT || 10000;

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, {
      ok: true,
      service: "consysencia-bff",
      ts: new Date().toISOString()
    });
  }

  // Placeholder endpoints para o Gemini implementar depois
  if (
    req.url.startsWith("/auth") ||
    req.url.startsWith("/catalog") ||
    req.url.startsWith("/playback") ||
    req.url.startsWith("/stream/")
  ) {
    return json(res, 501, {
      error: "NOT_IMPLEMENTED",
      message: "BFF real será implementado pelo Gemini."
    });
  }

  return json(res, 404, { error: "NOT_FOUND" });
});

server.listen(PORT, () => {
  console.log(`[consysencia-bff] listening on :${PORT}`);
});
