import { secp256k1 } from "@noble/curves/secp256k1.js";

const EC_PRIVATE_KEY_BEGIN = "-----BEGIN EC PRIVATE KEY-----";
const EC_PRIVATE_KEY_END = "-----END EC PRIVATE KEY-----";
const PKCS8_PRIVATE_KEY_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PKCS8_PRIVATE_KEY_END = "-----END PRIVATE KEY-----";

const OID_SECP256K1 = new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x0a]);

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function derLength(length) {
  if (length < 128) return Uint8Array.of(length);
  const bytes = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derWrap(tag, content) {
  return concatBytes(Uint8Array.of(tag), derLength(content.length), content);
}

function derSequence(...parts) {
  return derWrap(0x30, concatBytes(...parts));
}

function derInteger(value) {
  if (value === 1) return Uint8Array.of(0x02, 0x01, 0x01);
  throw new Error(`Unsupported DER integer: ${value}`);
}

function derOid(bytes) {
  return derWrap(0x06, bytes);
}

function derOctetString(bytes) {
  return derWrap(0x04, bytes);
}

function derTagged(tag, content) {
  return derWrap(0xa0 | tag, content);
}

function derBitString(bytes) {
  return derWrap(0x03, concatBytes(Uint8Array.of(0x00), bytes));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrapPem(label, derBytes) {
  const body = bytesToBase64(derBytes).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

/** Encode a secp256k1 private key in OpenSSL SEC1 PEM format (ZATCA-compatible). */
export function encodeSecp256k1PrivateKeyPem(privateKeyBytes) {
  if (privateKeyBytes.length !== 32) {
    throw new Error("secp256k1 private key must be 32 bytes.");
  }

  const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
  const ecPrivateKey = derSequence(
    derInteger(1),
    derOctetString(privateKeyBytes),
    derTagged(0, derOid(OID_SECP256K1)),
    derTagged(1, derBitString(publicKey))
  );

  return wrapPem("EC PRIVATE KEY", ecPrivateKey);
}

/** Generate a fresh ZATCA-compatible secp256k1 private key (PEM). */
export function generateSecp256k1PrivateKeyPem() {
  const { secretKey } = secp256k1.keygen();
  return encodeSecp256k1PrivateKeyPem(secretKey);
}

export function isValidPrivateKeyPem(value) {
  const pem = String(value || "").trim();
  if (!pem) return false;

  const hasEcHeader =
    pem.includes(EC_PRIVATE_KEY_BEGIN) && pem.includes(EC_PRIVATE_KEY_END);
  const hasPkcs8Header =
    pem.includes(PKCS8_PRIVATE_KEY_BEGIN) && pem.includes(PKCS8_PRIVATE_KEY_END);

  return hasEcHeader || hasPkcs8Header;
}
