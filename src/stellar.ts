import { Networks, SorobanRpc, Horizon } from '@stellar/stellar-sdk';
import { HumonicsError } from './errors.js';

export type Network = 'mainnet' | 'testnet';

const DEFAULTS: Record<Network, { rpcUrl: string; horizonUrl: string }> = {
  mainnet: {
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    horizonUrl: 'https://horizon.stellar.org',
  },
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
};

// Contract addresses loaded from env — never hardcoded
export const CONTRACTS: Record<Network, Record<string, string>> = {
  mainnet: {
    certificateRegistry: process.env['CERTIFICATE_REGISTRY_MAINNET'] ?? '',
    verificationGateway: process.env['VERIFICATION_GATEWAY_MAINNET'] ?? '',
    humToken: process.env['HUM_TOKEN_MAINNET'] ?? '',
  },
  testnet: {
    certificateRegistry: process.env['CERTIFICATE_REGISTRY_TESTNET'] ?? 'CTESTNET_REGISTRY_PLACEHOLDER',
    verificationGateway: process.env['VERIFICATION_GATEWAY_TESTNET'] ?? 'CTESTNET_GATEWAY_PLACEHOLDER',
    humToken: process.env['HUM_TOKEN_TESTNET'] ?? 'CTESTNET_HUM_PLACEHOLDER',
  },
};

export const NETWORK_PASSPHRASE: Record<Network, string> = {
  mainnet: Networks.PUBLIC,
  testnet: Networks.TESTNET,
};

export function createRpcClient(network: Network, rpcUrl?: string): SorobanRpc.Server {
  const url = rpcUrl ?? DEFAULTS[network].rpcUrl;
  return new SorobanRpc.Server(url, { allowHttp: url.startsWith('http://') });
}

export function createHorizonClient(network: Network, horizonUrl?: string): Horizon.Server {
  const url = horizonUrl ?? DEFAULTS[network].horizonUrl;
  return new Horizon.Server(url, { allowHttp: url.startsWith('http://') });
}

/** Wraps any Stellar/Soroban error into a HumonicsError. */
export function wrapStellarError(err: unknown, context: string): HumonicsError {
  if (err instanceof HumonicsError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const isNetwork = message.includes('ECONNREFUSED') || message.includes('fetch');
  return new HumonicsError(
    isNetwork ? 'NETWORK_ERROR' : 'CONTRACT_ERROR',
    `${context}: ${message}`,
    err,
  );
}
