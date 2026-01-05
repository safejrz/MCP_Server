# 🎲 Dice Roller MCP Server

A complete example of a Model Context Protocol (MCP) server that provides comprehensive dice rolling functionality for tabletop games, RPGs, and random number generation.

## Features

- **`flip_coin`** - Flip one or more coins
- **`roll_dice`** - Roll dice using standard notation (e.g., 2d6+3, 1d20-2)
- **`roll_custom`** - Roll custom dice with any number of sides
- **`roll_stats`** - Generate D&D ability scores using 4d6 drop lowest
- **`roll_advantage`** - Roll d20 with advantage
- **`roll_disadvantage`** - Roll d20 with disadvantage
- **`roll_check`** - Make a skill check against a DC
- **`roll_initiative`** - Roll initiative for combat

## Quick Setup

```bash
# 1. Build the Docker image
docker build -t dice-mcp-server .

# 2. Follow the installation instructions
cat install_instructions.txt
```

## Usage Examples

Ask Claude:
- "Roll 2d6+3 for damage"
- "Generate D&D stats for a new character"
- "Roll a perception check with +5 modifier against DC 15"
- "Flip 3 coins"
- "Roll with advantage and add my +7 attack bonus"

## Files Included

- `Dockerfile` - Container configuration
- `requirements.txt` - Python dependencies
- `dice_server.py` - Main server implementation
- `install_instructions.txt` - Step-by-step setup guide
- `readme.txt` - Original documentation

## Dice Notation Guide

- **XdY**: Roll X dice with Y sides (e.g., 3d6)
- **XdY+Z**: Add Z to the total
- **XdY-Z**: Subtract Z from the total
- **d20**: When X is omitted, defaults to 1 die

## Testing

```bash
# Test locally
python dice_server.py

# Test MCP protocol
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | python dice_server.py
```