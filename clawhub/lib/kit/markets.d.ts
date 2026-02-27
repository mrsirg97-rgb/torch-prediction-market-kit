/**
 * markets.ts — market CRUD, lifecycle, and on-chain operations.
 *
 * file-based state: markets.json is the source of truth.
 * each prediction market = a torch token on the bonding curve.
 */
import { Connection, Keypair } from '@solana/web3.js';
import type { Market, MarketSnapshot, Outcome } from './types';
export declare const loadMarkets: (path: string) => Market[];
export declare const saveMarkets: (path: string, markets: Market[]) => void;
export declare const createMarket: (connection: Connection, market: Market, agentKeypair: Keypair, vaultCreator: string) => Promise<string>;
export declare const snapshotMarket: (connection: Connection, market: Market) => Promise<MarketSnapshot | null>;
export declare const resolveMarket: (market: Market) => Promise<Outcome>;
//# sourceMappingURL=markets.d.ts.map