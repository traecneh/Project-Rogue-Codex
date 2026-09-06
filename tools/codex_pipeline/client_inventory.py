from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from tools.codex_pipeline.config import CLIENT_GF_JSON_DIR, CLIENT_LOG_PATH, CLIENT_PACK_PATH, CLIENT_ROOT
from tools.codex_pipeline.vpack import VpackError, decrypt_vpack


DIAGNOSTIC_JSON_NAMES = {"Settings.json": "local preferences", "GUI.json": "local panel state"}
RUNTIME_EXTENSIONS = {".dll", ".exe"}


@dataclass(frozen=True)
class ClientRootFile:
    path: Path
    size_bytes: int
    extension: str
    kind: str
    zeroed_binary: bool = False


@dataclass(frozen=True)
class VpackFileInventory:
    path: str
    original_size: int
    compressed_size: int
    sha256_ok: bool


@dataclass(frozen=True)
class PackedJsonSummary:
    path: str
    primary_collection: str | None
    group_count: int
    record_count: int
    fields: list[str]
    issues: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AtlasInventoryEntry:
    path: Path
    name: str | None
    width: int | None
    height: int | None
    size_bytes: int
    sha256: str | None
    issue: str | None = None


@dataclass(frozen=True)
class DiagnosticFile:
    path: Path
    keys: list[str]
    note: str


@dataclass(frozen=True)
class ClientInventoryReport:
    client_root: Path
    root_files: list[ClientRootFile]
    vpack_path: Path
    vpack_exists: bool
    vpack_size_bytes: int | None
    vpack_sha256: str | None
    vpack_schema_version: int | None
    vpack_build_version: int | None
    vpack_compression: str | None
    vpack_files: list[VpackFileInventory]
    vpack_log_build_version: int | None
    vpack_log_file_count: int | None
    vpack_log_loaded_files: list[str]
    json_files: list[PackedJsonSummary]
    atlases: list[AtlasInventoryEntry]
    diagnostics: list[DiagnosticFile]
    issues: list[str]

    @property
    def ready(self) -> bool:
        return not self.issues and self.vpack_exists

    @property
    def root_file_count(self) -> int:
        return len(self.root_files)

    @property
    def runtime_file_count(self) -> int:
        return sum(1 for file in self.root_files if file.kind == "runtime")

    @property
    def diagnostic_file_count(self) -> int:
        return len(self.diagnostics)

    @property
    def zeroed_binary_count(self) -> int:
        return sum(1 for file in self.root_files if file.zeroed_binary)


@dataclass(frozen=True)
class ClientInventoryDiffEntry:
    section: str
    key: str
    change_type: str
    summary: str


@dataclass(frozen=True)
class ClientInventoryDiffReport:
    entries: list[ClientInventoryDiffEntry]
    issues: list[str]

    @property
    def has_changes(self) -> bool:
        return bool(self.entries)

    @property
    def has_errors(self) -> bool:
        return bool(self.issues)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def _sha256_file(path: Path) -> str | None:
    try:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError:
        return None
    return digest.hexdigest().upper()


def _is_zeroed_binary(path: Path, size_bytes: int) -> bool:
    if size_bytes == 0 or path.suffix.lower() not in {".dat", ".bin"}:
        return False
    try:
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(8192)
                if not chunk:
                    return True
                if any(byte != 0 for byte in chunk):
                    return False
    except OSError:
        return False


def _classify_root_file(path: Path) -> str:
    if path.name in DIAGNOSTIC_JSON_NAMES:
        return "diagnostic"
    if path.name.lower().endswith(".log"):
        return "log"
    if path.suffix.lower() in RUNTIME_EXTENSIONS:
        return "runtime"
    return "data"


def _build_root_file_inventory(client_root: Path) -> tuple[list[ClientRootFile], list[str]]:
    issues: list[str] = []
    try:
        entries = sorted((entry for entry in client_root.iterdir() if entry.is_file()), key=lambda entry: entry.name.lower())
    except OSError as exc:
        return [], [f"failed to read client root: {exc}"]

    files: list[ClientRootFile] = []
    for entry in entries:
        try:
            size_bytes = entry.stat().st_size
        except OSError as exc:
            issues.append(f"failed to stat root file {entry}: {exc}")
            continue
        files.append(
            ClientRootFile(
                path=Path(entry.name),
                size_bytes=size_bytes,
                extension=entry.suffix.lower(),
                kind=_classify_root_file(entry),
                zeroed_binary=_is_zeroed_binary(entry, size_bytes),
            )
        )
    return files, issues


def _read_json(data: bytes, path: str) -> tuple[Any | None, list[str]]:
    try:
        return json.loads(data.decode("utf-8")), []
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        return None, [f"{path} failed to parse as JSON: {exc}"]


