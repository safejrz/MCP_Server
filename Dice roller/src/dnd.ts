import { AdvantageState, DiceRollResult, doubleDiceExpression, rollExpression } from "./dice.js";

export type DndRollMode = "ability-check" | "attack-roll" | "saving-throw" | "damage-roll";

export interface DndRollOptions {
  mode: DndRollMode;
  abilityModifier?: number;
  proficiencyBonus?: number;
  proficient?: boolean;
  advantage?: AdvantageState;
  difficultyClass?: number;
  bonus?: number;
  attackBonus?: number;
  damageExpression?: string;
  damageBonus?: number;
  critical?: boolean;
  repeat?: number;
  label?: string;
}

export interface DndRollEntry {
  total: number;
  detail: string;
  dc?: number;
  passed?: boolean;
  advantage: AdvantageState;
}

export interface DndRollOutcome {
  mode: DndRollMode;
  label?: string;
  entries: DndRollEntry[];
  expressionUsed: string;
}

export function executeDndRoll(options: DndRollOptions): DndRollOutcome {
  if (options.mode === "damage-roll") {
    return rollDamage(options);
  }

  return rollD20Based(options);
}

function rollD20Based(options: DndRollOptions): DndRollOutcome {
  const advantage = options.advantage ?? "normal";
  const repeats = clampRepeat(options.repeat ?? 1);
  const staticBonus = computeStaticBonus(options);
  const expression = buildD20Expression(staticBonus);

  const entries: DndRollEntry[] = [];
  for (let i = 0; i < repeats; i += 1) {
    const trace = rollExpression(expression, { advantage });
    const passed = options.difficultyClass !== undefined ? trace.total >= options.difficultyClass : undefined;
    entries.push({
      total: trace.total,
      detail: trace.detail,
      dc: options.difficultyClass,
      passed,
      advantage,
    });
  }

  return {
    mode: options.mode,
    label: options.label,
    entries,
    expressionUsed: expression,
  };
}

function rollDamage(options: DndRollOptions): DndRollOutcome {
  const advantage = "normal";
  const repeats = clampRepeat(options.repeat ?? 1);
  const damageExpression = options.damageExpression ?? "1d6";
  const coreExpression = options.critical ? doubleDiceExpression(damageExpression) : damageExpression;
  const staticBonus = (options.abilityModifier ?? 0) + (options.damageBonus ?? 0) + (options.bonus ?? 0);
  const expression = appendModifier(coreExpression, staticBonus);

  const entries: DndRollEntry[] = [];
  for (let i = 0; i < repeats; i += 1) {
    const trace = rollExpression(expression, { advantage });
    entries.push({
      total: trace.total,
      detail: trace.detail,
      advantage,
    });
  }

  return {
    mode: "damage-roll",
    label: options.label,
    entries,
    expressionUsed: expression,
  };
}

function computeStaticBonus(options: DndRollOptions): number {
  const ability = options.abilityModifier ?? 0;
  const proficiency = options.proficient ? options.proficiencyBonus ?? 0 : 0;
  const misc = options.bonus ?? 0;
  const attack = options.mode === "attack-roll" ? options.attackBonus ?? 0 : 0;
  return ability + proficiency + misc + attack;
}

function buildD20Expression(staticBonus: number): string {
  if (staticBonus === 0) {
    return "1d20";
  }
  return appendModifier("1d20", staticBonus);
}

function appendModifier(expression: string, modifier: number): string {
  if (modifier === 0) {
    return expression;
  }
  const sign = modifier > 0 ? "+" : "";
  return `${expression}${sign}${modifier}`;
}

function clampRepeat(repeat: number): number {
  if (!Number.isFinite(repeat) || repeat < 1) {
    return 1;
  }
  return Math.min(10, Math.trunc(repeat));
}
