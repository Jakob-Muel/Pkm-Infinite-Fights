# PKM Infinite Fights

A browser-based Pokémon stat-battle game. A random Pokémon defends, and you pick your challenger. Try to get the longest streak of wins going.

## How to Play

1. Press **Start Game** — a random Pokémon appears as your first opponent. A stat is given to be battled in.
2. Search for a Pokémon either by navigating with ◀ ▶, or by searching in the text field.
3. Press **Battle**. The stats of the challenger are revealed, and the fight is evaluated.
4. If you win, your Pokémon becomes the new opponent. If you lose, the streak ends.
5. No Pokémon can be used twice. Check the **Eliminated** button to see who's out.

## Tech Stack

- Plain HTML, CSS & JavaScript: I have decided to use no framework. I wanted the website to be as simple and as maintainable as possible.
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
## Future Plans

- Add more Pokémon from all generations
- Add Scoreboard and share-Button
- Add more possible stats to fight in

## Credits

- Pokémon data provided by [PokéAPI](https://pokeapi.co) — a free, open RESTful Pokémon API.
- Pokémon and all related names are trademarks of Nintendo / Game Freak.
