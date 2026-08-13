// Concorrência crítica: consumo de stock, aprovação e conversão de orçamentos.
// ATENÇÃO: escreve dados. Usar apenas em ambiente de teste.
const URL_BASE = `${process.env.SUPABASE_URL}/rest/v1`;
const ANON = process.env.SUPABASE_ANON_KEY;
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const N = Number(args.n || 50);

const token = await (async () => {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.LOAD_EMAIL, password: process.env.LOAD_PASSWORD }),
  });
  if (!r.ok) throw new Error(`login falhou: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
})();

const H = { apikey: ANON, Authorization: `Bearer ${token}`, "content-type": "application/json" };
const rpc = (fn, body) => fetch(`${URL_BASE}/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (p) => fetch(`${URL_BASE}${p}`, { headers: H }).then((r) => r.json());

async function stockTest(workOrderId) {
  const before = await get(`/parts?select=id,name,stock_quantity&limit=200`);
  const res = await Promise.all(Array.from({ length: N }, () => rpc("consume_work_order_parts", { p_work_order_id: workOrderId })));
  const codes = res.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  const after = await get(`/parts?select=id,name,stock_quantity&limit=200`);
  const movs = await get(`/stock_movements?work_order_id=eq.${workOrderId}&select=id,part_id,quantity,type`);
  const diff = before
    .map((b) => ({ name: b.name, antes: b.stock_quantity, depois: after.find((a) => a.id === b.id)?.stock_quantity }))
    .filter((d) => d.antes !== d.depois);
  console.log(`\n[STOCK] ${N} chamadas simultâneas -> ${JSON.stringify(codes)}`);
  console.log(`  deltas de stock:`, diff);
  console.log(`  movimentos criados: ${movs.length} (esperado: 1 por peça distinta)`);
}

async function approvalTest(quoteId) {
  const res = await Promise.all(Array.from({ length: N }, () =>
    fetch(`${URL_BASE}/quotes?id=eq.${quoteId}&status=eq.sent`, {
      method: "PATCH", headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({ status: "approved" }),
    }).then(async (r) => ({ status: r.status, rows: (await r.json())?.length ?? 0 }))
  ));
  const winners = res.filter((r) => r.rows > 0).length;
  console.log(`\n[APROVAÇÃO] ${N} tentativas simultâneas -> aprovações efetivas: ${winners} (esperado: 1)`);
  const wos = await get(`/work_orders?quote_id=eq.${quoteId}&select=id`);
  console.log(`  OS criadas a partir do orçamento: ${wos.length} (esperado: 1)`);
}

if (args["work-order"]) await stockTest(args["work-order"]);
if (args.quote) await approvalTest(args.quote);
if (!args["work-order"] && !args.quote) console.log("Indicar --work-order <uuid> e/ou --quote <uuid>");
