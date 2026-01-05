import { randomInt } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import { AdvantageState, rollExpression } from "./dice.js";
import { DndRollMode, executeDndRoll } from "./dnd.js";

const advantageEnum = z.enum(["normal", "advantage", "disadvantage"]);

async function main(): Promise<void> {
  const server = new Server(
    {
      name: "dice-roller-mcp",
      version: "0.1.0",
      description: "Coin flips, dice expressions, and D&D friendly helpers.",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  registerCoinFlipTool(server);
  registerDiceExpressionTool(server);
  registerDndTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function registerCoinFlipTool(server: Server): void {
  const schema = z.object({
    count: z.number().int().min(1).max(50).default(1),
  });

  server.tool(
    {
      name: "flip_coins",
      description: "Flip one or more coins and return heads/tails counts.",
      inputSchema: schema,
    },
    async (input) => {
      const count = input.count;
      const flips = Array.from({ length: count }, () => flipCoin());
      const heads = flips.filter((value) => value === "heads").length;
      const tails = count - heads;

      const lines = [
        `coin flips: ${count}`,
        `results: ${flips.join(", ")}`,
        `heads: ${heads}, tails: ${tails}`,
      ];

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}

function registerDiceExpressionTool(server: Server): void {
  const schema = z.object({
    expression: z.string().min(1, "Provide a dice expression such as 2d6+1"),
    repeat: z.number().int().min(1).max(20).default(1),
    advantage: advantageEnum.default("normal"),
    explodeOnMax: z.boolean().default(false),
  });

  server.tool(
    {
      name: "roll_expression",
      description: "Roll any standard dice expression (NdM +/- modifiers with optional advantage).",
      inputSchema: schema,
    },
    async (input) => {
      const blocks = [];
      for (let i = 0; i < input.repeat; i += 1) {
        const outcome = rollExpression(input.expression, {
          advantage: input.advantage as AdvantageState,
          explodeOnMax: input.explodeOnMax,
        });

        blocks.push(`roll ${i + 1}: total ${outcome.total}\n${outcome.detail}`);
      }

      return {
        content: [
          {
            type: "text",
            text: blocks.join("\n\n"),
          },
        ],
      };
    },
  );
}

function registerDndTool(server: Server): void {
  const schema = z.object({
    mode: z.enum(["ability-check", "attack-roll", "saving-throw", "damage-roll"] satisfies DndRollMode[]),
    abilityModifier: z.number().int().min(-30).max(30).default(0),
    proficiencyBonus: z.number().int().min(0).max(10).default(0),
    proficient: z.boolean().default(false),
    advantage: advantageEnum.optional(),
    difficultyClass: z.number().int().min(1).max(40).optional(),
    bonus: z.number().int().min(-20).max(20).default(0),
    attackBonus: z.number().int().min(-20).max(20).default(0),
    damageExpression: z.string().optional(),
    damageBonus: z.number().int().min(-20).max(20).default(0),
    critical: z.boolean().default(false),
    repeat: z.number().int().min(1).max(10).default(1),
    label: z.string().max(60).optional(),
  }).refine(
    (payload) => (payload.mode === "damage-roll" ? Boolean(payload.damageExpression) : true),
    {
      message: "damageExpression is required when mode is damage-roll",
      path: ["damageExpression"],
    },
  );

  server.tool(
    {
      name: "dnd_roll",
      description:
        "Helper for common D&D rolls: ability checks, attack rolls, saving throws, and damage (with optional crits).",
      inputSchema: schema,
    },
    async (input) => {
      const outcome = executeDndRoll({
        mode: input.mode as DndRollMode,
        abilityModifier: input.abilityModifier,
        proficiencyBonus: input.proficiencyBonus,
        proficient: input.proficient,
        advantage: input.advantage as AdvantageState | undefined,
        difficultyClass: input.difficultyClass,
        bonus: input.bonus,
        attackBonus: input.attackBonus,
        damageExpression: input.damageExpression,
        damageBonus: input.damageBonus,
        critical: input.critical,
        repeat: input.repeat,
        label: input.label,
      });

      const header = [`mode: ${outcome.mode}`, `expression: ${outcome.expressionUsed}`];
      if (outcome.label) {
        header.push(`label: ${outcome.label}`);
      }

      const entries = outcome.entries.map((entry, index) => {
        const dcText = entry.dc !== undefined ? ` vs DC ${entry.dc} (${entry.passed ? "pass" : "fail"})` : "";
        return `roll ${index + 1}: ${entry.total}${dcText}\n${entry.detail}`;
      });

      return {
        content: [
          {
            type: "text",
            text: [...header, ...entries].join("\n\n"),
          },
        ],
      };
    },
  );
}

function flipCoin(): "heads" | "tails" {
  return randomInt(0, 2) === 0 ? "heads" : "tails";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
