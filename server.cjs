const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const rootReal = fs.realpathSync(root);
const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://noldgjtoqhwefqdzdpzs.supabase.co https://raw.githubusercontent.com; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg"
};

http.createServer(async (req, res) => {
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.writeHead(405).end("Method not allowed");
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  // Local links are shared as /p/<slug>, while the customer page reads ?c=<slug>.
  // Normalize the short link before static-file lookup so it works like the deployed route.
  const shortCustomerLink = pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
  if (shortCustomerLink) {
    res.writeHead(302, { Location: `/customer/?c=${encodeURIComponent(shortCustomerLink[1])}` }).end();
    return;
  }

  let file = path.resolve(root, "." + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    file = await fs.promises.realpath(file);
    if (file !== rootReal && !file.startsWith(rootReal + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if ((await fs.promises.stat(file)).isDirectory()) file = await fs.promises.realpath(path.join(file, "index.html"));
    if (file !== rootReal && !file.startsWith(rootReal + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const contents = await fs.promises.readFile(file);
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.end(req.method === "HEAD" ? undefined : contents);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") console.error("Local server request failed:", error.message);
    res.writeHead(error.code === "ENOENT" || error.code === "ENOTDIR" ? 404 : 500).end("Not found");
  }
}).listen(8000, "127.0.0.1", () => {
  console.log("SalesDesk is at http://127.0.0.1:8000/");
});
