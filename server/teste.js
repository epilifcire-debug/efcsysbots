// Teste de ponta a ponta com uma API do Claude simulada (não gasta créditos).
// Precisa de um PostgreSQL de teste em TEST_DATABASE_URL:
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/bots npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";

const DB = process.env.TEST_DATABASE_URL;
const PORTA_API = 18901, PORTA_APP = 18902;
let falsa, app;
let chamadasChefe = 0;

before(async () => {
  assert.ok(DB, "Defina TEST_DATABASE_URL");
  // API do Claude de mentira: o Chefe chama o PM e depois responde
  falsa = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (c) => { corpo += c; });
    req.on("end", () => {
      const b = JSON.parse(corpo);
      const ehChefe = Array.isArray(b.tools) && b.tools.length > 0;
      let resposta;
      if (ehChefe && chamadasChefe++ === 0) {
        resposta = { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "chamar_robo", input: { robo: "pm", tarefa: "Planejar um app de reservas" } }] };
      } else if (ehChefe) {
        resposta = { stop_reason: "end_turn", content: [{ type: "text", text: "Pronto: o **PM** planejou." }] };
      } else {
        resposta = { stop_reason: "end_turn", content: [{ type: "text", text: "1. Tarefa A\n2. Tarefa B" }] };
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: b.model, usage: { input_tokens: 1, output_tokens: 1 }, ...resposta }));
    });
  }).listen(PORTA_API);

  app = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, DATABASE_URL: DB, DATABASE_SSL: "false", PORT: String(PORTA_APP),
      ANTHROPIC_API_KEY: "teste", ANTHROPIC_BASE_URL: `http://127.0.0.1:${PORTA_API}`,
      ADMIN_USUARIO: "eric", ADMIN_SENHA: "senha-de-teste-123", ADMIN_EMAIL: "eric@exemplo.com" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((ok) => app.stdout.on("data", (d) => { if (String(d).includes("no ar")) ok(); }));
});

after(() => { app?.kill(); falsa?.close(); });

const url = (p) => `http://127.0.0.1:${PORTA_APP}${p}`;
let cookie = "";
const post = (p, corpo) => fetch(url(p), { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(corpo || {}) });

test("health responde", async () => {
  const r = await fetch(url("/health"));
  assert.equal(r.status, 200);
});

test("sem login a API recusa", async () => {
  const r = await fetch(url("/api/eu"));
  assert.equal(r.status, 401);
});

test("senha errada é recusada", async () => {
  const r = await post("/api/entrar", { login: "eric", senha: "errada" });
  assert.equal(r.status, 401);
});

test("entra pelo e-mail e pelo usuário", async () => {
  let r = await post("/api/entrar", { login: "ERIC@exemplo.com", senha: "senha-de-teste-123" });
  assert.equal(r.status, 200);
  r = await post("/api/entrar", { login: "eric", senha: "senha-de-teste-123" });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  const eu = await (await fetch(url("/api/eu"), { headers: { cookie } })).json();
  assert.equal(eu.usuario, "eric");
  assert.equal(eu.papel, "master");
});

test("pedido passa pelo PM e a conversa fica salva", async () => {
  const r = await post("/api/pedido", { texto: "Quero um app de reservas" });
  assert.equal(r.status, 200);
  const eventos = (await r.text()).split("\n\n").filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)));
  assert.ok(eventos.some((e) => e.tipo === "repasse" && e.robo === "pm"));
  assert.ok(eventos.some((e) => e.tipo === "resultado" && e.robo === "pm"));
  assert.ok(eventos.some((e) => e.tipo === "resposta" && e.texto.includes("PM")));
  assert.ok(eventos.some((e) => e.tipo === "fim"));
  const conversa = await (await fetch(url("/api/conversa"), { headers: { cookie } })).json();
  assert.deepEqual(conversa.mensagens.map((m) => m.autor), ["eric", "robo", "chefe"]);
});

test("sair encerra a sessão", async () => {
  await post("/api/sair");
  const r = await fetch(url("/api/eu"), { headers: { cookie } });
  assert.equal(r.status, 401);
});
