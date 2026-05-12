import { HumonicsClient } from '@humonics/sdk';

const client = new HumonicsClient({
  network: 'testnet',
  debug: (msg) => console.log('[humonics]', msg),
});

// Single verify
const contentHash = 'a'.repeat(64); // SHA-256 hex of your content
const result = await client.verify(contentHash);

if (result.certified) {
  console.log('Content is certified:', result.certificate);
  if (result.revoked) {
    console.log('Warning: certificate has been revoked');
  }
} else {
  console.log('Content is not certified');
}

// Batch verify
const hashes = ['a'.repeat(64), 'b'.repeat(64)];
const results = await client.batchVerify(hashes);
results.forEach((r, i) => {
  console.log(`Hash ${i}: certified=${r.certified}`);
});
