from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from tools.codex_pipeline.config import (
    ARMORS_DATA_PATH,
    CLIENT_DATA_DIR,
    GENERATED_OUTPUT_DIR,
    MONSTERS_DATA_PATH,
    WEAPONS_DATA_PATH,
)


class ExportError(RuntimeError):
    """Raised when a client data export or sync cannot complete."""


@dataclass(frozen=True)
class ExportTarget:
    name: str
    extractor_script: Path
    source_data: Path
    output_filename: str
    site_path: Path

    def generated_path(self, output_dir: Path = GENERATED_OUTPUT_DIR) -> Path:
        return output_dir / self.output_filename


@dataclass(frozen=True)
class ExportResult:
    target: ExportTarget
    generated_path: Path
    stdout: str
    stderr: str


@dataclass(frozen=True)
class SyncResult:
    target: ExportTarget
    generated_path: Path
    site_path: Path
    changed: bool
    dry_run: bool


@dataclass(frozen=True)
class FieldChange:
    path: str
    old_value: Any
    new_value: Any


@dataclass(frozen=True)
class RecordChange:
    key: str
    label: str
    field_changes: list[FieldChange]


@dataclass(frozen=True)
class DataDiffReport:
    target: ExportTarget
    generated_path: Path
    site_path: Path
    added: list[str]
    removed: list[str]
    changed: list[RecordChange]

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed or self.changed)


DEFAULT_EXPORT_TARGETS: dict[str, ExportTarget] = {
    "monsters": ExportTarget(
        name="monsters",
        extractor_script=CLIENT_DATA_DIR / "extract_monsters_data03.py",
        source_data=CLIENT_DATA_DIR / "data03.dat",
        output_filename="monsters_data03.json",
        site_path=MONSTERS_DATA_PATH,
    ),
    "weapons": ExportTarget(
        name="weapons",
        extractor_script=CLIENT_DATA_DIR / "extract_weapons_data05.py",
        source_data=CLIENT_DATA_DIR / "data05.dat",
        output_filename="weapons_data05.json",
        site_path=WEAPONS_DATA_PATH,
    ),
    "armors": ExportTarget(
        name="armors",
        extractor_script=CLIENT_DATA_DIR / "extract_armors_data06.py",
        source_data=CLIENT_DATA_DIR / "data06.dat",
        output_filename="armors_data06.json",
        site_path=ARMORS_DATA_PATH,
    ),
}


def resolve_targets(names: Sequence[str] | None = None) -> list[ExportTarget]:
    if not names:
        return list(DEFAULT_EXPORT_TARGETS.values())

    targets: list[ExportTarget] = []
    unknown = [name for name in names if name not in DEFAULT_EXPORT_TARGETS]
    if unknown:
        valid = ", ".join(sorted(DEFAULT_EXPORT_TARGETS))
        raise ExportError(f"Unknown export target(s): {', '.join(unknown)}. Valid targets: {valid}")
    for name in names:
        targets.append(DEFAULT_EXPORT_TARGETS[name])
    return targets


def _validate_generated_json(path: Path, target: ExportTarget) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{target.name} generated invalid JSON at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{target.name} generated output must be a JSON list: {path}")


def _read_json_list(path: Path, target: ExportTarget, label: str) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{target.name} {label} is not readable JSON at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{target.name} {label} must be a JSON list: {path}")
    return data


