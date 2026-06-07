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

import sys
from pathlib import Path

try:
    from tools.codex_pipeline.extractors.field_schemas import (
        MONSTER_FIELD_NAMES,
        build_fields,
    )
    from tools.codex_pipeline.extractors.monster_metadata import (
        FLAG_BERSERKER,
        FLAG_BLOCK,
        FLAG_BOSS,
        FLAG_ETHEREAL,
        FLAG_FLYING,
        FLAG_IMMOBILE,
        FLAG_TARGET_HIT_RANGE_TRAP,
        FLAG_THORNS,
        KNOWN_FLAG_MASK,
        enrich_monster_fields,
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
        MONSTER_FIELD_NAMES,
        build_fields,
    )
    from monster_metadata import (
        FLAG_BERSERKER,
        FLAG_BLOCK,
        FLAG_BOSS,
        FLAG_ETHEREAL,
        FLAG_FLYING,
        FLAG_IMMOBILE,
        FLAG_TARGET_HIT_RANGE_TRAP,
        FLAG_THORNS,
        KNOWN_FLAG_MASK,
        enrich_monster_fields,
    )
    from shared import (
        extract_ascii_name,
        find_varying_indices,
        load_xor_encoded_records,
        parse_extractor_args,
        write_extractor_output,
    )

XOR_KEY_WORD = 0xD4D4
WORDS_PER_RECORD = 270


def parse_data03(path: Path):
    """Parse data03.dat and return a list of monster dicts."""
    records = load_xor_encoded_records(
        path, words_per_record=WORDS_PER_RECORD, xor_key=XOR_KEY_WORD
    )
    varying_indices = find_varying_indices(records)

    monsters = []
    warnings = []
    skipped = 0
    for idx, rec_words in enumerate(records):
        # Monster name = first printable chunk up to first null
        name = extract_ascii_name(rec_words)
        if not name:
            skipped += 1
            continue

        fields = build_fields(rec_words, varying_indices, MONSTER_FIELD_NAMES)
        warnings.extend(enrich_monster_fields(fields, name))

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
    parsed_args = parse_extractor_args(argv)
    data_path = parsed_args.data_path
    out_path = parsed_args.out_path
    diff_out_path = parsed_args.diff_out_path
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

    monsters, skipped, warnings = parse_data03(data_path)
    write_extractor_output(
        monsters,
        out_path,
        output_label="monsters",
        skipped_message=f"skipped {skipped} without names",
        record_label="Monster",
        diff_out_path=diff_out_path,
        warnings=warnings,
    )


if __name__ == "__main__":
    main()
