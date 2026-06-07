#!/usr/bin/env python3
"""
Extract monster definitions from data03.dat into a JSON file.

- Expects data03.dat in the same directory as this script.
- Writes monsters_data03.json in the same directory.
- If an existing monsters_data03.json is present, it is backed up with a timestamp,
  hashed, and compared against the newly written file.
- Optional: use --diff-out PATH to write a name-aware diff of changes.

Each monster record:
  - 270 little-endian 16-bit words, XOR-encoded with 0xD4D4.
  - Record count = total_words / 270.

Output JSON format (per monster):
{
  "id": int,
  "name": str,
  "fields": {
    // one entry per word position that varies across any monster
    // known indices are named, all others are "unknown_<word_index>"
    // 15: type (Animal/Beast/Demon/...),
    // 16: min_damage, 17: max_damage, 18: health, 25: level,
    // 23: movement_speed, 24: attack_speed,
    // 28: elemental_attack (Fire/Electric/Acid/etc.)
    // 29: status_effect
    // 26: total_flags (bitmask)
    // 174: uncommon_tatter, 175: rare_tatter
    // For mapped fields, a companion "<name>_label" is also emitted.
    // flags derived from total_flags:
    //   is_target_when_hit_ranged_trapped (0x8000)
    //   is_flying (0x0200)
    //   is_ethereal (0x0100)
    //   is_boss (0x0040)
    //   is_berserker (0x0004)
    //   is_target_when_blocked (0x0001)
    //   is_immobile (0x0002)
    //   has_thorns (0x4000)
    // total_flags remains the raw flags word
    // Sprite/frame atlas hints:
    //   frame_1_x (idx 130), frame_1_y (131), frame_1_width (132), frame_1_height (133)
    //   frame_2_x (134), frame_2_y (135), frame_2_width (136), frame_2_height (137)
    //   frame_3_x (138), frame_3_y (139), frame_3_width (140), frame_3_height (141)
    //   frame_4_x (142), frame_4_y (143), frame_4_width (144), frame_4_height (145)
    //   frame_5_x (146), frame_5_y (147), frame_5_width (148), frame_5_height (149)
    //   frame_6_x (150), frame_6_y (151), frame_6_width (152), frame_6_height (153)
    //   frame_7_x (154), frame_7_y (155), frame_7_width (156), frame_7_height (157)
    //   frame_8_x (158), frame_8_y (159), frame_8_width (160), frame_8_height (161)
    //   frame_9_x (162), frame_9_y (163), frame_9_width (164), frame_9_height (165)
  }
}

Records whose names are not recoverable (would have been "Monster_<idx>") are
omitted from the output. The script reports how many were written vs skipped.
"""

import difflib
import hashlib
import json
import struct
import sys
from datetime import datetime
from pathlib import Path

XOR_KEY_WORD = 0xD4D4
WORDS_PER_RECORD = 270
FLAG_TARGET_HIT_RANGE_TRAP = 0x8000
FLAG_FLYING = 0x0200
FLAG_ETHEREAL = 0x0100
FLAG_BOSS = 0x0040
FLAG_BERSERKER = 0x0004
FLAG_BLOCK = 0x0001
FLAG_IMMOBILE = 0x0002
FLAG_THORNS = 0x4000
KNOWN_FLAG_MASK = (
    FLAG_TARGET_HIT_RANGE_TRAP
    | FLAG_FLYING
    | FLAG_ETHEREAL
    | FLAG_BOSS
    | FLAG_BERSERKER
    | FLAG_BLOCK
    | FLAG_IMMOBILE
    | FLAG_THORNS
)

# Value labels for mapped fields
TYPE_LABELS = {
    0: "None",
    1: "Fire Beast",
    2: "Electrical Beast",
    3: "Demon",
    4: "Animal",
    5: "Beast",
    6: "Human",
    7: "Giant",
    8: "Undead",
    9: "Ice Beast",
    10: "Poison Beast",
    11: "Disease Beast",
}

ELEMENTAL_LABELS = {
    0: "None",
    1: "Fire",
    2: "Electric",
    4: "Cold",
    6: "Acid",
    7: "Poison",
    8: "Disease",
}

STATUS_EFFECT_LABELS = {
    1286: "Bleed",
    2564: "Shock",
    3841: "Poison",
    3842: "Disease",
    3856: "Freeze",
    5121: "Poison",
    5122: "Disease",
    5126: "Bleed",
}

TATTER_LABELS = {
    0: "None",
    1: "Lifesteal",
    2: "Bloodthirster",
    3: "Rejuvenation",
    4: "Antitoxin",
    5: "Immunization",
    6: "Vitality",
    7: "Bolstered Strength",
    9: "Magic Shield",
    10: "Juggernaut",
    11: "Parry",
    12: "Alchemist",
    13: "Knowledge",
    14: "Moneybags",
    21: "Demon Blood",
    22: "Frozen Heart",
    23: "Lightning Field",
    24: "Tourniquet",
    25: "Hazmat",
    26: "Antacid",
    29: "Vampirism",
    30: "Garrote",
    31: "Brutality",
    32: "Tenacity",
    33: "Swiftness",
    35: "Epidemic",
    36: "Lethal Toxins",
    37: "Destruction",
    38: "Impenetrable",
    39: "Hawkeye",
    40: "Overpower",
    41: "Demonsbane",
    42: "Beastslayer",
    43: "Executioner",
    44: "Consecration",
    45: "Venomshock",
    46: "Iceshatter",
    47: "Desperation",
    48: "Bloodlust",
    49: "Slayer",
    51: "Critical Aegis",
    52: "Toxic Shell",
}


