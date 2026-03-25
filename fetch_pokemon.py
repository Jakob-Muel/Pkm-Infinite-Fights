import requests
import json
import os
import time
from datetime import date

BASE_URL = "https://pokeapi.co/api/v2"
TOTAL = 151

# Create the pkm folder if it doesn't exist
os.makedirs("pkm", exist_ok=True)


def fetch(url):
    """Fetch a URL with basic error handling."""
    response = requests.get(url)
    response.raise_for_status()
    return response.json()


def get_pokemon(pokemon_id):
    """Fetch and clean a single Pokemon's data."""
    data = fetch(f"{BASE_URL}/pokemon/{pokemon_id}")

    # Only keep level-up moves to keep file size manageable
    level_up_moves = [
        m["move"]["name"]
        for m in data["moves"]
        if any(v["move_learn_method"]["name"] == "level-up" for v in m["version_group_details"])
    ]

    return {
        "id": data["id"],
        "name": data["name"],
        "display_name": data["name"].capitalize(),
        "sprite": data["sprites"]["front_default"],
        "types": [t["type"]["name"] for t in data["types"]],
        "stats": {
            "hp":        data["stats"][0]["base_stat"],
            "attack":    data["stats"][1]["base_stat"],
            "defense":   data["stats"][2]["base_stat"],
            "sp_attack": data["stats"][3]["base_stat"],
            "sp_defense":data["stats"][4]["base_stat"],
            "speed":     data["stats"][5]["base_stat"],
        },
        "moves": level_up_moves,
    }


# Fetch all 151 Pokemon
all_pokemon = []

for i in range(1, TOTAL + 1):
    print(f"[{i}/{TOTAL}] Fetching Pokemon #{i}...")
    try:
        pkm = get_pokemon(i)
        all_pokemon.append(pkm)
        print(f"  -> {pkm['display_name']} ({', '.join(pkm['types'])})")
    except Exception as e:
        print(f"  -> ERROR: {e}")

    # Small delay to be polite to the API
    time.sleep(0.3)


# Build the final output
output = {
    "version": "1.0",
    "last_updated": str(date.today()),
    "count": len(all_pokemon),
    "pokemon": all_pokemon,
}

output_path = os.path.join("pkm", "pokemon.json")
with open(output_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"\nDone! Saved {len(all_pokemon)} Pokemon to {output_path}")
