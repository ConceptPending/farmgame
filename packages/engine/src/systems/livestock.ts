import type { GameState, Notification } from "../state.js";
import type { Animal } from "../entities/animal.js";
import { ANIMAL_CATALOG } from "../entities/animal.js";
import { CROP_CATALOG, ALL_CROP_IDS } from "../data/crops.js";
import { PRODUCT_CATALOG } from "../data/products.js";
import { nextBool } from "../rng.js";
import {
  pastureGrazingOffset,
  animalAmenities,
  FEED_TROUGH_FACTOR,
  WATER_TROUGH_BREED_BONUS,
} from "./pen.js";

/** Soft ceiling on herd size; feed economics are the real limiter below this. */
const MAX_HERD = 40;

// Animals eat grain and forage (e.g. hay/clover).
const FEED_IDS = ALL_CROP_IDS.filter(
  (id) => CROP_CATALOG[id].category === "grain" || CROP_CATALOG[id].category === "forage",
);


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
  let manure = state.manure;

  if (state.day === 1) {
    // Effective feed need per animal: feed troughs cut waste; pasture (grass
    // tiles inside the pen) provides free grazing up to a cap.
    const pasture = pastureGrazingOffset(state);
    const amenities = animalAmenities(state);
    const needed = animals.reduce((sum, a) => {
      const base = ANIMAL_CATALOG[a.type].feedPerSeason;
      const afterTrough = amenities.get(a.id)?.feed ? base * FEED_TROUGH_FACTOR : base;
      return sum + Math.max(0, afterTrough - (pasture.get(a.id) ?? 0));
    }, 0);
    const available = FEED_IDS.reduce((sum, id) => sum + (inventory[id] ?? 0), 0);
    const consumed = Math.min(needed, available);

    if (consumed > 0) {
      inventory = { ...inventory };
      let toConsume = consumed;
      for (const id of FEED_IDS) {
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
        message: "Livestock are underfed — grow or buy more feed.",
      });
    }

    // Manure: every animal contributes (bigger animals more), scaled by health.
    manure += Math.round(animals.reduce((sum, a) => sum + ANIMAL_CATALOG[a.type].manurePerSeason * a.health, 0));

    // Products: mature, well-fed animals yield eggs/milk/wool into inventory.
    if (fedRatio >= 1) {
      const produced: Record<string, number> = {};
      for (const a of animals) {
        const def = ANIMAL_CATALOG[a.type];
        if (def.product && def.yieldPerSeason && a.maturity >= 1 && a.health > 0) {
          const amt = Math.round(def.yieldPerSeason * a.health);
          if (amt > 0) produced[def.product] = (produced[def.product] ?? 0) + amt;
        }
      }
      const totalProduced = Object.values(produced).reduce((s, n) => s + n, 0);
      if (totalProduced > 0) {
        inventory = { ...inventory };
        const used = Object.values(inventory).reduce((s, n) => s + n, 0);
        let free = state.inventoryCapacity - used;
        const parts: string[] = [];
        for (const [pid, amt] of Object.entries(produced)) {
          const add = Math.max(0, Math.min(amt, free));
          if (add > 0) {
            inventory[pid] = (inventory[pid] ?? 0) + add;
            free -= add;
            parts.push(`${add} ${PRODUCT_CATALOG[pid as keyof typeof PRODUCT_CATALOG].name.toLowerCase()}`);
          }
        }
        if (parts.length > 0) {
          notifications.push({ type: "success", message: `Your animals produced ${parts.join(", ")}.` });
        }
      }
    }

    // Breeding: well-fed, mature, healthy animals. Feed economics limit the
    // herd; a soft cap just prevents runaway growth. Calves join their parent's
    // tile (so they're born inside the same pen). A water trough in the pen
    // gives this animal a small breeding bonus.
    if (fedRatio >= 1) {
      const babies: Animal[] = [];
      for (const a of animals) {
        if (animals.length + babies.length >= MAX_HERD) break;
        const def = ANIMAL_CATALOG[a.type];
        if (a.maturity >= 1 && a.health >= 0.8) {
          const chance = Math.min(
            1,
            def.breedChance * (amenities.get(a.id)?.water ? WATER_TROUGH_BREED_BONUS : 1),
          );
          const roll = nextBool(rng, chance);
          rng = roll.rng;
          if (roll.value) {
            babies.push({ id: nextAnimalId++, type: a.type, age: 0, maturity: 0, health: 1, tileIndex: a.tileIndex });
            notifications.push({ type: "success", message: `A ${def.name.toLowerCase()} was born!` });
          }
        }
      }
      animals = [...animals, ...babies];
    }
  }

  return {
    state: { ...state, animals, inventory, rng, nextAnimalId, manure },
    notifications,
  };
}
