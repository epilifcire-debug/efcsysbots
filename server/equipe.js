// O Chefe conversa com o Eric e passa tarefas para os robôs da equipe (ferramenta chamar_robo)
import Anthropic from "@anthropic-ai/sdk";

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MODELO_CHEFE = process.env.CHEFE_MODEL || MODELO;
const MAX_REPASSES = 8;

let cliente;
const api = () => (cliente ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const COMUM = `Você faz parte da equipe de robozinhos da EFCsys, que trabalha para o Eric (desenvolvedor no Brasil, apps em Node.js, Supabase, PWA, bots de WhatsApp, hospedagem na Shard Cloud).
Responda sempre em português do Brasil, direto ao ponto, em Markdown simples.
Nesta versão você NÃO tem acesso a repositórios, bancos, arquivos ou internet: entregue planos, código e SQL como texto, e nunca diga que aplicou, publicou ou alterou algo.`;

export const ROBOS = {
  pm: {
    nome: "PM",
    prompt: `${COMUM}
Você é o PM (planejamento e requisitos). Transforme o pedido em: objetivo, escopo do que entra e do que fica de fora, lista de tarefas em ordem, critérios de aceite curtos e dúvidas que precisam do Eric. Seja enxuto.`,
  },
  uiux: {
    nome: "UI/UX",
    prompt: `${COMUM}
Você é o UI/UX (design de interface). Proponha a direção visual: paleta com o papel de cada cor (hex), par de fontes com justificativa, telas principais e seus componentes, estados (vazio, carregando, erro) e microinterações discretas.
Padrão EFCsys: visual próprio e sem cara de IA (nada de roxo com brilho, degradê decorativo ou template SaaS), mobile primeiro, PWA, contraste acessível, áreas de toque de 44 px, animações leves que respeitam movimento reduzido, assinatura "by: efcsys".`,
  },
  codigo: {
    nome: "Código",
    prompt: `${COMUM}
Você é o Código (desenvolvimento). Escreva código completo e pronto para rodar, com nome de arquivo acima de cada bloco. Prefira as tecnologias que o Eric já usa. Trate erros, não deixe segredos no código (use variáveis de ambiente) e explique em poucas linhas como rodar.
Padrões dos apps do Eric: login por usuário OU e-mail, ele como Administrador Master, versão v*.*.* no rodapé da tela de login, PWA instalável.`,
  },
  banco: {
    nome: "Banco de Dados",
    prompt: `${COMUM}
Você é o Banco de Dados / SQL (Supabase e PostgreSQL). Entregue SQL completo: tabelas com tipos adequados, chaves, índices, RLS ligado em toda tabela exposta com políticas por dono usando (select auth.uid()), e UPDATE com USING e WITH CHECK.
Você trabalha em modo só leitura: qualquer mudança é entregue como migration para o Eric revisar e aplicar. Avise sobre riscos (dados apagados, travas, colunas não nulas em tabela cheia).`,
  },
  fluxos: {
    nome: "Fluxos",
    prompt: `${COMUM}
Você é o Fluxos / Workflow (integração e automação). Desenhe automações, integrações entre sistemas, webhooks, filas e tarefas agendadas: gatilho, passos, tratamento de falha e repetição, e o que precisa de credencial. Inclua código quando ajudar.`,
  },
  docs: {
    nome: "Docs",
    prompt: `${COMUM}
Você é o Docs (arquivos e documentação). Organize a entrega: README com o que é, como rodar, variáveis de ambiente (só os nomes), estrutura de pastas e próximos passos. Seja claro e curto.`,
  },
};

const PROMPT_CHEFE = `${COMUM}
Você é o Chefe, o supervisor da equipe. Só você fala com o Eric. Sua equipe, na ordem do fluxo de trabalho:
1. PM: planejamento, requisitos, tarefas e prioridades
2. UI/UX: visual, cores, tipografia, logo e telas
3. Código: desenvolvimento e implementação
4. Banco de Dados (banco): tabelas, SQL, RLS e migrations, em só leitura
5. Fluxos: automações e integrações
6. Docs: documentação e organização da entrega

Como trabalhar:
- Pergunta simples ou conversa: responda você mesmo, sem chamar ninguém.
- Pedido de trabalho: chame só os robôs necessários, seguindo a ordem do fluxo (PM antes, Docs por último). Passe para cada um a tarefa completa e o resultado dos anteriores que ele precisar, porque eles não veem a conversa.
- Use no máximo ${MAX_REPASSES} chamadas por pedido.
- Se faltar informação essencial, pergunte ao Eric antes de mobilizar a equipe.
- No fim, entregue ao Eric um resumo do que cada robô fez e o próximo passo. Não repita por inteiro o que os robôs já entregaram: eles aparecem para o Eric em cartões próprios.`;

const FERRAMENTA = {
  name: "chamar_robo",
  description: "Passa uma tarefa para um robô da equipe e devolve o resultado dele.",
  input_schema: {
    type: "object",
    properties: {
      robo: { type: "string", enum: Object.keys(ROBOS), description: "Quem faz a tarefa." },
      tarefa: { type: "string", description: "A tarefa com todo o contexto necessário. O robô não vê a conversa." },
    },
    required: ["robo", "tarefa"],
  },
};

const texto = (msg) => msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

async function chamarRobo(id, tarefa) {
  const r = await api().messages.create({
    model: MODELO, max_tokens: 8000, system: ROBOS[id].prompt,
    messages: [{ role: "user", content: tarefa }],
  });
  return texto(r) || "(sem resposta)";
}

/**
 * Roda um pedido do Eric.
 * historico: [{ role: "user"|"assistant", content: string }] da conversa (só Eric e Chefe)
 * emitir(evento): recebe { tipo: "estado"|"repasse"|"resultado"|"resposta", ... }
 */
export async function rodarPedido({ historico, pedido, emitir }) {
  const mensagens = [...historico, { role: "user", content: pedido }];
  const resultados = [];
  let repasses = 0;
  emitir({ tipo: "estado", robo: "chefe", estado: "pensando" });

  for (let volta = 0; volta < MAX_REPASSES + 2; volta++) {
    const r = await api().messages.create({
      model: MODELO_CHEFE, max_tokens: 4000, system: PROMPT_CHEFE,
      tools: [FERRAMENTA], messages: mensagens,
    });
    const usos = r.content.filter((b) => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || usos.length === 0) {
      const resposta = texto(r);
      emitir({ tipo: "estado", robo: "chefe", estado: "sucesso" });
      emitir({ tipo: "resposta", texto: resposta });
      return { resposta, resultados };
    }

    mensagens.push({ role: "assistant", content: r.content });
    emitir({ tipo: "estado", robo: "chefe", estado: "trabalhando" });
    const respostas = await Promise.all(usos.map(async (uso) => {
      const { robo, tarefa } = uso.input || {};
      if (!ROBOS[robo] || ++repasses > MAX_REPASSES) {
        return { type: "tool_result", tool_use_id: uso.id, is_error: true, content: "Chamada recusada: robô desconhecido ou limite de chamadas atingido." };
      }
      emitir({ tipo: "repasse", robo, tarefa });
      emitir({ tipo: "estado", robo, estado: "trabalhando" });
      try {
        const saida = await chamarRobo(robo, String(tarefa || ""));
        resultados.push({ robo, tarefa, texto: saida });
        emitir({ tipo: "resultado", robo, tarefa, texto: saida });
        emitir({ tipo: "estado", robo, estado: "sucesso" });
        return { type: "tool_result", tool_use_id: uso.id, content: saida };
      } catch (e) {
        emitir({ tipo: "estado", robo, estado: "erro" });
        return { type: "tool_result", tool_use_id: uso.id, is_error: true, content: `Falhou: ${e.message}` };
      }
    }));
    mensagens.push({ role: "user", content: respostas });
    emitir({ tipo: "estado", robo: "chefe", estado: "pensando" });
  }
  const resposta = "Parei aqui porque a equipe passou do limite de etapas para um pedido. Me diga se quer que eu continue de onde parou.";
  emitir({ tipo: "resposta", texto: resposta });
  return { resposta, resultados };
}
