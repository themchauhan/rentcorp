// Minimal stand-in for Meta's Graph API during e2e tests. Records every
// request; replies like the Cloud API. A recipient of 919111111199 fails.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GRAPH_PORT ?? 3199);
const requests = [];
let counter = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.url === "/__health") return json(res, 200, { ok: true });
    if (req.url === "/__requests") return json(res, 200, requests);
    const url = new URL(req.url ?? "/", "http://mock");
    // Embedded Signup endpoints.
    if (/^\/v[\d.]+\/oauth\/access_token$/.test(url.pathname)) {
      requests.push({ kind: "oauth", query: Object.fromEntries(url.searchParams) });
      return url.searchParams.get("code") === "bad-code"
        ? json(res, 400, { error: { message: "Invalid code" } })
        : json(res, 200, { access_token: `es-token-${url.searchParams.get("code")}-000000000000` });
    }
    const sub = /^\/v[\d.]+\/(\d+)\/subscribed_apps$/.exec(url.pathname);
    if (req.method === "POST" && sub) {
      requests.push({ kind: "subscribe", wabaId: sub[1], auth: req.headers.authorization });
      return json(res, 200, { success: true });
    }
    const phone = /^\/v[\d.]+\/(\d+)$/.exec(url.pathname);
    if (req.method === "GET" && phone) {
      return json(res, 200, {
        display_phone_number: "+91 90000 0" + phone[1].slice(-4),
        id: phone[1],
      });
    }
    const m = /^\/(v[\d.]+)\/(\d+)\/messages$/.exec(url.pathname);
    if (req.method === "POST" && m) {
      const body = JSON.parse(raw || "{}");
      if (body.to === "919111111199") {
        requests.push({
          version: m[1],
          phoneNumberId: m[2],
          auth: req.headers.authorization,
          body,
          messageId: null,
        });
        return json(res, 400, {
          error: {
            code: 131026,
            message: "Message undeliverable",
            error_data: { details: "Recipient is not on WhatsApp" },
          },
        });
      }
      const messageId = `wamid.MOCK${Date.now()}${++counter}`;
      requests.push({
        version: m[1],
        phoneNumberId: m[2],
        auth: req.headers.authorization,
        body,
        messageId,
      });
      return json(res, 200, { messaging_product: "whatsapp", messages: [{ id: messageId }] });
    }
    json(res, 404, { error: { message: "not found" } });
  });
}).listen(PORT, () => console.log(`mock graph on ${PORT}`));
