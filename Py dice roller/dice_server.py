#!/usr/bin/env python3
"""
Simple Dice Roller MCP Server - Provides comprehensive dice rolling functionality for games and simulations
"""
import os
import sys
import logging
import random
from mcp.server.fastmcp import FastMCP

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger("dice-server")

# Initialize MCP server - NO PROMPT PARAMETER!
mcp = FastMCP("dice")

# === UTILITY FUNCTIONS ===
def parse_dice_notation(notation):
    """Parse dice notation like 2d6+3 into components"""
    try:
        # Handle modifier
        modifier = 0
        if '+' in notation:
            parts = notation.split('+')
            notation = parts[0]
            modifier = int(parts[1])
        elif '-' in notation:
            parts = notation.split('-')
            notation = parts[0]
            modifier = -int(parts[1])
        
        # Parse XdY format
        if 'd' in notation.lower():
            parts = notation.lower().split('d')
            num_dice = int(parts[0]) if parts[0] else 1
            sides = int(parts[1])
            return num_dice, sides, modifier
        else:
            # Single number means 1 die with that many sides
            return 1, int(notation), modifier
    except:
        return None, None, None

def format_roll_result(rolls, total, modifier=0):
    """Format roll results nicely"""
    if len(rolls) == 1 and modifier == 0:
        return f"🎲 Rolled: {rolls[0]}"
    
    rolls_str = " + ".join(str(r) for r in rolls)
    if modifier > 0:
        return f"🎲 Rolled: {rolls_str} + {modifier} = **{total}**"
    elif modifier < 0:
        return f"🎲 Rolled: {rolls_str} - {abs(modifier)} = **{total}**"
    else:
        return f"🎲 Rolled: {rolls_str} = **{total}**"

# === MCP TOOLS ===

