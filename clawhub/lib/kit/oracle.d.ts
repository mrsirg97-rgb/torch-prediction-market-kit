/**
 * oracle.ts — resolution logic for prediction markets.
 *
 * price_feed: fetches current price from CoinGecko public API.
 * manual: returns 'unresolved' (resolved by editing markets.json directly).
 */
import type { Oracle, PriceFeedOracle, Outcome } from './types';
export declare const checkPriceFeed: (oracle: PriceFeedOracle) => Promise<Outcome>;
export declare const checkOracle: (oracle: Oracle) => Promise<Outcome>;
//# sourceMappingURL=oracle.d.ts.map