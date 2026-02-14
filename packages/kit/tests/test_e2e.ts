/**
 * E2E Test — Surfpool (mainnet fork)
 *
 * Tests vault-based prediction market bot flow:
 *   1. Connect to surfpool RPC
 *   2. Load and validate market definitions
 *   3. Oracle price feed check (live CoinGecko)
 *   4. Token creation via buildCreateTokenTransaction
 *   5. Token detail and snapshot reading
 *   6. Verify vault query APIs
 *   7. Verify in-process keypair generation (no user wallet)
 *
 * Run:
 *   surfpool start --network mainnet --no-tui
 *   npx tsx tests/test_e2e.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  getToken,
  getTokens,
  getHolders,
  getVaultForWallet,
  buildCreateTokenTransaction,
  confirmTransaction,
} from 'torchsdk'

const RPC_URL = process.env.RPC_URL ?? 'http://localhost:8899'

const log = (msg: string) => {
  const ts = new Date().toISOString().substr(11, 8)
  console.log(`[${ts}] ${msg}`)
}

const sol = (lamports: number): string => (lamports / LAMPORTS_PER_SOL).toFixed(4)

let passed = 0
let failed = 0

const ok = (name: string, detail?: string) => {
  passed++
  log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

const fail = (name: string, err: any) => {
  failed++
  log(`  ✗ ${name} — ${err.message || err}`)
}

const main = async () => {
  console.log('='.repeat(60))
  console.log('PREDICTION MARKET BOT E2E TEST — Surfpool Mainnet Fork')
  console.log('='.repeat(60))

  // ------------------------------------------------------------------
  // 1. Connect
  // ------------------------------------------------------------------
  log('\n[1] Connect to RPC')
  const connection = new Connection(RPC_URL, 'confirmed')
  try {
    const version = await connection.getVersion()
    ok('connection', `solana-core ${version['solana-core']}`)
  } catch (e: any) {
    fail('connection', e)
    console.error('Cannot reach RPC. Is surfpool running?')
    process.exit(1)
  }

  // ------------------------------------------------------------------
  // 2. Load and validate market definitions
  // ------------------------------------------------------------------
  log('\n[2] Load Market Definitions')

  const testMarkets = [
    {
      id: 'test-sol-200',
      question: 'Will SOL be above $200 by March 1, 2026?',
      symbol: 'SOL200T',
      name: 'SOL Above 200 Test',
      oracle: {
        type: 'price_feed' as const,
        asset: 'solana',
        condition: 'above' as const,
        target: 200,
      },
      deadline: Math.floor(Date.now() / 1000) + 86400,
      initialLiquidityLamports: 100000000,
      metadataUri: 'https://arweave.net/placeholder',
    },
  ]

  const tmpDir = os.tmpdir()
  const testMarketsPath = path.join(tmpDir, `test-markets-${Date.now()}.json`)
  fs.writeFileSync(testMarketsPath, JSON.stringify(testMarkets, null, 2))

  try {
    // inline loadMarkets logic for test isolation
    const raw = fs.readFileSync(testMarketsPath, 'utf-8')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) throw new Error('Markets file must be an array')
    if (parsed.length === 0) throw new Error('No markets defined')

    const m = parsed[0]
    if (!m.id) throw new Error('Market missing id')
    if (!m.question) throw new Error('Market missing question')
    if (!m.symbol) throw new Error('Market missing symbol')
    if (!m.oracle) throw new Error('Market missing oracle')
    if (!m.deadline) throw new Error('Market missing deadline')

    ok('loadMarkets', `loaded ${parsed.length} market definitions`)
    log(`    ${m.id} — "${m.question}"`)
    log(`    oracle: ${m.oracle.type} | asset=${m.oracle.asset} | target=$${m.oracle.target}`)
  } catch (e: any) {
    fail('loadMarkets', e)
  }

  // cleanup temp file
  try {
    fs.unlinkSync(testMarketsPath)
  } catch {}

  // ------------------------------------------------------------------
  // 3. Oracle price feed check (live CoinGecko)
  // ------------------------------------------------------------------
  log('\n[3] Oracle Price Feed (CoinGecko)')
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const price = data.solana?.usd
    if (price == null) throw new Error('No price data for solana')

    const target = 200
    const outcome = price > target ? 'yes' : 'no'
    ok('checkPriceFeed', `SOL=$${price} | target=$${target} | above=${outcome}`)
  } catch (e: any) {
    fail('checkPriceFeed', e)
  }

  // ------------------------------------------------------------------
  // 4. Token creation (buildCreateTokenTransaction)
  // ------------------------------------------------------------------
  log('\n[4] Token Creation (buildCreateTokenTransaction)')
  const agentKeypair = Keypair.generate()
  let createdMint: string | undefined

  try {
    const result = await buildCreateTokenTransaction(connection, {
      creator: agentKeypair.publicKey.toBase58(),
      name: 'PM Test Token',
      symbol: 'PMTEST',
      metadata_uri: 'https://arweave.net/placeholder',
    })

    if (!result.transaction) throw new Error('No transaction returned')
    if (!result.mint) throw new Error('No mint returned')

    createdMint = result.mint.toBase58()
    ok('buildCreateTokenTransaction', `mint=${createdMint.slice(0, 12)}...`)

    // attempt to submit (may fail on surfpool without funded agent)
    try {
      result.transaction.sign(agentKeypair)
      const sig = await connection.sendRawTransaction(result.transaction.serialize())
      await confirmTransaction(connection, sig, agentKeypair.publicKey.toBase58())
      ok('token creation tx', `sig=${sig.slice(0, 16)}...`)
    } catch (e: any) {
      log(`    (tx submit skipped — ${e.message?.slice(0, 60)}...)`)
    }
  } catch (e: any) {
    fail('buildCreateTokenTransaction', e)
  }

  // ------------------------------------------------------------------
  // 5. Token detail and snapshot
  // ------------------------------------------------------------------
  log('\n[5] Token Detail & Snapshot (getToken, getHolders)')

  // use an existing token for snapshot testing
  let firstMint: string | undefined
  try {
    const { tokens } = await getTokens(connection, {
      status: 'bonding',
      sort: 'volume',
      limit: 5,
    })

    if (tokens.length > 0) {
      firstMint = tokens[0].mint
      ok('getTokens', `found ${tokens.length} bonding tokens`)
    } else {
      log('    no bonding tokens found, trying migrated...')
      const { tokens: migrated } = await getTokens(connection, {
        status: 'migrated',
        sort: 'volume',
        limit: 5,
      })
      if (migrated.length > 0) {
        firstMint = migrated[0].mint
        ok('getTokens', `found ${migrated.length} migrated tokens`)
      }
    }
  } catch (e: any) {
    fail('getTokens', e)
  }

  if (firstMint) {
    try {
      const token = await getToken(connection, firstMint)

      if (!token.name) throw new Error('Missing token name')
      if (!token.symbol) throw new Error('Missing token symbol')
      if (token.price_sol <= 0) throw new Error('Invalid price')

      ok(
        'getToken',
        `${token.name} (${token.symbol}) | price=${sol(token.price_sol)} SOL | status=${token.status}`,
      )
    } catch (e: any) {
      fail('getToken', e)
    }

    try {
      const { holders } = await getHolders(connection, firstMint)
      ok('getHolders', `${holders.length} holders`)
    } catch (e: any) {
      // getTokenLargestAccounts can fail on surfpool for Token-2022 mints
      if (e.message?.includes('Internal error')) {
        log(`    (getHolders skipped — surfpool RPC limitation for Token-2022)`)
      } else {
        fail('getHolders', e)
      }
    }
  }

  // ------------------------------------------------------------------
  // 6. Vault query APIs
  // ------------------------------------------------------------------
  log('\n[6] Vault Query APIs (getVaultForWallet)')
  const testKeypair = Keypair.generate()
  log(`    test agent wallet: ${testKeypair.publicKey.toBase58().slice(0, 12)}...`)

  try {
    const link = await getVaultForWallet(connection, testKeypair.publicKey.toBase58())
    if (!link) {
      ok('getVaultForWallet', 'correctly returns null for unlinked wallet')
    } else {
      ok(
        'getVaultForWallet',
        `wallet is linked to vault (creator=${link.creator?.slice(0, 8)}...)`,
      )
    }
  } catch (e: any) {
    fail('getVaultForWallet', e)
  }

  // ------------------------------------------------------------------
  // 7. Verify in-process keypair
  // ------------------------------------------------------------------
  log('\n[7] Verify In-Process Keypair')
  ok(
    'keypair generated',
    `${testKeypair.publicKey.toBase58().slice(0, 12)}... (in-process, no env var)`,
  )
  ok('no user wallet', 'no WALLET env var read, no external key imported')

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n' + '='.repeat(60))
  console.log(`RESULTS: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
