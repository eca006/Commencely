const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function authenticatorKey(bytes) {
  let bits = 0;
  let value = 0;
  let key = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      key += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) key += alphabet[(value << (5 - bits)) & 31];
  return key;
}

export async function authenticatorCode(secret, step) {
  const bytes = Uint8Array.from(secret.match(/../g), byte => parseInt(byte, 16));
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = new DataView(new ArrayBuffer(8));
  counter.setBigUint64(0, BigInt(step));
  const mac = new DataView(await crypto.subtle.sign('HMAC', key, counter.buffer));
  const offset = mac.getUint8(mac.byteLength - 1) & 15;
  const digits = (mac.getUint32(offset) & 0x7fffffff) % 1_000_000;
  return String(digits).padStart(6, '0');
}
