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

export const loadMarkets = (path: string): Market[] => {
  if (!fs.existsSync(path)) return []

  const raw = fs.readFileSync(path, 'utf-8')
  const definitions: (MarketDefinition & Partial<Market>)[] = JSON.parse(raw)

  return definitions.map((d) => ({
    ...d,
    mint: d.mint ?? null,
    status: d.status ?? 'pending',
    outcome: d.outcome ?? 'unresolved',
    createdAt: d.createdAt ?? null,
    resolvedAt: d.resolvedAt ?? null,
  }))
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
  const createResult = await buildCreateTokenTransaction(connection, {
    creator: agentKeypair.publicKey.toBase58(),
    name: market.name,
    symbol: market.symbol,
    metadata_uri: market.metadataUri,
  })

  createResult.transaction.sign(agentKeypair)
  const createSig = await connection.sendRawTransaction(createResult.transaction.serialize())
  await confirmTransaction(connection, createSig, agentKeypair.publicKey.toBase58())

  const mintAddress = createResult.mint.toBase58()

  // seed liquidity via vault buy
  if (market.initialLiquidityLamports > 0) {
    const buyResult = await buildBuyTransaction(connection, {
      mint: mintAddress,
      buyer: agentKeypair.publicKey.toBase58(),
      amount_sol: market.initialLiquidityLamports,
      slippage_bps: 500,
      vault: vaultCreator,
    })

    buyResult.transaction.sign(agentKeypair)
    const buySig = await connection.sendRawTransaction(buyResult.transaction.serialize())
    await confirmTransaction(connection, buySig, agentKeypair.publicKey.toBase58())
  }

  return mintAddress
}

export const snapshotMarket = async (
  connection: Connection,
  market: Market,
): Promise<MarketSnapshot | null> => {
  if (!market.mint) return null

  const token = await getToken(connection, market.mint)
  const { holders: holdersList } = await getHolders(connection, market.mint)

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