@mcp.tool()
async def flip_coin(count: str = "1") -> str:
    """Flip one or more coins and show results as heads or tails."""
    logger.info(f"Flipping {count} coin(s)")
    
    try:
        num_coins = int(count) if count.strip() else 1
        if num_coins < 1:
            return "❌ Error: Must flip at least 1 coin"
        if num_coins > 100:
            return "❌ Error: Maximum 100 coins at once"
        
        results = []
        for _ in range(num_coins):
            results.append("Heads" if random.randint(0, 1) == 1 else "Tails")
        
        if num_coins == 1:
            return f"🪙 Coin flip: **{results[0]}**"
        else:
            heads = results.count("Heads")
            tails = results.count("Tails")
            return f"""🪙 Flipped {num_coins} coins:
- Heads: {heads} ({heads/num_coins*100:.1f}%)
- Tails: {tails} ({tails/num_coins*100:.1f}%)
Results: {', '.join(results)}"""
    except ValueError:
        return f"❌ Error: Invalid count: {count}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_dice(notation: str = "1d20") -> str:
    """Roll dice using standard notation like 1d20, 2d6+3, 3d8-2, etc."""
    logger.info(f"Rolling dice: {notation}")
    
    try:
        if not notation.strip():
            notation = "1d20"
        
        num_dice, sides, modifier = parse_dice_notation(notation)
        if num_dice is None:
            return f"❌ Error: Invalid dice notation '{notation}'. Use format like '2d6' or '1d20+5'"
        
        if num_dice < 1 or num_dice > 100:
            return "❌ Error: Number of dice must be between 1 and 100"
        if sides < 2 or sides > 1000:
            return "❌ Error: Dice sides must be between 2 and 1000"
        
        rolls = [random.randint(1, sides) for _ in range(num_dice)]
        total = sum(rolls) + modifier
        
        result = format_roll_result(rolls, total, modifier)
        return result
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_custom(sides: str = "6", count: str = "1") -> str:
    """Roll custom dice with any number of sides."""
    logger.info(f"Rolling {count} d{sides}")
    
    try:
        num_sides = int(sides) if sides.strip() else 6
        num_dice = int(count) if count.strip() else 1
        
        if num_dice < 1 or num_dice > 100:
            return "❌ Error: Number of dice must be between 1 and 100"
        if num_sides < 2 or num_sides > 1000:
            return "❌ Error: Dice sides must be between 2 and 1000"
        
        rolls = [random.randint(1, num_sides) for _ in range(num_dice)]
        total = sum(rolls)
        
        result = f"🎲 Rolling {num_dice}d{num_sides}: "
        if num_dice == 1:
            result += f"**{rolls[0]}**"
        else:
            result += f"{' + '.join(str(r) for r in rolls)} = **{total}**"
        
        return result
    except ValueError:
        return f"❌ Error: Invalid input - sides: {sides}, count: {count}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_stats() -> str:
    """Roll D&D ability scores using 4d6 drop lowest method for all six stats."""
    logger.info("Rolling D&D stats")
    
    try:
        stats = []
        details = []
        
        for i in range(6):
            rolls = sorted([random.randint(1, 6) for _ in range(4)], reverse=True)
            kept = rolls[:3]
            dropped = rolls[3]
            stat_total = sum(kept)
            stats.append(stat_total)
            details.append(f"  {i+1}. Rolled: {rolls} → Kept {kept} (dropped {dropped}) = **{stat_total}**")
        
        stats_sorted = sorted(stats, reverse=True)
        total = sum(stats)
        modifier_total = sum((stat - 10) // 2 for stat in stats)
        
        return f"""⚔️ **D&D Ability Scores** (4d6 drop lowest):

{chr(10).join(details)}

**Final Stats:** {', '.join(str(s) for s in stats)}
**Sorted:** {', '.join(str(s) for s in stats_sorted)}
**Total:** {total} | **Modifier Sum:** {'+' if modifier_total >= 0 else ''}{modifier_total}"""
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_advantage(modifier: str = "0") -> str:
    """Roll a d20 with advantage (roll twice, take higher) with optional modifier."""
    logger.info(f"Rolling with advantage, modifier: {modifier}")
    
    try:
        mod = int(modifier) if modifier.strip() else 0
        
        roll1 = random.randint(1, 20)
        roll2 = random.randint(1, 20)
        higher = max(roll1, roll2)
        total = higher + mod
        
        result = f"🎯 **Advantage Roll:**\n"
        result += f"  First roll: {roll1}\n"
        result += f"  Second roll: {roll2}\n"
        result += f"  Taking higher: **{higher}**"
        
        if mod != 0:
            result += f"\n  With modifier: {higher} {'+' if mod >= 0 else '-'} {abs(mod)} = **{total}**"
        
        if roll1 == 20 or roll2 == 20:
            result += "\n  🌟 **CRITICAL SUCCESS!**"
        elif roll1 == 1 and roll2 == 1:
            result += "\n  💀 **CRITICAL FAILURE!**"
        
        return result
    except ValueError:
        return f"❌ Error: Invalid modifier: {modifier}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_disadvantage(modifier: str = "0") -> str:
    """Roll a d20 with disadvantage (roll twice, take lower) with optional modifier."""
    logger.info(f"Rolling with disadvantage, modifier: {modifier}")
    
    try:
        mod = int(modifier) if modifier.strip() else 0
        
        roll1 = random.randint(1, 20)
        roll2 = random.randint(1, 20)
        lower = min(roll1, roll2)
        total = lower + mod
        
        result = f"😰 **Disadvantage Roll:**\n"
        result += f"  First roll: {roll1}\n"
        result += f"  Second roll: {roll2}\n"
        result += f"  Taking lower: **{lower}**"
        
        if mod != 0:
            result += f"\n  With modifier: {lower} {'+' if mod >= 0 else '-'} {abs(mod)} = **{total}**"
        
        if lower == 20:
            result += "\n  🌟 **CRITICAL SUCCESS!**"
        elif lower == 1:
            result += "\n  💀 **CRITICAL FAILURE!**"
        
        return result
    except ValueError:
        return f"❌ Error: Invalid modifier: {modifier}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_check(dc: str = "15", modifier: str = "0", skill_name: str = "") -> str:
    """Make a skill check against a DC with a d20 roll plus modifier."""
    logger.info(f"Rolling skill check DC {dc} with modifier {modifier}")
    
    try:
        difficulty_class = int(dc) if dc.strip() else 15
        mod = int(modifier) if modifier.strip() else 0
        skill = skill_name.strip() if skill_name.strip() else "Check"
        
        roll = random.randint(1, 20)
        total = roll + mod
        success = total >= difficulty_class
        
        result = f"🎲 **{skill} (DC {difficulty_class}):**\n"
        result += f"  Rolled: {roll}"
        
        if mod != 0:
            result += f" {'+' if mod >= 0 else '-'} {abs(mod)} = **{total}**"
        else:
            result += f" = **{total}**"
        
        if roll == 20:
            result += "\n  🌟 **NATURAL 20! CRITICAL SUCCESS!**"
        elif roll == 1:
            result += "\n  💀 **NATURAL 1! CRITICAL FAILURE!**"
        elif success:
            margin = total - difficulty_class
            result += f"\n  ✅ **SUCCESS!** (by {margin} point{'s' if margin != 1 else ''})"
        else:
            margin = difficulty_class - total
            result += f"\n  ❌ **FAILURE** (missed by {margin} point{'s' if margin != 1 else ''})"
        
        return result
    except ValueError:
        return f"❌ Error: Invalid input - DC: {dc}, modifier: {modifier}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

@mcp.tool()
async def roll_initiative(modifier: str = "0", combatants: str = "1") -> str:
    """Roll initiative for one or more combatants in D&D combat."""
    logger.info(f"Rolling initiative for {combatants} combatants")
    
    try:
        mod = int(modifier) if modifier.strip() else 0
        num_combatants = int(combatants) if combatants.strip() else 1
        
        if num_combatants < 1 or num_combatants > 20:
            return "❌ Error: Number of combatants must be between 1 and 20"
        
        results = []
        for i in range(num_combatants):
            roll = random.randint(1, 20)
            total = roll + mod
            results.append((i + 1, roll, total))
        
        # Sort by total initiative (descending)
        results.sort(key=lambda x: x[2], reverse=True)
        
        output = "⚔️ **Initiative Order:**\n"
        for combatant, roll, total in results:
            if num_combatants == 1:
                output += f"  Rolled: {roll}"
                if mod != 0:
                    output += f" {'+' if mod >= 0 else '-'} {abs(mod)}"
                output += f" = **{total}**"
            else:
                output += f"  Combatant {combatant}: {roll}"
                if mod != 0:
                    output += f" {'+' if mod >= 0 else '-'} {abs(mod)}"
                output += f" = **{total}**\n"
        
        return output.rstrip()
    except ValueError:
        return f"❌ Error: Invalid input - modifier: {modifier}, combatants: {combatants}"
    except Exception as e:
        logger.error(f"Error: {e}")
        return f"❌ Error: {str(e)}"

# === SERVER STARTUP ===
if __name__ == "__main__":
    logger.info("Starting Dice Roller MCP server...")
    
    try:
        mcp.run(transport='stdio')
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)