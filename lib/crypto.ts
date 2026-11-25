/**
 * Isomorphic Cryptographic Utility for API Request & Response Encryption
 * Uses standard AES-256-GCM with 96-bit (12-byte) initialization vectors (IV).
 * Compatible with modern browser Web Crypto API and Node.js environments.
 */

const DEFAULT_CIPHER_SECRET =
  process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY ||
  process.env.API_ENCRYPTION_KEY ||
  'wmedlaw-dtr-sec-cipher-v1-production-2026';

let cachedKeyPromise: Promise<CryptoKey> | null = null;

/**
 * Derives a 256-bit AES-GCM CryptoKey using SHA-256 of the secret.
 */
export async function getCryptoKey(secret: string = DEFAULT_CIPHER_SECRET): Promise<CryptoKey> {
  if (cachedKeyPromise && secret === DEFAULT_CIPHER_SECRET) {
    return cachedKeyPromise;
  }

  const promise = (async () => {
    const encoder = new TextEncoder();
    const hash = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(secret));
    return globalThis.crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  if (secret === DEFAULT_CIPHER_SECRET) {
    cachedKeyPromise = promise;
  }

  return promise;
}

/**
 * Converts a Uint8Array to a Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts arbitrary data (objects, strings, arrays) into an AES-256-GCM Base64 string.
 * Every encryption uses a freshly generated random 12-byte IV.
 */
export async function encryptPayload(data: any, secret: string = DEFAULT_CIPHER_SECRET): Promise<string> {
  if (data === undefined) return '';
  const key = await getCryptoKey(secret);
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(jsonStr);

  // 12-byte random IV
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  // Pack: [12-byte IV] + [Ciphertext + Auth Tag]
  const combined = new Uint8Array(iv.length + encryptedBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuf), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypts an AES-256-GCM Base64 string back into its original parsed object or string.
 * Gracefully handles already-parsed or plain fallback payloads.
 */
export async function decryptPayload<T = any>(payload: any, secret: string = DEFAULT_CIPHER_SECRET): Promise<T> {
  if (!payload) return payload;

  const rawPayload =
    typeof payload === 'object' && payload !== null && 'payload' in payload
      ? payload.payload
      : payload;

  if (typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return payload;
  }

  try {
    const rawBytes = base64ToBytes(rawPayload);
    // Needs at least 12 bytes IV + 16 bytes auth tag = 28 bytes
    if (rawBytes.length < 28) {
      return payload;
    }

    const key = await getCryptoKey(secret);
    const iv = new Uint8Array(rawBytes.subarray(0, 12));
    const ciphertext = new Uint8Array(rawBytes.subarray(12));

    const decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const str = decoder.decode(decryptedBuf);
    try {
      return JSON.parse(str) as T;
    } catch {
      return str as unknown as T;
    }
  } catch (err) {
    // If decryption fails (e.g. payload wasn't encrypted), fallback to raw if valid
    console.warn('Payload decryption warning, returning raw:', err);
    return payload;
  }
}

export interface SecureFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

export interface SecureFetchOptions extends Omit<RequestInit, 'body'> {
  accessToken?: string;
  encryptBody?: boolean;
  secret?: string;
  body?: any;
}

/**
 * Wrapper around standard fetch that automatically encrypts request bodies
 * and decrypts response payloads.
 */
export async function secureFetch<T = any>(
  url: string,
  options?: SecureFetchOptions
): Promise<SecureFetchResult<T>> {
  const headers = new Headers(options?.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options?.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  let finalBody: BodyInit | null | undefined = options?.body;

  // If request has a body and encryptBody is not explicitly false, encrypt it
  if (options?.body && options?.encryptBody !== false) {
    let parsed: any = options.body;
    if (typeof options.body === 'string') {
      try {
        parsed = JSON.parse(options.body);
      } catch {
        parsed = options.body;
      }
    }
    const encryptedStr = await encryptPayload(parsed, options?.secret);
    finalBody = JSON.stringify({
      _encrypted: true,
      payload: encryptedStr,
    });
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      body: finalBody,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      return {
        ok: res.ok,
        status: res.status,
        data: null as any,
        error: `HTTP ${res.status}: Failed to parse JSON response`,
      };
    }

    if (json && (json._encrypted || json.payload)) {
      const decrypted = await decryptPayload<T>(json, options?.secret);
      const isOk = res.ok && !(decrypted && typeof decrypted === 'object' && (decrypted as any).error && !res.ok);
      return {
        ok: isOk,
        status: res.status,
        data: decrypted,
        error: isOk ? undefined : (decrypted as any)?.error || `HTTP error ${res.status}`,
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data: json as T,
      error: res.ok ? undefined : json?.error || `HTTP error ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null as any,
      error: err?.message || 'Network request failed',
    };
  }
}
