#!/usr/bin/env node
/**
 * torch-prediction-market-bot — vault-based prediction market bot.
 *
 * generates an agent keypair in-process (or uses SOLANA_PRIVATE_KEY if provided).
 * all operations route through a torch vault identified by VAULT_CREATOR.
 *
 * usage:
 *   VAULT_CREATOR=<pubkey> SOLANA_RPC_URL=<rpc> npx tsx src/index.ts
 *
 * env:
 *   SOLANA_RPC_URL    — solana RPC endpoint (required, fallback: RPC_URL)
 *   VAULT_CREATOR     — vault creator pubkey (required)
 *   SOLANA_PRIVATE_KEY — disposable controller keypair, base58 (optional)
 *   SCAN_INTERVAL_MS  — ms between scan cycles (default 60000, min 5000)
 *   LOG_LEVEL         — debug | info | warn | error (default info)
 *   MARKETS_PATH      — path to markets JSON file (default ./markets.json)
 */
export { withTimeout } from './utils';
//# sourceMappingURL=index.d.ts.map