// Rampa de concorrência contra o caminho real PostgREST -> Postgres (leitura anónima).
// Mede p50/p95/p99, throughput e taxa de erro. Não escreve nada na base de dados.
const URL_BASE = `${process.env.SUPABASE_URL}/rest/v1`;
const ANON = process.env.SUPABASE_ANON_KEY;
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN;
};

async function worker(endTime, lat, errs, codes) {
  while (Date.now() < endTime) {
    const t0 = performance.now();
    try {
      const r = await fetch(`${URL_BASE}/platform_settings?key=eq.landing&select=value`, { headers: H });
      await r.text();
      codes[r.status] = (codes[r.status] || 0) + 1;
      if (!r.ok) errs.push(r.status);
      lat.push(performance.now() - t0);
    } catch (e) {
      errs.push(String(e).slice(0, 60));
    }
  }
}

async function run(conc, seconds) {
  const lat = [], errs = [], codes = {};
  const end = Date.now() + seconds * 1000;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: conc }, () => worker(end, lat, errs, codes)));
  const dur = (Date.now() - t0) / 1000;
  console.log(
    `conc=${String(conc).padStart(4)} reqs=${String(lat.length).padStart(6)} ` +
    `rps=${(lat.length / dur).toFixed(0).padStart(5)} ` +
    `p50=${pct(lat, 50).toFixed(0)}ms p95=${pct(lat, 95).toFixed(0)}ms p99=${pct(lat, 99).toFixed(0)}ms ` +
    `max=${Math.max(...lat).toFixed(0)}ms erros=${errs.length} codes=${JSON.stringify(codes)}`
  );
}

for (const c of [1, 10, 50, 100, 200, 400]) {
  await run(c, 12);
}
