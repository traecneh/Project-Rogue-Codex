from __future__ import annotations

import ast
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.exports import ExportTarget

VPACK_MAGIC = b"VPACK"


@dataclass(frozen=True)
class SourceCheckResult:
    target: str
    check: str
    path: Path
    ok: bool
    message: str


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
        return sum(1 for check in self.source_checks if check.ok)

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


def _vpack_candidate_for_source(path: Path) -> Path:
    return path.parent / "ClientPack" / "rogue_data.vpack"


def _is_vpack_file(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        return path.read_bytes()[: len(VPACK_MAGIC)] == VPACK_MAGIC
    except OSError:
        return False


def _source_data_check(target: ExportTarget) -> SourceCheckResult:
    path = target.source_data
    if path.is_file():
        return SourceCheckResult(
            target.name,
            "source data",
            path,
            True,
            f"legacy .dat source data found: {path}",
        )

    vpack_path = _vpack_candidate_for_source(path)
    if _is_vpack_file(vpack_path):
        return SourceCheckResult(
            target.name,
            "source data",
            path,
            False,
            (
                f"source data not found: {path}; packed VPACK source found: {vpack_path}; "
                "legacy .dat extractors cannot read packed VPACK JSON yet"
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


def inspect_export_source_package(targets: Iterable[ExportTarget]) -> ExportSourcePackageReport:
    target_list = list(targets)
    source_checks = [_source_data_check(target) for target in target_list]
    vpack_paths = dict.fromkeys(_vpack_candidate_for_source(target.source_data) for target in target_list)
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
