// Conexão com o PostgreSQL da Shard Cloud e criação das tabelas
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta a variável DATABASE_URL (PostgreSQL da Shard Cloud).");
  process.exit(1);
}

// DATABASE_SSL=false desliga o SSL (ex.: banco local). Na Shard, deixe sem definir.
const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
export const pool = new pg.Pool({ connectionString: url, ssl, max: 5 });

export const q = (texto, params) => pool.query(texto, params);

const MIGRACOES = [
  `create table if not exists usuarios (
     id         serial primary key,
     usuario    text not null,
     email      text,
     senha_hash text not null,
     papel      text not null default 'usuario' check (papel in ('master', 'admin', 'usuario')),
     criado_em  timestamptz not null default now()
   )`,
  `create unique index if not exists usuarios_usuario_un on usuarios (lower(usuario))`,
  `create unique index if not exists usuarios_email_un on usuarios (lower(email)) where email is not null`,
  `create table if not exists sessoes (
     token_hash text primary key,
     usuario_id integer not null references usuarios(id) on delete cascade,
     expira_em  timestamptz not null,
     criado_em  timestamptz not null default now()
   )`,
  `create index if not exists sessoes_usuario_idx on sessoes (usuario_id)`,
  `create table if not exists conversas (
     id         bigserial primary key,
     usuario_id integer not null references usuarios(id) on delete cascade,
     criado_em  timestamptz not null default now()
   )`,
  `create index if not exists conversas_usuario_idx on conversas (usuario_id, id desc)`,
  `create table if not exists mensagens (
     id          bigserial primary key,
     conversa_id bigint not null references conversas(id) on delete cascade,
     autor       text not null check (autor in ('eric', 'chefe', 'robo')),
     robo        text,
     tarefa      text,
     conteudo    text not null,
     criado_em   timestamptz not null default now()
   )`,
  `create index if not exists mensagens_conversa_idx on mensagens (conversa_id, id)`,
];

export async function migrar() {
  for (const sql of MIGRACOES) await q(sql);
  await q("delete from sessoes where expira_em < now()");
}
