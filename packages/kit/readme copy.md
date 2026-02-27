# torch-prediction-market-kit

autonomous vault-based prediction market bot for Torch Market on Solana. built on [torchsdk](https://www.npmjs.com/package/torchsdk) v3.7.22.

each prediction market is a Torch token — the bonding curve provides price discovery, the treasury accumulates value from trading fees, and the vault manages the bot's positions. the agent keypair is generated in-process (disposable, holds nothing of value). all SOL routes through the vault.

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

or via npm:

```bash
npm install torch-prediction-market-kit@2.0.0
VAULT_CREATOR=<pubkey> SOLANA_RPC_URL=<rpc> npx torch-prediction-market-bot
```

## env vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_RPC_URL` | yes | — | Solana RPC endpoint (fallback: `RPC_URL`) |
| `VAULT_CREATOR` | yes | — | Vault creator pubkey |
| `SOLANA_PRIVATE_KEY` | no | — | Disposable controller keypair (base58 or byte array). If omitted, generates fresh keypair on startup (recommended) |
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

## dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@solana/web3.js` | 1.98.4 | Solana RPC, keypair, transaction |
| `torchsdk` | 3.7.22 | Token queries, token creation, buy builder, vault queries |

## testing

requires [Surfpool](https://github.com/txtx/surfpool) running a mainnet fork:

```bash
surfpool start --network mainnet --no-tui
pnpm test
```

## links

- [torch market](https://torch.market)
- [torchsdk (npm)](https://www.npmjs.com/package/torchsdk)
- [torchsdk (source)](https://github.com/mrsirg97-rgb/torchsdk)
- [clawhub skill](https://clawhub.ai/mrsirg97-rgb/torch-prediction-market-kit)
- program id: `8hbUkonssSEEtkqzwM7ZcZrD9evacM92TcWSooVF4BeT`

## license

MIT
