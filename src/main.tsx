import "./index.css";

const renderFatalBootError = (error: unknown) => {
  const root = document.getElementById("root");
  if (!root) return;

  const message = error instanceof Error ? error.message : "Erro inesperado ao iniciar a aplicação.";
  const escapedMessage = message.replace(/[&<>"]/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" };
    return entities[char] ?? char;
  });
  console.error("[GarageFlow boot error]", error);
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0f14;color:#f5f5f4;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <section style="width:min(100%,460px);border:1px solid rgba(245,158,11,.35);background:#14171c;border-radius:12px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.35);">
        <div style="font-size:14px;color:#f59e0b;font-weight:700;margin-bottom:10px;">GarageFlow</div>
        <h1 style="font-size:22px;line-height:1.2;margin:0 0 10px;font-weight:800;letter-spacing:0;">A aplicação não carregou corretamente</h1>
        <p style="font-size:14px;line-height:1.5;color:#cbd5e1;margin:0 0 18px;">Foi detetado um erro de arranque. Recarrega a página para obter a versão mais recente.</p>
        <button id="gf-reload" style="min-height:44px;width:100%;border:0;border-radius:8px;background:#f59e0b;color:#111827;font-weight:800;font-size:14px;cursor:pointer;">Recarregar GarageFlow</button>
        <details style="margin-top:16px;color:#94a3b8;font-size:12px;">
          <summary>Detalhes técnicos</summary>
          <pre style="white-space:pre-wrap;overflow:auto;max-height:120px;background:rgba(255,255,255,.04);padding:10px;border-radius:8px;">${escapedMessage}</pre>
        </details>
      </section>
    </main>`;
  document.getElementById("gf-reload")?.addEventListener("click", async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister().catch(() => undefined)));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
      }
    } catch {}
    window.location.reload();
  });
};

window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (!root?.hasChildNodes()) renderFatalBootError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const root = document.getElementById("root");
  if (!root?.hasChildNodes()) renderFatalBootError(event.reason);
});

import("./boot").catch(renderFatalBootError);
