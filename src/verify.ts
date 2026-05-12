import { z } from 'zod';
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  TimeoutInfinite,
  Account,
  scValToNative,
  xdr,
  Keypair,
} from '@stellar/stellar-sdk';
import type { VerificationResult, Certificate } from './types.js';
import { HumonicsError } from './errors.js';
import { wrapStellarError, CONTRACTS, NETWORK_PASSPHRASE } from './stellar.js';
import type { Network } from './stellar.js';

const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Must be a SHA-256 hex string');

// Ephemeral read-only keypair for simulation — never used to sign real transactions
const SIM_KEYPAIR = Keypair.random();
// Fallback account used when RPC is unavailable (simulation only)
const SIM_ACCOUNT = new Account(SIM_KEYPAIR.publicKey(), '0');

function parseCertificate(raw: unknown): Certificate {
  // scValToNative may return a JSON string (from scvString) or a native object
  const obj: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const r = obj as Record<string, unknown>;
  return {
    id: String(r['id']),
    contentHash: String(r['content_hash'] ?? r['contentHash'] ?? ''),
    did: String(r['did'] ?? ''),
    contentType: String(r['content_type'] ?? r['contentType'] ?? 'text') as Certificate['contentType'],
    issuedAt: Number(r['issued_at'] ?? r['issuedAt'] ?? 0),
    txHash: String(r['tx_hash'] ?? r['txHash'] ?? ''),
    revoked: Boolean(r['revoked']),
  };
}

export async function verify(
  rpc: SorobanRpc.Server,
  network: Network,
  contentHash: string,
  debug?: (msg: string) => void,
  contractId?: string,
): Promise<VerificationResult> {
  const parsed = ContentHashSchema.safeParse(contentHash);
  if (!parsed.success) {
    throw new HumonicsError('INVALID_INPUT', `Invalid contentHash: ${parsed.error.message}`);
  }

  const resolvedContractId = contractId ?? CONTRACTS[network].verificationGateway;
  const contract = new Contract(resolvedContractId);

  try {
    // Build a minimal transaction for simulation (read-only, never submitted)
    const account = await rpc.getAccount(SIM_KEYPAIR.publicKey()).catch(() => SIM_ACCOUNT);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE[network],
    })
      .addOperation(contract.call('verify_content', xdr.ScVal.scvString(contentHash)))
      .setTimeout(TimeoutInfinite)
      .build();

    const result = await rpc.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(result)) {
      if (result.error.includes('NotFound') || result.error.includes('not_certified')) {
        return { certified: false };
      }
      throw new HumonicsError('CONTRACT_ERROR', result.error);
    }

    const returnVal = (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!returnVal) return { certified: false };

    const native = scValToNative(returnVal);
    const cert = parseCertificate(native);

    return cert.revoked
      ? { certified: true, certificate: cert, revoked: true }
      : { certified: true, certificate: cert };
  } catch (err) {
    if (err instanceof HumonicsError) throw err;
    throw wrapStellarError(err, 'verify');
  }
}

export async function batchVerify(
  rpc: SorobanRpc.Server,
  network: Network,
  contentHashes: string[],
  debug?: (msg: string) => void,
  contractId?: string,
): Promise<VerificationResult[]> {
  if (contentHashes.length === 0) return [];

  const schema = z.array(ContentHashSchema).min(1).max(100);
  const parsed = schema.safeParse(contentHashes);
  if (!parsed.success) {
    throw new HumonicsError('INVALID_INPUT', `Invalid contentHashes: ${parsed.error.message}`);
  }

  debug?.(`batchVerify: ${contentHashes.length} hashes`);

  return Promise.all(contentHashes.map((h) => verify(rpc, network, h, debug, contractId)));
}
