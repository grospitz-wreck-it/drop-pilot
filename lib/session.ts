const COOKIE_NAME = "droppilot_session";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("droppilot-personal-session-v1"));
  return bytesToHex(signature);
}

export async function isValidSession(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;
  const expected = await createSessionToken(secret);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export { COOKIE_NAME };
