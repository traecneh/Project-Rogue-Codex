import io
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def make_vpack_bytes(*, build_version=42, ciphertext=b"encrypted payload"):
    auth_tag = bytes(range(16))
    nonce = bytes(range(16, 28))
    return (
        b"VPACK"
        + struct.pack("<H", 1)
        + struct.pack("<I", build_version)
        + bytes([1, 1])
        + auth_tag
        + nonce
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
        self.assertEqual("000102030405060708090A0B0C0D0E0F", report.auth_tag_candidate_hex)
        self.assertEqual("101112131415161718191A1B", report.nonce_candidate_hex)

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
            pack_path.write_bytes(make_vpack_bytes(build_version=3, ciphertext=b"abcdef"))
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
        self.assertIn("CIPHERTEXT: offset=49 length=6 trailing=0 fits=yes", printed)
        self.assertIn("CLIENT LOG: build=3 files=2 observed=2", printed)
        self.assertIn("LOG FILE weapons.json", printed)
        self.assertIn("LOG FILE monsters.json", printed)
        self.assertIn("DECRYPTION: unsupported by Codex pipeline", printed)


if __name__ == "__main__":
    unittest.main()
