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

// --- input validation allowlists ---

const ALLOWED_METADATA_DOMAINS = new Set([
  'arweave.net',
  'www.arweave.net',
  'gateway.irys.xyz',
  'ipfs.io',
  'cloudflare-ipfs.com',
  'nftstorage.link',
  'dweb.link',
])

const MAX_LIQUIDITY_LAMPORTS = 10_000_000_000 // 10 SOL

const validateMetadataUri = (uri: string, marketId: string): void => {
  let hostname: string
  try {
    hostname = new URL(uri).hostname
  } catch {
    throw new Error(`invalid metadataUri for market "${marketId}": ${uri}`)
  }
  if (!ALLOWED_METADATA_DOMAINS.has(hostname)) {
    throw new Error(
      `metadataUri domain "${hostname}" is not allowed for market "${marketId}". ` +
        `Allowed: ${[...ALLOWED_METADATA_DOMAINS].join(', ')}`,
    )
  }
}

const validateLiquidity = (lamports: number, marketId: string): void => {
  if (lamports < 0) {
    throw new Error(`initialLiquidityLamports cannot be negative for market "${marketId}"`)
  }
  if (lamports > MAX_LIQUIDITY_LAMPORTS) {
    throw new Error(
      `initialLiquidityLamports ${lamports} exceeds max ${MAX_LIQUIDITY_LAMPORTS} (10 SOL) for market "${marketId}"`,
    )
  }
}

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

    // validate inputs on pending markets (already-created markets are not re-validated)
    if (m.status === 'pending') {
      validateMetadataUri(m.metadataUri, m.id)
      validateLiquidity(m.initialLiquidityLamports, m.id)
    }
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

    // v3.7.22: if the buy completed the bonding curve, send the migration transaction
    if (buyResult.migrationTransaction) {
      buyResult.migrationTransaction.sign(agentKeypair)
      const migSig = await withTimeout(
        connection.sendRawTransaction(buyResult.migrationTransaction.serialize()),
        SDK_TIMEOUT_MS,
        'sendRawTransaction(migrate)',
      )
      await withTimeout(
        confirmTransaction(connection, migSig, agentKeypair.publicKey.toBase58()),
        SDK_TIMEOUT_MS,
        'confirmTransaction(migrate)',
      )
    }
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
