// EFCsys Bots — app da equipe de robozinhos
(function () {
  "use strict";

  // Ordem do fluxo de trabalho
  const BOTS = [
    { id: "chefe",  nome: "Chefe",                sub: "Diretrizes e demanda",     faz: "Recebe o seu pedido, coordena a equipe e te entrega o resultado." },
    { id: "pm",     nome: "PM",                   sub: "Planejamento e requisitos", faz: "Quebra o pedido em tarefas, define requisitos e prioridades." },
    { id: "uiux",   nome: "UI/UX",                sub: "Design de interface",      faz: "Define cores, tipografia, logo e telas, sem cara de IA." },
    { id: "codigo", nome: "Código",               sub: "Desenvolvimento",          faz: "Escreve o código e implementa as telas." },
    { id: "banco",  nome: "Banco de Dados / SQL", sub: "Dados e backend",          faz: "Tabelas, consultas, migrations e RLS no Supabase. Começa em só leitura." },
    { id: "fluxos", nome: "Fluxos / Workflow",    sub: "Integração e automação",   faz: "Cria automações, integrações e tarefas em segundo plano." },
    { id: "docs",   nome: "Docs",                 sub: "Arquivos e documentação",  faz: "Organiza entregas, documentação e arquivos do projeto." },
  ];

  const ESTADOS = [
    { id: "dormindo", nome: "Dormindo" }, { id: "acordando", nome: "Acordando" },
    { id: "feliz", nome: "Feliz" }, { id: "repouso", nome: "Repouso" },
    { id: "pensando", nome: "Pensando" }, { id: "trabalhando", nome: "Trabalhando" },
    { id: "erro", nome: "Erro" }, { id: "sucesso", nome: "Sucesso" },
  ];

  const sprite = (bot, estado) => `sprites/${bot}_${estado}.webp`;
  const porId = Object.fromEntries(BOTS.map((b) => [b.id, b]));
  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs, ...filhos) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") n.className = v;
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
      // um "oi" rápido ao passar o mouse ou focar
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
  const TELAS = ["equipe", "fluxo", "estados"];
  function irPara() {
    const atual = TELAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "equipe";
    TELAS.forEach((t) => { $("#tela-" + t).hidden = t !== atual; });
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.tela === atual) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", irPara);

  // ---------- Versão no rodapé ----------
  const v = window.EFCSYS_VERSAO || {};
  $("#versao").textContent = `v${v.versao || "dev"}${v.commit ? " · " + v.commit.slice(0, 7) : ""}`;

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

  montarEquipe();
  montarFluxo();
  mostrarEstadoEquipe("repouso");
  irPara();
})();
