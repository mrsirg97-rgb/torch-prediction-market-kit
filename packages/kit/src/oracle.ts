/**
 * oracle.ts — resolution logic for prediction markets.
 *
 * price_feed: fetches current price from CoinGecko public API.
 * manual: returns 'unresolved' (resolved by editing markets.json directly).
 */

import type { Oracle, PriceFeedOracle, Outcome } from './types'

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price'

export const checkPriceFeed = async (oracle: PriceFeedOracle): Promise<Outcome> => {
  const url = `${COINGECKO_API}?ids=${oracle.asset}&vs_currencies=usd`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as Record<string, { usd?: number }>
  const price = data[oracle.asset]?.usd

  if (price == null) {
    throw new Error(`no price data for asset: ${oracle.asset}`)
  }

  if (oracle.condition === 'above') {
    return price > oracle.target ? 'yes' : 'no'
  }

  return price < oracle.target ? 'yes' : 'no'
}

export const checkOracle = async (oracle: Oracle): Promise<Outcome> => {
  if (oracle.type === 'price_feed') {
    return checkPriceFeed(oracle)
  }

  // manual oracle — resolved by editing markets.json directly
  return 'unresolved'
}
