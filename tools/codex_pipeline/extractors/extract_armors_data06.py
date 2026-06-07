#!/usr/bin/env python3
"""
Extract armor/robe/defensive item definitions from data06.dat into a JSON file.

- Expects data06.dat in the same directory as this script by default.
- Writes armors_data06.json in the same directory by default.
- If an existing armors_data06.json is present, it is backed up with a timestamp,
  hashed, and compared against the newly written file.
- Optional: use --diff-out PATH to write a name-aware diff of changes.

Each armor record:
  - 120 little-endian 16-bit words (240 bytes), XOR-encoded with 0xD4D4.
  - Record count = total_words / 120.

Output JSON format (per armor):
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
  (same logic as your monster and weapon scripts).
- All field names start as "unknown_<index>" so you can later rename them
  once you map them to in-game meanings (e.g. armor_value, value, resist_type, etc.).
"""

from pathlib import Path

try:
    from tools.codex_pipeline.extractors.field_schemas import (
        ARMOR_FIELD_NAMES,
        build_fields,
    )
    from tools.codex_pipeline.extractors.item_metadata import (
        enrich_armor_fields,
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
        ARMOR_FIELD_NAMES,
        build_fields,
    )
    from item_metadata import (
        enrich_armor_fields,
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
# data06.dat packs eight 240-byte armor entries back-to-back in each 1920-byte
# chunk. A single armor entry is 120 16-bit words.
WORDS_PER_RECORD = 120
RUN_CONFIG = ExtractorRunConfig(
    default_data_filename="data06.dat",
    default_output_filename="armors_data06.json",
    output_label="armors",
    record_label="Item",
    skipped_message_template="skipped {skipped} without names",
)


def parse_data06(path: Path):
    """Parse data06.dat and return a list of armor dicts."""
    records = load_xor_encoded_records(
        path, words_per_record=WORDS_PER_RECORD, xor_key=XOR_KEY_WORD
    )
    varying_indices = find_varying_indices(records)

    armors = []
    skipped = 0

    for rec_index, rec_words in enumerate(records):
        fields = build_fields(rec_words, varying_indices, ARMOR_FIELD_NAMES)

        # Skip disabled slots (not enabled in game)
        if rec_words[19] in (15, 16):
            skipped += 1
            continue

        # Armor name = first printable chunk up to first null
        name = extract_ascii_name(rec_words)
        if not name or name.lower() == "unused":
            # Skip blank or placeholder records.
            skipped += 1
            continue

        enrich_armor_fields(fields)

        armor = {
            "id": rec_index,
            "name": name,
            "fields": fields,
        }
        armors.append(armor)

    return armors, skipped


def main(argv=None):
    armors = run_configured_extractor(
        argv,
        script_file=__file__,
        config=RUN_CONFIG,
        parse_records=parse_data06,
    )

    report_item_perk_values(armors, include_zero_perks=False)


if __name__ == "__main__":
    main()
