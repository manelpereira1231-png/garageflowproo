import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', () => JSON.parse(open('./users.json')));

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '90s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<800'],
  },
};

const BASE = __ENV.BASE_URL;
const ANON = __ENV.ANON_KEY;

export default function () {
  const u = users[__VU % users.length];
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${u.token}`,
    Accept: 'application/json',
  };
  const s = u.shopId;

  // Leituras representativas das páginas mais usadas (todas filtradas por oficina).
  const reqs = [
    `${BASE}/rest/v1/clients?shop_id=eq.${s}&deleted_at=is.null&select=id,name,phone&order=created_at.desc&limit=50`,
    `${BASE}/rest/v1/work_orders?shop_id=eq.${s}&select=id,number,status,total&order=created_at.desc&limit=50`,
    `${BASE}/rest/v1/quotes?shop_id=eq.${s}&select=id,number,status,total&order=created_at.desc&limit=50`,
    `${BASE}/rest/v1/invoices?shop_id=eq.${s}&select=id,number,status,total&order=created_at.desc&limit=50`,
    `${BASE}/rest/v1/parts?shop_id=eq.${s}&select=id,name,stock_quantity&order=name&limit=50`,
  ];

  for (const url of reqs) {
    const res = http.get(url, { headers });
    check(res, { '200': (r) => r.status === 200 });
  }
  sleep(1);
}
