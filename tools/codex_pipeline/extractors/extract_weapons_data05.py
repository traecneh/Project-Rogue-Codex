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

import json
import sys
from pathlib import Path

try:
    from tools.codex_pipeline.extractors.item_metadata import (
        PERK_LABELS,
        WEAPON_ELEMENT_LABELS,
        WEAPON_RARITY_LABELS,
        WEAPON_SPECIALTY_LABELS,
        WEAPON_SUBTYPE_LABELS,
        add_field_label,
        resolve_corrupted_perk_label,
    )
    from tools.codex_pipeline.extractors.shared import (
        diff_json_records_by_id,
        extract_ascii_name,
        find_varying_indices,
        file_hash,
        load_xor_encoded_records,
        make_backup_path,
        parse_extractor_args,
    )
except ModuleNotFoundError:
    from item_metadata import (
        PERK_LABELS,
        WEAPON_ELEMENT_LABELS,
        WEAPON_RARITY_LABELS,
        WEAPON_SPECIALTY_LABELS,
        WEAPON_SUBTYPE_LABELS,
        add_field_label,
        resolve_corrupted_perk_label,
    )
    from shared import (
        diff_json_records_by_id,
        extract_ascii_name,
        find_varying_indices,
        file_hash,
        load_xor_encoded_records,
        make_backup_path,
        parse_extractor_args,
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

    # Known field names (indices that have been mapped)
    known_names = {
        # Name fragments (2-byte little-endian char pairs, continuing the ASCII name)
        0: "name_0",
        1: "name_1",
        2: "name_2",
        3: "name_3",
        4: "name_4",
        5: "name_5",
        6: "name_6",
        7: "name_7",
        8: "name_8",
        9: "name_9",
        10: "name_10",
        11: "name_11",
        # Stats
        13: "min_damage",
        14: "max_damage",
        16: "value_low",  # little-endian low word of gold value
        17: "value_high",  # high word of gold value
        18: "weight",
        19: "attack_speed",
        20: "skill_requirement",
        24: "specialty",
        25: "specialty_amount",
        26: "element",
        22: "subtype",
        23: "level_requirement",
        # Frame atlas positions (x, y, width, height)
        38: "frame_1_x",
        39: "frame_1_y",
        40: "frame_1_width",
        41: "frame_1_height",
        42: "frame_2_x",
        43: "frame_2_y",
        44: "frame_2_width",
        45: "frame_2_height",
        46: "frame_3_x",
        47: "frame_3_y",
        48: "frame_3_width",
        49: "frame_3_height",
        50: "frame_4_x",
        51: "frame_4_y",
        52: "frame_4_width",
        53: "frame_4_height",
        54: "frame_5_x",
        55: "frame_5_y",
        56: "frame_5_width",
        57: "frame_5_height",
        58: "frame_6_x",
        59: "frame_6_y",
        60: "frame_6_width",
        61: "frame_6_height",
        62: "frame_7_x",
        63: "frame_7_y",
        64: "frame_7_width",
        65: "frame_7_height",
        66: "frame_8_x",
        67: "frame_8_y",
        68: "frame_8_width",
        69: "frame_8_height",
        70: "frame_9_x",
        71: "frame_9_y",
        72: "frame_9_width",
        73: "frame_9_height",
        75: "max_rarity",
        # Shard / crafting values
        76: "shard_decomposition_amount",
        77: "shard_promotion_amount",
        80: "perk",
        99: "corrupted_perk",
        82: "fire_resistance",
        83: "cold_resistance",
        84: "electric_resistance",
        85: "acid_resistance",
        86: "poison_resistance",
        87: "disease_resistance",
        90: "strength",
        91: "dexterity",
        92: "constitution",
        96: "to_hit",
        28: "proc_chance",
    }

    def field_name(index: int) -> str:
        """Return a readable field name for a given word index."""
        return known_names.get(index, f"unknown_{index}")

    weapons = []
    skipped = 0

    for rec_index, rec_words in enumerate(records):
        fields = {}
        for i in varying_indices:
            fname = field_name(i)
            fields[fname] = rec_words[i]

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

        # Derived gold value (32-bit little-endian from value_low/value_high)
        if "value_low" in fields and "value_high" in fields:
            fields["value"] = fields["value_low"] + (fields["value_high"] << 16)

        add_field_label(fields, "subtype", "subtype_label", WEAPON_SUBTYPE_LABELS)
        add_field_label(fields, "specialty", "specialty_label", WEAPON_SPECIALTY_LABELS)
        add_field_label(fields, "element", "element_label", WEAPON_ELEMENT_LABELS)
        add_field_label(fields, "max_rarity", "max_rarity_label", WEAPON_RARITY_LABELS)

        # Perk labels (game-specific effects; extend as more are mapped)
        perk_val = fields.get("perk")
        if perk_val in PERK_LABELS:
            fields["perk_label"] = PERK_LABELS[perk_val]

        corrupted_val = fields.get("corrupted_perk")
        if corrupted_val:
            resolved = resolve_corrupted_perk_label(corrupted_val, perk_val)
            if resolved:
                fields["corrupted_perk_label"] = resolved

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

    backup_info = None
    if out_path.exists():
        if not out_path.is_file():
            raise SystemExit(f"Output path exists and is not a file: {out_path}")
        old_hash = file_hash(out_path)
        backup_path = make_backup_path(out_path)
        out_path.rename(backup_path)
        backup_info = (backup_path, old_hash)
        print(
            f"Backed up existing {out_path.name} to {backup_path.name} "
            f"(sha256: {old_hash})"
        )

    weapons, skipped = parse_data05(data_path)

    out_path.write_text(json.dumps(weapons, indent=2))
    print(
        f"Wrote {len(weapons)} weapons to {out_path} "
        f"(skipped {skipped} missing/unused names)"
    )
    new_hash = file_hash(out_path)
    if backup_info:
        backup_path, old_hash = backup_info
        if old_hash == new_hash:
            print(f"Hash check: new file matches backup (sha256: {new_hash})")
        else:
            print(
                "Hash check: new file differs from backup "
                f"(old {old_hash}, new {new_hash})"
            )
        diff_lines = diff_json_records_by_id(backup_path, out_path, record_label="Weapon")
        if diff_lines:
            if diff_out_path is not None:
                diff_out_path.write_text("\n".join(diff_lines) + "\n", encoding="utf-8")
                print(f"Diff written to {diff_out_path}")
            else:
                print("Diff (name-aware):")
                for line in diff_lines:
                    print(line)
        else:
            print("Diff: no changes.")
    else:
        print(f"New file hash (sha256): {new_hash}")

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
