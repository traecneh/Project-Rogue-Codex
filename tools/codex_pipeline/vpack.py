from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
import struct
from dataclasses import dataclass, field
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


VPACK_MAGIC = b"VPACK"
VPACK_FIXED_HEADER_SIZE = 49
VPACK_NONCE_OFFSET = 13
VPACK_NONCE_SIZE = 12
VPACK_AUTH_TAG_OFFSET = 25
VPACK_AUTH_TAG_SIZE = 16
VPACK_CIPHERTEXT_LENGTH_OFFSET = 41
VPACK_AES_KEY_B64 = "Vm9ybGlhUm9ndWVEYXRhUGFja0tleTIwMjYhIVZQSzE="


class VpackError(ValueError):
    pass


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


@dataclass(frozen=True)
class VpackExtractedFile:
    path: str
    data: bytes
    original_size: int
    compressed_size: int
    offset: int
    sha256: str
    size_ok: bool
    sha256_ok: bool


@dataclass(frozen=True)
class VpackDecryptionResult:
    report: VpackInspectionReport
    manifest: dict
    files: list[VpackExtractedFile]


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
    compression_id = data[11]
    crypto_id = data[12]
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


def _read_pack_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as exc:
        raise VpackError(f"failed to read pack file: {exc}") from exc


def _decode_default_key() -> bytes:
    key = base64.b64decode(VPACK_AES_KEY_B64, validate=True)
    if len(key) != 32:
        raise VpackError(f"decoded AES key length is not 32 bytes: {len(key)}")
    return key


def _validate_manifest(manifest: object, report: VpackInspectionReport) -> dict:
    if not isinstance(manifest, dict):
        raise VpackError("manifest root is not an object")
    if manifest.get("schema_version") != report.schema_version:
        raise VpackError("manifest schema_version does not match header schema version")
    if manifest.get("build_version") != report.build_version:
        raise VpackError("manifest build_version does not match header build version")
    if manifest.get("compression") != "gzip-per-file":
        raise VpackError(f"manifest compression is unsupported: {manifest.get('compression')!r}")
    if not isinstance(manifest.get("files"), list) or not manifest["files"]:
        raise VpackError("manifest files field is not a non-empty array")
    return manifest


def _parse_manifest(plaintext: bytes, report: VpackInspectionReport) -> tuple[dict, int]:
    if len(plaintext) < 4:
        raise VpackError("decrypted plaintext is missing the manifest length")
    manifest_length = struct.unpack_from("<I", plaintext, 0)[0]
    manifest_end = 4 + manifest_length
    if manifest_end > len(plaintext):
        raise VpackError("manifest length exceeds decrypted plaintext")
    try:
        manifest = json.loads(plaintext[4:manifest_end])
    except json.JSONDecodeError as exc:
        raise VpackError(f"manifest JSON parse error: {exc}") from exc
    return _validate_manifest(manifest, report), manifest_end


def _extract_file(entry: object, payload: bytes) -> VpackExtractedFile:
    if not isinstance(entry, dict):
        raise VpackError("manifest file entry is not an object")
    path = entry.get("path")
    original_size = entry.get("original_size")
    compressed_size = entry.get("compressed_size")
    offset = entry.get("offset")
    sha256 = entry.get("sha256")
    if (
        not isinstance(path, str)
        or not isinstance(original_size, int)
        or not isinstance(compressed_size, int)
        or not isinstance(offset, int)
        or not isinstance(sha256, str)
    ):
        raise VpackError(f"manifest file entry is missing or has invalid fields: {entry!r}")
    if compressed_size <= 0:
        raise VpackError(f"manifest compressed_size is zero for {path}")
    if offset < 0 or compressed_size < 0 or offset + compressed_size > len(payload):
        raise VpackError(f"manifest payload range exceeds decrypted payload for {path}")
    compressed = payload[offset : offset + compressed_size]
    try:
        data = gzip.decompress(compressed)
    except OSError as exc:
        raise VpackError(f"gzip decompression failed for {path}: {exc}") from exc
    digest = hashlib.sha256(data).hexdigest()
    return VpackExtractedFile(
        path=path,
        data=data,
        original_size=original_size,
        compressed_size=compressed_size,
        offset=offset,
        sha256=sha256,
        size_ok=len(data) == original_size,
        sha256_ok=digest == sha256,
    )


def decrypt_vpack(path: Path, *, log_path: Path | None = None) -> VpackDecryptionResult:
    report = inspect_vpack(path, log_path=log_path)
    if not report.exists:
        raise VpackError(f"pack file not found: {path}")
    if not report.header_valid:
        raise VpackError("; ".join(report.issues))

    data = _read_pack_bytes(path)
    nonce = data[VPACK_NONCE_OFFSET : VPACK_NONCE_OFFSET + VPACK_NONCE_SIZE]
    tag = data[VPACK_AUTH_TAG_OFFSET : VPACK_AUTH_TAG_OFFSET + VPACK_AUTH_TAG_SIZE]
    ciphertext = data[report.ciphertext_offset : report.ciphertext_offset + report.ciphertext_length]
    try:
        plaintext = AESGCM(_decode_default_key()).decrypt(nonce, ciphertext + tag, None)
    except Exception as exc:
        raise VpackError(f"AES-GCM decrypt/authentication failed: {exc}") from exc

    manifest, payload_offset = _parse_manifest(plaintext, report)
    payload = plaintext[payload_offset:]
    files = [_extract_file(entry, payload) for entry in manifest["files"]]
    for file in files:
        if not file.size_ok:
            raise VpackError(f"deflate output size did not match manifest original_size for {file.path}")
        if not file.sha256_ok:
            raise VpackError(f"sha256 mismatch for {file.path}")
    return VpackDecryptionResult(report=report, manifest=manifest, files=files)


def resolve_vpack_output_path(output_dir: Path, packed_path: str) -> Path:
    relative = Path(packed_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise VpackError(f"manifest path is invalid: {packed_path}")
    output_root = output_dir.resolve()
    output_path = (output_root / relative).resolve()
    if not output_path.is_relative_to(output_root):
        raise VpackError(f"manifest path is invalid: {packed_path}")
    return output_path
