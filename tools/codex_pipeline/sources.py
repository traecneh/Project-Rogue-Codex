from __future__ import annotations

import ast
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.exports import ExportTarget
from tools.codex_pipeline.packed_json import (
    find_packed_vpack_source,
    is_packed_json_target_supported,
    vpack_candidates_for_source,
)

VPACK_MAGIC = b"VPACK"


@dataclass(frozen=True)
class SourceCheckResult:
    target: str
    check: str
    path: Path
    ok: bool
    message: str
    source_kind: str | None = None


@dataclass(frozen=True)
class VpackSourceInfo:
    path: Path
    exists: bool
    is_vpack: bool
    size_bytes: int | None
    sha256: str | None
    header_hex: str | None
    error: str | None = None


@dataclass(frozen=True)
class ExportSourcePackageReport:
    source_checks: list[SourceCheckResult]
    vpack_sources: list[VpackSourceInfo]

    @property
    def legacy_source_count(self) -> int:
        return sum(1 for check in self.source_checks if check.ok and check.source_kind == "legacy")

    @property
    def packed_source_count(self) -> int:
        return sum(1 for check in self.source_checks if check.ok and check.source_kind == "packed")

    @property
    def missing_source_count(self) -> int:
        return sum(1 for check in self.source_checks if not check.ok)

    @property
    def export_ready(self) -> bool:
        return all(check.ok for check in self.source_checks)


def _file_check(target: str, check: str, path: Path, missing_message: str) -> SourceCheckResult:
    if path.is_file():
        return SourceCheckResult(target, check, path, True, f"{check} found: {path}")
    return SourceCheckResult(target, check, path, False, f"{missing_message}: {path}")


def _source_data_check(target: ExportTarget) -> SourceCheckResult:
    path = target.source_data
    if path.is_file():
        return SourceCheckResult(
            target.name,
            "source data",
            path,
            True,
            f"legacy .dat source data found: {path}",
            "legacy",
        )

    vpack_path = find_packed_vpack_source(path)
    if vpack_path is not None:
        if is_packed_json_target_supported(target.name):
            return SourceCheckResult(
                target.name,
                "source data",
                vpack_path,
                True,
                (
                    f"source data not found: {path}; packed VPACK source found: {vpack_path}; "
                    "using packed JSON mapper"
                ),
                "packed",
            )
        return SourceCheckResult(
            target.name,
            "source data",
            vpack_path,
            False,
            (
                f"source data not found: {path}; packed VPACK source found: {vpack_path}; "
                f"{target.name} does not support packed JSON mapping yet"
            ),
        )

    return SourceCheckResult(target.name, "source data", path, False, f"source data not found: {path}")


def _inspect_vpack_source(path: Path) -> VpackSourceInfo:
    if not path.is_file():
        return VpackSourceInfo(path, False, False, None, None, None)

    try:
        digest = hashlib.sha256()
        header = b""
        size = 0
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                if len(header) < 16:
                    header = (header + chunk)[:16]
                size += len(chunk)
                digest.update(chunk)
    except OSError as exc:
        return VpackSourceInfo(path, True, False, None, None, None, str(exc))

    return VpackSourceInfo(
        path=path,
        exists=True,
        is_vpack=header.startswith(VPACK_MAGIC),
        size_bytes=size,
        sha256=digest.hexdigest().upper(),
        header_hex=header.hex().upper(),
    )


def _dedupe_vpack_candidate_paths(candidates: Iterable[Path]) -> list[Path]:
    def candidate_is_file(path: Path) -> bool:
        is_file = getattr(path, "is_file", None)
        return bool(is_file and is_file())

    selected: dict[str, Path] = {}
    for candidate in candidates:
        key = str(candidate).casefold()
        existing = selected.get(key)
        if existing is None:
            selected[key] = candidate
        elif not candidate_is_file(existing) and candidate_is_file(candidate):
            selected[key] = candidate
    return list(selected.values())


def inspect_export_source_package(targets: Iterable[ExportTarget]) -> ExportSourcePackageReport:
    target_list = list(targets)
    source_checks = [_source_data_check(target) for target in target_list]
    vpack_paths = _dedupe_vpack_candidate_paths(
        candidate
        for target in target_list
        for candidate in vpack_candidates_for_source(target.source_data)
    )
    vpack_sources = [_inspect_vpack_source(path) for path in vpack_paths]
    return ExportSourcePackageReport(source_checks, vpack_sources)


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
        results.append(_source_data_check(target))
        results.append(_site_destination_check(target))
        results.append(_syntax_check(target))
    return results
