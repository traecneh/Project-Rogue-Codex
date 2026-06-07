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
import sys
from pathlib import Path

try:
    from tools.codex_pipeline.extractors.field_schemas import (
        ARMOR_FIELD_NAMES,
        field_name,
    )
    from tools.codex_pipeline.extractors.item_metadata import (
        ARMOR_SLOT_LABELS,
        PERK_LABELS,
        RARITY_LABELS,
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
    from field_schemas import (
        ARMOR_FIELD_NAMES,
        field_name,
    )
    from item_metadata import (
        ARMOR_SLOT_LABELS,
        PERK_LABELS,
        RARITY_LABELS,
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
# data06.dat packs eight 240-byte armor entries back-to-back in each 1920-byte
# chunk. A single armor entry is 120 16-bit words.
WORDS_PER_RECORD = 120
def parse_data06(path: Path):
    """Parse data06.dat and return a list of armor dicts."""
    records = load_xor_encoded_records(
        path, words_per_record=WORDS_PER_RECORD, xor_key=XOR_KEY_WORD
    )
    varying_indices = find_varying_indices(records)

    armors = []
    skipped = 0

    for rec_index, rec_words in enumerate(records):
        fields = {}
        for i in varying_indices:
            fname = field_name(ARMOR_FIELD_NAMES, i)
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

        add_field_label(fields, "slot", "slot_label", ARMOR_SLOT_LABELS)
        add_field_label(fields, "max_rarity", "max_rarity_label", RARITY_LABELS)

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
