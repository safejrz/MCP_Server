# Dice Roller MCP Server

A lightweight Model Context Protocol server that exposes three dice related tools:

- `flip_coins` — flip one or more coins.
- `roll_expression` — evaluate generic dice expressions (NdM with modifiers, optional advantage/disadvantage, exploding dice, repeats).
- `dnd_roll` — opinionated helpers for D&D style checks, attacks, saves, and damage rolls (with critical damage doubling).

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in watch/dev mode (stdio transport):
   ```bash
   npm run dev
   ```
3. Build for distribution:
   ```bash
   npm run build
   ```
4. Run the compiled server:
   ```bash
   npm start
   ```

The server speaks MCP over stdio, so wire it up with your MCP-compatible client (e.g., Claude Desktop custom server entry).

## Tool Details

### flip_coins
- **Inputs**: `count` (1-50, default 1)
- **Output**: per-flip list and aggregate heads/tails count.

### roll_expression
- **Inputs**:
  - `expression`: Any combination of dice terms (`NdM`, optional `!` for exploding and `kh/kl` keep rules) plus modifiers.
  - `repeat`: Number of independent rolls (1-20).
  - `advantage`: `normal`, `advantage`, or `disadvantage`.
  - `explodeOnMax`: Force explosion for every die.
- **Output**: Detailed breakdown per roll, including trace for advantage/disadvantage comparisons.

### dnd_roll
Handles common tabletop workflows:
- `mode`: `ability-check`, `attack-roll`, `saving-throw`, `damage-roll`.
- `abilityModifier`, `proficiencyBonus`, `proficient`, `bonus`, `attackBonus` tune static modifiers.
- `advantage` / `difficultyClass` for d20-based rolls.
- `damageExpression`, `damageBonus`, `critical` for damage math (dice double on crits).
- `repeat` to run multiple times in one call, `label` for context.

## Notes

- Randomness is provided by Node's `crypto.randomInt` for uniform results.
- Advantage/disadvantage evaluates the full expression twice and keeps the higher/lower total.
- Critical damage doubles the quantity of dice while leaving modifiers untouched, matching standard 5e rules.
