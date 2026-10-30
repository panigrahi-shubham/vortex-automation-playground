import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const { loadOtp } = require('../../server/otp.cjs') as { loadOtp: () => Promise<typeof import('otplib')> };
import { Prisma } from '@prisma/client';
import { tokenHash } from './passwords';
import { WorkflowError } from '../workflows/errors';

export function mfaKey() {
  const key = Buffer.from(process.env.ORVILO_MFA_KEY || '', 'base64');
  if (key.length !== 32) throw new WorkflowError(503, 'MFA encryption is not configured');
  return key;
}
export function encryptSecret(secret: string, userId: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', mfaKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptSecret(secret: string, userId: string) {
  const bytes = Buffer.from(secret, 'base64');
  const cipher = createDecipheriv('aes-256-gcm', mfaKey(), bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(userId)); cipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
}
export const newEnrollment = async (email: string) => {
  const { generateSecret, generateURI } = await loadOtp();
  const secret = generateSecret();
  return { secret, uri: generateURI({ issuer: 'Orvilo', label: email, secret }) };
};
export async function consumeFactor(tx: Prisma.TransactionClient, userId: string, code: unknown, allowBackup = true) {
  if (typeof code !== 'string' || code.length > 32) return false;
  const credential = await tx.mfaCredential.findUnique({ where: { userId } });
  if (!credential) return false;
  if (/^\d{6}$/.test(code)) {
    const { verifySync } = await loadOtp();
    const result = verifySync({ secret: decryptSecret(credential.secret, userId), token: code, epochTolerance: 30, ...(credential.lastStep >= 0 ? { afterTimeStep: credential.lastStep } : {}) });
    if (!result.valid || !('timeStep' in result) || typeof result.timeStep !== 'number') return false;
    await tx.mfaCredential.update({ where: { userId }, data: { lastStep: result.timeStep } });
    return true;
  }
  if (allowBackup && credential.enabled && /^[a-f0-9]{24}$/.test(code)) {
    return (await tx.mfaBackupCode.deleteMany({ where: { userId, codeHash: tokenHash(code) } })).count === 1;
  }
  return false;
}


