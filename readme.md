# torch-prediction-market-kit

autonomous vault-based prediction market bot for Torch Market on Solana.

each prediction market is a Torch token — the bonding curve provides price discovery, the treasury accumulates value from trading fees, and the vault manages the bot's positions.

## how it works

1. **create** — bot launches a torch token for a prediction question
2. **seed** — bot buys initial tokens via vault to provide starting liquidity
3. **trade** — users buy the token to bet YES (price up), sell to bet NO (price down)
4. **monitor** — bot tracks price, volume, and holders as market signals
5. **resolve** — at deadline, bot checks oracle and records outcome

## setup

```bash
pnpm install
pnpm build
```

## usage

```bash
VAULT_CREATOR=<pubkey> SOLANA_RPC_URL=<rpc> npx tsx src/index.ts
```

## env vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_RPC_URL` | yes | — | Solana RPC endpoint (fallback: `RPC_URL`) |
| `VAULT_CREATOR` | yes | — | Vault creator pubkey |
| `SOLANA_PRIVATE_KEY` | no | — | Disposable controller keypair (base58 or byte array) |
| `SCAN_INTERVAL_MS` | no | 60000 | Cycle interval in ms (min 5000) |
| `LOG_LEVEL` | no | info | debug / info / warn / error |
| `MARKETS_PATH` | no | ./markets.json | Path to market definitions |

## markets.json

```json
[
  {
    "id": "sol-200-mar",
    "question": "Will SOL be above $200 by March 1, 2026?",
    "symbol": "SOL200M",
    "name": "SOL Above 200 March",
    "oracle": {
      "type": "price_feed",
      "asset": "solana",
      "condition": "above",
      "target": 200
    },
    "deadline": 1740787200,
    "initialLiquidityLamports": 100000000,
    "metadataUri": "https://arweave.net/placeholder"
  }
]
```

## testing

```bash
surfpool start --network mainnet --no-tui
pnpm test
```
