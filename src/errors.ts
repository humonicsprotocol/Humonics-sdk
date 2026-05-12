export type HumonicsErrorCode =
  | 'CONTENT_NOT_CERTIFIED'
  | 'CERTIFICATE_REVOKED'
  | 'INVALID_PROOF'
  | 'NETWORK_ERROR'
  | 'CONTRACT_ERROR'
  | 'INVALID_INPUT';

export class HumonicsError extends Error {
  constructor(
    public readonly code: HumonicsErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HumonicsError';
  }
}
