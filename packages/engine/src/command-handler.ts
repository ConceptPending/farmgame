import type { GameCommand, SprayType } from "./commands.js";
import type { GameState, Notification } from "./state.js";
import { BASE_INVENTORY_CAPACITY, SILO_CAPACITY_BONUS, LOAN_LIMIT } from "./state.js";
import type { CropId } from "./entities/crop.js";
import type { BuildingType } from "./entities/building.js";
import { BUILDING_CATALOG, createBuilding } from "./entities/building.js";
import { createField } from "./entities/field.js";
import { tileIndex } from "./entities/world.js";
import { getCropDef } from "./data/crops.js";
import { getGoodInfo } from "./data/goods.js";
import { SELL_DEMAND_IMPACT, MIN_DEMAND } from "./systems/market.js";
import type { AnimalType } from "./entities/animal.js";
import { ANIMAL_CATALOG, createAnimal, animalValue } from "./entities/animal.js";
import { computeLivestockCapacity } from "./systems/livestock.js";

export interface CommandResult {
  state: GameState;
  success: boolean;
  error?: string;
  notifications: Notification[];
}

function fail(state: GameState, error: string): CommandResult {
  return { state, success: false, error, notifications: [] };
}

function totalInventory(state: GameState): number {
  return Object.values(state.inventory).reduce((sum, qty) => sum + qty, 0);
}

function handleBuyPlot(state: GameState, plotX: number, plotY: number): CommandResult {
  const plotsPerRow = state.world.width / state.world.plotSize;
  if (plotX < 0 || plotX >= plotsPerRow || plotY < 0 || plotY >= plotsPerRow) {
    return fail(state, "Plot coordinates out of bounds");
  }

  const plotIdx = plotY * plotsPerRow + plotX;
  if (state.world.plotOwnership[plotIdx]) {
    return fail(state, "You already own this plot");
  }

  // Check adjacency to an owned plot
  const neighbors = [
    [plotX - 1, plotY],
    [plotX + 1, plotY],
    [plotX, plotY - 1],
    [plotX, plotY + 1],
  ];
  const hasAdjacentOwned = neighbors.some(([nx, ny]) => {
    if (nx < 0 || nx >= plotsPerRow || ny < 0 || ny >= plotsPerRow) return false;
    return state.world.plotOwnership[ny * plotsPerRow + nx];
  });
  if (!hasAdjacentOwned) {
    return fail(state, "Plot must be adjacent to owned land");
  }

  // Calculate cost based on average soil quality of the plot's tiles
  let soilSum = 0;
  const startX = plotX * state.world.plotSize;
  const startY = plotY * state.world.plotSize;
  for (let dy = 0; dy < state.world.plotSize; dy++) {
    for (let dx = 0; dx < state.world.plotSize; dx++) {
      const idx = tileIndex(startX + dx, startY + dy, state.world.width);
      soilSum += state.world.tiles[idx].soilQuality;
    }
  }
  const avgSoil = soilSum / (state.world.plotSize * state.world.plotSize);
  const cost = Math.round(200 + avgSoil * 300);

  if (state.money < cost) {
    return fail(state, `Not enough money. Need $${cost}, have $${state.money}`);
  }

  // Apply ownership
  const newPlotOwnership = [...state.world.plotOwnership];
  newPlotOwnership[plotIdx] = true;

  const newTiles = [...state.world.tiles];
  for (let dy = 0; dy < state.world.plotSize; dy++) {
    for (let dx = 0; dx < state.world.plotSize; dx++) {
      const idx = tileIndex(startX + dx, startY + dy, state.world.width);
      const tile = { ...newTiles[idx], owned: true };
      if (tile.terrain === "grass" || tile.terrain === "forest") {
        tile.terrain = "dirt";
      }
      newTiles[idx] = tile;
    }
  }

  return {
    state: {
      ...state,
      money: state.money - cost,
      world: { ...state.world, tiles: newTiles, plotOwnership: newPlotOwnership },
    },
    success: true,
    notifications: [
      { type: "success", message: `Purchased plot (${plotX},${plotY}) for $${cost}` },
    ],
  };
}

