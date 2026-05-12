import type { Keypair } from '@stellar/stellar-sdk';
import type { VerificationResult, Certificate, ZKProof, ContentType } from './types.js';
import { createRpcClient, createHorizonClient } from './stellar.js';
import type { Network } from './stellar.js';
import { verify, batchVerify } from './verify.js';
import { issue, revoke } from './issue.js';

export interface HumonicsClientConfig {
  network: Network;
  rpcUrl?: string;
  horizonUrl?: string;
  /** Optional debug callback — never logs to console internally */
  debug?: (msg: string) => void;
}

export class HumonicsClient {
  private readonly network: Network;
  private readonly rpc: ReturnType<typeof createRpcClient>;
  private readonly debug?: (msg: string) => void;

  constructor(config: HumonicsClientConfig) {
    this.network = config.network;
    this.rpc = createRpcClient(config.network, config.rpcUrl);
    // horizon client available for future use (account lookups, etc.)
    createHorizonClient(config.network, config.horizonUrl);
    this.debug = config.debug;
  }

  verify(contentHash: string): Promise<VerificationResult> {
    return verify(this.rpc, this.network, contentHash, this.debug);
  }

  batchVerify(contentHashes: string[]): Promise<VerificationResult[]> {
    return batchVerify(this.rpc, this.network, contentHashes, this.debug);
  }

  issue(input: {
    contentHash: string;
    zkProof: ZKProof;
    did: string;
    contentType: ContentType;
    keypair: Keypair;
  }): Promise<Certificate> {
    return issue(this.rpc, this.network, input, this.debug);
  }

  revoke(certId: string, keypair: Keypair): Promise<void> {
    return revoke(this.rpc, this.network, certId, keypair, this.debug);
  }
}
