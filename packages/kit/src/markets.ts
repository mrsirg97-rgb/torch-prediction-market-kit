/**
 * markets.ts — market CRUD, lifecycle, and on-chain operations.
 *
 * file-based state: markets.json is the source of truth.
 * each prediction market = a torch token on the bonding curve.
 */

import * as fs from 'fs'
import { Connection, Keypair } from '@solana/web3.js'
import {
  getToken,
  getHolders,
  buildCreateTokenTransaction,
  buildBuyTransaction,
  confirmTransaction,
} from 'torchsdk'
import type { MarketDefinition, Market, MarketSnapshot, Outcome } from './types'
import { checkOracle } from './oracle'
import { withTimeout } from './utils'

const SDK_TIMEOUT_MS = 30_000

export const loadMarkets = (path: string): Market[] => {
  if (!fs.existsSync(path)) return []

  const raw = fs.readFileSync(path, 'utf-8')
  const definitions: (MarketDefinition & Partial<Market>)[] = JSON.parse(raw)

  const markets = definitions.map((d) => ({
    ...d,
    mint: d.mint ?? null,
    status: d.status ?? 'pending',
    outcome: d.outcome ?? 'unresolved',
    createdAt: d.createdAt ?? null,
    resolvedAt: d.resolvedAt ?? null,
  }))

  const seen = new Set<string>()
  for (const m of markets) {
    if (seen.has(m.id)) {
      throw new Error(`duplicate market id: "${m.id}" in ${path}`)
    }
    seen.add(m.id)
  }

  return markets
}

export const saveMarkets = (path: string, markets: Market[]): void => {
  fs.writeFileSync(path, JSON.stringify(markets, null, 2) + '\n', 'utf-8')
}

export const createMarket = async (
  connection: Connection,
  market: Market,
  agentKeypair: Keypair,
  vaultCreator: string,
): Promise<string> => {
  // create the torch token
  const createResult = await withTimeout(
    buildCreateTokenTransaction(connection, {
      creator: agentKeypair.publicKey.toBase58(),
      name: market.name,
      symbol: market.symbol,
      metadata_uri: market.metadataUri,
    }),
    SDK_TIMEOUT_MS,
    'buildCreateTokenTransaction',
  )

  createResult.transaction.sign(agentKeypair)
  const createSig = await withTimeout(
    connection.sendRawTransaction(createResult.transaction.serialize()),
    SDK_TIMEOUT_MS,
    'sendRawTransaction(create)',
  )
  await withTimeout(
    confirmTransaction(connection, createSig, agentKeypair.publicKey.toBase58()),
    SDK_TIMEOUT_MS,
    'confirmTransaction(create)',
  )

  const mintAddress = createResult.mint.toBase58()

  // seed liquidity via vault buy
  if (market.initialLiquidityLamports > 0) {
    const buyResult = await withTimeout(
      buildBuyTransaction(connection, {
        mint: mintAddress,
        buyer: agentKeypair.publicKey.toBase58(),
        amount_sol: market.initialLiquidityLamports,
        slippage_bps: 500,
        vault: vaultCreator,
      }),
      SDK_TIMEOUT_MS,
      'buildBuyTransaction',
    )

    buyResult.transaction.sign(agentKeypair)
    const buySig = await withTimeout(
      connection.sendRawTransaction(buyResult.transaction.serialize()),
      SDK_TIMEOUT_MS,
      'sendRawTransaction(buy)',
    )
    await withTimeout(
      confirmTransaction(connection, buySig, agentKeypair.publicKey.toBase58()),
      SDK_TIMEOUT_MS,
      'confirmTransaction(buy)',
    )
  }

  return mintAddress
}

export const snapshotMarket = async (
  connection: Connection,
  market: Market,
): Promise<MarketSnapshot | null> => {
  if (!market.mint) return null

  const token = await withTimeout(getToken(connection, market.mint), SDK_TIMEOUT_MS, 'getToken')
  const { holders: holdersList } = await withTimeout(getHolders(connection, market.mint), SDK_TIMEOUT_MS, 'getHolders')

  return {
    marketId: market.id,
    mint: market.mint,
    price: token.price_sol,
    marketCap: token.market_cap_sol,
    volume: token.sol_raised ?? 0,
    treasuryBalance: token.treasury_sol_balance ?? 0,
    holders: holdersList.length,
    timestamp: Date.now(),
  }
}

export const resolveMarket = async (market: Market): Promise<Outcome> => {
  return checkOracle(market.oracle)
}
