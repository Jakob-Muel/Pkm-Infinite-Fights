# PKM Infinite Fights

Browser-based Pokémon stat-battle game inspired by Top Trumps (known as “Quartett” in German). A random Pokémon challenges you in a specific stat (e.g. Attack or Speed). Choose a Pokémon with a higher value in that stat to win. Your chosen Pokémon then becomes the new challenger. How long can your streak last?

Currently hosted over Githup Pages:

[Link to the game](https://jakob-muel.github.io/Pkm-Chain-Athon/)

## How to Play

0. Login, Sign Up or play as guest
1. Press **Start Game** — a random Pokémon appears as your first opponent with a given stat value to beat (e.g. higher defense stat).
2. Search for a Pokémon on the right by either browsing with ◀ ▶, or using the searchfield.
3. Press **Battle** — it is revealed if you have won or not.
4. If you win, your Pokémon becomes the new Challenger. If you lose, the run ends.
5. No Pokémon can be used twice. Check the **Eliminated** button to see who's out.

## Tech Stack

- Plain HTML, CSS & JavaScript — no framework
- Google Fonts (Press Start 2P)
- Backend for userdata including highscores in [Supabase](https://supabase.com/)
- Hosted on GitHub Pages

## Roadmap

- **Accessibility / Keyboard mode** — make the full game playable with keyboard only
- **New generations** — expand beyond Gen 1 to the full National Pokédex
- **New game modes** — Easy mode with a health system, Hard mode where ties count as a loss
- **dedicated URL** — making the website accesible over a dedicated URL

## Credits

- Pokémon data provided by [PokéAPI](https://pokeapi.co)
- Built with the assistance of agentic Coding
- Pokémon and all related names are trademarks of Nintendo / Game Freak.
