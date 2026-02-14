/**
 * types.ts — interfaces for the vault-based prediction market bot.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type MarketStatus = 'pending' | 'active' | 'resolved' | 'cancelled'
export type Outcome = 'yes' | 'no' | 'unresolved'
export type OracleType = 'price_feed' | 'manual'

export interface PriceFeedOracle {
  type: 'price_feed'
  asset: string // coingecko id, e.g. 'solana', 'bitcoin'
  condition: 'above' | 'below'
  target: number // USD price target
}

export interface ManualOracle {
  type: 'manual'
  source: string // description of resolution source
}

export type Oracle = PriceFeedOracle | ManualOracle

export interface MarketDefinition {
  id: string
  question: string
  symbol: string // max 10 chars
  name: string // max 32 chars
  oracle: Oracle
  deadline: number // unix timestamp
  initialLiquidityLamports: number // SOL to seed bonding curve (in lamports)
  metadataUri: string // token metadata URI
}

export interface Market extends MarketDefinition {
  mint: string | null // torch token mint address (set after creation)
  status: MarketStatus
  outcome: Outcome
  createdAt: number | null // unix timestamp
  resolvedAt: number | null
}

export interface MarketSnapshot {
  marketId: string
  mint: string
  price: number // token price in SOL
  marketCap: number // in lamports
  volume: number // in lamports
  treasuryBalance: number // in lamports
  holders: number
  timestamp: number
}

export interface BotConfig {
  rpcUrl: string
  vaultCreator: string
  privateKey: string | null
  scanIntervalMs: number
  logLevel: LogLevel
  marketsPath: string
}
