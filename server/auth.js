// Login por usuário OU e-mail, sessão em cookie httpOnly
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { q } from "./db.js";

const COOKIE = "efcsysbots_sessao";
const DIAS = 30;
const SENHA_FALSA = bcrypt.hashSync("senha-que-nao-existe", 12); // mesmo tempo de resposta com ou sem usuário
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");

export async function criarUsuario({ usuario, email, senha, papel = "usuario" }) {
  usuario = String(usuario || "").trim();
  email = email ? String(email).trim() : null;
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(usuario)) throw new Error("Usuário deve ter de 3 a 40 letras, números, ponto, hífen ou sublinhado.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (!senha || String(senha).length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const senha_hash = await bcrypt.hash(String(senha), 12);
  const { rows } = await q(
    "insert into usuarios (usuario, email, senha_hash, papel) values ($1, $2, $3, $4) returning id, usuario, email, papel",
    [usuario, email, senha_hash, papel]);
  return rows[0];
}

// Na primeira inicialização, cria o Administrador Master a partir das variáveis ADMIN_*
export async function garantirMaster() {
  const { rows } = await q("select count(*)::int as n from usuarios where papel = 'master'");
  if (rows[0].n > 0) return;
  const { ADMIN_USUARIO, ADMIN_SENHA, ADMIN_EMAIL } = process.env;
  if (!ADMIN_USUARIO || !ADMIN_SENHA) {
    console.warn("Nenhum Administrador Master ainda. Defina ADMIN_USUARIO e ADMIN_SENHA e reinicie, ou rode: npm run criar-admin");
    return;
  }
  const u = await criarUsuario({ usuario: ADMIN_USUARIO, email: ADMIN_EMAIL, senha: ADMIN_SENHA, papel: "master" });
  console.log(`Administrador Master criado: ${u.usuario}. Pode apagar ADMIN_SENHA do painel.`);
}

// Limite simples de tentativas de login por IP (10 por 10 minutos)
const tentativas = new Map();
function bloqueado(ip) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) || []).filter((t) => agora - t < 10 * 60 * 1000);
  tentativas.set(ip, lista);
  return lista.length >= 10;
}
const registrarFalha = (ip) => tentativas.get(ip).push(Date.now());

function lerCookie(req) {
  const c = req.headers.cookie || "";
  const m = c.split(/;\s*/).find((p) => p.startsWith(COOKIE + "="));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}

function gravarCookie(res, valor, maxAgeSeg) {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeg}${seguro}`);
}

export async function entrar(req, res) {
  const ip = req.ip;
  if (bloqueado(ip)) return res.status(429).json({ erro: "Muitas tentativas. Espere alguns minutos e tente de novo." });
  const login = String(req.body?.login || "").trim();
  const senha = String(req.body?.senha || "");
  if (!login || !senha) return res.status(400).json({ erro: "Preencha o usuário ou e-mail e a senha." });
  const { rows } = await q(
    "select id, usuario, senha_hash from usuarios where lower(usuario) = lower($1) or lower(email) = lower($1) limit 1", [login]);
  const u = rows[0];
  const ok = u ? await bcrypt.compare(senha, u.senha_hash) : await bcrypt.compare(senha, SENHA_FALSA);
  if (!u || !ok) {
    registrarFalha(ip);
    return res.status(401).json({ erro: "Usuário, e-mail ou senha incorretos." });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  await q("insert into sessoes (token_hash, usuario_id, expira_em) values ($1, $2, now() + ($3 || ' days')::interval)",
    [hash(token), u.id, String(DIAS)]);
  gravarCookie(res, token, DIAS * 86400);
  res.json({ usuario: u.usuario });
}

export async function sair(req, res) {
  const token = lerCookie(req);
  if (token) await q("delete from sessoes where token_hash = $1", [hash(token)]);
  gravarCookie(res, "", 0);
  res.json({ ok: true });
}

export async function exigirLogin(req, res, next) {
  try {
    const token = lerCookie(req);
    if (!token) return res.status(401).json({ erro: "Entre para continuar." });
    const { rows } = await q(
      `select u.id, u.usuario, u.papel from sessoes s join usuarios u on u.id = s.usuario_id
       where s.token_hash = $1 and s.expira_em > now()`, [hash(token)]);
    if (!rows[0]) return res.status(401).json({ erro: "Sua sessão expirou. Entre de novo." });
    req.usuario = rows[0];
    next();
  } catch (e) { next(e); }
}
