// Cria o Administrador Master pelo terminal da Shard Cloud (ou localmente):
//   npm run criar-admin -- --usuario eric --senha "uma-senha-forte" [--email voce@exemplo.com]
import { migrar, pool } from "./db.js";
import { criarUsuario } from "./auth.js";

const args = process.argv.slice(2);
const pegar = (nome) => { const i = args.indexOf("--" + nome); return i >= 0 ? args[i + 1] : undefined; };

try {
  await migrar();
  const u = await criarUsuario({ usuario: pegar("usuario"), senha: pegar("senha"), email: pegar("email"), papel: "master" });
  console.log(`Administrador Master criado: ${u.usuario}${u.email ? " (" + u.email + ")" : ""}`);
} catch (e) {
  console.error("Não deu para criar:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
