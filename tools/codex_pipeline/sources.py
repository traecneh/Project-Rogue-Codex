from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.exports import ExportTarget


@dataclass(frozen=True)
class SourceCheckResult:
    target: str
    check: str
    path: Path
    ok: bool
    message: str


def _file_check(target: str, check: str, path: Path, missing_message: str) -> SourceCheckResult:
    if path.is_file():
        return SourceCheckResult(target, check, path, True, f"{check} found: {path}")
    return SourceCheckResult(target, check, path, False, f"{missing_message}: {path}")


def _site_destination_check(target: ExportTarget) -> SourceCheckResult:
    parent = target.site_path.parent
    if parent.is_dir():
        return SourceCheckResult(
            target.name,
            "site destination",
            parent,
            True,
            f"site destination parent found: {parent}",
        )
    return SourceCheckResult(
        target.name,
        "site destination",
        parent,
        False,
        f"site destination parent not found: {parent}",
    )


def _syntax_check(target: ExportTarget) -> SourceCheckResult:
    path = target.extractor_script
    if not path.is_file():
        return SourceCheckResult(
            target.name,
            "extractor syntax",
            path,
            False,
            f"extractor syntax skipped because extractor was not found: {path}",
        )
    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except SyntaxError as exc:
        return SourceCheckResult(
            target.name,
            "extractor syntax",
            path,
            False,
            f"extractor syntax error: {path}:{exc.lineno}:{exc.offset}: {exc.msg}",
        )
    except OSError as exc:
        return SourceCheckResult(
            target.name,
            "extractor syntax",
            path,
            False,
            f"extractor syntax failed to read: {path}: {exc}",
        )
    return SourceCheckResult(target.name, "extractor syntax", path, True, f"extractor syntax ok: {path}")


def validate_export_sources(targets: Iterable[ExportTarget]) -> list[SourceCheckResult]:
    results: list[SourceCheckResult] = []
    for target in targets:
        results.append(_file_check(target.name, "extractor", target.extractor_script, "extractor not found"))
        results.append(_file_check(target.name, "source data", target.source_data, "source data not found"))
        results.append(_site_destination_check(target))
        results.append(_syntax_check(target))
    return results