function handleDesignateField(state: GameState, tileIndices: number[]): CommandResult {
  if (tileIndices.length === 0) {
    return fail(state, "Must select at least one tile");
  }

  // All tiles must be owned, clear terrain (dirt/grass), and not already in a field or building
  for (const idx of tileIndices) {
    if (idx < 0 || idx >= state.world.tiles.length) {
      return fail(state, "Tile index out of bounds");
    }
    const tile = state.world.tiles[idx];
    if (!tile.owned) return fail(state, "All tiles must be on owned land");
    if (tile.terrain !== "dirt" && tile.terrain !== "grass") {
      return fail(state, "Cannot designate field on water, rock, or forest");
    }
    if (tile.fieldId !== null) return fail(state, "Tile already belongs to a field");
    if (tile.buildingId !== null) return fail(state, "Tile has a building on it");
  }

  const fieldId = state.nextFieldId;
  const field = createField(fieldId, tileIndices);

  // Calculate average moisture from tiles
  let moistureSum = 0;
  for (const idx of tileIndices) {
    moistureSum += state.world.tiles[idx].moisture;
  }
  field.moisture = moistureSum / tileIndices.length;

  // Update tiles to reference the field
  const newTiles = [...state.world.tiles];
  for (const idx of tileIndices) {
    newTiles[idx] = { ...newTiles[idx], fieldId };
  }

  return {
    state: {
      ...state,
      fields: [...state.fields, field],
      world: { ...state.world, tiles: newTiles },
      nextFieldId: fieldId + 1,
    },
    success: true,
    notifications: [
      { type: "info", message: `Designated field #${fieldId} (${tileIndices.length} tiles)` },
    ],
  };
}

function handlePlowField(state: GameState, fieldId: number): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail(state, "Field not found");
  if (field.state !== "fallow") return fail(state, "Field must be fallow to plow");

  return {
    state: {
      ...state,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "plowed" as const } : f,
      ),
    },
    success: true,
    notifications: [{ type: "info", message: `Plowed field #${fieldId}` }],
  };
}

function handlePlantField(state: GameState, fieldId: number, cropId: CropId): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail(state, "Field not found");
  if (field.state !== "plowed") return fail(state, "Field must be plowed before planting");

  const def = getCropDef(cropId);
  if (!def) return fail(state, `Unknown crop: ${cropId}`);

  if (!def.plantSeasons.includes(state.season)) {
    return fail(state, `${def.name} cannot be planted in ${state.season}`);
  }

  const totalCost = def.seedCost * field.tileIndices.length;
  if (state.money < totalCost) {
    return fail(state, `Not enough money. Need $${totalCost}, have $${state.money}`);
  }

  return {
    state: {
      ...state,
      money: state.money - totalCost,
      fields: state.fields.map((f) =>
        f.id === fieldId
          ? { ...f, state: "planted" as const, cropId, growth: 0, growthTicks: 0 }
          : f,
      ),
    },
    success: true,
    notifications: [
      {
        type: "info",
        message: `Planted ${def.name} in field #${fieldId} for $${totalCost}`,
      },
    ],
  };
}

function handleHarvestField(state: GameState, fieldId: number): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail(state, "Field not found");
  if (field.state !== "ready") return fail(state, "Crops are not ready to harvest");
  if (!field.cropId) return fail(state, "No crop to harvest");

  const def = getCropDef(field.cropId);
  if (!def) return fail(state, "Unknown crop");

  // Yield based on field size, health, and weeds
  const healthMod = Math.max(0.2, field.health);
  const weedMod = Math.max(0.3, 1 - field.weeds * 0.7);
  const quantity = Math.round(def.baseYield * field.tileIndices.length * healthMod * weedMod);

  // Check inventory capacity
  const currentTotal = totalInventory(state);
  if (currentTotal + quantity > state.inventoryCapacity) {
    return fail(
      state,
      `Not enough storage. Need ${quantity} space, have ${state.inventoryCapacity - currentTotal} free. Build silos for more.`,
    );
  }

  const newInventory = { ...state.inventory };
  newInventory[field.cropId] = (newInventory[field.cropId] ?? 0) + quantity;

  return {
    state: {
      ...state,
      inventory: newInventory,
      fields: state.fields.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              state: "plowed" as const,
              cropId: null,
              growth: 0,
              growthTicks: 0,
              health: 1.0,
              weeds: Math.min(f.weeds, 0.3),
              pests: 0,
            }
          : f,
      ),
    },
    success: true,
    notifications: [
      { type: "success", message: `Harvested ${quantity} ${def.name} from field #${fieldId}` },
    ],
  };
}

function handleRemoveField(state: GameState, fieldId: number): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail(state, "Field not found");

  const newTiles = [...state.world.tiles];
  for (const idx of field.tileIndices) {
    newTiles[idx] = { ...newTiles[idx], fieldId: null };
  }

  return {
    state: {
      ...state,
      fields: state.fields.filter((f) => f.id !== fieldId),
      world: { ...state.world, tiles: newTiles },
    },
    success: true,
    notifications: [{ type: "info", message: `Removed field #${fieldId}` }],
  };
}

