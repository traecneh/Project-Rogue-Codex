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
import re
import struct
import sys
from pathlib import Path

try:
    from tools.codex_pipeline.extractors.shared import (
        diff_json_records_by_id,
        file_hash,
        make_backup_path,
        parse_extractor_args,
    )
except ModuleNotFoundError:
    from shared import (
        diff_json_records_by_id,
        file_hash,
        make_backup_path,
        parse_extractor_args,
    )

XOR_KEY_WORD = 0xD4D4
# data05.dat packs eight 248-byte weapon entries back-to-back in each 1984-byte
# chunk. A single weapon entry is 124 16-bit words.
WORDS_PER_RECORD = 124
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


def parse_data05(path: Path):
    """Parse data05.dat and return a list of weapon dicts."""
    data = path.read_bytes()
    if len(data) % 2 != 0:
        raise ValueError(f"{path.name} size is not even ({len(data)} bytes)")

    total_words = len(data) // 2
    words = struct.unpack("<%dH" % total_words, data)

    # XOR-decode each 16-bit word
    decoded_words = [w ^ XOR_KEY_WORD for w in words]

    if total_words % WORDS_PER_RECORD != 0:
        raise ValueError(
            f"Total words ({total_words}) is not a multiple of {WORDS_PER_RECORD}"
        )

    num_records = total_words // WORDS_PER_RECORD

    # Slice all records first so we can discover which indices actually vary
    records = [
        decoded_words[i * WORDS_PER_RECORD : (i + 1) * WORDS_PER_RECORD]
        for i in range(num_records)
    ]

    # Determine which word indices vary across at least one record
    varying_indices = []
    for idx in range(WORDS_PER_RECORD):
        values = {rec[idx] for rec in records}
        if len(values) > 1:
            varying_indices.append(idx)

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
        # Re-pack as bytes for text extraction
        raw_bytes = struct.pack("<%dH" % WORDS_PER_RECORD, *rec_words)

        # Build an ASCII view; non-printables -> '\0'
        ascii_all = "".join(chr(b) if 32 <= b < 127 else "\0" for b in raw_bytes)

        fields = {}
        for i in varying_indices:
            fname = field_name(i)
            fields[fname] = rec_words[i]

        # Skip disabled weapon types (bows/crossbows) before name extraction/output.
        if rec_words[22] in (7, 8):
            skipped += 1
            continue

        # Weapon name = first printable chunk up to first null
        name = ascii_all.split("\0", 1)[0].strip()
        if not name or name.lower() == "unused":
            # Skip placeholder or nameless entries.
            skipped += 1
            continue

        # Derived gold value (32-bit little-endian from value_low/value_high)
        if "value_low" in fields and "value_high" in fields:
            fields["value"] = fields["value_low"] + (fields["value_high"] << 16)

        # Human-readable subtype
        subtype_labels = {
            1: "Sword",
            2: "Dagger",
            3: "Axe",
            4: "Blunt",
            5: "Polearm",
        }
        subtype_val = fields.get("subtype")
        if subtype_val in subtype_labels:
            fields["subtype_label"] = subtype_labels[subtype_val]

        # Human-readable specialty
        specialty_labels = {
            1: "Strength",
            2: "Dexterity",
            3: "Constitution",
        }
        spec_val = fields.get("specialty")
        if spec_val in specialty_labels:
            fields["specialty_label"] = specialty_labels[spec_val]

        # Human-readable element
        element_labels = {
            1: "Fire",
            2: "Electric",
            4: "Cold",
            6: "Acid",
        7: "Poison",
        8: "Disease",
        5: "Magic",
    }
        elem_val = fields.get("element")
        if elem_val in element_labels:
            fields["element_label"] = element_labels[elem_val]

        # Max rarity label
        rarity_labels = {
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
