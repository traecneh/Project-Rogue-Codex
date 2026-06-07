from __future__ import annotations

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

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


def _prepare_generated_path(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if not path.is_file():
            raise ExportError(f"Generated output path exists and is not a file: {path}")
        path.unlink()


def _resolve_output_dir(output_dir: Path) -> Path:
    return output_dir.expanduser().resolve()


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
