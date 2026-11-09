// Turns a rank into one number so LP history can be drawn on a single axis:
// Iron IV 0 LP is 0, each division is worth 100, and Master, Grandmaster and
// Challenger share one LP scale starting at 2,800 (where Diamond I ends).

const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const
const apexTiers = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
const divisions = ['IV', 'III', 'II', 'I'] as const
export const apexBase = tiers.length * 400

export function ladderValue(tier: string, division: string | null, lp: number): number {
  if (apexTiers.includes(tier)) return apexBase + lp
  const tierIndex = tiers.indexOf(tier as (typeof tiers)[number])
  const divisionIndex = divisions.indexOf((division ?? 'IV') as (typeof divisions)[number])
  if (tierIndex < 0 || divisionIndex < 0) return 0
  return tierIndex * 400 + divisionIndex * 100 + Math.min(lp, 100)
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

/** The division that starts at a ladder value, for axis labels: 1300 -> "Gold IV". */
export function ladderLabel(value: number): string {
  if (value >= apexBase) return value === apexBase ? 'Master' : `Master+ ${value - apexBase} LP`
  const tierIndex = Math.floor(value / 400)
  const divisionIndex = Math.floor((value % 400) / 100)
  return `${titleCase(tiers[tierIndex])} ${divisions[divisionIndex]}`
}
