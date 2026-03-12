// ml/public/js/ml-base.js
// ✅ Base helper + auto-prefix para suite (/ml) vs standalone ("")
// ✅ Intercepta fetch() e XHR para evitar 404 por falta de /ml
(() => {
  "use strict";

  // Base real onde o app está montado
  // - suite:   /ml/login -> base "/ml"
  // - local:   /login    -> base ""
  function detectBase() {
    const p = window.location.pathname || "/";
    return p.startsWith("/ml/") || p === "/ml" ? "/ml" : "";
  }

  const base = window.__ML_BASE__ ?? detectBase();

  // compat (código antigo usa isso)
  window.ML_BASE = base;
  window.__ML_BASE__ = base;

  function withBase(url) {
    if (!url) return url;

    // Request object (fetch)
    if (typeof url === "object" && url.url) {
      return new Request(withBase(url.url), url);
    }

    if (typeof url !== "string") return url;

    // Não mexe em URL absoluta
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("//")
    ) {
      return url;
    }

    // Já está com base
    if (base && (url === base || url.startsWith(base + "/"))) return url;

    // Só prefixa quando é caminho absoluto do site
    if (url.startsWith("/")) return base + url;

    return url;
  }

  // Helper antigo (mantém)
  window.mlUrl = function mlUrl(path) {
    if (!path) return base || "/";
    return withBase(path);
  };

  // Helper novo (pra padronizar daqui pra frente)
  window.ML = window.ML || {};
  window.ML.base = base;
  window.ML.url = (p) => withBase(p);

  // -----------------------
  // Patch do fetch
  // -----------------------
  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => originalFetch(withBase(input), init);
  }

  // -----------------------
  // Patch do XHR (caso algum script use axios/XHR)
  // -----------------------
  if (
    window.XMLHttpRequest &&
    XMLHttpRequest.prototype &&
    typeof XMLHttpRequest.prototype.open === "function"
  ) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
      return origOpen.call(this, method, withBase(url), async, user, password);
    };
  }

  try {
    console.log("✅ ml-base.js ativo | base =", base || "(standalone)");
  } catch {}
})();
