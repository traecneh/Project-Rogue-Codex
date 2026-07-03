import gzip
import hashlib
import io
import json
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


PACK_KEY = b"VorliaRogueDataPackKey2026!!VPK1"


def make_vpack_bytes(*, build_version=42, ciphertext=b"encrypted payload"):
    nonce = bytes(range(12))
    tag = bytes(range(16, 32))
    return (
        b"VPACK"
        + struct.pack("<H", 1)
        + struct.pack("<I", build_version)
        + bytes([1, 1])
        + nonce
        + tag
        + struct.pack("<Q", len(ciphertext))
        + ciphertext
    )


def make_encrypted_vpack(files: dict[str, bytes], *, build_version=42):
    offset = 0
    packed_files = []
    payload_parts = []
    for path, data in files.items():
        compressed = gzip.compress(data)
        payload_parts.append(compressed)
        packed_files.append(
            {
                "path": path,
                "original_size": len(data),
                "compressed_size": len(compressed),
                "offset": offset,
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
        offset += len(compressed)

    manifest = {
        "schema_version": 1,
        "build_version": build_version,
        "compression": "gzip-per-file",
        "files": packed_files,
    }
    manifest_bytes = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
    plaintext = struct.pack("<I", len(manifest_bytes)) + manifest_bytes + b"".join(payload_parts)
    nonce = bytes(range(12))
    encrypted = AESGCM(PACK_KEY).encrypt(nonce, plaintext, None)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]
    return (
        b"VPACK"
        + struct.pack("<H", 1)
        + struct.pack("<I", build_version)
        + bytes([1, 1])
        + nonce
        + tag
        + struct.pack("<Q", len(ciphertext))
        + ciphertext
    )


class VpackInspectorTests(unittest.TestCase):
    def test_inspect_vpack_reads_fixed_header_and_ciphertext_bounds(self):
        from tools.codex_pipeline.vpack import inspect_vpack

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pack_path = root / "rogue_data.vpack"
            pack_path.write_bytes(make_vpack_bytes(build_version=7, ciphertext=b"abc123"))

            report = inspect_vpack(pack_path)

        self.assertTrue(report.exists)
        self.assertTrue(report.header_valid)
        self.assertEqual("VPACK", report.magic)
        self.assertEqual(1, report.schema_version)
        self.assertEqual(7, report.build_version)
        self.assertEqual(1, report.crypto_id)
        self.assertEqual(1, report.compression_id)
        self.assertEqual(49, report.header_size)
        self.assertEqual(49, report.ciphertext_offset)
        self.assertEqual(6, report.ciphertext_length)
        self.assertTrue(report.ciphertext_fits)
        self.assertEqual(0, report.trailing_bytes)
        self.assertEqual("101112131415161718191A1B1C1D1E1F", report.auth_tag_candidate_hex)
        self.assertEqual("000102030405060708090A0B", report.nonce_candidate_hex)

    def test_decrypt_vpack_extracts_and_verifies_manifest_files(self):
        from tools.codex_pipeline.vpack import decrypt_vpack

        files = {
            "weapons.json": b'{"weapons":[{"name":"Rune Sword"}]}',
            "armors.json": b'{"armors":[{"name":"Iceburst Amulet"}]}',
        }
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pack_path = root / "rogue_data.vpack"
            pack_path.write_bytes(make_encrypted_vpack(files, build_version=9))

            result = decrypt_vpack(pack_path)

        self.assertEqual(9, result.manifest["build_version"])
        self.assertEqual("gzip-per-file", result.manifest["compression"])
        self.assertEqual(["weapons.json", "armors.json"], [file.path for file in result.files])
        self.assertEqual(files["weapons.json"], result.files[0].data)
        self.assertEqual(files["armors.json"], result.files[1].data)
        self.assertTrue(all(file.sha256_ok for file in result.files))
        self.assertTrue(all(file.size_ok for file in result.files))

    def test_inspect_vpack_reports_client_log_loaded_files(self):
        from tools.codex_pipeline.vpack import inspect_vpack

        log_text = "\n".join(
            [
                "[Client] [info] Loaded client data pack Data/ClientPack/rogue_data.vpack (build 1, 3 files)",
                "[Client] [info] Loading Map.json from client data pack",
                "[Client] [info] Loading weapons.json from client data pack",
                "[Client] [info] Loading Map.json from client data pack",
                "[Client] [info] Loading armors.json from client data pack",
            ]
        )
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pack_path = root / "rogue_data.vpack"
            log_path = root / "ProjectRogue.log"
            pack_path.write_bytes(make_vpack_bytes(build_version=1))
            log_path.write_text(log_text, encoding="utf-8")

            report = inspect_vpack(pack_path, log_path=log_path)

        self.assertEqual(1, report.log_build_version)
        self.assertEqual(3, report.log_file_count)
        self.assertEqual(["Map.json", "weapons.json", "armors.json"], report.log_loaded_files)

    def test_cli_vpack_info_prints_header_and_log_summary(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pack_path = root / "rogue_data.vpack"
            log_path = root / "ProjectRogue.log"
            pack_path.write_bytes(make_encrypted_vpack({"weapons.json": b"{}", "monsters.json": b"{}"}, build_version=3))
            log_path.write_text(
                "[Client] [info] Loaded client data pack Data/ClientPack/rogue_data.vpack (build 3, 2 files)\n"
                "[Client] [info] Loading weapons.json from client data pack\n"
                "[Client] [info] Loading monsters.json from client data pack\n",
                encoding="utf-8",
            )

            output = io.StringIO()
            with patch("sys.stdout", output):
                exit_code = cli.main(["vpack-info", "--pack-path", str(pack_path), "--log-path", str(log_path)])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn(f"VPACK INFO: {pack_path}", printed)
        self.assertIn("HEADER: magic=VPACK schema=1 build=3 crypto=1 compression=1", printed)
        self.assertIn("CIPHERTEXT: offset=49", printed)
        self.assertIn("CLIENT LOG: build=3 files=2 observed=2", printed)
        self.assertIn("LOG FILE weapons.json", printed)
        self.assertIn("LOG FILE monsters.json", printed)
        self.assertIn("MANIFEST: schema=1 build=3 compression=gzip-per-file files=2", printed)
        self.assertIn("DECRYPTION: supported by Codex pipeline", printed)

    def test_cli_vpack_extract_writes_decrypted_files(self):
        from tools.codex_pipeline import cli

        files = {
            "weapons.json": b'{"weapons":[{"name":"Rune Sword"}]}',
            "nested/armors.json": b'{"armors":[{"name":"Iceburst Amulet"}]}',
        }
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pack_path = root / "rogue_data.vpack"
            output_dir = root / "out"
            pack_path.write_bytes(make_encrypted_vpack(files))

            output = io.StringIO()
            with patch("sys.stdout", output):
                exit_code = cli.main(["vpack-extract", "--pack-path", str(pack_path), "--output-dir", str(output_dir)])

            weapons = (output_dir / "weapons.json").read_bytes()
            armors = (output_dir / "nested" / "armors.json").read_bytes()

        self.assertEqual(0, exit_code)
        self.assertEqual(files["weapons.json"], weapons)
        self.assertEqual(files["nested/armors.json"], armors)
        printed = output.getvalue()
        self.assertIn("VPACK EXTRACTED weapons.json", printed)
        self.assertIn("VPACK EXTRACTED nested/armors.json", printed)


if __name__ == "__main__":
    unittest.main()
