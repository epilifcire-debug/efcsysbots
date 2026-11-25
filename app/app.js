// EFCsys Bots — app da equipe de robozinhos
(function () {
  "use strict";

  // Ordem do fluxo de trabalho
  const BOTS = [
    { id: "chefe",  nome: "Chefe",                curto: "Chefe",  sub: "Diretrizes e demanda",      faz: "Recebe o seu pedido, coordena a equipe e te entrega o resultado." },
    { id: "pm",     nome: "PM",                   curto: "PM",     sub: "Planejamento e requisitos", faz: "Quebra o pedido em tarefas, define requisitos e prioridades." },
    { id: "uiux",   nome: "UI/UX",                curto: "UI/UX",  sub: "Design de interface",       faz: "Define cores, tipografia, logo e telas, sem cara de IA." },
    { id: "codigo", nome: "Código",               curto: "Código", sub: "Desenvolvimento",           faz: "Escreve o código e implementa as telas." },
    { id: "banco",  nome: "Banco de Dados / SQL", curto: "Banco",  sub: "Dados e backend",           faz: "Tabelas, consultas, migrations e RLS no Supabase. Começa em só leitura." },
    { id: "fluxos", nome: "Fluxos / Workflow",    curto: "Fluxos", sub: "Integração e automação",    faz: "Cria automações, integrações e tarefas em segundo plano." },
    { id: "docs",   nome: "Docs",                 curto: "Docs",   sub: "Arquivos e documentação",   faz: "Organiza entregas, documentação e arquivos do projeto." },
  ];

  const ESTADOS = [
    { id: "dormindo", nome: "Dormindo" }, { id: "acordando", nome: "Acordando" },
    { id: "feliz", nome: "Feliz" }, { id: "repouso", nome: "Repouso" },
    { id: "pensando", nome: "Pensando" }, { id: "trabalhando", nome: "Trabalhando" },
    { id: "erro", nome: "Erro" }, { id: "sucesso", nome: "Sucesso" },
  ];
  const ROTULO_ESTADO = { dormindo: "dormindo", acordando: "acordando", feliz: "feliz", repouso: "pronto", pensando: "pensando", trabalhando: "trabalhando", erro: "com erro", sucesso: "terminou" };

  const sprite = (bot, estado) => `sprites/${bot}_${estado}.webp`;
  const porId = Object.fromEntries(BOTS.map((b) => [b.id, b]));
  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs, ...filhos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const f of filhos) n.append(f);
    return n;
  }

  function imgBot(bot, estado, largura, flutua) {
    return el("img", {
      src: sprite(bot, estado), alt: "", width: String(largura),
      height: String(Math.round(largura * 1.48)), loading: "lazy",
      class: flutua ? "flutua" : "",
    });
  }

  async function api(caminho, opcoes = {}) {
    const r = await fetch(caminho, {
      ...opcoes, credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) },
    });
    if (r.status === 401) { mostrarLogin(); throw new Error("sessao"); }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(dados.erro || "Não deu certo. Tente de novo.");
    return dados;
  }

  // ---------- Versão (só v*.*.*) ----------
  const versao = "v" + ((window.EFCSYS_VERSAO && window.EFCSYS_VERSAO.versao) || "0.0.0");
  document.querySelectorAll("[data-versao]").forEach((n) => { n.textContent = versao; });

  // ---------- Login ----------
  function mostrarLogin() {
    $("#app").hidden = true;
    $("#tela-login").hidden = false;
    setTimeout(() => $("#login").focus(), 50);
  }
  function mostrarApp(usuario) {
    $("#tela-login").hidden = true;
    $("#app").hidden = false;
    $("#topo-usuario").textContent = `Olá, ${usuario}`;
    carregarConversa();
    irPara();
  }
  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("#erro-login");
    const botao = $("#botao-entrar");
    const login = $("#login").value.trim();
    const senha = $("#senha").value;
    erro.hidden = true;
    if (!login || !senha) { erro.textContent = "Preencha o usuário ou e-mail e a senha."; erro.hidden = false; return; }
    botao.disabled = true; botao.textContent = "Entrando…";
    try {
      const r = await fetch("api/entrar", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, senha }) });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || "Não deu para entrar.");
      $("#senha").value = "";
      mostrarApp(dados.usuario);
    } catch (err) {
      erro.textContent = err.message; erro.hidden = false;
    } finally {
      botao.disabled = false; botao.textContent = "Entrar";
    }
  });
  $("#botao-sair").addEventListener("click", async () => {
    try { await api("api/sair", { method: "POST" }); } catch (_) { /* já está fora */ }
    $("#mensagens").replaceChildren();
    mostrarLogin();
  });

  // ---------- Conversa ----------
  const voltaRepouso = {};
  function montarFaixa() {
    $("#faixa-equipe").replaceChildren(...BOTS.map((b) => {
      const img = imgBot(b.id, "repouso", 46, true);
      img.id = "faixa-" + b.id;
      const legenda = el("span", { class: "faixa-estado", id: "faixa-estado-" + b.id }, ROTULO_ESTADO.repouso);
      return el("li", { class: "faixa-item" }, img, el("span", { class: "faixa-nome" }, b.curto), legenda);
    }));
  }
  function mudarEstado(bot, estado) {
    if (!porId[bot]) return;
    const img = document.getElementById("faixa-" + bot);
    if (img) img.src = sprite(bot, estado);
    const leg = document.getElementById("faixa-estado-" + bot);
    if (leg) leg.textContent = ROTULO_ESTADO[estado] || estado;
    clearTimeout(voltaRepouso[bot]);
    if (estado === "sucesso" || estado === "erro") {
      voltaRepouso[bot] = setTimeout(() => mudarEstado(bot, "repouso"), 6000);
    }
  }

  function rolarFim() {
    const caixa = $("#mensagens");
    caixa.lastElementChild && caixa.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" });
  }
  function ativarCopiar(raiz) {
    raiz.querySelectorAll(".copiar").forEach((b) => b.addEventListener("click", async () => {
      const codigo = b.parentElement.querySelector("code").textContent;
      try { await navigator.clipboard.writeText(codigo); b.textContent = "Copiado"; } catch (_) { b.textContent = "Não copiou"; }
      setTimeout(() => { b.textContent = "Copiar"; }, 2000);
    }));
  }
  function balaoEric(texto) {
    $("#mensagens").append(el("div", { class: "msg msg-eric" }, el("p", {}, texto)));
  }
  function balaoChefe(texto) {
    const corpo = el("div", { class: "msg-corpo md", html: window.renderMarkdown(texto) });
    ativarCopiar(corpo);
    $("#mensagens").append(el("div", { class: "msg msg-chefe" }, imgBot("chefe", "repouso", 36, false), corpo));
  }
  function linhaRepasse(robo, tarefa) {
    const b = porId[robo];
    $("#mensagens").append(el("div", { class: "repasse" },
      imgBot(robo, "trabalhando", 30, false),
      el("span", {}, `O Chefe passou para ${b.nome}`),
      el("span", { class: "repasse-tarefa" }, tarefa.length > 140 ? tarefa.slice(0, 140) + "…" : tarefa)));
  }
  function cartaoRobo(robo, tarefa, texto) {
    const b = porId[robo] || { nome: robo };
    const corpo = el("div", { class: "md", html: window.renderMarkdown(texto) });
    ativarCopiar(corpo);
    $("#mensagens").append(el("details", { class: "cartao-robo" },
      el("summary", {}, imgBot(robo, "sucesso", 30, false), el("span", {}, `${b.nome} entregou`), el("span", { class: "abrir" }, "ver")),
      tarefa ? el("p", { class: "cartao-tarefa" }, el("strong", {}, "Tarefa: "), tarefa) : "",
      corpo));
  }
  function aviso(texto) {
    $("#mensagens").append(el("div", { class: "msg-aviso", role: "alert" }, texto));
  }
  function boasVindas() {
    $("#mensagens").replaceChildren();
    balaoChefe("Oi! Eu sou o Chefe. Me diga o que você precisa e eu passo para a equipe certa: **PM**, **UI/UX**, **Código**, **Banco de Dados**, **Fluxos** e **Docs**.");
  }

  async function carregarConversa() {
    try {
      const { mensagens } = await api("api/conversa");
      if (!mensagens.length) { boasVindas(); return; }
      $("#mensagens").replaceChildren();
      for (const m of mensagens) {
        if (m.autor === "eric") balaoEric(m.conteudo);
        else if (m.autor === "chefe") balaoChefe(m.conteudo);
        else cartaoRobo(m.robo, m.tarefa, m.conteudo);
      }
      rolarFim();
    } catch (e) { if (e.message !== "sessao") aviso(e.message); }
  }

  let ocupado = false;
  $("#botao-nova").addEventListener("click", async () => {
    if (ocupado) return;
    try { await api("api/conversa/nova", { method: "POST" }); boasVindas(); BOTS.forEach((b) => mudarEstado(b.id, "repouso")); }
    catch (e) { if (e.message !== "sessao") aviso(e.message); }
  });

  const campo = $("#pedido");
  campo.addEventListener("input", () => { campo.style.height = "auto"; campo.style.height = Math.min(campo.scrollHeight, 160) + "px"; });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#form-pedido").requestSubmit(); }
  });

  $("#form-pedido").addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto || ocupado) return;
    ocupado = true;
    $("#botao-enviar").disabled = true;
    campo.value = ""; campo.style.height = "auto";
    balaoEric(texto); rolarFim();
    mudarEstado("chefe", "acordando");
    const pensando = el("div", { class: "msg-aviso suave" }, "O Chefe está lendo o seu pedido…");
    $("#mensagens").append(pensando);
    try {
      const r = await fetch("api/pedido", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
      if (r.status === 401) { mostrarLogin(); return; }
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.erro || "Não deu certo."); }
      const leitor = r.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let fim;
        while ((fim = buffer.indexOf("\n\n")) >= 0) {
          const bloco = buffer.slice(0, fim); buffer = buffer.slice(fim + 2);
          const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
          if (!linha) continue;
          const ev = JSON.parse(linha.slice(6));
          if (pensando.isConnected && ev.tipo !== "estado") pensando.remove();
          if (ev.tipo === "estado") mudarEstado(ev.robo, ev.estado);
          else if (ev.tipo === "repasse") { linhaRepasse(ev.robo, ev.tarefa); rolarFim(); }
          else if (ev.tipo === "resultado") { cartaoRobo(ev.robo, ev.tarefa, ev.texto); rolarFim(); }
          else if (ev.tipo === "resposta") { balaoChefe(ev.texto); rolarFim(); }
          else if (ev.tipo === "falha") { aviso(ev.erro); rolarFim(); }
        }
      }
    } catch (err) {
      mudarEstado("chefe", "erro");
      aviso(err.message || "A conexão caiu. Tente de novo.");
    } finally {
      if (pensando.isConnected) pensando.remove();
      ocupado = false;
      $("#botao-enviar").disabled = false;
      campo.focus();
    }
  });

  // ---------- Equipe ----------
  function montarEquipe() {
    const lista = $("#lista-equipe");
    BOTS.forEach((b, i) => {
      const img = imgBot(b.id, "repouso", 112, true);
      const botao = el("button", { type: "button", class: "cartao", "aria-label": `${b.nome}: ${b.sub}. Ver expressões`, onclick: () => abrirDetalhe(b.id) },
        img,
        el("span", { class: "ordem" }, String(i + 1).padStart(2, "0")),
        el("span", { class: "cartao-nome" }, b.nome),
        el("span", { class: "cartao-sub" }, b.sub));
      const oi = () => { img.src = sprite(b.id, "feliz"); };
      const volta = () => { img.src = sprite(b.id, "repouso"); };
      botao.addEventListener("pointerenter", oi);
      botao.addEventListener("pointerleave", volta);
      botao.addEventListener("focus", oi);
      botao.addEventListener("blur", volta);
      lista.append(el("li", {}, botao));
    });
  }

  // ---------- Detalhe com as 8 expressões ----------
  let botAberto = null;
  function seletor(container, atual, aoEscolher) {
    container.replaceChildren(...ESTADOS.map((e) =>
      el("button", { type: "button", "aria-pressed": String(e.id === atual), onclick: () => aoEscolher(e.id) }, e.nome)));
  }
  function mostrarEstadoDetalhe(estado) {
    const b = porId[botAberto];
    const img = $("#detalhe-img");
    img.src = sprite(b.id, estado);
    img.alt = `${b.nome}, ${ESTADOS.find((e) => e.id === estado).nome.toLowerCase()}`;
    seletor($("#detalhe-estados"), estado, mostrarEstadoDetalhe);
  }
  function abrirDetalhe(id) {
    botAberto = id;
    const b = porId[id];
    $("#detalhe-nome").textContent = b.nome;
    $("#detalhe-sub").textContent = b.sub;
    $("#detalhe-faz").textContent = b.faz;
    mostrarEstadoDetalhe("acordando");
    const dlg = $("#detalhe");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    setTimeout(() => { if (botAberto === id && dlg.open) mostrarEstadoDetalhe("feliz"); }, 700);
  }

  // ---------- Fluxo ----------
  function passo(id) {
    const b = porId[id];
    return el("div", { class: "passo" }, imgBot(id, "repouso", 64, false),
      el("div", {}, el("div", { class: "passo-nome" }, b.nome), el("div", { class: "passo-sub" }, b.sub)));
  }
  const seta = (txt, dupla) => el("div", { class: "seta" + (dupla ? " dupla" : "") }, txt);
  function montarFluxo() {
    const col = el("div", { class: "fluxo-col" },
      passo("chefe"), seta("Briefing / Demanda"), passo("pm"),
      el("div", { class: "ramos" },
        el("div", { class: "ramo" }, el("p", { class: "ramo-titulo" }, "Caminho do design"),
          seta("Wireframe / Telas"), passo("uiux"), seta("Layouts / UI")),
        el("div", { class: "ramo" }, el("p", { class: "ramo-titulo" }, "Caminho do código"),
          seta("Especificações"), passo("codigo"), seta("Consultas / API (ida e volta)", true), passo("banco"), seta("Código e dados"))),
      el("p", { class: "juncao" }, "Os dois caminhos se juntam em Fluxos"),
      passo("fluxos"), seta("Entrega / Validação"), passo("docs"));
    $("#fluxo").append(col);
  }

  // ---------- Expressões da equipe ----------
  function mostrarEstadoEquipe(estado) {
    seletor($("#seletor-estados"), estado, mostrarEstadoEquipe);
    const nome = ESTADOS.find((e) => e.id === estado).nome.toLowerCase();
    $("#lista-estados").replaceChildren(...BOTS.map((b) => el("li", {},
      el("div", { class: "cartao", role: "img", "aria-label": `${b.nome}, ${nome}` },
        imgBot(b.id, estado, 92, estado !== "dormindo"),
        el("span", { class: "cartao-nome" }, b.nome)))));
  }

  // ---------- Navegação por hash ----------
  const TELAS = ["conversa", "equipe", "fluxo", "estados"];
  function irPara() {
    const atual = TELAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "conversa";
    TELAS.forEach((t) => { $("#tela-" + t).hidden = t !== atual; });
    document.body.classList.toggle("em-conversa", atual === "conversa");
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.tela === atual) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", irPara);

  // ---------- PWA: service worker e atualização ----------
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    // só existe "versão nova" se a página já era controlada por uma versão anterior
    const tinhaVersao = !!navigator.serviceWorker.controller;
    let pediuAtualizar = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (pediuAtualizar) { pediuAtualizar = false; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      const avisar = (w) => {
        if (!tinhaVersao) return;
        $("#aviso-atualizar").hidden = false;
        $("#botao-atualizar").onclick = () => { pediuAtualizar = true; w.postMessage("pular-espera"); };
      };
      if (reg.waiting) avisar(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const novo = reg.installing;
        novo && novo.addEventListener("statechange", () => {
          if (novo.state === "installed") avisar(novo);
        });
      });
    }).catch(() => { /* o app continua funcionando como site */ });
  }

  montarFaixa();
  montarEquipe();
  montarFluxo();
  mostrarEstadoEquipe("repouso");

  // começa conferindo se já tem sessão
  fetch("api/eu", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => mostrarApp(d.usuario))
    .catch(() => mostrarLogin());
})();
