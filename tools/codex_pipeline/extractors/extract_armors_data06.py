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

import json
import re
import sys
from pathlib import Path

try:
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
# data06.dat packs eight 240-byte armor entries back-to-back in each 1920-byte
# chunk. A single armor entry is 120 16-bit words.
WORDS_PER_RECORD = 120
PERK_LABELS = {
    1: "Lifesteal (Tier 2)",
    6: "Vitality (Tier 1)",
    10: "Juggernaut (Tier 1)",
    22: "Frozen Heart (Tier 1)",
    30: "Garrote (Tier 1)",
    44: "Consecration (Tier 1)",
    52: "Lethal Toxins (Tier 2)",
    100: "Runic (Tier 1)",
    104: "Flame Buffet (Tier 1)",
    107: "Blood Siphon (Tier 1)",
    257: "Lifesteal (Tier 2)",
    258: "Vampirism (Tier 1)",
    266: "Juggernaut (Tier 2)",
    270: "Moneybags (Tier 2)",
    285: "Vampirism (Tier 2)",
    286: "Garrote (Tier 2)",
    291: "Epidemic (Tier 2)",
    293: "Destruction (Tier 2)",
    295: "Hawkeye (Tier 2)",
    296: "Overpower (Tier 2)",
    297: "Demonsbane (Tier 2)",
    302: "Ice Shatter (Tier 2)",
    307: "Critical Aegis (Tier 2)",
    308: "Toxic Shell (Tier 2)",
    102: "Envenomation (Tier 1)",
    105: "Crimson Feast (Tier 1)",
    259: "Rejuvenation (Tier 2)",
    260: "Antitoxin (Tier 2)",
    261: "Immunization (Tier 2)",
    262: "Vitality (Tier 2)",
    263: "Bolstered Strength (Tier 2)",
    265: "Magic Shield (Tier 2)",
    267: "Parry (Tier 2)",
    268: "Alchemist (Tier 2)",
    269: "Knowledge (Tier 2)",
    277: "Demon Blood (Tier 2)",
    278: "Frozen Heart (Tier 2)",
    21: "Demon Blood",
    279: "Lightning Field (Tier 2)",
    280: "Tourniquet (Tier 2)",
    281: "Hazmat (Tier 2)",
    282: "Antacid (Tier 2)",
    287: "Brutality (Tier 2)",
    288: "Tenacity (Tier 2)",
    289: "Swiftness (Tier 2)",
    292: "Lethal Toxins (Tier 2)",
    300: "Consecration (Tier 2)",
    301: "Venomshock (Tier 2)",
    303: "Desperation (Tier 2)",
    304: "Bloodlust (Tier 2)",
    305: "Slayer (Tier 2)",
    362: "Plague Eater (Tier 2)",
    513: "Lifesteal (Tier 3)",
    514: "Bloodthirster (Tier 3)",
    515: "Rejuvenation (Tier 3)",
    516: "Antitoxin (Tier 3)",
    522: "Juggernaut (Tier 3)",
    524: "Alchemist (Tier 3)",
    525: "Knowledge (Tier 3)",
    533: "Demon Blood (Tier 3)",
    542: "Garrote (Tier 3)",
    549: "Destruction (Tier 3)",
    556: "Consecration (Tier 3)",
    559: "Desperation (Tier 3)",
    564: "Toxic Shell (Tier 3)",
    614: "Envenomation (Tier 3)",
    615: "Lycan (Tier 3)",
    619: "Blood Siphon (Tier 3)",
    3: "Rejuvenation (Tier 1)",
    4: "Antitoxin (Tier 1)",
    5: "Immunization (Tier 1)",
    9: "Magic Shield (Tier 1)",
    11: "Parry (Tier 1)",
    12: "Alchemist (Tier 1)",
    15: "Flame Strike (Tier 1)",
    16: "Lightning Javelin (Tier 1)",
    17: "Iceburst (Tier 1)",
    18: "Sulfuric (Tier 1)",
    19: "Plague (Tier 1)",
    20: "Toxicity (Tier 1)",
    36: "Lethal Toxins (Tier 1)",
    37: "Destruction (Tier 1)",
    101: "Vengeance (Tier 1)",
    518: "Vitality (Tier 3)",
    523: "Parry (Tier 3)",
    547: "Epidemic (Tier 3)",
    548: "Lethal Toxins (Tier 3)",
    560: "Bloodlust (Tier 3)",
    563: "Critical Aegis (Tier 3)",
    612: "Runic (Tier 3)",
    613: "Vengeance (Tier 3)",
    616: "Flame Buffet (Tier 3)",
    617: "Crimson Feast (Tier 3)",
}


_TIER_PATTERN = re.compile(r"\(Tier\s*(\d+)\)", re.IGNORECASE)


def _bump_tier_label(label: str) -> str:
    """Increment a '(Tier N)' suffix if present."""

    def repl(match: re.Match[str]) -> str:
        tier_num = int(match.group(1))
        return f"(Tier {tier_num + 1})"

    return _TIER_PATTERN.sub(repl, label, count=1)


