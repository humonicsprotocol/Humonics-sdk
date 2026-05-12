import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SorobanRpc } from '@stellar/stellar-sdk';
import { Account, Keypair } from '@stellar/stellar-sdk';
import { verify, batchVerify } from '../src/verify.js';
import { HumonicsError } from '../src/errors.js';
import {
  MOCK_CERT,
  MOCK_REVOKED_CERT,
  mockSimSuccess,
  mockSimNotFound,
  mockSimError,
} from './mocks/stellar.js';

const TEST_CONTRACT = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526';
const SIM_ACCOUNT = new Account(Keypair.random().publicKey(), '0');

function makeRpc(simResult: SorobanRpc.Api.SimulateTransactionResponse): SorobanRpc.Server {
  return {
    getAccount: vi.fn().mockResolvedValue(SIM_ACCOUNT),
    simulateTransaction: vi.fn().mockResolvedValue(simResult),
  } as unknown as SorobanRpc.Server;
}

describe('verify()', () => {
  it('returns certified=true for known content', async () => {
    const rpc = makeRpc(mockSimSuccess(MOCK_CERT));
    const result = await verify(rpc, 'testnet', 'a'.repeat(64), undefined, TEST_CONTRACT);
    expect(result.certified).toBe(true);
    expect(result.certificate?.id).toBe('cert_abc123');
    expect(result.revoked).toBeUndefined();
  });

  it('returns certified=false for unknown content — never throws', async () => {
    const rpc = makeRpc(mockSimNotFound());
    const result = await verify(rpc, 'testnet', 'a'.repeat(64), undefined, TEST_CONTRACT);
    expect(result.certified).toBe(false);
    expect(result.certificate).toBeUndefined();
  });

  it('returns certified=true, revoked=true for a revoked certificate', async () => {
    const rpc = makeRpc(mockSimSuccess(MOCK_REVOKED_CERT));
    const result = await verify(rpc, 'testnet', 'b'.repeat(64), undefined, TEST_CONTRACT);
    expect(result.certified).toBe(true);
    expect(result.revoked).toBe(true);
  });

  it('throws HumonicsError(NETWORK_ERROR) on network failure', async () => {
    const rpc = {
      getAccount: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      simulateTransaction: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as SorobanRpc.Server;

    await expect(verify(rpc, 'testnet', 'a'.repeat(64), undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('throws HumonicsError(CONTRACT_ERROR) on contract error', async () => {
    const rpc = makeRpc(mockSimError('some_contract_error'));
    await expect(verify(rpc, 'testnet', 'a'.repeat(64), undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'CONTRACT_ERROR',
    });
  });

  it('throws HumonicsError(INVALID_INPUT) for a bad contentHash', async () => {
    const rpc = makeRpc(mockSimNotFound());
    await expect(verify(rpc, 'testnet', 'not-a-hash', undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
});

describe('batchVerify()', () => {
  it('returns results for all hashes', async () => {
    const rpc = {
      getAccount: vi.fn().mockResolvedValue(SIM_ACCOUNT),
      simulateTransaction: vi.fn().mockResolvedValue(mockSimNotFound()),
    } as unknown as SorobanRpc.Server;

    const results = await batchVerify(rpc, 'testnet', ['a'.repeat(64), 'b'.repeat(64)], undefined, TEST_CONTRACT);
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.certified)).toBe(true);
  });

  it('returns empty array for empty input', async () => {
    const rpc = makeRpc(mockSimNotFound());
    const results = await batchVerify(rpc, 'testnet', [], undefined, TEST_CONTRACT);
    expect(results).toEqual([]);
  });

  it('throws INVALID_INPUT for invalid hash in batch', async () => {
    const rpc = makeRpc(mockSimNotFound());
    await expect(batchVerify(rpc, 'testnet', ['bad'], undefined, TEST_CONTRACT)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
  });
});
