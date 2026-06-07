from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Literal

from tools.codex_pipeline.config import GENERATED_OUTPUT_DIR
from tools.codex_pipeline.exports import ExportError, ExportTarget


UNKNOWN_FIELD_RE = re.compile(r"^unknown_(\d+)$")


@dataclass(frozen=True)
class UnknownFieldReport:
    name: str
    record_count: int
    nonzero_count: int
    values: list[Any]
    samples: list[str]


@dataclass(frozen=True)
class UnknownFieldTargetReport:
    target_name: str
    data_path: Path
    record_count: int
    fields: list[UnknownFieldReport]


def _read_json_list(path: Path, target: ExportTarget) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{target.name} unknown-field source is not readable JSON at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{target.name} unknown-field source must be a JSON list: {path}")
    return data


def _field_sort_key(name: str) -> tuple[int, str]:
    match = UNKNOWN_FIELD_RE.match(name)
    if match:
        return int(match.group(1)), name
    return 10**9, name


def _value_sort_key(value: Any) -> tuple[str, str]:
    if isinstance(value, bool):
        return "bool", str(value)
    if isinstance(value, int):
        return "int", f"{value:020d}"
    return type(value).__name__, repr(value)


def _record_label(record: dict[str, Any], fallback_index: int) -> str:
    name = str(record.get("name") or "").strip()
    if name:
        return name
    record_id = record.get("id")
    if record_id is not None:
        return f"id {record_id}"
    return f"record {fallback_index}"


def _source_path(
    target: ExportTarget,
    *,
    source: Literal["site", "generated"],
    output_dir: Path,
) -> Path:
    if source == "site":
        return target.site_path
    return output_dir / target.output_filename


def build_unknown_field_reports(
    targets: Iterable[ExportTarget],
    *,
    source: Literal["site", "generated"] = "site",
    output_dir: Path = GENERATED_OUTPUT_DIR,
    max_samples: int = 3,
) -> list[UnknownFieldTargetReport]:
    reports: list[UnknownFieldTargetReport] = []
    output_dir = output_dir.expanduser().resolve()
    for target in targets:
        data_path = _source_path(target, source=source, output_dir=output_dir)
        records = _read_json_list(data_path, target)
        field_stats: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"record_count": 0, "nonzero_count": 0, "values": set(), "samples": []}
        )

        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            fields = record.get("fields")
            if not isinstance(fields, dict):
                continue
            label = _record_label(record, index)
            for name, value in fields.items():
                if not isinstance(name, str) or UNKNOWN_FIELD_RE.match(name) is None:
                    continue
                stats = field_stats[name]
                stats["record_count"] += 1
                stats["values"].add(value)
                if value not in (0, None):
                    stats["nonzero_count"] += 1
                    samples = stats["samples"]
                    if len(samples) < max_samples:
                        samples.append(f"{label}={value}")

        reports.append(
            UnknownFieldTargetReport(
                target_name=target.name,
                data_path=data_path,
                record_count=len(records),
                fields=[
                    UnknownFieldReport(
                        name=name,
                        record_count=stats["record_count"],
                        nonzero_count=stats["nonzero_count"],
                        values=sorted(stats["values"], key=_value_sort_key),
                        samples=list(stats["samples"]),
                    )
                    for name, stats in sorted(field_stats.items(), key=lambda item: _field_sort_key(item[0]))
                ],
            )
        )
    return reports
