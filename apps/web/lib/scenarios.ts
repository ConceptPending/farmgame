import type { CreateGameOptions, Goal, GoalType, RivalConfig } from "@farmgame/engine";

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "Easy" },
  { id: "normal", name: "Normal" },
  { id: "hard", name: "Hard" },
];

interface DiffParams {
  startingMoney: number;
  expenseMultiplier: number;
  targetScale: number;
  rivalAggr: number;
}

const DIFF: Record<Difficulty, DiffParams> = {
  easy: { startingMoney: 1000, expenseMultiplier: 0.7, targetScale: 0.8, rivalAggr: 0.45 },
  normal: { startingMoney: 500, expenseMultiplier: 1.0, targetScale: 1.0, rivalAggr: 0.6 },
  hard: { startingMoney: 300, expenseMultiplier: 1.3, targetScale: 1.25, rivalAggr: 0.75 },
};

const RIVAL_NAMES = ["Hollow Creek Farm", "Golden Acres", "Ridgeline Ranch", "Brms & Sons"];
const RIVAL_FOCUS = [["wheat", "corn"], ["tomato", "peppers"], ["soybeans", "potatoes"], ["strawberries", "grapes"]];

function makeRivals(count: number, aggressiveness: number): RivalConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    name: RIVAL_NAMES[i % RIVAL_NAMES.length],
    aggressiveness,
    startingPlots: 2,
    focusGoods: RIVAL_FOCUS[i % RIVAL_FOCUS.length],
  }));
}

export interface Scenario {
  id: string;
  name: string;
  blurb: string;
  /** false until rival farms land (Phase B). */
  available: boolean;
  rivals: number;
  buildGoal: (d: DiffParams) => Goal;
  goalSummary: (d: DiffParams) => string;
  /** Optional per-difficulty starting-money override. Lets tutorial scenarios
   *  be forgiving without changing the global difficulty defaults — e.g.
   *  First Harvest gives Hard players $800 instead of the global $300. */
  startingMoneyOverride?: Partial<Record<Difficulty, number>>;
  /** Optional per-difficulty expense-multiplier override. Long scenarios
   *  (Prosperity, Race the Clock, …) compound the global Hard 1.3× into
   *  a bankruptcy trap over 36+ turns; this lets them opt down to 1.15
   *  on Hard without changing what "Hard" means on short scenarios. */
  expenseMultiplierOverride?: Partial<Record<Difficulty, number>>;
}

const NET_WORTH_BASE = 40000;
const LAND_BARON_BASE = 14;
const money = (n: number) => `$${n.toLocaleString()}`;

