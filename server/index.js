// Servidor do EFCsys Bots: app (pasta app/), login e conversa com o Chefe
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { q, migrar } from "./db.js";
import { entrar, sair, exigirLogin, garantirMaster } from "./auth.js";
import { rodarPedido } from "./equipe.js";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 8080);
const LIMITE_PEDIDO = 8000;

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- login ----------
app.post("/api/entrar", (req, res, next) => entrar(req, res).catch(next));
app.post("/api/sair", (req, res, next) => sair(req, res).catch(next));
app.get("/api/eu", exigirLogin, (req, res) => res.json({ usuario: req.usuario.usuario, papel: req.usuario.papel }));

// ---------- conversas ----------
async function conversaAtual(usuarioId, criarSeNaoTiver = true) {
  const { rows } = await q("select id from conversas where usuario_id = $1 order by id desc limit 1", [usuarioId]);
  if (rows[0] || !criarSeNaoTiver) return rows[0]?.id || null;
  const novo = await q("insert into conversas (usuario_id) values ($1) returning id", [usuarioId]);
  return novo.rows[0].id;
}

app.get("/api/conversa", exigirLogin, async (req, res, next) => {
  try {
    const id = await conversaAtual(req.usuario.id, false);
    if (!id) return res.json({ id: null, mensagens: [] });
    const { rows } = await q("select autor, robo, tarefa, conteudo, criado_em from mensagens where conversa_id = $1 order by id", [id]);
    res.json({ id, mensagens: rows });
  } catch (e) { next(e); }
});

app.post("/api/conversa/nova", exigirLogin, async (req, res, next) => {
  try {
    const { rows } = await q("insert into conversas (usuario_id) values ($1) returning id", [req.usuario.id]);
    res.json({ id: rows[0].id });
  } catch (e) { next(e); }
});

// Um pedido por vez por pessoa, para não gastar créditos em dobro
const ocupados = new Set();

app.post("/api/pedido", exigirLogin, async (req, res, next) => {
  const pedido = String(req.body?.texto || "").trim();
  if (!pedido) return res.status(400).json({ erro: "Escreva o pedido." });
  if (pedido.length > LIMITE_PEDIDO) return res.status(400).json({ erro: `O pedido passou de ${LIMITE_PEDIDO} caracteres.` });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ erro: "O servidor está sem a chave da API do Claude (ANTHROPIC_API_KEY)." });
  if (ocupados.has(req.usuario.id)) return res.status(409).json({ erro: "A equipe ainda está trabalhando no pedido anterior." });
  ocupados.add(req.usuario.id);

  // resposta em fluxo (Server-Sent Events) para a tela acompanhar cada robô
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let aberto = true;
  res.on("close", () => { aberto = false; });
  const emitir = (ev) => { if (aberto) res.write(`data: ${JSON.stringify(ev)}\n\n`); };
  const batida = setInterval(() => { if (aberto) res.write(": ok\n\n"); }, 15000);

  try {
    const conversa = await conversaAtual(req.usuario.id);
    const { rows } = await q(
      "select autor, conteudo from mensagens where conversa_id = $1 and autor in ('eric', 'chefe') order by id desc limit 20", [conversa]);
    const historico = rows.reverse().map((m) => ({ role: m.autor === "eric" ? "user" : "assistant", content: m.conteudo }));
    await q("insert into mensagens (conversa_id, autor, conteudo) values ($1, 'eric', $2)", [conversa, pedido]);

    const { resposta, resultados } = await rodarPedido({ historico, pedido, emitir });
    for (const r of resultados) {
      await q("insert into mensagens (conversa_id, autor, robo, tarefa, conteudo) values ($1, 'robo', $2, $3, $4)", [conversa, r.robo, r.tarefa, r.texto]);
    }
    await q("insert into mensagens (conversa_id, autor, conteudo) values ($1, 'chefe', $2)", [conversa, resposta]);
    emitir({ tipo: "fim" });
  } catch (e) {
    console.error("Erro no pedido:", e);
    emitir({ tipo: "estado", robo: "chefe", estado: "erro" });
    emitir({ tipo: "falha", erro: "A equipe não conseguiu terminar este pedido. Tente de novo em instantes." });
  } finally {
    clearInterval(batida);
    ocupados.delete(req.usuario.id);
    res.end();
  }
});

// ---------- app (PWA) ----------
app.use(express.static(path.join(RAIZ, "app"), {
  setHeaders(res, arquivo) {
    if (/(sw\.js|index\.html|version\.js|manifest\.webmanifest)$/.test(arquivo)) res.setHeader("Cache-Control", "no-cache");
  },
}));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return res.end();
  res.status(500).json({ erro: "Algo deu errado no servidor." });
});

await migrar();
await garantirMaster();
app.listen(PORT, () => console.log(`EFCsys Bots no ar na porta ${PORT}`));
