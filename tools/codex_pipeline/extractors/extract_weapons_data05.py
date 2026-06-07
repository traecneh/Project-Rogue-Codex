#!/usr/bin/env python3
"""
Extract weapon (offensive item) definitions from data05.dat into a JSON file.

- Expects data05.dat in the same directory as this script by default.
- Writes weapons_data05.json in the same directory by default.
- If an existing weapons_data05.json is present, it is backed up with a timestamp,
  hashed, and compared against the newly written file.
- Optional: use --diff-out PATH to write a name-aware diff of changes.

Each weapon record:
  - 124 little-endian 16-bit words (248 bytes), XOR-encoded with 0xD4D4.
  - Record count = total_words / 124.

Output JSON format (per weapon):
{
  "id": int,
  "name": str,
  "fields": {
    "unknown_<word_index>": value,
    ...
  }
}

Notes:
- "fields" only includes word indices that vary across at least one record
  (same logic as your monster script).
- All field names start as "unknown_<index>" so you can later rename them
  once you map them to in-game meanings (e.g. min_damage, max_damage, value, etc.).
"""

from pathlib import Path

try:
    from tools.codex_pipeline.extractors.field_schemas import (
        WEAPON_FIELD_NAMES,
        build_fields,
    )
    from tools.codex_pipeline.extractors.item_metadata import (
        enrich_weapon_fields,
        report_item_perk_values,
    )
    from tools.codex_pipeline.extractors.shared import (
        ExtractorRunConfig,
        extract_ascii_name,
        find_varying_indices,
        load_xor_encoded_records,
        run_configured_extractor,
    )
except ModuleNotFoundError:
    from field_schemas import (
        WEAPON_FIELD_NAMES,
        build_fields,
    )
    from item_metadata import (
        enrich_weapon_fields,
        report_item_perk_values,
    )
    from shared import (
        ExtractorRunConfig,
        extract_ascii_name,
        find_varying_indices,
        load_xor_encoded_records,
        run_configured_extractor,
    )

XOR_KEY_WORD = 0xD4D4
# data05.dat packs eight 248-byte weapon entries back-to-back in each 1984-byte
# chunk. A single weapon entry is 124 16-bit words.
WORDS_PER_RECORD = 124
RUN_CONFIG = ExtractorRunConfig(
    default_data_filename="data05.dat",
    default_output_filename="weapons_data05.json",
    output_label="weapons",
    record_label="Weapon",
    skipped_message_template="skipped {skipped} missing/unused names",
)


def parse_data05(path: Path):
    """Parse data05.dat and return a list of weapon dicts."""
    records = load_xor_encoded_records(
        path, words_per_record=WORDS_PER_RECORD, xor_key=XOR_KEY_WORD
    )
    varying_indices = find_varying_indices(records)

    weapons = []
    skipped = 0

    for rec_index, rec_words in enumerate(records):
        fields = build_fields(rec_words, varying_indices, WEAPON_FIELD_NAMES)

        # Skip disabled weapon types (bows/crossbows) before name extraction/output.
        if rec_words[22] in (7, 8):
            skipped += 1
            continue

        # Weapon name = first printable chunk up to first null
        name = extract_ascii_name(rec_words)
        if not name or name.lower() == "unused":
            # Skip placeholder or nameless entries.
            skipped += 1
            continue

        enrich_weapon_fields(fields)

        weapon = {
            "id": rec_index,
            "name": name,
            "fields": fields,
        }
        weapons.append(weapon)

    return weapons, skipped


def main(argv=None):
    weapons = run_configured_extractor(
        argv,
        script_file=__file__,
        config=RUN_CONFIG,
        parse_records=parse_data05,
    )

    report_item_perk_values(weapons, include_zero_perks=True)


if __name__ == "__main__":
    main()
