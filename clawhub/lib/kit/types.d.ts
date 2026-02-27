/**
 * types.ts — interfaces for the vault-based prediction market bot.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type MarketStatus = 'pending' | 'active' | 'resolved' | 'cancelled';
export type Outcome = 'yes' | 'no' | 'unresolved';
export type OracleType = 'price_feed' | 'manual';
export interface PriceFeedOracle {
    type: 'price_feed';
    asset: string;
    condition: 'above' | 'below';
    target: number;
}
export interface ManualOracle {
    type: 'manual';
    source: string;
}
export type Oracle = PriceFeedOracle | ManualOracle;
export interface MarketDefinition {
    id: string;
    question: string;
    symbol: string;
    name: string;
    oracle: Oracle;
    deadline: number;
    initialLiquidityLamports: number;
    metadataUri: string;
}
export interface Market extends MarketDefinition {
    mint: string | null;
    status: MarketStatus;
    outcome: Outcome;
    createdAt: number | null;
    resolvedAt: number | null;
}
export interface MarketSnapshot {
    marketId: string;
    mint: string;
    price: number;
    marketCap: number;
    volume: number;
    treasuryBalance: number;
    holders: number;
    timestamp: number;
}
export interface BotConfig {
    rpcUrl: string;
    vaultCreator: string;
    privateKey: string | null;
    scanIntervalMs: number;
    logLevel: LogLevel;
    marketsPath: string;
}
//# sourceMappingURL=types.d.ts.map