// Shared Humonics types — consumed by SDK, oracle-service, and zk-circuits.
// This package is a workspace dependency; types are defined here until
// @humonics/types is published.

export type ContentType = 'text' | 'code' | 'art' | 'audio' | 'video';

export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export interface Certificate {
  id: string;
  contentHash: string;
  did: string;
  contentType: ContentType;
  issuedAt: number;       // Unix timestamp
  txHash: string;         // Stellar transaction hash
  revoked: boolean;
}

export interface VerificationResult {
  certified: boolean;
  certificate?: Certificate;  // Present when certified = true
  revoked?: boolean;          // Present when certified = true but revoked
}
