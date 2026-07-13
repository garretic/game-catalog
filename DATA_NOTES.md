# games.json — data provenance & decisions

## Source
Compiled from my two accounts (both kept, this is a backup so I'm independent of them):
- **HowLongToBeat** — primary source. Provided completion dates, platforms, and full history (480 rows scraped from the Completed list).
- **IGN Playlist** — secondary. Used only to fill in studio/developer names (181 rows).

## Record count
- 480 rows scraped from HLTB.
- 2 collapsed as true duplicates → **478 final entries**.

## Field schema (per entry)
- `title` — game name (HLTB spelling).
- `studio` — developer, from IGN where available (~197 filled). Rest blank, to be auto-filled from RAWG at runtime.
- `platform` — platform I finished it on.
- `date` — completion date, ISO `YYYY-MM-DD`. Some are **year-only** (e.g. `2017`) and some are **blank** (older games HLTB had no date for).
- `year` — derived from `date` (blank if no date).
- `rating` — blank. HLTB showed all as "NR" (not rated); left empty for me to fill later.
- `hours` — blank. HLTB List view didn't expose per-game playtime, so none captured.
- `note` — blank freeform field.

## Duplicate decisions
Kept as SEPARATE entries (do not dedupe):
- Different games sharing a name: God of War (PS2 vs 2018), Ratchet & Clank (PS2 vs PS4), Star Wars: Battlefront (2004 vs 2015 reboot, both PC), Star Wars: Battlefront II (PS2 vs 2017).
- Remasters/remakes kept separate from originals: Mass Effect + Mass Effect 2 (Xbox 360 vs PS4 Legendary Edition), The Legend of Zelda: Link's Awakening (Game Boy vs Switch remake).
- Same game finished on two platforms (kept both as playthrough records): Mega Man Legends (PS1 / N64), Super Mario Bros. 3 (NES / Switch), The Legend of Zelda (NES / 3DS), A Link to the Past (SNES / GBA).
- Metroid on NES — beaten twice (2019 and 2022), both dates kept.

Collapsed to ONE entry (accidental double-records):
- Tales of Monkey Island (PC) — kept the dated row (2018-03-08).
- X-Men vs. Street Fighter (Sega Saturn) — kept the dated row (2022-11-30).

## Known gaps / to-do
- Studios and genres are sparse → enrich from RAWG API at load time, without overwriting existing values.
- Ratings and hours are empty across the board → fill in manually over time if wanted.
- Some retro/Japanese titles may not match RAWG cleanly (accents, "HD"/"Remaster" suffixes, arcade games) → support a manual cover-URL override in games.json.