def file_hash(path: Path, algo: str = "sha256", chunk_size: int = 1024 * 1024) -> str:
    hasher = hashlib.new(algo)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def make_backup_path(path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = path.with_name(f"{path.stem}.{timestamp}.bak{path.suffix}")
    if not candidate.exists():
        return candidate
    for counter in range(1, 1000):
        candidate = path.with_name(f"{path.stem}.{timestamp}.bak{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Unable to find a unique backup filename.")


def diff_files(old_path: Path, new_path: Path) -> list[str]:
    old_lines = old_path.read_text(encoding="utf-8").splitlines()
    new_lines = new_path.read_text(encoding="utf-8").splitlines()
    return list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=str(old_path),
            tofile=str(new_path),
            lineterm="",
        )
    )


def format_value(value) -> str:
    return json.dumps(value, ensure_ascii=True)


def diff_monsters_by_name(old_path: Path, new_path: Path) -> list[str]:
    try:
        old_items = json.loads(old_path.read_text(encoding="utf-8"))
        new_items = json.loads(new_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return diff_files(old_path, new_path)

    def index_items(items: list[dict]) -> dict[int, dict]:
        indexed: dict[int, dict] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if isinstance(item_id, int):
                indexed[item_id] = item
        return indexed

    old_by_id = index_items(old_items)
    new_by_id = index_items(new_items)
    all_ids = sorted(set(old_by_id) | set(new_by_id))
    lines: list[str] = []

    for item_id in all_ids:
        old_item = old_by_id.get(item_id)
        new_item = new_by_id.get(item_id)

        if old_item is None:
            name = new_item.get("name", "<unknown>")
            lines.append(f"Monster {item_id}: {name}")
            lines.append("  + added")
            lines.append("")
            continue

        if new_item is None:
            name = old_item.get("name", "<unknown>")
            lines.append(f"Monster {item_id}: {name}")
            lines.append("  - removed")
            lines.append("")
            continue

        diffs: list[str] = []
        old_name = old_item.get("name")
        new_name = new_item.get("name")
        if old_name != new_name:
            diffs.append(f"  ~ name: {format_value(old_name)} -> {format_value(new_name)}")

        old_fields = old_item.get("fields", {})
        new_fields = new_item.get("fields", {})
        if not isinstance(old_fields, dict):
            old_fields = {}
        if not isinstance(new_fields, dict):
            new_fields = {}

        for key in sorted(set(old_fields) | set(new_fields)):
            old_val = old_fields.get(key)
            new_val = new_fields.get(key)
            if old_val != new_val:
                if key not in old_fields:
                    diffs.append(f"  + fields.{key}: {format_value(new_val)}")
                elif key not in new_fields:
                    diffs.append(f"  - fields.{key}: {format_value(old_val)}")
                else:
                    diffs.append(
                        f"  ~ fields.{key}: {format_value(old_val)} -> {format_value(new_val)}"
                    )

        if diffs:
            name_display = new_name or old_name or "<unknown>"
            if old_name and new_name and old_name != new_name:
                name_display = f"{old_name} -> {new_name}"
            lines.append(f"Monster {item_id}: {name_display}")
            lines.extend(diffs)
            lines.append("")

    if lines and lines[-1] == "":
        lines.pop()
    return lines


def parse_args(argv: list[str]) -> tuple[Path | None, Path | None, Path | None]:
    data_path = None
    out_path = None
    diff_out_path = None
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--diff-out":
            if i + 1 >= len(argv):
                raise SystemExit("Missing value for --diff-out")
            diff_out_path = Path(argv[i + 1]).expanduser().resolve()
            i += 2
            continue
        if token.startswith("--diff-out="):
            diff_out_path = Path(token.split("=", 1)[1]).expanduser().resolve()
            i += 1
            continue
        if token.startswith("-"):
            raise SystemExit(f"Unknown option: {token}")
        if data_path is None:
            data_path = Path(token).expanduser().resolve()
        elif out_path is None:
            out_path = Path(token).expanduser().resolve()
        else:
            raise SystemExit(f"Unexpected argument: {token}")
        i += 1
    return data_path, out_path, diff_out_path


def parse_data03(path: Path):
    """Parse data03.dat and return a list of monster dicts."""
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

    varying_indices = []
    for idx in range(WORDS_PER_RECORD):
        values = {rec[idx] for rec in records}
        if len(values) > 1:
            varying_indices.append(idx)

    known_names = {
        0: "name_0",
        1: "name_1",
        2: "name_2",
        3: "name_3",
        4: "name_4",
        5: "name_5",
        6: "name_6",
        7: "name_7",
        8: "name_8",
        15: "type",
        16: "min_damage",
        17: "max_damage",
        18: "health",
        23: "movement_speed",
        24: "attack_speed",
        25: "level",
        28: "elemental_attack",
        29: "status_effect",
        26: "total_flags",
        130: "frame_1_x",
        131: "frame_1_y",
        132: "frame_1_width",
        133: "frame_1_height",
        134: "frame_2_x",
        135: "frame_2_y",
        136: "frame_2_width",
        137: "frame_2_height",
        138: "frame_3_x",
        139: "frame_3_y",
        140: "frame_3_width",
        141: "frame_3_height",
        142: "frame_4_x",
        143: "frame_4_y",
        144: "frame_4_width",
        145: "frame_4_height",
        146: "frame_5_x",
        147: "frame_5_y",
        148: "frame_5_width",
        149: "frame_5_height",
        150: "frame_6_x",
        151: "frame_6_y",
        152: "frame_6_width",
        153: "frame_6_height",
        154: "frame_7_x",
        155: "frame_7_y",
        156: "frame_7_width",
        157: "frame_7_height",
        158: "frame_8_x",
        159: "frame_8_y",
        160: "frame_8_width",
        161: "frame_8_height",
        162: "frame_9_x",
        163: "frame_9_y",
        164: "frame_9_width",
        165: "frame_9_height",
        174: "uncommon_tatter",
        175: "rare_tatter",
    }

    def field_name(index: int) -> str:
        """Return a readable field name for a given word index."""
        return known_names.get(index, f"unknown_{index}")

    monsters = []
    warnings = []
    skipped = 0
    for idx, rec_words in enumerate(records):
        # Re-pack as bytes for text extraction
        raw_bytes = struct.pack("<%dH" % WORDS_PER_RECORD, *rec_words)

        # Build an ASCII view; non-printables -> '\0'
        ascii_all = "".join(chr(b) if 32 <= b < 127 else "\0" for b in raw_bytes)

        # Monster name = first printable chunk up to first null
        name = ascii_all.split("\0", 1)[0].strip()
        if not name:
            skipped += 1
            continue

        unknown_tatters = []
        unknown_status_effect = None
        fields = {}
        for i in varying_indices:
            fname = field_name(i)
            value = rec_words[i]
            fields[fname] = value
            if i == 15:
                label = TYPE_LABELS.get(value)
                if label is not None:
                    fields[f"{fname}_label"] = label
            elif i == 28:
                label = ELEMENTAL_LABELS.get(value)
                if label is not None:
                    fields[f"{fname}_label"] = label
            elif i == 29:
                if value != 0:
                    label = STATUS_EFFECT_LABELS.get(value)
                    if label is not None:
                        fields[f"{fname}_label"] = label
                    else:
                        unknown_status_effect = value
            elif i in (174, 175):
                label = TATTER_LABELS.get(value)
                if label is not None:
                    fields[f"{fname}_label"] = label
                else:
                    unknown_tatters.append(f"{fname}={value}")

        # Derive booleans from the flag word (total_flags).
        flag_val = fields.get("total_flags", 0)
        fields["is_target_when_hit_ranged_trapped"] = bool(
            flag_val & FLAG_TARGET_HIT_RANGE_TRAP
        )
        fields["is_flying"] = bool(flag_val & FLAG_FLYING)
        fields["is_ethereal"] = bool(flag_val & FLAG_ETHEREAL)
        fields["is_boss"] = bool(flag_val & FLAG_BOSS)
        fields["is_berserker"] = bool(flag_val & FLAG_BERSERKER)
        fields["is_target_when_blocked"] = bool(flag_val & FLAG_BLOCK)
        fields["is_immobile"] = bool(flag_val & FLAG_IMMOBILE)
        fields["has_thorns"] = bool(flag_val & FLAG_THORNS)

        # Flag any unexpected bits for later warning output.
        unknown_bits = flag_val & ~KNOWN_FLAG_MASK
        if unknown_bits:
            warnings.append(
                f"{name}: unknown flag bits set in total_flags = 0x{flag_val:04X} "
                f"(extra 0x{unknown_bits:04X})"
            )

        if unknown_tatters:
            warnings.append(f"{name}: unknown tatter label(s): {', '.join(unknown_tatters)}")
        if unknown_status_effect is not None:
            warnings.append(
                f"{name}: unknown status_effect label for value {unknown_status_effect}"
            )

        monster = {
            "id": idx,
            "name": name,
            "fields": fields,
        }

        monsters.append(monster)

    return monsters, skipped, warnings


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]

    # Default paths: same folder as this script
    base_dir = Path(__file__).resolve().parent
    data_path, out_path, diff_out_path = parse_args(argv)
    if data_path is None:
        data_path = base_dir / "data03.dat"
    if out_path is None:
        out_path = base_dir / "monsters_data03.json"
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

    monsters, skipped, warnings = parse_data03(data_path)

    out_path.write_text(json.dumps(monsters, indent=2))
    print(
        f"Wrote {len(monsters)} monsters to {out_path} "
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
        diff_lines = diff_monsters_by_name(backup_path, out_path)
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

    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")


if __name__ == "__main__":
    main()
