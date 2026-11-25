// Markdown simples e seguro para as respostas da equipe (escapa todo HTML antes de formatar)
(function () {
  "use strict";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function render(md) {
    const partes = String(md || "").split(/```/);
    let html = "";
    partes.forEach((parte, i) => {
      if (i % 2 === 1) {
        const quebra = parte.indexOf("\n");
        const linguagem = quebra > 0 ? parte.slice(0, quebra).trim() : "";
        const codigo = quebra > 0 ? parte.slice(quebra + 1) : parte;
        html += `<div class="bloco-codigo">${linguagem ? `<span class="bloco-ling">${esc(linguagem)}</span>` : ""}` +
                `<button type="button" class="copiar">Copiar</button><pre><code>${esc(codigo.replace(/\n$/, ""))}</code></pre></div>`;
        return;
      }
      let lista = null;
      const fecharLista = () => { if (lista) { html += `</${lista}>`; lista = null; } };
      let paragrafo = [];
      const fecharPar = () => { if (paragrafo.length) { html += `<p>${paragrafo.join("<br>")}</p>`; paragrafo = []; } };
      for (const bruta of parte.split("\n")) {
        const linha = esc(bruta);
        let m;
        if (!linha.trim()) { fecharPar(); fecharLista(); continue; }
        if ((m = linha.match(/^#{1,6}\s+(.*)$/))) { fecharPar(); fecharLista(); html += `<h4>${inline(m[1])}</h4>`; continue; }
        if ((m = linha.match(/^\s*[-*]\s+(.*)$/))) {
          fecharPar(); if (lista !== "ul") { fecharLista(); html += "<ul>"; lista = "ul"; }
          html += `<li>${inline(m[1])}</li>`; continue;
        }
        if ((m = linha.match(/^\s*\d+[.)]\s+(.*)$/))) {
          fecharPar(); if (lista !== "ol") { fecharLista(); html += "<ol>"; lista = "ol"; }
          html += `<li>${inline(m[1])}</li>`; continue;
        }
        fecharLista(); paragrafo.push(inline(linha));
      }
      fecharPar(); fecharLista();
    });
    return html;
  }

  window.renderMarkdown = render;
})();
