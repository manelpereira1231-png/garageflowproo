// Carga autenticada mista: N "oficinas" a executar operações reais em paralelo.
// Requer utilizadores de teste (ver README). Só faz leituras + criação de cliente/veículo.
import { readFileSync } from "node:fs";

const URL_BASE = `${process.env.SUPABASE_URL}/rest/v1`;
const ANON = process.env.SUPABASE_ANON_KEY;
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1]]] : a), [])
);
const SHOPS = Number(args.shops || 100);
const MINUTES = Number(args.minutes || 5);

const users = readFileSync(process.env.LOAD_USERS_FILE, "utf8")
  .split("\n").filter(Boolean).map((l) => {
    const [email, password, shopId] = l.split(":");
    return { email, password, shopId };
  }).slice(0, SHOPS);

const stats = {};
const rec = (op, ms, ok) => {
  const s = (stats[op] ||= { lat: [], err: 0 });
  ok ? s.lat.push(ms) : s.err++;
};
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((p / 100) * s.length)] : NaN; };

async function login(u) {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  if (!r.ok) throw new Error(`login ${u.email}: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function call(op, token, path, init = {}) {
  const t0 = performance.now();
  const r = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  await r.text();
  rec(op, performance.now() - t0, r.ok);
  return r.status;
}

// Mix representativo de utilização real de uma oficina.
const OPS = [
  (t, s) => call("dashboard", t, `/work_orders?shop_id=eq.${s}&select=id,status,total&limit=50`),
  (t, s) => call("pesquisa", t, `/clients?shop_id=eq.${s}&select=id,name,phone&name=ilike.*a*&limit=20`),
  (t, s) => call("veiculos", t, `/vehicles?shop_id=eq.${s}&select=id,plate,make,model&limit=30`),
  (t, s) => call("orcamentos", t, `/quotes?shop_id=eq.${s}&select=id,status,total&limit=30`),
  (t, s) => call("faturas", t, `/invoices?shop_id=eq.${s}&select=id,number,status,total&limit=30`),
  (t, s) => call("stock", t, `/parts?shop_id=eq.${s}&select=id,name,stock_quantity&limit=30`),
  (t, s) => call("criar_cliente", t, `/clients`, {
    method: "POST",
    body: JSON.stringify({ shop_id: s, name: `Carga ${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }),
  }),
];

const sessions = [];
for (const u of users) {
  try { sessions.push({ token: await login(u), shopId: u.shopId }); }
  catch (e) { console.error(String(e)); }
}
console.log(`Sessões ativas: ${sessions.length}/${users.length}`);

const end = Date.now() + MINUTES * 60_000;
await Promise.all(sessions.map(async (s) => {
  while (Date.now() < end) {
    const op = OPS[Math.floor(Math.random() * OPS.length)];
    try { await op(s.token, s.shopId); } catch { rec("rede", 0, false); }
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 800)); // ritmo humano
  }
}));

console.log(`\n${"op".padEnd(15)} n      p50    p95    p99    erros`);
for (const [op, s] of Object.entries(stats)) {
  console.log(
    `${op.padEnd(15)} ${String(s.lat.length).padEnd(6)} ` +
    `${pct(s.lat, 50)?.toFixed(0).padEnd(6)} ${pct(s.lat, 95)?.toFixed(0).padEnd(6)} ${pct(s.lat, 99)?.toFixed(0).padEnd(6)} ${s.err}`
  );
}
