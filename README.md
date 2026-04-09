# PKM Infinite Fights

A browser-based Pokémon stat-battle game. A random Pokémon defends — you pick your challenger and choose your moment to fight. Win, and your Pokémon carries the streak forward. Lose, and it's game over.

## How to Play

1. Press **Start Game** — a random Pokémon appears as your first opponent.
2. Search for a Pokémon on the right, browse with ◀ ▶, or leave the field empty to see all available options.
3. Press **Battle** — a random stat category is revealed and the winner is decided.
4. If you win, your Pokémon becomes the new defender. If you lose, the run ends.
5. No Pokémon can be used twice. Check the **Eliminated** button to see who's out.

## Tech Stack

- Plain HTML, CSS & JavaScript — no framework
- [PokeAPI](https://pokeapi.co) — Pokémon data (first 151) fetched once via `fetch_pokemon.py` and stored locally as `pkm/pokemon.json`
- Google Fonts (Press Start 2P)
- Hosted on GitHub Pages

## Local Development

```bash
# Fetch Pokémon data (only needed once)
python3 fetch_pokemon.py

# Serve locally
python3 -m http.server 8000
# → open http://localhost:8000
```

## Credits

- Pokémon data provided by [PokéAPI](https://pokeapi.co) — a free, open RESTful Pokémon API.
- Built with the assistance of [Claude](https://claude.ai) (Anthropic AI).
- Pokémon and all related names are trademarks of Nintendo / Game Freak.