export const SCENARIOS: Scenario[] = [
  {
    id: "homestead",
    name: "Homestead",
    blurb: "No clock, no rivals. Build a farm at your own pace.",
    available: true,
    rivals: 0,
    buildGoal: () => ({ type: "sandbox" }),
    goalSummary: () => "Sandbox — play forever",
  },
  {
    id: "prosperity",
    name: "Prosperity",
    blurb: "Grow a farm worth a small fortune.",
    available: true,
    rivals: 0,
    buildGoal: (d) => ({ type: "net_worth", target: Math.round(NET_WORTH_BASE * d.targetScale) }),
    goalSummary: (d) => `Reach ${money(Math.round(NET_WORTH_BASE * d.targetScale))} net worth`,
    // Long scenario (60+ turns of expansion-bot play): global Hard 1.3×
    // compounds into a $4K+ deficit before harvest income catches up. Dial
    // down to 1.15× and add a starting-cash cushion on Hard only.
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 800 },
  },
  {
    id: "land_baron",
    name: "Land Baron",
    blurb: "Claim the valley, plot by plot — before rivals do.",
    available: true,
    rivals: 2,
    buildGoal: (d) => ({ type: "land_baron", plots: Math.round(LAND_BARON_BASE * d.targetScale) }),
    goalSummary: (d) => `Own ${Math.round(LAND_BARON_BASE * d.targetScale)} plots`,
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 800 },
  },
  {
    id: "tycoon_rush",
    name: "Tycoon Rush",
    blurb: "Outrace rival farms to a fortune.",
    available: true,
    rivals: 3,
    buildGoal: (d) => ({ type: "tycoon_race", target: Math.round(NET_WORTH_BASE * d.targetScale) }),
    goalSummary: (d) => `First to ${money(Math.round(NET_WORTH_BASE * d.targetScale))}`,
    // 3 rivals on a 48-turn scenario; bigger cushion needed.
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 1000 },
  },
  {
    id: "market_mogul",
    name: "Market Mogul",
    blurb: "Out-produce rivals to corner the wheat market.",
    available: true,
    rivals: 2,
    buildGoal: () => ({ type: "market_leader", good: "wheat", seasons: 4 }),
    goalSummary: () => "Top wheat seller for 4 seasons",
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 800 },
  },
  // Turn-limited scenarios — added in PR M when deadline_turns landed.
  {
    id: "first_harvest",
    name: "First Harvest",
    blurb: "Learn the loop. 12 turns (one game year) to reach a modest target.",
    available: true,
    rivals: 0,
    // Tuned in PR Q against the headless simulator:
    //   greedy floor — easy 100% / normal 33% / hard 20% (3% bankrupt)
    // Competent humans land roughly Easy ~100, Normal 50-60, Hard 30-40.
    // PR V bumped target $2000 → $2500 to compensate for the drought
    // tuning, which lifted Normal's floor to 70% at the old target.
    buildGoal: (d) => ({
      type: "net_worth",
      target: Math.round(2500 * d.targetScale),
      deadlineTurns: 12,
    }),
    goalSummary: (d) => `${money(Math.round(2500 * d.targetScale))} net worth in 12 turns`,
    // Override the global Hard $300: a 12-turn tutorial shouldn't bankrupt
    // the player from seasonal expenses before they can earn anything back.
    startingMoneyOverride: { easy: 1500, normal: 750, hard: 800 },
  },
  {
    id: "quick_challenge",
    name: "Quick Challenge",
    blurb: "24 turns (two years) for a real payday.",
    available: true,
    rivals: 0,
    buildGoal: (d) => ({
      type: "net_worth",
      target: Math.round(15000 * d.targetScale),
      deadlineTurns: 24,
    }),
    goalSummary: (d) => `${money(Math.round(15000 * d.targetScale))} net worth in 24 turns`,
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 800 },
  },
  {
    id: "race_the_clock",
    name: "Race the Clock",
    blurb: "Outrun three rivals and the calendar — 36 turns to win.",
    available: true,
    rivals: 3,
    buildGoal: (d) => ({
      type: "tycoon_race",
      target: Math.round(NET_WORTH_BASE * d.targetScale),
      deadlineTurns: 36,
    }),
    goalSummary: (d) =>
      `First to ${money(Math.round(NET_WORTH_BASE * d.targetScale))} (36-turn limit)`,
    // Heaviest scenario in the catalog (deadline + 3 rivals + 36 turns of
    // Hard expenses). Extra cash cushion on top of the lower multiplier.
    expenseMultiplierOverride: { hard: 1.15 },
    startingMoneyOverride: { hard: 1000 },
  },
];

export function buildConfig(
  scenario: Scenario,
  difficulty: Difficulty,
  opts?: { seed?: number },
): CreateGameOptions {
  const d = DIFF[difficulty];
  const overrideMoney = scenario.startingMoneyOverride?.[difficulty];
  const overrideMult = scenario.expenseMultiplierOverride?.[difficulty];
  return {
    seed: opts?.seed,
    startingMoney: overrideMoney ?? d.startingMoney,
    expenseMultiplier: overrideMult ?? d.expenseMultiplier,
    goal: scenario.buildGoal(d),
    rivals: makeRivals(scenario.rivals, d.rivalAggr),
  };
}

// --- Custom game ---

export const CUSTOM_GOAL_TYPES: { type: GoalType; name: string }[] = [
  { type: "net_worth", name: "Net worth ($)" },
  { type: "tycoon_race", name: "Tycoon race ($, vs rivals)" },
  { type: "land_baron", name: "Land baron (plots)" },
  { type: "market_leader", name: "Market leader (seasons)" },
  { type: "sandbox", name: "Sandbox" },
];

export function buildCustomConfig(opts: {
  goalType: GoalType;
  target: number;
  startingMoney: number;
  expenseMultiplier: number;
  rivals: number;
  seed?: number;
}): CreateGameOptions {
  let goal: Goal;
  switch (opts.goalType) {
    case "land_baron":
      goal = { type: "land_baron", plots: opts.target };
      break;
    case "sandbox":
      goal = { type: "sandbox" };
      break;
    case "tycoon_race":
      goal = { type: "tycoon_race", target: opts.target };
      break;
    case "market_leader":
      goal = { type: "market_leader", good: "wheat", seasons: opts.target };
      break;
    default:
      goal = { type: "net_worth", target: opts.target };
  }
  return {
    seed: opts.seed,
    startingMoney: opts.startingMoney,
    expenseMultiplier: opts.expenseMultiplier,
    goal,
    rivals: makeRivals(opts.rivals, 0.6),
  };
}