def _prepare_generated_path(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if not path.is_file():
            raise ExportError(f"Generated output path exists and is not a file: {path}")
        path.unlink()


def _resolve_output_dir(output_dir: Path) -> Path:
    return output_dir.expanduser().resolve()


def _normalize_identity(value: Any) -> str:
    return str(value or "").strip().lower()


def _record_key(record: Any, index: int) -> str:
    if isinstance(record, dict):
        record_id = record.get("id")
        if record_id is not None and str(record_id).strip():
            return f"id:{record_id}"
        name = _normalize_identity(record.get("name"))
        if name:
            return f"name:{name}"
    return f"index:{index}"


def _record_label(record: Any, key: str) -> str:
    if isinstance(record, dict):
        name = str(record.get("name") or "").strip()
        record_id = record.get("id")
        if name and record_id is not None:
            return f"{name} ({record_id})"
        if name:
            return name
        if record_id is not None:
            return f"id {record_id}"
    return key


def _index_records(records: list[Any]) -> dict[str, Any]:
    indexed: dict[str, Any] = {}
    for index, record in enumerate(records):
        key = _record_key(record, index)
        if key not in indexed:
            indexed[key] = record
    return indexed


def _display_records(indexed: dict[str, Any], keys: Iterable[str]) -> list[str]:
    return [_record_label(indexed[key], key) for key in keys]


def _sort_record_key(key: str) -> tuple[int, str]:
    prefix, _, value = key.partition(":")
    if prefix == "id":
        try:
            return 0, f"{int(value):012d}"
        except ValueError:
            return 0, value
    if prefix == "name":
        return 1, value
    return 2, value


def _field_changes(old_value: Any, new_value: Any, path: str = "") -> list[FieldChange]:
    if isinstance(old_value, dict) and isinstance(new_value, dict):
        changes: list[FieldChange] = []
        for key in sorted(set(old_value) | set(new_value)):
            child_path = f"{path}.{key}" if path else str(key)
            if key not in old_value:
                changes.append(FieldChange(child_path, None, new_value[key]))
            elif key not in new_value:
                changes.append(FieldChange(child_path, old_value[key], None))
            else:
                changes.extend(_field_changes(old_value[key], new_value[key], child_path))
        return changes
    if old_value != new_value:
        return [FieldChange(path or "value", old_value, new_value)]
    return []


def build_generated_diff_report(target: ExportTarget, *, output_dir: Path = GENERATED_OUTPUT_DIR) -> DataDiffReport:
    output_dir = _resolve_output_dir(output_dir)
    generated_path = target.generated_path(output_dir)
    if not generated_path.is_file():
        raise ExportError(f"{target.name} generated output not found: {generated_path}")
    if not target.site_path.is_file():
        raise ExportError(f"{target.name} site output not found: {target.site_path}")

    generated_records = _read_json_list(generated_path, target, "generated output")
    site_records = _read_json_list(target.site_path, target, "site output")
    generated_by_key = _index_records(generated_records)
    site_by_key = _index_records(site_records)

    generated_keys = set(generated_by_key)
    site_keys = set(site_by_key)
    added_keys = sorted(generated_keys - site_keys, key=_sort_record_key)
    removed_keys = sorted(site_keys - generated_keys, key=_sort_record_key)
    common_keys = sorted(generated_keys & site_keys, key=_sort_record_key)
    changed: list[RecordChange] = []
    for key in common_keys:
        changes = _field_changes(site_by_key[key], generated_by_key[key])
        if changes:
            changed.append(
                RecordChange(
                    key=key,
                    label=_record_label(generated_by_key[key], key),
                    field_changes=changes,
                )
            )

    return DataDiffReport(
        target=target,
        generated_path=generated_path,
        site_path=target.site_path,
        added=_display_records(generated_by_key, added_keys),
        removed=_display_records(site_by_key, removed_keys),
        changed=changed,
    )


def build_generated_diff_reports(
    targets: Iterable[ExportTarget],
    *,
    output_dir: Path = GENERATED_OUTPUT_DIR,
) -> list[DataDiffReport]:
    return [build_generated_diff_report(target, output_dir=output_dir) for target in targets]


def export_client_data(
    targets: Iterable[ExportTarget],
    *,
    output_dir: Path = GENERATED_OUTPUT_DIR,
    python_executable: str = sys.executable,
) -> list[ExportResult]:
    output_dir = _resolve_output_dir(output_dir)
    results: list[ExportResult] = []
    for target in targets:
        if not target.extractor_script.is_file():
            raise ExportError(f"{target.name} extractor not found: {target.extractor_script}")
        if not target.source_data.is_file():
            raise ExportError(f"{target.name} source data not found: {target.source_data}")

        generated_path = target.generated_path(output_dir)
        _prepare_generated_path(generated_path)
        completed = subprocess.run(
            [
                python_executable,
                str(target.extractor_script),
                str(target.source_data),
                str(generated_path),
            ],
            cwd=str(target.extractor_script.parent),
            text=True,
            capture_output=True,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip() or "extractor exited with no output"
            raise ExportError(f"{target.name} export failed: {detail}")
        if not generated_path.is_file():
            raise ExportError(f"{target.name} extractor did not write expected output: {generated_path}")
        _validate_generated_json(generated_path, target)
        results.append(
            ExportResult(
                target=target,
                generated_path=generated_path,
                stdout=completed.stdout,
                stderr=completed.stderr,
            )
        )
    return results


def sync_generated_outputs(
    targets: Iterable[ExportTarget],
    *,
    output_dir: Path = GENERATED_OUTPUT_DIR,
    dry_run: bool = False,
) -> list[SyncResult]:
    output_dir = _resolve_output_dir(output_dir)
    results: list[SyncResult] = []
    for target in targets:
        generated_path = target.generated_path(output_dir)
        if not generated_path.is_file():
            raise ExportError(f"{target.name} generated output not found: {generated_path}")
        _validate_generated_json(generated_path, target)
        target.site_path.parent.mkdir(parents=True, exist_ok=True)

        generated_bytes = generated_path.read_bytes()
        current_bytes = target.site_path.read_bytes() if target.site_path.is_file() else None
        changed = current_bytes != generated_bytes
        if changed and not dry_run:
            shutil.copyfile(generated_path, target.site_path)
        results.append(
            SyncResult(
                target=target,
                generated_path=generated_path,
                site_path=target.site_path,
                changed=changed,
                dry_run=dry_run,
            )
        )
    return results
