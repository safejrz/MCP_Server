import { randomInt } from "node:crypto";

export type AdvantageState = "normal" | "advantage" | "disadvantage";

interface KeepClause {
  type: "kh" | "kl";
  count: number;
}

interface TermSpec {
  count: number;
  sides: number;
  explode: boolean;
  keep?: KeepClause;
  original: string;
}

interface DiceToken {
  kind: "dice";
  sign: 1 | -1;
  spec: TermSpec;
  raw: string;
}

interface ModifierToken {
  kind: "modifier";
  sign: 1 | -1;
  value: number;
  raw: string;
}

type Token = DiceToken | ModifierToken;

export interface DiceTermResult {
  notation: string;
  rolls: number[];
  kept: number[];
  subtotal: number;
  sign: 1 | -1;
  exploded: boolean;
  keepRule?: KeepClause;
}

export interface SingleEvaluation {
  expression: string;
  total: number;
  terms: DiceTermResult[];
  modifiers: number[];
  detail: string;
}

export interface DiceRollResult {
  expression: string;
  advantage: AdvantageState;
  total: number;
  traces: SingleEvaluation[];
  chosenTraceIndex: number;
  detail: string;
}

export interface EvaluateOptions {
  advantage?: AdvantageState;
  explodeOnMax?: boolean;
}

const termRegex = /^(?<count>\d*)d(?<sides>\d+)(?<explode>!+)?(?<keep>(kh|kl)\d+)?$/i;

export function rollExpression(expression: string, options: EvaluateOptions = {}): DiceRollResult {
  const advantage = options.advantage ?? "normal";
  const traces: SingleEvaluation[] = [];
  traces.push(evaluateOnce(expression, options));

  if (advantage !== "normal") {
    traces.push(evaluateOnce(expression, options));
  }

  const chosenTraceIndex = pickTraceIndex(traces, advantage);
  const chosenTrace = traces[chosenTraceIndex];

  return {
    expression: normalizeExpression(expression),
    advantage,
    total: chosenTrace.total,
    traces,
    chosenTraceIndex,
    detail: buildRollSummary(traces, advantage, chosenTraceIndex),
  };
}

export function doubleDiceExpression(expression: string): string {
  const tokens = tokenize(expression);
  if (!tokens.length) {
    throw new Error("No dice or modifiers were found in the expression");
  }

  return tokens
    .map((token, index) => {
      const prefix = formatPrefix(token.sign, index === 0);
      if (token.kind === "modifier") {
        return `${prefix}${Math.abs(token.value)}`;
      }

      const doubled = { ...token.spec, count: token.spec.count * 2 };
      return `${prefix}${termToString(doubled)}`;
    })
    .join("");
}

function evaluateOnce(expression: string, options: EvaluateOptions): SingleEvaluation {
  const tokens = tokenize(expression);
  if (!tokens.length) {
    throw new Error("Provide at least one dice term or modifier");
  }

  const terms: DiceTermResult[] = [];
  const modifiers: number[] = [];
  let total = 0;

  for (const token of tokens) {
    if (token.kind === "modifier") {
      const value = token.sign * token.value;
      total += value;
      modifiers.push(value);
      continue;
    }

    const termResult = rollDiceTerm(token.spec, token.sign, options.explodeOnMax ?? false);
    total += termResult.subtotal;
    terms.push(termResult);
  }

  return {
    expression: normalizeExpression(expression),
    total,
    terms,
    modifiers,
    detail: formatSingleDetail(terms, modifiers, total),
  };
}

