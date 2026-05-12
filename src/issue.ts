import { z } from 'zod';
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  TimeoutInfinite,
  xdr,
} from '@stellar/stellar-sdk';
import type { Keypair } from '@stellar/stellar-sdk';
import type { Certificate, ZKProof, ContentType } from './types.js';
import { HumonicsError } from './errors.js';
import { wrapStellarError, CONTRACTS, NETWORK_PASSPHRASE } from './stellar.js';
import type { Network } from './stellar.js';

const IssueInputSchema = z.object({
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  zkProof: z.object({
    pi_a: z.array(z.string()),
    pi_b: z.array(z.array(z.string())),
    pi_c: z.array(z.string()),
    protocol: z.string(),
    curve: z.string(),
  }),
  did: z.string().startsWith('did:stellar:'),
  contentType: z.enum(['text', 'code', 'art', 'audio', 'video']),
});

/** Validates the zkProof structure locally before hitting the contract. */
function validateProofLocally(proof: ZKProof): void {
  if (!proof.pi_a.length || !proof.pi_b.length || !proof.pi_c.length) {
    throw new HumonicsError('INVALID_PROOF', 'zkProof is missing required fields');
  }
  if (proof.protocol !== 'groth16') {
    throw new HumonicsError('INVALID_PROOF', `Unsupported proof protocol: ${proof.protocol}`);
  }
}

export async function issue(
  rpc: SorobanRpc.Server,
  network: Network,
  input: {
    contentHash: string;
    zkProof: ZKProof;
    did: string;
    contentType: ContentType;
    keypair: Keypair;
  },
  debug?: (msg: string) => void,
  contractId?: string,
): Promise<Certificate> {
  const parsed = IssueInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new HumonicsError('INVALID_INPUT', `Invalid issue input: ${parsed.error.message}`);
  }

  validateProofLocally(input.zkProof);

  const resolvedContractId = contractId ?? CONTRACTS[network].certificateRegistry;
  const contract = new Contract(resolvedContractId);

  debug?.(`issue: submitting to contract ${resolvedContractId}`);

  try {
    // Fetch account for sequence number
    const account = await rpc.getAccount(input.keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE[network],
    })
      .addOperation(
        contract.call(
          'issue_certificate',
          xdr.ScVal.scvString(input.contentHash),
          xdr.ScVal.scvString(input.did),
          xdr.ScVal.scvString(input.contentType),
          // zkProof serialised as JSON string — contract deserialises on-chain
          xdr.ScVal.scvString(JSON.stringify(input.zkProof)),
        ),
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const simResult = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new HumonicsError('CONTRACT_ERROR', simResult.error);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(input.keypair);

    const sendResult = await rpc.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new HumonicsError('CONTRACT_ERROR', `Transaction failed: ${sendResult.errorResult}`);
    }

    // Poll for confirmation
    let getResult = await rpc.getTransaction(sendResult.hash);
    while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      await new Promise((r) => setTimeout(r, 1000));
      getResult = await rpc.getTransaction(sendResult.hash);
    }

    if (getResult.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      throw new HumonicsError('CONTRACT_ERROR', `Transaction not successful: ${getResult.status}`);
    }

    const retval = getResult.returnValue;
    if (!retval) throw new HumonicsError('CONTRACT_ERROR', 'No return value from contract');

    const native = retval as unknown as Record<string, unknown>;
    return {
      id: String(native['id']),
      contentHash: input.contentHash,
      did: input.did,
      contentType: input.contentType,
      issuedAt: Number(native['issued_at']),
      txHash: sendResult.hash,
      revoked: false,
    };
  } catch (err) {
    if (err instanceof HumonicsError) throw err;
    throw wrapStellarError(err, 'issue');
  }
}

export async function revoke(
  rpc: SorobanRpc.Server,
  network: Network,
  certId: string,
  keypair: Keypair,
  debug?: (msg: string) => void,
  contractId?: string,
): Promise<void> {
  if (!certId) {
    throw new HumonicsError('INVALID_INPUT', 'certId is required');
  }

  const resolvedContractId = contractId ?? CONTRACTS[network].certificateRegistry;
  const contract = new Contract(resolvedContractId);

  debug?.(`revoke: revoking cert ${certId}`);

  try {
    const account = await rpc.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE[network],
    })
      .addOperation(contract.call('revoke_certificate', xdr.ScVal.scvString(certId)))
      .setTimeout(TimeoutInfinite)
      .build();

    const simResult = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new HumonicsError('CONTRACT_ERROR', simResult.error);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    preparedTx.sign(keypair);

    const sendResult = await rpc.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new HumonicsError('CONTRACT_ERROR', `Revoke failed: ${sendResult.errorResult}`);
    }
  } catch (err) {
    if (err instanceof HumonicsError) throw err;
    throw wrapStellarError(err, 'revoke');
  }
}