function handleBuild(state: GameState, buildingType: BuildingType, tileIdx: number): CommandResult {
  if (tileIdx < 0 || tileIdx >= state.world.tiles.length) {
    return fail(state, "Tile index out of bounds");
  }

  const tile = state.world.tiles[tileIdx];
  if (!tile.owned) return fail(state, "Must build on owned land");
  if (tile.buildingId !== null) return fail(state, "Tile already has a building");
  if (tile.fieldId !== null) return fail(state, "Cannot build on a field tile");
  if (tile.terrain === "water") return fail(state, "Cannot build on water");

  const buildingDef = BUILDING_CATALOG[buildingType];
  if (state.money < buildingDef.cost) {
    return fail(state, `Not enough money. Need $${buildingDef.cost}, have $${state.money}`);
  }

  const buildingId = state.nextBuildingId;
  const building = createBuilding(buildingId, buildingType, tileIdx);

  const newTiles = [...state.world.tiles];
  newTiles[tileIdx] = { ...newTiles[tileIdx], buildingId };

  // Silos increase inventory capacity
  let newCapacity = state.inventoryCapacity;
  if (buildingType === "silo") {
    newCapacity += SILO_CAPACITY_BONUS;
  }

  return {
    state: {
      ...state,
      money: state.money - buildingDef.cost,
      buildings: [...state.buildings, building],
      world: { ...state.world, tiles: newTiles },
      nextBuildingId: buildingId + 1,
      inventoryCapacity: newCapacity,
    },
    success: true,
    notifications: [
      { type: "success", message: `Built ${buildingDef.name} for $${buildingDef.cost}` },
    ],
  };
}

function handleDemolish(state: GameState, buildingId: number): CommandResult {
  const building = state.buildings.find((b) => b.id === buildingId);
  if (!building) return fail(state, "Building not found");

  const newTiles = [...state.world.tiles];
  newTiles[building.tileIndex] = { ...newTiles[building.tileIndex], buildingId: null };

  let newCapacity = state.inventoryCapacity;
  if (building.type === "silo") {
    newCapacity = Math.max(BASE_INVENTORY_CAPACITY, newCapacity - SILO_CAPACITY_BONUS);
  }

  return {
    state: {
      ...state,
      buildings: state.buildings.filter((b) => b.id !== buildingId),
      world: { ...state.world, tiles: newTiles },
      inventoryCapacity: newCapacity,
    },
    success: true,
    notifications: [{ type: "info", message: `Demolished building #${buildingId}` }],
  };
}

const SPRAY_COSTS: Record<SprayType, number> = {
  fertilizer: 20,
  pesticide: 15,
  herbicide: 10,
};

function handleSpray(state: GameState, fieldId: number, sprayType: SprayType): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail(state, "Field not found");

  const cost = SPRAY_COSTS[sprayType] * field.tileIndices.length;
  if (state.money < cost) {
    return fail(state, `Not enough money. Need $${cost}, have $${state.money}`);
  }

  let updates: Partial<typeof field> = {};
  let message = "";

  switch (sprayType) {
    case "fertilizer":
      updates = { health: Math.min(1, field.health + 0.3) };
      message = `Applied fertilizer to field #${fieldId}`;
      break;
    case "pesticide":
      updates = { pests: Math.max(0, field.pests - 0.6) };
      message = `Sprayed pesticide on field #${fieldId}`;
      break;
    case "herbicide":
      updates = { weeds: Math.max(0, field.weeds - 0.6) };
      message = `Sprayed herbicide on field #${fieldId}`;
      break;
  }

  return {
    state: {
      ...state,
      money: state.money - cost,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f,
      ),
    },
    success: true,
    notifications: [
      { type: "info", message: `${message} for $${cost}` },
    ],
  };
}

function handleSell(state: GameState, goodId: string, quantity: number): CommandResult {
  const def = getGoodInfo(goodId);
  if (!def) return fail(state, `Unknown good: ${goodId}`);

  const available = state.inventory[goodId] ?? 0;
  if (available < quantity) {
    return fail(state, `Not enough ${def.name}. Have ${available}, want to sell ${quantity}`);
  }

  // Sell against a downward-sloping demand curve: each unit nudges demand (and
  // thus price) down, so a big batch averages a lower price (slippage) and
  // leaves the market depressed until demand recovers. Pricing is relative to
  // the currently displayed price, so you sell near what the market panel shows.
  const clampPrice = (p: number) => Math.max(def.basePrice * 0.3, Math.min(def.basePrice * 3, p));
  const price = state.market.prices[goodId] ?? def.basePrice;
  const demand = state.market.demand[goodId] ?? 1.0;
  const endDemand = Math.max(MIN_DEMAND, demand - quantity * SELL_DEMAND_IMPACT);
  const slip = demand > 0 ? (demand + endDemand) / 2 / demand : 1; // <= 1
  const avgPrice = clampPrice(price * slip);
  const revenue = Math.round(quantity * avgPrice);

  const newInventory = { ...state.inventory };
  newInventory[goodId] = available - quantity;
  if (newInventory[goodId] === 0) delete newInventory[goodId];

  const newPrices = { ...state.market.prices };
  newPrices[goodId] = clampPrice(demand > 0 ? price * (endDemand / demand) : price);

  const newDemand = { ...state.market.demand };
  newDemand[goodId] = endDemand;

  return {
    state: {
      ...state,
      money: state.money + revenue,
      inventory: newInventory,
      market: {
        ...state.market,
        prices: newPrices,
        demand: newDemand,
      },
    },
    success: true,
    notifications: [
      { type: "success", message: `Sold ${quantity} ${def.name} for $${revenue}` },
    ],
  };
}

