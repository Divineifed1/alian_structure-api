# Multi-Wallet Management API

This document describes the new multi-wallet support and APIs.

Features:
- Link up to `WALLETS_PER_ACCOUNT` wallets per user (default 10)
- Any linked wallet can authenticate (signature-based)
- Wallet permission model (delegated wallets with permissions)
- Primary wallet designation for on-chain transactions
- Ability to unlink wallets
- Email notifications when a new wallet is linked
- Audit logs (provenance) for all wallet linking and authentication events

Endpoints (Auth Controller):

- POST /auth/challenge
  - Request a signature challenge for a wallet address
  - Body: { address }

- POST /auth/verify
  - Verify signature and issue JWT
  - Body: { message, signature }

- POST /auth/link-wallet (Authenticated)
  - Link a new wallet to the current user
  - Body: { walletAddress, message, signature, walletName?, permissions? }
  - `permissions` is an optional string array (e.g. ["authenticate", "read_data"]).

- POST /auth/unlink-wallet (Authenticated)
  - Unlink a wallet by id
  - Body: { walletId }

- GET /auth/wallets (Authenticated)
  - List all wallets for the current user

- GET /auth/wallets/:walletId (Authenticated)
  - Get wallet details

- POST /auth/wallets/:walletId/set-primary (Authenticated)
  - Set a wallet as primary for on-chain operations

Notes:
- The per-account wallet limit is controlled by environment variable `WALLETS_PER_ACCOUNT` (default 10).
- Delegated wallets require explicit permissions; authentication requires `authenticate` permission.
- Audit records are created via the Provenance service under the `wallet-service` and `wallet-auth` agent IDs.

Database changes:
- `wallets` table exists (see `src/core/auth/entities/wallet.entity.ts`) and is used to map multiple wallets to `users`.

If you'd like, I can add OpenAPI documentation examples or update existing API docs to include these endpoints.
