import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {AiError} from './providers.js';

function masterKey(secret) {
  const bytes = Buffer.from(secret || '', 'base64');
  if (bytes.length !== 32) throw new AiError('failed-precondition', 'The server needs a 32-byte AI encryption secret.');
  return bytes;
}

export function sealKey(key, secret, uid, provider) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(secret), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([uid, provider])));
  const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  return {iv: iv.toString('base64'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64')};
}

export function openKey(record, secret, uid, provider) {
  const master = masterKey(secret);
  try {
    const decipher = createDecipheriv('aes-256-gcm', master, Buffer.from(record.iv, 'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify([uid, provider])));
    decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new AiError('failed-precondition', 'The saved credential could not be opened. Re-enter the provider key in AI settings.');
  }
}