def _record_fields(records: list[Any]) -> list[str]:
    fields: set[str] = set()
    for record in records:
        if isinstance(record, dict):
            fields.update(str(key) for key in record.keys())
    return sorted(fields)


def _summarize_collection(path: str, collection_name: str, records: list[Any]) -> PackedJsonSummary:
    group_count = 0
    record_count = len(records)
    fields = set(_record_fields(records))
    if records and all(isinstance(record, dict) and isinstance(record.get("items"), list) for record in records):
        group_count = len(records)
        record_count = sum(len(record["items"]) for record in records)
        for record in records:
            fields.update(_record_fields(record["items"]))
    return PackedJsonSummary(
        path=path,
        primary_collection=collection_name,
        group_count=group_count,
        record_count=record_count,
        fields=sorted(fields),
    )


def _summarize_packed_json(path: str, data: bytes) -> PackedJsonSummary:
    parsed, issues = _read_json(data, path)
    if issues:
        return PackedJsonSummary(path, None, 0, 0, [], issues)

    if isinstance(parsed, dict):
        list_collections = [
            (key, value)
            for key, value in parsed.items()
            if isinstance(key, str) and isinstance(value, list)
        ]
        preferred = [
            (key, value)
            for key, value in list_collections
            if key not in {"grid", "chunks", "chunk_map"}
        ]
        selected = preferred[0] if preferred else (list_collections[0] if list_collections else None)
        if selected is not None:
            return _summarize_collection(path, selected[0], selected[1])
        return PackedJsonSummary(path, None, 0, 1, sorted(str(key) for key in parsed.keys()))

    if isinstance(parsed, list):
        return _summarize_collection(path, None, parsed)

    return PackedJsonSummary(path, None, 0, 1, [], [f"{path} root is {type(parsed).__name__}, not object or list"])


def _build_atlas_inventory(gf_json_dir: Path) -> tuple[list[AtlasInventoryEntry], list[str]]:
    if not gf_json_dir.is_dir():
        return [], [f"gf_json directory not found: {gf_json_dir}"]

    atlases: list[AtlasInventoryEntry] = []
    issues: list[str] = []
    for path in sorted(gf_json_dir.glob("*.json"), key=lambda item: item.name.lower()):
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
            name = parsed.get("Name") if isinstance(parsed, dict) else None
            encoded = parsed.get("Data") if isinstance(parsed, dict) else None
            if not isinstance(encoded, str):
                raise ValueError("missing string Data field")
            image_bytes = base64.b64decode(encoded, validate=True)
            with Image.open(BytesIO(image_bytes)) as image:
                width, height = image.size
            atlases.append(
                AtlasInventoryEntry(
                    path=Path(path.name),
                    name=name if isinstance(name, str) else None,
                    width=width,
                    height=height,
                    size_bytes=len(image_bytes),
                    sha256=_sha256_bytes(image_bytes),
                )
            )
        except (OSError, json.JSONDecodeError, ValueError, UnidentifiedImageError) as exc:
            message = f"{path.name}: {exc}"
            issues.append(f"atlas read failed for {message}")
            atlases.append(AtlasInventoryEntry(Path(path.name), None, None, None, 0, None, str(exc)))
    return atlases, issues


def _build_diagnostics(client_root: Path) -> tuple[list[DiagnosticFile], list[str]]:
    diagnostics: list[DiagnosticFile] = []
    issues: list[str] = []
    for name, note in DIAGNOSTIC_JSON_NAMES.items():
        path = client_root / name
        if not path.is_file():
            continue
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            issues.append(f"diagnostic JSON failed to read {path}: {exc}")
            continue
        keys = sorted(str(key) for key in parsed.keys()) if isinstance(parsed, dict) else []
        diagnostics.append(DiagnosticFile(Path(name), keys, note))
    return diagnostics, issues


