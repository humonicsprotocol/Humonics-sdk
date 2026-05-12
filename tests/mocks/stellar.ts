import type { SorobanRpc } from '@stellar/stellar-sdk';
import { xdr, scValToNative } from '@stellar/stellar-sdk';
import type { Certificate } from '../../src/types.js';

// A certified, non-revoked certificate fixture
export const MOCK_CERT: Certificate = {
  id: 'cert_abc123',
  contentHash: 'a'.repeat(64),
  did: 'did:stellar:GABC123',
  contentType: 'text',
  issuedAt: 1700000000,
  txHash: 'txhash_abc',
  revoked: false,
};

export const MOCK_REVOKED_CERT: Certificate = {
  ...MOCK_CERT,
  id: 'cert_revoked',
  contentHash: 'b'.repeat(64),
  revoked: true,
};

type SimResult = SorobanRpc.Api.SimulateTransactionResponse;

/** Returns a successful simulation result wrapping the given certificate. */
export function mockSimSuccess(cert: Certificate): SimResult {
  return {
    id: '1',
    latestLedger: 100,
    result: {
      retval: xdr.ScVal.scvString(JSON.stringify(cert)),
      auth: [],
    },
    cost: { cpuInsns: '0', memBytes: '0' },
    stateChanges: [],
    events: [],
    minResourceFee: '0',
    transactionData: new xdr.SorobanTransactionData(),
  } as unknown as SimResult;
}

/** Returns a simulation error (e.g. content not found). */
export function mockSimNotFound(): SimResult {
  return {
    id: '1',
    latestLedger: 100,
    error: 'not_certified',
  } as unknown as SimResult;
}

/** Returns a simulation error for a generic contract error. */
export function mockSimError(msg = 'contract_error'): SimResult {
  return {
    id: '1',
    latestLedger: 100,
    error: msg,
  } as unknown as SimResult;
}
