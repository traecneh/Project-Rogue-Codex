import base64
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
from PIL import Image


PACK_KEY = b"VorliaRogueDataPackKey2026!!VPK1"


def make_encrypted_vpack(files: dict[str, bytes], *, build_version=7) -> bytes:
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


def write_gf_json_png(path: Path, size: tuple[int, int], color=(255, 0, 255, 255)) -> None:
    image = Image.new("RGBA", size, color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"Name": path.stem, "Data": base64.b64encode(buffer.getvalue()).decode("ascii")}),
        encoding="utf-8",
    )


class ClientInventoryTests(unittest.TestCase):
    def test_build_client_inventory_report_summarizes_install_pack_json_and_atlases(self):
        from tools.codex_pipeline.client_inventory import build_client_inventory_report

        with tempfile.TemporaryDirectory() as tmp:
            client_root = Path(tmp)
            pack_path = client_root / "Data" / "ClientPack" / "rogue_data.vpack"
            log_path = client_root / "ProjectRogue.log"
            gf_json_dir = client_root / "gf_json"
            pack_path.parent.mkdir(parents=True)
            pack_path.write_bytes(
                make_encrypted_vpack(
                    {
                        "weapons.json": b'{"schema_version":1,"weapons":[{"type":0,"items":[{"id":1,"name":"Sword"}]}]}',
                        "collectables.json": b'{"schema_version":1,"collectables":[{"id":1,"name":"Gold","use_type":0}]}',
                    },
                    build_version=11,
                )
            )
            log_path.write_text(
                "[Client] [info] Loaded client data pack Data/ClientPack/rogue_data.vpack (build 11, 2 files)\n"
                "[Client] [info] Loading weapons.json from client data pack\n"
                "[Client] [info] Loading collectables.json from client data pack\n",
                encoding="utf-8",
            )
            write_gf_json_png(gf_json_dir / "itemgraph.json", (32, 16))
            write_gf_json_png(gf_json_dir / "trade.json", (8, 4))
            (client_root / "Settings.json").write_text('{"Account":"local-user","Graphics":{"Fullscreen":false}}', encoding="utf-8")
            (client_root / "GUI.json").write_text('{"Shop":{"open":true}}', encoding="utf-8")
            (client_root / "kills.dat").write_bytes(b"\x00" * 16)
            (client_root / "SDL3.dll").write_bytes(b"runtime")

            report = build_client_inventory_report(client_root, pack_path=pack_path, log_path=log_path, gf_json_dir=gf_json_dir)

        self.assertTrue(report.ready)
        self.assertEqual(client_root, report.client_root)
        self.assertEqual(5, report.root_file_count)
        self.assertEqual(1, report.runtime_file_count)
        self.assertEqual(2, len(report.vpack_files))
        self.assertEqual(11, report.vpack_build_version)
        self.assertEqual(2, report.vpack_log_file_count)
        self.assertEqual(["collectables.json", "weapons.json"], sorted(file.path for file in report.vpack_files))
        weapons = next(file for file in report.json_files if file.path == "weapons.json")
        self.assertEqual("weapons", weapons.primary_collection)
        self.assertEqual(1, weapons.group_count)
        self.assertEqual(1, weapons.record_count)
        self.assertIn("items", weapons.fields)
        collectables = next(file for file in report.json_files if file.path == "collectables.json")
        self.assertEqual("collectables", collectables.primary_collection)
        self.assertEqual(1, collectables.record_count)
        self.assertIn("use_type", collectables.fields)
        self.assertEqual(["itemgraph.json", "trade.json"], [atlas.path.name for atlas in report.atlases])
        self.assertEqual((32, 16), (report.atlases[0].width, report.atlases[0].height))
        self.assertEqual(2, report.diagnostic_file_count)
        self.assertEqual(1, report.zeroed_binary_count)

    def test_cli_client_inventory_prints_summary(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.client_inventory import (
            AtlasInventoryEntry,
            ClientInventoryReport,
            ClientRootFile,
            DiagnosticFile,
            PackedJsonSummary,
            VpackFileInventory,
        )

        report = ClientInventoryReport(
            client_root=Path("client"),
            root_files=[
                ClientRootFile(Path("Project Rogue Client.exe"), 100, ".exe", "app"),
                ClientRootFile(Path("Settings.json"), 20, ".json", "diagnostic"),
            ],
            vpack_path=Path("client/Data/ClientPack/rogue_data.vpack"),
            vpack_exists=True,
            vpack_size_bytes=1234,
            vpack_sha256="ABC",
            vpack_schema_version=1,
            vpack_build_version=5,
            vpack_compression="gzip-per-file",
            vpack_files=[
                VpackFileInventory("weapons.json", 500, 50, True),
                VpackFileInventory("monsters.json", 300, 30, True),
            ],
            vpack_log_build_version=5,
            vpack_log_file_count=2,
            vpack_log_loaded_files=["weapons.json", "monsters.json"],
            json_files=[
                PackedJsonSummary("weapons.json", "weapons", 1, 10, ["id", "items", "name"], []),
                PackedJsonSummary("monsters.json", "monsters", 0, 2, ["id", "name"], []),
            ],
            atlases=[
                AtlasInventoryEntry(Path("itemgraph.json"), "itemgraph", 1024, 1024, 100, "HASH", None),
            ],
            diagnostics=[
                DiagnosticFile(Path("Settings.json"), ["Account", "Graphics"], "local preferences"),
            ],
            issues=[],
        )

        output = io.StringIO()
        with patch.object(cli, "build_client_inventory_report", return_value=report), patch("sys.stdout", output):
            exit_code = cli.main(["client-inventory"])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("CLIENT INVENTORY: client", printed)
        self.assertIn("ROOT FILES: 2 file(s), diagnostics=1, runtime=0, zeroed-binary=0", printed)
        self.assertIn("VPACK: client/Data/ClientPack/rogue_data.vpack size=1234 sha256=ABC schema=1 build=5 files=2", printed)
        self.assertIn("PACKED JSON weapons.json: collection=weapons groups=1 records=10 fields=id, items, name", printed)
        self.assertIn("ATLAS itemgraph.json: name=itemgraph size=1024x1024 bytes=100 sha256=HASH", printed)
        self.assertIn("DIAGNOSTIC Settings.json: keys=Account, Graphics (local preferences)", printed)
        self.assertIn("CLIENT INVENTORY READINESS: READY", printed)

    def test_cli_client_inventory_derives_pack_log_and_atlas_paths_from_client_root(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.client_inventory import ClientInventoryReport

        client_root = Path("custom-client")
        report = ClientInventoryReport(
            client_root=client_root,
            root_files=[],
            vpack_path=client_root / "Data" / "ClientPack" / "rogue_data.vpack",
            vpack_exists=True,
            vpack_size_bytes=None,
            vpack_sha256=None,
            vpack_schema_version=None,
            vpack_build_version=None,
            vpack_compression=None,
            vpack_files=[],
            vpack_log_build_version=None,
            vpack_log_file_count=None,
            vpack_log_loaded_files=[],
            json_files=[],
            atlases=[],
            diagnostics=[],
            issues=[],
        )

        output = io.StringIO()
        with patch.object(cli, "build_client_inventory_report", return_value=report) as build_report, patch("sys.stdout", output):
            exit_code = cli.main(["client-inventory", "--client-root", str(client_root)])

        self.assertEqual(0, exit_code)
        build_report.assert_called_once_with(
            client_root,
            pack_path=client_root / "Data" / "ClientPack" / "rogue_data.vpack",
            log_path=client_root / "ProjectRogue.log",
            gf_json_dir=client_root / "gf_json",
        )

    def test_client_inventory_snapshot_is_stable_and_excludes_local_root(self):
        from tools.codex_pipeline.client_inventory import (
            AtlasInventoryEntry,
            ClientInventoryReport,
            ClientRootFile,
            DiagnosticFile,
            PackedJsonSummary,
            VpackFileInventory,
            build_client_inventory_snapshot,
        )

        report = ClientInventoryReport(
            client_root=Path("C:/local/client"),
            root_files=[
                ClientRootFile(Path("Settings.json"), 20, ".json", "diagnostic"),
                ClientRootFile(Path("SDL3.dll"), 200, ".dll", "runtime"),
            ],
            vpack_path=Path("C:/local/client/Data/ClientPack/rogue_data.vpack"),
            vpack_exists=True,
            vpack_size_bytes=1234,
            vpack_sha256="PACKHASH",
            vpack_schema_version=1,
            vpack_build_version=5,
            vpack_compression="gzip-per-file",
            vpack_files=[VpackFileInventory("weapons.json", 500, 50, True)],
            vpack_log_build_version=5,
            vpack_log_file_count=1,
            vpack_log_loaded_files=["weapons.json"],
            json_files=[PackedJsonSummary("weapons.json", "weapons", 1, 10, ["id", "name"], [])],
            atlases=[AtlasInventoryEntry(Path("itemgraph.json"), "itemgraph", 32, 32, 100, "ATLASHASH")],
            diagnostics=[DiagnosticFile(Path("Settings.json"), ["Account", "Graphics"], "local preferences")],
            issues=[],
        )

        snapshot = build_client_inventory_snapshot(report)

        self.assertEqual(1, snapshot["schema_version"])
        self.assertNotIn("client_root", snapshot)
        self.assertEqual("PACKHASH", snapshot["vpack"]["sha256"])
        self.assertIn("SDL3.dll", [file["path"] for file in snapshot["root_files"]])
        self.assertEqual(["Account", "Graphics"], snapshot["diagnostics"][0]["keys"])

    def test_diff_client_inventory_snapshots_reports_added_removed_and_changed_entries(self):
        from tools.codex_pipeline.client_inventory import diff_client_inventory_snapshots

        previous = {
            "schema_version": 1,
            "root_files": [
                {"path": "SDL2.dll", "size_bytes": 10, "kind": "runtime", "zeroed_binary": False},
                {"path": "Settings.json", "size_bytes": 20, "kind": "diagnostic", "zeroed_binary": False},
            ],
            "vpack": {"sha256": "OLD", "build_version": 1, "size_bytes": 100, "schema_version": 1, "compression": "gzip-per-file"},
            "vpack_files": [{"path": "weapons.json", "original_size": 100, "compressed_size": 20, "sha256_ok": True}],
            "packed_json": [
                {"path": "weapons.json", "primary_collection": "weapons", "group_count": 5, "record_count": 200, "fields": ["id", "name"]},
                {"path": "old.json", "primary_collection": "old", "group_count": 0, "record_count": 1, "fields": ["id"]},
            ],
            "atlases": [{"path": "itemgraph.json", "name": "itemgraph", "width": 32, "height": 32, "size_bytes": 100, "sha256": "A"}],
            "diagnostics": [{"path": "Settings.json", "keys": ["Account"], "note": "local preferences"}],
        }
        current = {
            "schema_version": 1,
            "root_files": [
                {"path": "SDL3.dll", "size_bytes": 12, "kind": "runtime", "zeroed_binary": False},
                {"path": "Settings.json", "size_bytes": 21, "kind": "diagnostic", "zeroed_binary": False},
            ],
            "vpack": {"sha256": "NEW", "build_version": 2, "size_bytes": 120, "schema_version": 1, "compression": "gzip-per-file"},
            "vpack_files": [{"path": "weapons.json", "original_size": 120, "compressed_size": 22, "sha256_ok": True}],
            "packed_json": [
                {"path": "weapons.json", "primary_collection": "weapons", "group_count": 6, "record_count": 210, "fields": ["id", "name", "speed"]},
                {"path": "collectables.json", "primary_collection": "collectables", "group_count": 0, "record_count": 10, "fields": ["id", "use_type"]},
            ],
            "atlases": [{"path": "itemgraph.json", "name": "itemgraph", "width": 64, "height": 32, "size_bytes": 120, "sha256": "B"}],
            "diagnostics": [{"path": "Settings.json", "keys": ["Account", "Graphics"], "note": "local preferences"}],
        }

        diff = diff_client_inventory_snapshots(previous, current)

        self.assertTrue(diff.has_changes)
        rendered = "\n".join(f"{entry.section} {entry.change_type} {entry.key}: {entry.summary}" for entry in diff.entries)
        self.assertIn("vpack changed rogue_data.vpack", rendered)
        self.assertIn("root_files removed SDL2.dll", rendered)
        self.assertIn("root_files added SDL3.dll", rendered)
        self.assertIn("packed_json changed weapons.json", rendered)
        self.assertIn("packed_json removed old.json", rendered)
        self.assertIn("packed_json added collectables.json", rendered)
        self.assertIn("atlases changed itemgraph.json", rendered)
        self.assertIn("diagnostics changed Settings.json", rendered)

    def test_cli_client_inventory_writes_and_diffs_snapshot(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.client_inventory import (
            AtlasInventoryEntry,
            ClientInventoryReport,
            PackedJsonSummary,
        )

        current_report = ClientInventoryReport(
            client_root=Path("client"),
            root_files=[],
            vpack_path=Path("client/Data/ClientPack/rogue_data.vpack"),
            vpack_exists=True,
            vpack_size_bytes=200,
            vpack_sha256="NEW",
            vpack_schema_version=1,
            vpack_build_version=2,
            vpack_compression="gzip-per-file",
            vpack_files=[],
            vpack_log_build_version=2,
            vpack_log_file_count=0,
            vpack_log_loaded_files=[],
            json_files=[PackedJsonSummary("weapons.json", "weapons", 1, 10, ["id", "name"], [])],
            atlases=[AtlasInventoryEntry(Path("itemgraph.json"), "itemgraph", 32, 32, 100, "HASH")],
            diagnostics=[],
            issues=[],
        )

        with tempfile.TemporaryDirectory() as tmp:
            snapshot_path = Path(tmp) / "snapshot.json"
            snapshot_path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "root_files": [],
                        "vpack": {"sha256": "OLD", "build_version": 1, "size_bytes": 100, "schema_version": 1, "compression": "gzip-per-file"},
                        "vpack_files": [],
                        "packed_json": [],
                        "atlases": [],
                        "diagnostics": [],
                    }
                ),
                encoding="utf-8",
            )

            output = io.StringIO()
            with patch.object(cli, "build_client_inventory_report", return_value=current_report), patch("sys.stdout", output):
                exit_code = cli.main(
                    [
                        "client-inventory",
                        "--snapshot-path",
                        str(snapshot_path),
                        "--diff-snapshot",
                        "--write-snapshot",
                    ]
                )

            written = json.loads(snapshot_path.read_text(encoding="utf-8"))

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("CLIENT INVENTORY DIFF:", printed)
        self.assertIn("DIFF CHANGED vpack rogue_data.vpack", printed)
        self.assertIn("DIFF ADDED packed_json weapons.json", printed)
        self.assertIn("CLIENT INVENTORY DIFF STATUS: changes detected", printed)
        self.assertIn("WROTE CLIENT INVENTORY SNAPSHOT:", printed)
        self.assertEqual("NEW", written["vpack"]["sha256"])


if __name__ == "__main__":
    unittest.main()
