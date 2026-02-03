/**
 * Test that our Go scrypt implementation matches Better Auth's JavaScript implementation
 * 
 * This script:
 * 1. Generates a password hash using Better Auth's method (TypeScript)
 * 2. Verifies it using Better Auth's verifyPassword
 * 3. Prints the hash format so we can manually test with Go
 */

import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const config = { N: 16384, r: 16, p: 1, dkLen: 64 };

async function generateKey(password: string, salt: string): Promise<Uint8Array> {
  // Better Auth normalizes with NFKC
  return await scryptAsync(password.normalize("NFKC"), salt, {
    N: config.N,
    p: config.p,
    r: config.r,
    dkLen: config.dkLen,
    maxmem: 128 * config.N * config.r * 2
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await generateKey(password, salt);
  return `${salt}:${bytesToHex(key)}`;
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [salt, keyHex] = hash.split(":");
  if (!salt || !keyHex) throw new Error("Invalid password hash");
  
  const key = await generateKey(password, salt);
  const keyBytes = hexToBytes(keyHex);
  
  // Constant time comparison
  if (key.length !== keyBytes.length) return false;
  let result = 0;
  for (let i = 0; i < key.length; i++) {
    result |= key[i] ^ keyBytes[i];
  }
  return result === 0;
}

async function main() {
  const testPassword = "TestPass123!";
  
  console.log("\n=== Better Auth Scrypt Implementation Test ===\n");
  console.log(`Test password: "${testPassword}"\n`);
  
  // Generate hash
  const hash = await hashPassword(testPassword);
  console.log("Generated hash:");
  console.log(`  Full hash: ${hash}`);
  console.log(`  Length: ${hash.length} characters`);
  
  const [salt, key] = hash.split(":");
  console.log(`\nHash components:`);
  console.log(`  Salt (hex): ${salt}`);
  console.log(`  Salt length: ${salt.length} characters (${salt.length / 2} bytes)`);
  console.log(`  Key (hex): ${key}`);
  console.log(`  Key length: ${key.length} characters (${key.length / 2} bytes)`);
  
  console.log(`\nExpected:`);
  console.log(`  Salt: 32 hex chars (16 bytes)`);
  console.log(`  Key: 128 hex chars (64 bytes)`);
  console.log(`  Total: 161 chars (32 + ':' + 128)`);
  console.log(`  Match: ${hash.length === 161 ? '✅ YES' : '❌ NO'}`);
  
  // Verify the hash works
  console.log(`\n=== Verification Test ===`);
  const isValid = await verifyPassword(hash, testPassword);
  console.log(`Password "${testPassword}" verification: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
  
  const wrongPassword = "WrongPass123!";
  const isInvalid = await verifyPassword(hash, wrongPassword);
  console.log(`Password "${wrongPassword}" verification: ${isInvalid ? '❌ Should be invalid!' : '✅ INVALID (correct)'}`);
  
  console.log(`\n=== Go Implementation Test ===`);
  console.log(`To test the Go implementation:`);
  console.log(`1. Use the same test password: "${testPassword}"`);
  console.log(`2. The generated hash should have format: <32-char-salt>:<128-char-key>`);
  console.log(`3. Both implementations should verify each other's hashes`);
  console.log(`\nExample Go test (pseudo-code):`);
  console.log(`  hash := hashPasswordScrypt("${testPassword}")`);
  console.log(`  // hash should be 161 characters with format salt:key`);
  console.log(`  fmt.Println("Hash length:", len(hash)) // Should be 161`);
}

main().catch(console.error);
