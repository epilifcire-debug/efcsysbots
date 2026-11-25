// Service worker do EFCsys Bots
// Troque a VERSAO a cada entrega: o cache antigo é apagado na ativação, sem mexer em outros dados do navegador.
const VERSAO = "0.2.0";
const CACHE = "efcsysbots-" + VERSAO;
const ARQUIVOS = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "version.js",
  "markdown.js",
  "manifest.webmanifest",
  "icons/icone-192.png",
  "icons/icone-512.png",
  "icons/icone-512-maskable.png",
  "sprites/banco_acordando.webp",
  "sprites/banco_dormindo.webp",
  "sprites/banco_erro.webp",
  "sprites/banco_feliz.webp",
  "sprites/banco_pensando.webp",
  "sprites/banco_repouso.webp",
  "sprites/banco_sucesso.webp",
  "sprites/banco_trabalhando.webp",
  "sprites/chefe_acordando.webp",
  "sprites/chefe_dormindo.webp",
  "sprites/chefe_erro.webp",
  "sprites/chefe_feliz.webp",
  "sprites/chefe_pensando.webp",
  "sprites/chefe_repouso.webp",
  "sprites/chefe_sucesso.webp",
  "sprites/chefe_trabalhando.webp",
  "sprites/codigo_acordando.webp",
  "sprites/codigo_dormindo.webp",
  "sprites/codigo_erro.webp",
  "sprites/codigo_feliz.webp",
  "sprites/codigo_pensando.webp",
  "sprites/codigo_repouso.webp",
  "sprites/codigo_sucesso.webp",
  "sprites/codigo_trabalhando.webp",
  "sprites/docs_acordando.webp",
  "sprites/docs_dormindo.webp",
  "sprites/docs_erro.webp",
  "sprites/docs_feliz.webp",
  "sprites/docs_pensando.webp",
  "sprites/docs_repouso.webp",
  "sprites/docs_sucesso.webp",
  "sprites/docs_trabalhando.webp",
  "sprites/fluxos_acordando.webp",
  "sprites/fluxos_dormindo.webp",
  "sprites/fluxos_erro.webp",
  "sprites/fluxos_feliz.webp",
  "sprites/fluxos_pensando.webp",
  "sprites/fluxos_repouso.webp",
  "sprites/fluxos_sucesso.webp",
  "sprites/fluxos_trabalhando.webp",
  "sprites/pm_acordando.webp",
  "sprites/pm_dormindo.webp",
  "sprites/pm_erro.webp",
  "sprites/pm_feliz.webp",
  "sprites/pm_pensando.webp",
  "sprites/pm_repouso.webp",
  "sprites/pm_sucesso.webp",
  "sprites/pm_trabalhando.webp",
  "sprites/uiux_acordando.webp",
  "sprites/uiux_dormindo.webp",
  "sprites/uiux_erro.webp",
  "sprites/uiux_feliz.webp",
  "sprites/uiux_pensando.webp",
  "sprites/uiux_repouso.webp",
  "sprites/uiux_sucesso.webp",
  "sprites/uiux_trabalhando.webp"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((nomes) => Promise.all(
    nomes.filter((n) => n.startsWith("efcsysbots-") && n !== CACHE).map((n) => caches.delete(n))
  )).then(() => self.clients.claim()));
});

// só atualiza quando a pessoa toca em "Atualizar"
self.addEventListener("message", (e) => {
  if (e.data === "pular-espera") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // nada da API nem do login passa pelo cache
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/") || url.pathname.endsWith("/health")) return;
  // páginas: rede primeiro (pega versão nova), cache se estiver sem internet
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("index.html")));
    return;
  }
  // arquivos estáticos: cache primeiro
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
