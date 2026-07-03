from __future__ import annotations

import re
import struct
from dataclasses import dataclass, field
from pathlib import Path


VPACK_MAGIC = b"VPACK"
VPACK_FIXED_HEADER_SIZE = 49
VPACK_AUTH_TAG_OFFSET = 13
VPACK_AUTH_TAG_SIZE = 16
VPACK_NONCE_OFFSET = 29
VPACK_NONCE_SIZE = 12
VPACK_CIPHERTEXT_LENGTH_OFFSET = 41


@dataclass(frozen=True)
class VpackInspectionReport:
    path: Path
    exists: bool
    size_bytes: int = 0
    header_valid: bool = False
    issues: list[str] = field(default_factory=list)
    magic: str | None = None
    schema_version: int | None = None
    build_version: int | None = None
    crypto_id: int | None = None
    compression_id: int | None = None
    header_size: int = VPACK_FIXED_HEADER_SIZE
    ciphertext_offset: int | None = None
    ciphertext_length: int | None = None
    ciphertext_fits: bool = False
    trailing_bytes: int | None = None
    auth_tag_candidate_hex: str | None = None
    nonce_candidate_hex: str | None = None
    log_path: Path | None = None
    log_build_version: int | None = None
    log_file_count: int | None = None
    log_loaded_files: list[str] = field(default_factory=list)


def _hex(data: bytes) -> str:
    return data.hex().upper()


def _append_unique(items: list[str], value: str) -> None:
    if value not in items:
        items.append(value)


def _read_log_observations(path: Path | None) -> tuple[int | None, int | None, list[str]]:
    if path is None or not path.is_file():
        return None, None, []

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None, None, []

    build_version = None
    file_count = None
    loaded_files: list[str] = []
    loaded_pattern = re.compile(r"Loaded client data pack .*\(build (\d+), (\d+) files\)")
    file_pattern = re.compile(r"Loading (.+?) from client data pack")

    for line in text.splitlines():
        loaded_match = loaded_pattern.search(line)
        if loaded_match:
            build_version = int(loaded_match.group(1))
            file_count = int(loaded_match.group(2))
            continue

        file_match = file_pattern.search(line)
        if file_match:
            _append_unique(loaded_files, file_match.group(1))

    return build_version, file_count, loaded_files


def inspect_vpack(path: Path, *, log_path: Path | None = None) -> VpackInspectionReport:
    issues: list[str] = []
    log_build_version, log_file_count, log_loaded_files = _read_log_observations(log_path)

    if not path.is_file():
        return VpackInspectionReport(
            path=path,
            exists=False,
            issues=[f"pack file not found: {path}"],
            log_path=log_path,
            log_build_version=log_build_version,
            log_file_count=log_file_count,
            log_loaded_files=log_loaded_files,
        )

    try:
        data = path.read_bytes()
    except OSError as exc:
        return VpackInspectionReport(
            path=path,
            exists=True,
            issues=[f"failed to read pack file: {exc}"],
            log_path=log_path,
            log_build_version=log_build_version,
            log_file_count=log_file_count,
            log_loaded_files=log_loaded_files,
        )

    size_bytes = len(data)
    if size_bytes < VPACK_FIXED_HEADER_SIZE:
        return VpackInspectionReport(
            path=path,
            exists=True,
            size_bytes=size_bytes,
            issues=[f"pack is smaller than the fixed header: {size_bytes} < {VPACK_FIXED_HEADER_SIZE}"],
            log_path=log_path,
            log_build_version=log_build_version,
            log_file_count=log_file_count,
            log_loaded_files=log_loaded_files,
        )

    magic_bytes = data[: len(VPACK_MAGIC)]
    magic = magic_bytes.decode("ascii", errors="replace")
    schema_version = struct.unpack_from("<H", data, 5)[0]
    build_version = struct.unpack_from("<I", data, 7)[0]
    crypto_id = data[11]
    compression_id = data[12]
    auth_tag_hex = _hex(data[VPACK_AUTH_TAG_OFFSET : VPACK_AUTH_TAG_OFFSET + VPACK_AUTH_TAG_SIZE])
    ciphertext_length = struct.unpack_from("<Q", data, VPACK_CIPHERTEXT_LENGTH_OFFSET)[0]
    nonce_hex = _hex(data[VPACK_NONCE_OFFSET : VPACK_NONCE_OFFSET + VPACK_NONCE_SIZE])
    ciphertext_offset = VPACK_FIXED_HEADER_SIZE
    expected_size = ciphertext_offset + ciphertext_length
    trailing_bytes = size_bytes - expected_size
    ciphertext_fits = ciphertext_length > 0 and expected_size <= size_bytes

    if magic_bytes != VPACK_MAGIC:
        issues.append(f"pack magic is not VPACK: {magic!r}")
    if ciphertext_length == 0:
        issues.append("pack ciphertext length is zero")
    if expected_size > size_bytes:
        issues.append("pack ciphertext length exceeds file size")
    if expected_size < size_bytes:
        issues.append("pack has trailing bytes after ciphertext")

    return VpackInspectionReport(
        path=path,
        exists=True,
        size_bytes=size_bytes,
        header_valid=not issues,
        issues=issues,
        magic=magic,
        schema_version=schema_version,
        build_version=build_version,
        crypto_id=crypto_id,
        compression_id=compression_id,
        ciphertext_offset=ciphertext_offset,
        ciphertext_length=ciphertext_length,
        ciphertext_fits=ciphertext_fits,
        trailing_bytes=trailing_bytes,
        auth_tag_candidate_hex=auth_tag_hex,
        nonce_candidate_hex=nonce_hex,
        log_path=log_path,
        log_build_version=log_build_version,
        log_file_count=log_file_count,
        log_loaded_files=log_loaded_files,
    )