def resolve_corrupted_perk_label(corrupted_val: int, base_val: int | None = None) -> str | None:
    """
    Try to resolve a human label for a corrupted perk value.

    Resolution order:
      1) Direct lookup in PERK_LABELS.
      2) If paired base perk is known, reuse its label (bumping Tier when cp = base + 256).
      3) If cp - 256 matches a known perk, use that label with a Tier bump.
    """
    if corrupted_val in PERK_LABELS:
        return PERK_LABELS[corrupted_val]

    if base_val is not None and base_val in PERK_LABELS:
        base_label = PERK_LABELS[base_val]
        if corrupted_val - base_val == 256:
            return _bump_tier_label(base_label)
        return base_label

    offset_base = corrupted_val - 256
    if offset_base in PERK_LABELS:
        return _bump_tier_label(PERK_LABELS[offset_base])

    return None


def parse_data06(path: Path):
    """Parse data06.dat and return a list of armor dicts."""
    records = load_xor_encoded_records(
        path, words_per_record=WORDS_PER_RECORD, xor_key=XOR_KEY_WORD
    )
    varying_indices = find_varying_indices(records)

    # Known field names we’ve mapped
    known_names = {
        # Name fragments (2-byte little-endian char pairs that form the item name)
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
        # Stats / properties
        13: "armor",
        14: "value_low",
        15: "value_high",
        16: "weight",
        17: "player_level_requirement",
        19: "slot",
        20: "level",
        72: "deconstruction",
        73: "promotion",
        79: "cold_resistance",
        # Frame atlas positions (x, y, width, height)
        34: "frame_1_x",
        35: "frame_1_y",
        36: "frame_1_width",
        37: "frame_1_height",
        38: "frame_2_x",
        39: "frame_2_y",
        40: "frame_2_width",
        41: "frame_2_height",
        42: "frame_3_x",
        43: "frame_3_y",
        44: "frame_3_width",
        45: "frame_3_height",
        46: "frame_4_x",
        47: "frame_4_y",
        48: "frame_4_width",
        49: "frame_4_height",
        50: "frame_5_x",
        51: "frame_5_y",
        52: "frame_5_width",
        53: "frame_5_height",
        54: "frame_6_x",
        55: "frame_6_y",
        56: "frame_6_width",
        57: "frame_6_height",
        58: "frame_7_x",
        59: "frame_7_y",
        60: "frame_7_width",
        61: "frame_7_height",
        62: "frame_8_x",
        63: "frame_8_y",
        64: "frame_8_width",
        65: "frame_8_height",
        66: "frame_9_x",
        67: "frame_9_y",
        68: "frame_9_width",
        69: "frame_9_height",
        71: "max_rarity",
        76: "perk",
        95: "corrupted_perk",
        78: "fire_resistance",
        80: "lightning_resistance",
        82: "acid_resistance",
        83: "poison_resistance",
        84: "disease_resistance",
        86: "strength",
        87: "dexterity",
        88: "constitution",
        92: "to_hit",
    }

    def field_name(index: int) -> str:
        """Return a readable field name for a given word index."""
        return known_names.get(index, f"unknown_{index}")

    armors = []
    skipped = 0

    for rec_index, rec_words in enumerate(records):
        fields = {}
        for i in varying_indices:
            fname = field_name(i)
            fields[fname] = rec_words[i]

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

        # Derived gold value (32-bit little-endian from value_low/value_high)
        if "value_low" in fields and "value_high" in fields:
            fields["value"] = fields["value_low"] + (fields["value_high"] << 16)

        # Human-readable slot label
        slot_labels = {
            10: "Helmet",
            11: "Chest",
            12: "Shield",
            13: "Leggings",
            14: "Gauntlets",
            18: "Cosmetic",
        }
        slot_val = fields.get("slot")
        if slot_val in slot_labels:
            fields["slot_label"] = slot_labels[slot_val]

        # Max rarity label
        rarity_labels = {
            0: "Common",
            1: "Uncommon",
            2: "Rare",
            3: "Epic",
            4: "Legendary",
            5: "Mythical",
            6: "Ascendant",
        }
        max_rarity_val = fields.get("max_rarity")
        if max_rarity_val in rarity_labels:
            fields["max_rarity_label"] = rarity_labels[max_rarity_val]

        # Perk labels (shared mapping with weapons)
        perk_val = fields.get("perk")
        if perk_val in PERK_LABELS:
            fields["perk_label"] = PERK_LABELS[perk_val]

        # Corrupted perk labels (unknown_95)
        corrupted_val = fields.get("corrupted_perk")
        if corrupted_val:
            resolved = resolve_corrupted_perk_label(corrupted_val, perk_val)
            if resolved:
                fields["corrupted_perk_label"] = resolved

        armor = {
            "id": rec_index,
            "name": name,
            "fields": fields,
        }
        armors.append(armor)

    return armors, skipped


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
        data_path = base_dir / "data06.dat"
    if out_path is None:
        out_path = base_dir / "armors_data06.json"
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

    armors, skipped = parse_data06(data_path)

    out_path.write_text(json.dumps(armors, indent=2))
    print(
        f"Wrote {len(armors)} armors to {out_path} "
        f"(skipped {skipped} without names)"
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
        diff_lines = diff_json_records_by_id(backup_path, out_path, record_label="Item")
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

    # Report perk values and associated armors (to help map/verify labels)
    perk_groups = {}
    corrupted_groups = {}
    for a in armors:
        fields = a["fields"]
        val = fields.get("perk")
        if val not in (None, 0):
            perk_groups.setdefault(val, []).append(a["name"])
        cval = fields.get("corrupted_perk")
        if cval not in (None, 0):
            corrupted_groups.setdefault(cval, []).append(a["name"])

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
