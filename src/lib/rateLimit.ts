import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { DatabaseError, getDb } from '@/lib/db'
import { getEnv } from '@/lib/env'

// Protects the Riot API key. Every action that calls Riot first reserves an
// estimated number of requests through the reserve_riot_budget database
// function, which enforces two limits atomically:
//   - a site-wide budget that stays under the personal key's 100 requests per
//     2 minutes, so the key never gets rate limited by Riot
//   - a per-visitor limit on expensive actions, so one person cannot use up
//     the budget for everyone
// Visitors are identified by a salted hash of their IP address; the IP itself
// is never stored.

export type BudgetAction = 'lookup' | 'refresh' | 'load_more' | 'live' | 'timelines'

interface ActionRule {
  visitorLimit: number // per visitorWindowSeconds; 0 = no per-visitor limit
  visitorWindowSeconds: number
}

const rules: Record<BudgetAction, ActionRule> = {
  lookup: { visitorLimit: 6, visitorWindowSeconds: 600 },
  refresh: { visitorLimit: 10, visitorWindowSeconds: 600 },
  load_more: { visitorLimit: 6, visitorWindowSeconds: 600 },
  live: { visitorLimit: 20, visitorWindowSeconds: 600 },
  timelines: { visitorLimit: 0, visitorWindowSeconds: 600 },
}

// Personal keys allow 100 requests per 2 minutes. Keep some headroom.
const globalLimit = 90
const globalWindowSeconds = 120

// Estimated Riot requests per action.
export const riotCosts = {
  lookup: 25, // account, summoner, league, mastery, match IDs, up to 20 matches
  refresh: 12, // account, summoner, league, mastery, match IDs, a few new matches
  loadMore: 21, // match IDs plus up to 20 older matches
  live: 1,
} as const

export type BudgetResult =
  | { allowed: true }
  | { allowed: false; reason: 'visitor' | 'global'; retryAfterSeconds: number }

export class BudgetExceededError extends Error {
  readonly reason: 'visitor' | 'global'
  readonly retryAfterSeconds: number

  constructor(reason: 'visitor' | 'global', retryAfterSeconds: number) {
    super(reason === 'visitor' ? 'Visitor limit reached' : 'Site-wide Riot budget reached')
    this.name = 'BudgetExceededError'
    this.reason = reason
    this.retryAfterSeconds = retryAfterSeconds
  }
}

async function visitorHash(): Promise<string> {
  const requestHeaders = await headers()
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown'
  // Salted with a server secret so the stored hash cannot be reversed to an IP.
  const salt = getEnv().SUPABASE_SECRET_KEY
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/** Reserves Riot API budget for an action. Returns whether it may proceed. */
export async function reserveBudget(action: BudgetAction, cost: number): Promise<BudgetResult> {
  const rule = rules[action]
  // Background work has no per-visitor limit, so it does not read request
  // headers (which are unavailable inside after() in server components).
  const ipHash = rule.visitorLimit > 0 ? await visitorHash() : 'background'
  const { data, error } = await getDb().rpc('reserve_riot_budget', {
    p_ip_hash: ipHash,
    p_action: action,
    p_cost: cost,
    p_ip_limit: rule.visitorLimit,
    p_ip_window: rule.visitorWindowSeconds,
    p_global_limit: globalLimit,
    p_global_window: globalWindowSeconds,
  })
  if (error) throw new DatabaseError('check the Riot API budget', error)

  const result = data as { allowed: boolean; reason?: 'visitor' | 'global'; retry_after?: number }
  if (result.allowed) return { allowed: true }
  return { allowed: false, reason: result.reason ?? 'global', retryAfterSeconds: result.retry_after ?? 60 }
}

/** Like reserveBudget, but throws BudgetExceededError when the action is not allowed. */
export async function requireBudget(action: BudgetAction, cost: number): Promise<void> {
  const result = await reserveBudget(action, cost)
  if (!result.allowed) throw new BudgetExceededError(result.reason, result.retryAfterSeconds)
}

export function describeBudgetError(error: BudgetExceededError): string {
  const wait = formatWait(error.retryAfterSeconds)
  return error.reason === 'visitor'
    ? `You've made a lot of requests in a short time. Try again in ${wait}.`
    : `The site is busy right now. Try again in ${wait}.`
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}
