import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.PISGAH_SESSION_SECRET;
  if (!secret) {
    throw new Error("PISGAH_SESSION_SECRET is required for encryption");
  }
  return Buffer.from(secret, "hex").subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(":");
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encHex, tagHex] = ciphertext.split(":");
  if (!ivHex || !encHex || !tagHex) {
    throw new Error("Invalid encrypted format");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(encHex, "hex", "utf8") + decipher.final("utf8");
}
