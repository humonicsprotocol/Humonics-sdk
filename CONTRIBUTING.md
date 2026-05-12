# Contributing to @humonics/sdk

## Prerequisites

- Node.js ≥ 18

No external services needed — all Soroban RPC calls are mocked in tests.

## Local setup

```bash
git clone git@github.com:humonicsprotocol/Humonics-sdk.git
cd Humonics-sdk
npm install
npm test        # all tests pass with no external services
npm run build   # compile to dist/
```

## Running against testnet

Set contract address env vars and point to a real RPC:

```bash
export VERIFICATION_GATEWAY_TESTNET=C...
export CERTIFICATE_REGISTRY_TESTNET=C...
export HUM_TOKEN_TESTNET=C...
```

Then use the SDK directly in a script with `network: 'testnet'`.

## Branch naming

| Prefix | Use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation only |

## PR checklist

- [ ] `npm test` passes
- [ ] No `any` types introduced
- [ ] All Soroban/Stellar errors wrapped in `HumonicsError` — never thrown raw
- [ ] Public API changes documented (adding params = minor version bump)
- [ ] `src/index.ts` exports only `HumonicsClient`, `HumonicsError`, `HumonicsErrorCode`

## API stability rule

The public API surface is minimal by design. **Adding a new parameter to any public method requires a minor version bump** and team sign-off. Never add optional parameters silently.

## Type discipline

- No `any` — if you don't know the type, find it in `@stellar/stellar-sdk` or define it in `src/types.ts`
- All public functions must be fully typed
