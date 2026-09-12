const TECHNICAL_NETWORK_ERROR = /\b(load failed|failed to fetch|networkerror|network error)\b/i;

const FRIENDLY_NETWORK_ERROR =
  "Estamos com dificuldades temporárias em contactar o servidor. Tenta novamente dentro de instantes.";

function replaceTechnicalText(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text && TECHNICAL_NETWORK_ERROR.test(current.data)) textNodes.push(current);
    current = walker.nextNode();
  }
  textNodes.forEach((node) => {
    node.data = node.data.replace(TECHNICAL_NETWORK_ERROR, FRIENDLY_NETWORK_ERROR);
  });
}

/** Final presentation guard: browser/network wording must never reach users. */
export function installUserFacingErrorGuard() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const run = () => replaceTechnicalText(document.body);
  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => replaceTechnicalText(node));
      if (mutation.type === "characterData" && mutation.target instanceof Text) {
        const text = mutation.target.data;
        if (TECHNICAL_NETWORK_ERROR.test(text)) {
          mutation.target.data = text.replace(TECHNICAL_NETWORK_ERROR, FRIENDLY_NETWORK_ERROR);
        }
      }
    });
  });

  const start = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (TECHNICAL_NETWORK_ERROR.test(message)) event.preventDefault();
  });
}