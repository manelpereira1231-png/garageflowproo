/**
 * Symmetric encryption for provider credentials (InvoiceXpress / Moloni API tokens).
 * Uses AES-GCM with a 32-byte key derived from `BILLING_CRED_ENC_KEY` (project secret).
 * Ciphertext format:  base64( 12-byte IV | ciphertext | 16-byte tag )
 *
 * NEVER return the plaintext key to the frontend. Only edge functions (service-role)
 * decrypt when calling the provider API.
 */

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("BILLING_CRED_ENC_KEY");
  if (!raw) throw new Error("BILLING_CRED_ENC_KEY not configured");
  // Derive a 32-byte key by SHA-256 of the secret (accepts any length input).
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptSecret(payload: string): Promise<string> {
  const key = await getKey();
  const bytes = fromB64(payload);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(plain);
}