def build_client_inventory_report(
    client_root: Path = CLIENT_ROOT,
    *,
    pack_path: Path = CLIENT_PACK_PATH,
    log_path: Path = CLIENT_LOG_PATH,
    gf_json_dir: Path = CLIENT_GF_JSON_DIR,
) -> ClientInventoryReport:
    client_root = client_root.expanduser().resolve()
    pack_path = pack_path.expanduser().resolve()
    log_path = log_path.expanduser().resolve()
    gf_json_dir = gf_json_dir.expanduser().resolve()
    issues: list[str] = []

    root_files, root_issues = _build_root_file_inventory(client_root)
    issues.extend(root_issues)
    atlases, atlas_issues = _build_atlas_inventory(gf_json_dir)
    issues.extend(atlas_issues)
    diagnostics, diagnostic_issues = _build_diagnostics(client_root)
    issues.extend(diagnostic_issues)

    vpack_exists = pack_path.is_file()
    vpack_size_bytes = pack_path.stat().st_size if vpack_exists else None
    vpack_sha256 = _sha256_file(pack_path) if vpack_exists else None
    vpack_schema_version = None
    vpack_build_version = None
    vpack_compression = None
    vpack_files: list[VpackFileInventory] = []
    vpack_log_build_version = None
    vpack_log_file_count = None
    vpack_log_loaded_files: list[str] = []
    json_files: list[PackedJsonSummary] = []

    if not vpack_exists:
        issues.append(f"VPACK not found: {pack_path}")
    else:
        try:
            decrypted = decrypt_vpack(pack_path, log_path=log_path)
            vpack_schema_version = decrypted.manifest.get("schema_version")
            vpack_build_version = decrypted.manifest.get("build_version")
            vpack_compression = decrypted.manifest.get("compression")
            vpack_log_build_version = decrypted.report.log_build_version
            vpack_log_file_count = decrypted.report.log_file_count
            vpack_log_loaded_files = decrypted.report.log_loaded_files
            vpack_files = [
                VpackFileInventory(file.path, file.original_size, file.compressed_size, file.sha256_ok)
                for file in decrypted.files
            ]
            json_files = [
                _summarize_packed_json(file.path, file.data)
                for file in decrypted.files
                if file.path.lower().endswith(".json")
            ]
            issues.extend(issue for summary in json_files for issue in summary.issues)
        except (OSError, VpackError) as exc:
            issues.append(f"VPACK inventory failed: {exc}")

    return ClientInventoryReport(
        client_root=client_root,
        root_files=root_files,
        vpack_path=pack_path,
        vpack_exists=vpack_exists,
        vpack_size_bytes=vpack_size_bytes,
        vpack_sha256=vpack_sha256,
        vpack_schema_version=vpack_schema_version,
        vpack_build_version=vpack_build_version,
        vpack_compression=vpack_compression,
        vpack_files=vpack_files,
        vpack_log_build_version=vpack_log_build_version,
        vpack_log_file_count=vpack_log_file_count,
        vpack_log_loaded_files=vpack_log_loaded_files,
        json_files=json_files,
        atlases=atlases,
        diagnostics=diagnostics,
        issues=issues,
    )


def _path_string(path: Path) -> str:
    return path.as_posix()


def build_client_inventory_snapshot(report: ClientInventoryReport) -> dict[str, object]:
    return {
        "schema_version": 1,
        "root_files": [
            {
                "path": _path_string(file.path),
                "size_bytes": file.size_bytes,
                "extension": file.extension,
                "kind": file.kind,
                "zeroed_binary": file.zeroed_binary,
            }
            for file in sorted(report.root_files, key=lambda item: _path_string(item.path).lower())
        ],
        "vpack": {
            "exists": report.vpack_exists,
            "size_bytes": report.vpack_size_bytes,
            "sha256": report.vpack_sha256,
            "schema_version": report.vpack_schema_version,
            "build_version": report.vpack_build_version,
            "compression": report.vpack_compression,
            "file_count": len(report.vpack_files),
            "log_build_version": report.vpack_log_build_version,
            "log_file_count": report.vpack_log_file_count,
            "log_loaded_files": sorted(report.vpack_log_loaded_files),
        },
        "vpack_files": [
            {
                "path": file.path,
                "original_size": file.original_size,
                "compressed_size": file.compressed_size,
                "sha256_ok": file.sha256_ok,
            }
            for file in sorted(report.vpack_files, key=lambda item: item.path.lower())
        ],
        "packed_json": [
            {
                "path": summary.path,
                "primary_collection": summary.primary_collection,
                "group_count": summary.group_count,
                "record_count": summary.record_count,
                "fields": sorted(summary.fields),
            }
            for summary in sorted(report.json_files, key=lambda item: item.path.lower())
        ],
        "atlases": [
            {
                "path": _path_string(atlas.path),
                "name": atlas.name,
                "width": atlas.width,
                "height": atlas.height,
                "size_bytes": atlas.size_bytes,
                "sha256": atlas.sha256,
            }
            for atlas in sorted(report.atlases, key=lambda item: _path_string(item.path).lower())
        ],
        "diagnostics": [
            {
                "path": _path_string(diagnostic.path),
                "keys": sorted(diagnostic.keys),
                "note": diagnostic.note,
            }
            for diagnostic in sorted(report.diagnostics, key=lambda item: _path_string(item.path).lower())
        ],
    }


