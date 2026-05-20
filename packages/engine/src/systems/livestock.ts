import type { GameState, Notification } from "../state.js";
import type { Animal } from "../entities/animal.js";
import { ANIMAL_CATALOG, BARN_CAPACITY } from "../entities/animal.js";
import { CROP_CATALOG, ALL_CROP_IDS } from "../data/crops.js";
import { nextBool } from "../rng.js";

/** Total livestock the player's barns can house. */
export function computeLivestockCapacity(state: GameState): number {
  return state.buildings.filter((b) => b.type === "barn").length * BARN_CAPACITY;
}

const GRAIN_IDS = ALL_CROP_IDS.filter((id) => CROP_CATALOG[id].category === "grain");

/**
 * Livestock system. Each tick animals age and grow; each season they consume
 * grain feed, gain or lose health accordingly, may starve, and well-fed mature
 * animals can breed (subject to barn capacity).
 */
export function livestockSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  // No animals → no work and, importantly, no RNG consumption (keeps games
  // without livestock byte-for-byte identical).
  if (state.animals.length === 0) {
    return { state, notifications: [] };
  }

  const notifications: Notification[] = [];
  let rng = state.rng;

  // Per-tick growth.
  let animals: Animal[] = state.animals.map((a) => {
    const def = ANIMAL_CATALOG[a.type];
    return { ...a, age: a.age + 1, maturity: Math.min(1, a.maturity + 1 / def.growthTicks) };
  });

  let inventory = state.inventory;
  let nextAnimalId = state.nextAnimalId;

  if (state.day === 1) {
    // Feed consumption from grain stocks.
    const needed = animals.reduce((sum, a) => sum + ANIMAL_CATALOG[a.type].feedPerSeason, 0);
    const available = GRAIN_IDS.reduce((sum, id) => sum + (inventory[id] ?? 0), 0);
    const consumed = Math.min(needed, available);

    if (consumed > 0) {
      inventory = { ...inventory };
      let toConsume = consumed;
      for (const id of GRAIN_IDS) {
        if (toConsume <= 0) break;
        const have = inventory[id] ?? 0;
        const take = Math.min(have, toConsume);
        if (take > 0) {
          inventory[id] = have - take;
          if (inventory[id] === 0) delete inventory[id];
          toConsume -= take;
        }
      }
    }

    const fedRatio = needed > 0 ? consumed / needed : 1;

    // Health update + starvation.
    const survivors: Animal[] = [];
    for (const a of animals) {
      const health =
        fedRatio >= 1
          ? Math.min(1, a.health + 0.2)
          : Math.max(0, a.health - ((1 - fedRatio) * 0.5 + 0.1));
      if (health <= 0) {
        notifications.push({
          type: "warning",
          message: `A ${ANIMAL_CATALOG[a.type].name.toLowerCase()} starved for lack of feed.`,
        });
        continue;
      }
      survivors.push({ ...a, health });
    }
    animals = survivors;

    if (fedRatio < 1 && animals.length > 0) {
      notifications.push({
        type: "warning",
        message: "Livestock are underfed — grow or buy more grain.",
      });
    }

    // Breeding: well-fed, mature, healthy animals, limited by barn capacity.
    if (fedRatio >= 1) {
      const capacity = computeLivestockCapacity(state);
      const babies: Animal[] = [];
      for (const a of animals) {
        if (animals.length + babies.length >= capacity) break;
        const def = ANIMAL_CATALOG[a.type];
        if (a.maturity >= 1 && a.health >= 0.8) {
          const roll = nextBool(rng, def.breedChance);
          rng = roll.rng;
          if (roll.value) {
            babies.push({ id: nextAnimalId++, type: a.type, age: 0, maturity: 0, health: 1 });
            notifications.push({ type: "success", message: `A ${def.name.toLowerCase()} was born!` });
          }
        }
      }
      animals = [...animals, ...babies];
    }
  }

  return {
    state: { ...state, animals, inventory, rng, nextAnimalId },
    notifications,
  };
}
