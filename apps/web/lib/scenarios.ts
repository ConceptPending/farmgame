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
  },
  {
    id: "land_baron",
    name: "Land Baron",
    blurb: "Claim the valley, plot by plot — before rivals do.",
    available: true,
    rivals: 2,
    buildGoal: (d) => ({ type: "land_baron", plots: Math.round(LAND_BARON_BASE * d.targetScale) }),
    goalSummary: (d) => `Own ${Math.round(LAND_BARON_BASE * d.targetScale)} plots`,
  },
  {
    id: "tycoon_rush",
    name: "Tycoon Rush",
    blurb: "Outrace rival farms to a fortune.",
    available: true,
    rivals: 3,
    buildGoal: (d) => ({ type: "tycoon_race", target: Math.round(NET_WORTH_BASE * d.targetScale) }),
    goalSummary: (d) => `First to ${money(Math.round(NET_WORTH_BASE * d.targetScale))}`,
  },
  {
    id: "market_mogul",
    name: "Market Mogul",
    blurb: "Out-produce rivals to corner the wheat market.",
    available: true,
    rivals: 2,
    buildGoal: () => ({ type: "market_leader", good: "wheat", seasons: 4 }),
    goalSummary: () => "Top wheat seller for 4 seasons",
  },
];

export function buildConfig(
  scenario: Scenario,
  difficulty: Difficulty,
  opts?: { seed?: number },
): CreateGameOptions {
  const d = DIFF[difficulty];
  return {
    seed: opts?.seed,
    startingMoney: d.startingMoney,
    expenseMultiplier: d.expenseMultiplier,
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
