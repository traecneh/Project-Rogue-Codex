from __future__ import annotations

import difflib
import hashlib
import json
import struct
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence


@dataclass(frozen=True)
class ParsedExtractorArgs:
    data_path: Path | None
    out_path: Path | None
    diff_out_path: Path | None


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


def format_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def read_xor_encoded_words(path: Path, xor_key: int) -> list[int]:
    data = path.read_bytes()
    if len(data) % 2 != 0:
        raise ValueError(f"{path.name} size is not even ({len(data)} bytes)")

    total_words = len(data) // 2
    words = struct.unpack(f"<{total_words}H", data)
    return [word ^ xor_key for word in words]


def split_words_into_records(words: list[int], words_per_record: int) -> list[list[int]]:
    if len(words) % words_per_record != 0:
        raise ValueError(
            f"Total words ({len(words)}) is not a multiple of {words_per_record}"
        )

    return [
        words[i * words_per_record : (i + 1) * words_per_record]
        for i in range(len(words) // words_per_record)
    ]


def load_xor_encoded_records(
    path: Path, *, words_per_record: int, xor_key: int
) -> list[list[int]]:
    words = read_xor_encoded_words(path, xor_key)
    return split_words_into_records(words, words_per_record)


def find_varying_indices(records: list[list[int]]) -> list[int]:
    if not records:
        return []

    words_per_record = len(records[0])
    varying_indices = []
    for idx in range(words_per_record):
        values = {record[idx] for record in records}
        if len(values) > 1:
            varying_indices.append(idx)
    return varying_indices


def extract_ascii_name(record_words: list[int]) -> str:
    raw_bytes = struct.pack(f"<{len(record_words)}H", *record_words)
    ascii_all = "".join(chr(byte) if 32 <= byte < 127 else "\0" for byte in raw_bytes)
    return ascii_all.split("\0", 1)[0].strip()


def _index_records(records: list[Any]) -> dict[int, dict[str, Any]]:
    indexed: dict[int, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict):
            continue
        record_id = record.get("id")
        if isinstance(record_id, int):
            indexed[record_id] = record
    return indexed


def diff_records_by_id(
    old_items: list[Any],
    new_items: list[Any],
    *,
    record_label: str,
) -> list[str]:
    old_by_id = _index_records(old_items)
    new_by_id = _index_records(new_items)
    all_ids = sorted(set(old_by_id) | set(new_by_id))
    lines: list[str] = []

    for item_id in all_ids:
        old_item = old_by_id.get(item_id)
        new_item = new_by_id.get(item_id)

        if old_item is None:
            name = new_item.get("name", "<unknown>")
            lines.append(f"{record_label} {item_id}: {name}")
            lines.append("  + added")
            lines.append("")
            continue

        if new_item is None:
            name = old_item.get("name", "<unknown>")
            lines.append(f"{record_label} {item_id}: {name}")
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
            lines.append(f"{record_label} {item_id}: {name_display}")
            lines.extend(diffs)
            lines.append("")

    if lines and lines[-1] == "":
        lines.pop()
    return lines


def diff_json_records_by_id(old_path: Path, new_path: Path, *, record_label: str) -> list[str]:
    try:
        old_items = json.loads(old_path.read_text(encoding="utf-8"))
        new_items = json.loads(new_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return diff_files(old_path, new_path)
    if not isinstance(old_items, list) or not isinstance(new_items, list):
        return diff_files(old_path, new_path)
    return diff_records_by_id(old_items, new_items, record_label=record_label)


def write_extractor_output(
    records: list[Any],
    out_path: Path,
    *,
    output_label: str,
    skipped_message: str,
    record_label: str,
    diff_out_path: Path | None = None,
    warnings: Sequence[str] = (),
) -> None:
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

    out_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} {output_label} to {out_path} ({skipped_message})")

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
        diff_lines = diff_json_records_by_id(
            backup_path, out_path, record_label=record_label
        )
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
        for warning in warnings:
            print(f"  - {warning}")


def parse_extractor_args(argv: list[str]) -> ParsedExtractorArgs:
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
    return ParsedExtractorArgs(data_path, out_path, diff_out_path)
