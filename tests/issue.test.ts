import { describe, it, expect, vi } from 'vitest';
import type { SorobanRpc } from '@stellar/stellar-sdk';
import { Keypair, xdr } from '@stellar/stellar-sdk';
import { issue, revoke } from '../src/issue.js';
import { HumonicsError } from '../src/errors.js';
import type { ZKProof } from '../src/types.js';
import { mockSimError } from './mocks/stellar.js';

const VALID_PROOF: ZKProof = {
  pi_a: ['1', '2'],
  pi_b: [['1', '2'], ['3', '4']],
  pi_c: ['1', '2'],
  protocol: 'groth16',
  curve: 'bn128',
};

const VALID_INPUT = {
  contentHash: 'a'.repeat(64),
  zkProof: VALID_PROOF,
  did: 'did:stellar:GABC123',
  contentType: 'text' as const,
  keypair: Keypair.random(),
};

const TEST_CONTRACT = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526';

function makeRpc(overrides: Partial<SorobanRpc.Server> = {}): SorobanRpc.Server {
  return {
    getAccount: vi.fn().mockResolvedValue({ id: VALID_INPUT.keypair.publicKey(), sequenceNumber: () => '1', incrementSequenceNumber: vi.fn() }),
    simulateTransaction: vi.fn().mockResolvedValue({
      id: '1',
      latestLedger: 100,
      result: { retval: xdr.ScVal.scvString(JSON.stringify({ id: 'cert_new', issued_at: 1700000000 })), auth: [] },
      cost: { cpuInsns: '0', memBytes: '0' },
      stateChanges: [],
      events: [],
      minResourceFee: '100',
      transactionData: new xdr.SorobanTransactionData(),
    }),
    sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'txhash_new' }),
    getTransaction: vi.fn().mockResolvedValue({ status: 'SUCCESS', returnValue: xdr.ScVal.scvString(JSON.stringify({ id: 'cert_new', issued_at: 1700000000 })) }),
    ...overrides,
  } as unknown as SorobanRpc.Server;
}

describe('issue()', () => {
  it('throws INVALID_PROOF for unsupported proof protocol', async () => {
    const rpc = makeRpc();
    await expect(
      issue(rpc, 'testnet', { ...VALID_INPUT, zkProof: { ...VALID_PROOF, protocol: 'plonk' } }, undefined, TEST_CONTRACT),
    ).rejects.toMatchObject({ code: 'INVALID_PROOF' });
  });

  it('throws INVALID_INPUT for bad contentHash', async () => {
    const rpc = makeRpc();
    await expect(
      issue(rpc, 'testnet', { ...VALID_INPUT, contentHash: 'bad' }, undefined, TEST_CONTRACT),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('throws INVALID_INPUT for bad DID', async () => {
    const rpc = makeRpc();
    await expect(
      issue(rpc, 'testnet', { ...VALID_INPUT, did: 'not-a-did' }, undefined, TEST_CONTRACT),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('throws CONTRACT_ERROR when simulation fails', async () => {
    const rpc = makeRpc({ simulateTransaction: vi.fn().mockResolvedValue(mockSimError()) });
    await expect(issue(rpc, 'testnet', VALID_INPUT, undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'CONTRACT_ERROR',
    });
  });

  it('throws NETWORK_ERROR on network failure', async () => {
    const rpc = makeRpc({ getAccount: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
    await expect(issue(rpc, 'testnet', VALID_INPUT, undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

describe('revoke()', () => {
  it('throws INVALID_INPUT for empty certId', async () => {
    const rpc = makeRpc();
    await expect(revoke(rpc, 'testnet', '', VALID_INPUT.keypair, undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });

  it('throws CONTRACT_ERROR when simulation fails', async () => {
    const rpc = makeRpc({ simulateTransaction: vi.fn().mockResolvedValue(mockSimError()) });
    await expect(revoke(rpc, 'testnet', 'cert_abc', VALID_INPUT.keypair, undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'CONTRACT_ERROR',
    });
  });
});