function tokenize(expression: string): Token[] {
  const compact = normalizeExpression(expression);
  if (!compact) {
    return [];
  }

  const segments = compact.match(/[+-]?[^+-]+/g);
  if (!segments) {
    return [];
  }

  return segments.map((segment) => {
    const sign: 1 | -1 = segment.startsWith("-") ? -1 : 1;
    const body = segment.replace(/^[+-]/, "");
    if (!body) {
      throw new Error(`Unable to parse token in expression: ${segment}`);
    }

    if (body.toLowerCase().includes("d")) {
      const spec = parseTerm(body);
      return {
        kind: "dice",
        sign,
        spec,
        raw: segment,
      } satisfies DiceToken;
    }

    const value = Number.parseInt(body, 10);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid modifier token: ${segment}`);
    }

    return {
      kind: "modifier",
      sign,
      value,
      raw: segment,
    } satisfies ModifierToken;
  });
}

function parseTerm(raw: string): TermSpec {
  const match = raw.match(termRegex);
  if (!match || !match.groups) {
    throw new Error(`Invalid dice notation: ${raw}`);
  }

  const count = match.groups.count ? Number.parseInt(match.groups.count, 10) : 1;
  const sides = Number.parseInt(match.groups.sides, 10);
  if (count <= 0 || sides <= 0) {
    throw new Error(`Dice notation must use positive numbers: ${raw}`);
  }

  let keep: KeepClause | undefined;
  if (match.groups.keep) {
    const keepType = match.groups.keep.slice(0, 2).toLowerCase() as "kh" | "kl";
    const keepCount = Number.parseInt(match.groups.keep.slice(2), 10);
    if (keepCount <= 0 || keepCount > count) {
      throw new Error(`Invalid keep pattern in ${raw}`);
    }
    keep = { type: keepType, count: keepCount };
  }

  return {
    count,
    sides,
    explode: Boolean(match.groups.explode),
    keep,
    original: raw,
  };
}

function rollDiceTerm(spec: TermSpec, sign: 1 | -1, explodeOverride: boolean): DiceTermResult {
  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    rolls.push(...rollSingleDie(spec.sides, spec.explode || explodeOverride));
  }

  const kept = applyKeep(rolls, spec.keep);
  const subtotal = kept.reduce((sum, value) => sum + value, 0) * sign;

  return {
    notation: spec.original,
    rolls,
    kept,
    subtotal,
    sign,
    exploded: spec.explode || explodeOverride,
    keepRule: spec.keep,
  };
}

function rollSingleDie(sides: number, explode: boolean): number[] {
  const results: number[] = [];
  let roll = randomInt(1, sides + 1);
  results.push(roll);

  while (explode && roll === sides) {
    roll = randomInt(1, sides + 1);
    results.push(roll);
  }

  return results;
}

function applyKeep(rolls: number[], keep?: KeepClause): number[] {
  if (!keep) {
    return [...rolls];
  }

  const sorted = [...rolls].sort((a, b) => (keep.type === "kh" ? b - a : a - b));
  return sorted.slice(0, keep.count);
}

function pickTraceIndex(traces: SingleEvaluation[], advantage: AdvantageState): number {
  if (traces.length === 1) {
    return 0;
  }

  if (advantage === "advantage") {
    return traces[0].total >= traces[1].total ? 0 : 1;
  }

  if (advantage === "disadvantage") {
    return traces[0].total <= traces[1].total ? 0 : 1;
  }

  return 0;
}

function formatSingleDetail(terms: DiceTermResult[], modifiers: number[], total: number): string {
  const termParts = terms.map((term) => {
    const keptLabel = term.keepRule ? `${term.keepRule.type}${term.keepRule.count}` : "all";
    const keptValues = term.kept.join(", ") || "-";
    const prefix = term.sign === -1 ? "-" : "";
    return `${prefix}${term.notation} => [${term.rolls.join(", ")}] keep ${keptLabel}: [${keptValues}] => ${prefix}${Math.abs(term.subtotal)}`;
  });

  const modifierText = modifiers.length ? `modifiers: ${modifiers.join(", ")}` : "no modifiers";
  return [...termParts, modifierText, `total: ${total}`].join("\n");
}

function buildRollSummary(traces: SingleEvaluation[], advantage: AdvantageState, chosen: number): string {
  if (advantage === "normal" || traces.length === 1) {
    return traces[0].detail;
  }

  const labels = ["first", "second"];
  const blocks = traces.map((trace, index) => {
    const header = `${labels[index]} roll (${trace.total})${index === chosen ? " ← kept" : ""}`;
    return `${header}\n${trace.detail}`;
  });

  return [`advantage mode: ${advantage}`, ...blocks].join("\n\n");
}

function normalizeExpression(expression: string): string {
  return expression.replace(/\s+/g, "").replace(/\u2212/g, "-");
}

function termToString(spec: TermSpec): string {
  const keep = spec.keep ? `${spec.keep.type}${spec.keep.count}` : "";
  const explode = spec.explode ? "!" : "";
  return `${spec.count}d${spec.sides}${explode}${keep}`;
}

function formatPrefix(sign: 1 | -1, first: boolean): string {
  if (first) {
    return sign === -1 ? "-" : "";
  }
  return sign === -1 ? "-" : "+";
}