def write_client_inventory_snapshot(report: ClientInventoryReport, path: Path) -> Path:
    snapshot = build_client_inventory_snapshot(report)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def load_client_inventory_snapshot(path: Path) -> dict[str, object]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"client inventory snapshot must be a JSON object: {path}")
    return data


def _indexed(items: object) -> dict[str, dict[str, object]]:
    if not isinstance(items, list):
        return {}
    indexed: dict[str, dict[str, object]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        key = item.get("path")
        if isinstance(key, str):
            indexed[key] = item
    return indexed


def _format_scalar_change(key: str, before: object, after: object) -> str:
    return f"{key} {before!r} -> {after!r}"


def _format_list_change(key: str, before: object, after: object) -> str:
    before_set = set(before) if isinstance(before, list) else set()
    after_set = set(after) if isinstance(after, list) else set()
    added = sorted(str(value) for value in after_set - before_set)
    removed = sorted(str(value) for value in before_set - after_set)
    parts = []
    if added:
        parts.append(f"{key} added {', '.join(added)}")
    if removed:
        parts.append(f"{key} removed {', '.join(removed)}")
    return "; ".join(parts) if parts else _format_scalar_change(key, before, after)


def _changed_summary(previous: dict[str, object], current: dict[str, object], keys: list[str]) -> str:
    changes: list[str] = []
    for key in keys:
        before = previous.get(key)
        after = current.get(key)
        if before == after:
            continue
        if isinstance(before, list) or isinstance(after, list):
            changes.append(_format_list_change(key, before, after))
        else:
            changes.append(_format_scalar_change(key, before, after))
    return "; ".join(changes)


def _diff_indexed_section(
    entries: list[ClientInventoryDiffEntry],
    section: str,
    previous_items: object,
    current_items: object,
    compare_keys: list[str],
) -> None:
    previous = _indexed(previous_items)
    current = _indexed(current_items)
    previous_keys = set(previous)
    current_keys = set(current)

    for key in sorted(current_keys - previous_keys):
        entries.append(ClientInventoryDiffEntry(section, key, "added", "added"))
    for key in sorted(previous_keys - current_keys):
        entries.append(ClientInventoryDiffEntry(section, key, "removed", "removed"))
    for key in sorted(previous_keys & current_keys):
        summary = _changed_summary(previous[key], current[key], compare_keys)
        if summary:
            entries.append(ClientInventoryDiffEntry(section, key, "changed", summary))


def _snapshot_schema_issue(label: str, snapshot: dict[str, object]) -> str | None:
    schema_version = snapshot.get("schema_version")
    if schema_version != 1:
        return f"{label} snapshot schema_version must be 1, got {schema_version!r}"
    return None


def diff_client_inventory_snapshots(
    previous: dict[str, object],
    current: dict[str, object],
) -> ClientInventoryDiffReport:
    entries: list[ClientInventoryDiffEntry] = []
    issues = [
        issue
        for issue in (
            _snapshot_schema_issue("previous", previous),
            _snapshot_schema_issue("current", current),
        )
        if issue is not None
    ]
    if issues:
        return ClientInventoryDiffReport(entries, issues)

    previous_vpack = previous.get("vpack") if isinstance(previous.get("vpack"), dict) else {}
    current_vpack = current.get("vpack") if isinstance(current.get("vpack"), dict) else {}
    vpack_summary = _changed_summary(
        previous_vpack,
        current_vpack,
        [
            "exists",
            "size_bytes",
            "sha256",
            "schema_version",
            "build_version",
            "compression",
            "file_count",
            "log_build_version",
            "log_file_count",
            "log_loaded_files",
        ],
    )
    if vpack_summary:
        entries.append(ClientInventoryDiffEntry("vpack", "rogue_data.vpack", "changed", vpack_summary))

    _diff_indexed_section(
        entries,
        "root_files",
        previous.get("root_files"),
        current.get("root_files"),
        ["size_bytes", "extension", "kind", "zeroed_binary"],
    )
    _diff_indexed_section(
        entries,
        "vpack_files",
        previous.get("vpack_files"),
        current.get("vpack_files"),
        ["original_size", "compressed_size", "sha256_ok"],
    )
    _diff_indexed_section(
        entries,
        "packed_json",
        previous.get("packed_json"),
        current.get("packed_json"),
        ["primary_collection", "group_count", "record_count", "fields"],
    )
    _diff_indexed_section(
        entries,
        "atlases",
        previous.get("atlases"),
        current.get("atlases"),
        ["name", "width", "height", "size_bytes", "sha256"],
    )
    _diff_indexed_section(
        entries,
        "diagnostics",
        previous.get("diagnostics"),
        current.get("diagnostics"),
        ["keys", "note"],
    )
    return ClientInventoryDiffReport(entries, issues)
