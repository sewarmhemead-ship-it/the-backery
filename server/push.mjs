// ============================================================
// Web Push ohne Bibliothek: VAPID (RFC 8292) + Verschlüsselung
// aes128gcm (RFC 8291). Damit kommen Benachrichtigungen aufs Handy,
// auch wenn die Seite zu ist (iPhone: nur als App vom Home-Bildschirm).
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// Schlüsselpaar einmal erzeugen und im Datenordner aufheben.
// Ändert es sich, müssen alle Handys die Benachrichtigungen neu einschalten.
export function loadVapid(dir) {
  const file = path.join(dir, 'vapid.json');
  let jwk;
  try { jwk = JSON.parse(fs.readFileSync(file, 'utf8')).jwk; } catch { /* neu */ }
  if (!jwk) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    jwk = privateKey.export({ format: 'jwk' });
    fs.writeFileSync(file, JSON.stringify({ jwk }));
  }
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]));
  return { key, publicKey };
}

export function vapidAuth(vapid, endpoint, subject) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: vapid.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// RFC 8291: Nachricht für genau dieses Gerät verschlüsseln
export function encrypt(payload, p256dh, authSecret, { salt = crypto.randomBytes(16), ecdh } = {}) {
  const ua = unb64u(p256dh), auth = unb64u(authSecret);
  if (ua.length !== 65 || auth.length !== 16) throw new Error('bad subscription keys');
  const local = ecdh || crypto.createECDH('prime256v1');
  if (!ecdh) local.generateKeys();
  const asPub = local.getPublicKey();
  const shared = local.computeSecret(ua);
  const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

// Nur an echte Push-Dienste senden (Google, Apple, Mozilla, Microsoft)
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
export function pushAllowed(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some(r => r.test(u.hostname));
  } catch { return false; }
}

export async function sendPush(vapid, subject, sub, payload, { urgency = 'normal', ttl = 12 * 3600 } = {}) {
  if (!pushAllowed(sub.endpoint)) return 400;
  const body = encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(ttl), Urgency: urgency, 'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream', Authorization: vapidAuth(vapid, sub.endpoint, subject),
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  return r.status;
}