function handleBuyAnimal(state: GameState, animalType: AnimalType): CommandResult {
  const def = ANIMAL_CATALOG[animalType];
  const capacity = computeLivestockCapacity(state);
  if (capacity === 0) return fail(state, "Build a barn to house livestock first");
  if (state.animals.length >= capacity) {
    return fail(state, "No barn space. Build another barn.");
  }
  if (state.money < def.cost) {
    return fail(state, `Not enough money. Need $${def.cost}, have $${state.money}`);
  }
  const animal = createAnimal(state.nextAnimalId, animalType);
  return {
    state: {
      ...state,
      money: state.money - def.cost,
      animals: [...state.animals, animal],
      nextAnimalId: state.nextAnimalId + 1,
    },
    success: true,
    notifications: [{ type: "success", message: `Bought a ${def.name.toLowerCase()} for $${def.cost}` }],
  };
}

function handleSellAnimal(state: GameState, animalId: number): CommandResult {
  const animal = state.animals.find((a) => a.id === animalId);
  if (!animal) return fail(state, "Animal not found");
  const value = animalValue(animal);
  const def = ANIMAL_CATALOG[animal.type];
  return {
    state: {
      ...state,
      money: state.money + value,
      animals: state.animals.filter((a) => a.id !== animalId),
    },
    success: true,
    notifications: [{ type: "success", message: `Sold a ${def.name.toLowerCase()} for $${value}` }],
  };
}

function handleTakeLoan(state: GameState, amount: number): CommandResult {
  if (amount <= 0) return fail(state, "Loan amount must be positive");
  const available = LOAN_LIMIT - state.loan;
  if (amount > available) {
    return fail(state, `Loan limit exceeded. You can borrow up to $${available}`);
  }
  return {
    state: { ...state, money: state.money + amount, loan: state.loan + amount },
    success: true,
    notifications: [
      { type: "info", message: `Borrowed $${amount}. Total owed: $${state.loan + amount}` },
    ],
  };
}

function handleRepayLoan(state: GameState, amount: number): CommandResult {
  if (amount <= 0) return fail(state, "Repayment must be positive");
  if (amount > state.loan) return fail(state, `You only owe $${state.loan}`);
  if (amount > state.money) return fail(state, "Not enough cash to repay that much");
  return {
    state: { ...state, money: state.money - amount, loan: state.loan - amount },
    success: true,
    notifications: [
      { type: "info", message: `Repaid $${amount}. Remaining debt: $${state.loan - amount}` },
    ],
  };
}

export function applyCommand(state: GameState, command: GameCommand): CommandResult {
  switch (command.type) {
    case "BUY_PLOT":
      return handleBuyPlot(state, command.plotX, command.plotY);
    case "DESIGNATE_FIELD":
      return handleDesignateField(state, command.tileIndices);
    case "PLOW_FIELD":
      return handlePlowField(state, command.fieldId);
    case "PLANT_FIELD":
      return handlePlantField(state, command.fieldId, command.cropId);
    case "HARVEST_FIELD":
      return handleHarvestField(state, command.fieldId);
    case "REMOVE_FIELD":
      return handleRemoveField(state, command.fieldId);
    case "BUILD":
      return handleBuild(state, command.buildingType, command.tileIndex);
    case "DEMOLISH":
      return handleDemolish(state, command.buildingId);
    case "SPRAY":
      return handleSpray(state, command.fieldId, command.sprayType);
    case "SELL":
      return handleSell(state, command.cropId, command.quantity);
    case "BUY_ANIMAL":
      return handleBuyAnimal(state, command.animalType);
    case "SELL_ANIMAL":
      return handleSellAnimal(state, command.animalId);
    case "TAKE_LOAN":
      return handleTakeLoan(state, command.amount);
    case "REPAY_LOAN":
      return handleRepayLoan(state, command.amount);
    case "PAUSE":
      return { state: { ...state, paused: true }, success: true, notifications: [] };
    case "RESUME":
      return { state: { ...state, paused: false }, success: true, notifications: [] };
    case "SET_SPEED":
      return { state: { ...state, speed: command.speed }, success: true, notifications: [] };
  }
}
