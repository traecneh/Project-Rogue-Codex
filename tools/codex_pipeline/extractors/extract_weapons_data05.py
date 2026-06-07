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

import sys
from pathlib import Path

try:
    from tools.codex_pipeline.extractors.field_schemas import (
        WEAPON_FIELD_NAMES,
        build_fields,
    )
    from tools.codex_pipeline.extractors.item_metadata import (
        PERK_LABELS,
        enrich_weapon_fields,
        resolve_corrupted_perk_label,
    )
    from tools.codex_pipeline.extractors.shared import (
        extract_ascii_name,
        find_varying_indices,
        load_xor_encoded_records,
        parse_extractor_args,
        write_extractor_output,
    )
except ModuleNotFoundError:
    from field_schemas import (
        WEAPON_FIELD_NAMES,
        build_fields,
    )
    from item_metadata import (
        PERK_LABELS,
        enrich_weapon_fields,
        resolve_corrupted_perk_label,
    )
    from shared import (
        extract_ascii_name,
        find_varying_indices,
        load_xor_encoded_records,
        parse_extractor_args,
        write_extractor_output,
    )

XOR_KEY_WORD = 0xD4D4
# data05.dat packs eight 248-byte weapon entries back-to-back in each 1984-byte
# chunk. A single weapon entry is 124 16-bit words.
WORDS_PER_RECORD = 124
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
    if argv is None:
        argv = sys.argv[1:]

    # Default paths: same folder as this script
    base_dir = Path(__file__).resolve().parent
    parsed_args = parse_extractor_args(argv)
    data_path = parsed_args.data_path
    out_path = parsed_args.out_path
    diff_out_path = parsed_args.diff_out_path
    if data_path is None:
        data_path = base_dir / "data05.dat"
    if out_path is None:
        out_path = base_dir / "weapons_data05.json"
    if diff_out_path is not None:
        if diff_out_path.exists() and diff_out_path.is_dir():
            raise SystemExit(f"Diff output path is a directory: {diff_out_path}")
        if not diff_out_path.parent.exists():
            raise SystemExit(
                f"Diff output directory not found: {diff_out_path.parent}"
            )

    if not data_path.is_file():
        raise SystemExit(f"Input file not found: {data_path}")

    weapons, skipped = parse_data05(data_path)
    write_extractor_output(
        weapons,
        out_path,
        output_label="weapons",
        skipped_message=f"skipped {skipped} missing/unused names",
        record_label="Weapon",
        diff_out_path=diff_out_path,
    )

    # Report perk values and associated weapons (to help map/verify labels)
    perk_groups = {}
    corrupted_groups = {}
    for w in weapons:
        fields = w["fields"]
        val = fields.get("perk")
        if val is None:
            pass
        else:
            perk_groups.setdefault(val, []).append(w["name"])
        cval = fields.get("corrupted_perk")
        if cval not in (None, 0):
            corrupted_groups.setdefault(cval, []).append(w["name"])
    if perk_groups:
        labeled = {v: names for v, names in perk_groups.items() if v in PERK_LABELS}
        unlabeled = {v: names for v, names in perk_groups.items() if v not in PERK_LABELS}
        if labeled:
            print("Perk values (labeled):")
            for val in sorted(labeled):
                label = PERK_LABELS.get(val, "")
                names = ", ".join(labeled[val])
                print(f"  {val} ({label}): {names}")
        if unlabeled:
            print("Perk values (unlabeled):")
            for val in sorted(unlabeled):
                names = ", ".join(unlabeled[val])
                print(f"  {val}: {names}")

    if corrupted_groups:
        labeled_c = {
            v: names
            for v, names in corrupted_groups.items()
            if resolve_corrupted_perk_label(v) is not None
        }
        unlabeled_c = {
            v: names
            for v, names in corrupted_groups.items()
            if resolve_corrupted_perk_label(v) is None
        }
        if labeled_c:
            print("Corrupted perk values (labeled):")
            for val in sorted(labeled_c):
                label = resolve_corrupted_perk_label(val) or ""
                names = ", ".join(labeled_c[val])
                print(f"  {val} ({label}): {names}")
        if unlabeled_c:
            print("Corrupted perk values (unlabeled):")
            for val in sorted(unlabeled_c):
                names = ", ".join(unlabeled_c[val])
                print(f"  {val}: {names}")


if __name__ == "__main__":
    main()
