import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.config import DROP_SOURCES_PATH


class SiteValidationTests(unittest.TestCase):
    def test_inline_style_parser_reports_unmatched_closing_brace(self):
        from tools.codex_pipeline.validators.site import validate_inline_styles

        html = "<html><head><style>.ok { color: red; } } .lost { color: blue; }</style></head></html>"
        issues = validate_inline_styles("broken-style.html", html)

        self.assertEqual(1, len(issues))
        self.assertIn("unexpected closing brace", issues[0].message)

    def test_inline_style_attribute_parser_reports_style_attributes(self):
        from tools.codex_pipeline.validators.site import validate_style_attributes

        html = '<html><body><div class="ok" style="display: flex;"></div></body></html>'
        issues = validate_style_attributes("inline-attr.html", html)

        self.assertEqual(1, len(issues))
        self.assertIn("inline style attribute #1", issues[0].message)

    def test_validated_pages_do_not_use_inline_style_attributes(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT
        from tools.codex_pipeline.validators.site import validate_style_attributes

        messages = []
        for path in cli.VALIDATED_HTML_PATHS:
            label = str(path.relative_to(REPO_ROOT))
            html = path.read_text(encoding="utf-8")
            messages.extend(issue.message for issue in validate_style_attributes(label, html))

        self.assertEqual([], messages)

    def test_css_file_parser_reports_unmatched_closing_brace(self):
        from tools.codex_pipeline.validators.site import validate_css_file

        with tempfile.TemporaryDirectory() as tmp:
            css_path = Path(tmp) / "broken.css"
            css_path.write_text(".ok { color: red; } } .lost { color: blue; }", encoding="utf-8")

            issues = validate_css_file("broken.css", css_path)

        self.assertEqual(1, len(issues))
        self.assertIn("unexpected closing brace", issues[0].message)

    def test_monsters_table_wrapper_keeps_scroll_container_style(self):
        from tools.codex_pipeline.config import REPO_ROOT
        from tools.codex_pipeline.validators.site import validate_css_source

        css_path = REPO_ROOT / "css" / "monsters.css"
        css = css_path.read_text(encoding="utf-8")
        issues = validate_css_source("css/monsters.css", css)
        wrapper_match = re.search(r"\.monsters-table-wrapper\s*\{(?P<body>[^}]*)\}", css)

        self.assertEqual([], issues)
        self.assertIsNotNone(wrapper_match)
        wrapper_body = wrapper_match.group("body") if wrapper_match else ""
        self.assertIn("overflow: auto;", wrapper_body)
        self.assertIn("max-height: 70vh;", wrapper_body)

    def test_monsters_page_uses_external_page_stylesheet(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "enemies" / "monsters.html"
        css_path = REPO_ROOT / "css" / "monsters.css"
        html = html_path.read_text(encoding="utf-8")
        inline_styles = [
            style.strip()
            for style in re.findall(
                r"<style\b[^>]*>([\s\S]*?)</style>",
                html,
                flags=re.IGNORECASE,
            )
            if style.strip()
        ]

        self.assertIn('<link rel="stylesheet" href="css/monsters.css" />', html)
        self.assertTrue(css_path.is_file())
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertEqual([], inline_styles)

    def test_monsters_page_uses_external_page_script(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "enemies" / "monsters.html"
        script_path = REPO_ROOT / "js" / "monsters-page.js"
        html = html_path.read_text(encoding="utf-8")
        inline_scripts = [
            script.strip()
            for script in re.findall(
                r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                html,
                flags=re.IGNORECASE,
            )
            if script.strip()
        ]

        self.assertIn('<script src="js/monsters-page.js" defer></script>', html)
        self.assertTrue(script_path.is_file())
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertEqual([], inline_scripts)

    def test_item_pages_use_external_page_stylesheet(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        for page_name in ["weapons", "armors"]:
            with self.subTest(page=page_name):
                css_path = REPO_ROOT / "css" / f"{page_name}.css"
                html_path = REPO_ROOT / "pages" / "items" / f"{page_name}.html"
                html = html_path.read_text(encoding="utf-8")
                inline_styles = [
                    style.strip()
                    for style in re.findall(
                        r"<style\b[^>]*>([\s\S]*?)</style>",
                        html,
                        flags=re.IGNORECASE,
                    )
                    if style.strip()
                ]

                self.assertIn(f'<link rel="stylesheet" href="css/{page_name}.css" />', html)
                self.assertTrue(css_path.is_file())
                self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
                self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
                self.assertEqual([], inline_styles)
                self.assertNotRegex(html, r"\sstyle\s*=")

    def test_item_pages_use_external_page_scripts(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        for page_name in ["weapons", "armors"]:
            with self.subTest(page=page_name):
                html_path = REPO_ROOT / "pages" / "items" / f"{page_name}.html"
                script_path = REPO_ROOT / "js" / f"{page_name}-page.js"
                html = html_path.read_text(encoding="utf-8")
                inline_scripts = [
                    script.strip()
                    for script in re.findall(
                        r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                        html,
                        flags=re.IGNORECASE,
                    )
                    if script.strip()
                ]

                self.assertIn(f'<script src="js/{page_name}-page.js" defer></script>', html)
                self.assertTrue(script_path.is_file())
                self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
                self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
                self.assertEqual([], inline_scripts)

    def test_item_pages_share_common_page_utilities(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        helper_path = REPO_ROOT / "js" / "items-page-utils.js"
        helper_script = helper_path.read_text(encoding="utf-8")

        self.assertIn(helper_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn("window.RogueCodexItemPageUtils", helper_script)
        self.assertIn("createRouteHelpers", helper_script)
        self.assertIn("createTooltipPinningController", helper_script)
        self.assertIn("createDropsFromPill", helper_script)
        self.assertIn("formatValue", helper_script)
        self.assertIn("ensureImage", helper_script)
        self.assertIn('const isNavigationPill = pill.tagName === "A";', helper_script)
        self.assertIn("if (!isNavigationPill) {", helper_script)

        for page_name in ["weapons", "armors"]:
            with self.subTest(page=page_name):
                html_path = REPO_ROOT / "pages" / "items" / f"{page_name}.html"
                script_path = REPO_ROOT / "js" / f"{page_name}-page.js"
                html = html_path.read_text(encoding="utf-8")
                script = script_path.read_text(encoding="utf-8")

                self.assertIn('<script src="js/items-page-utils.js"></script>', html)
                self.assertIn("const itemUtils = window.RogueCodexItemPageUtils || {};", script)
                self.assertIn("itemUtils.createRouteHelpers", script)
                self.assertIn("itemUtils.createTooltipPinningController", script)
                self.assertIn("itemUtils.createDropsFromPill", script)
                self.assertIn("itemUtils.formatValue", script)
                self.assertIn("itemUtils.ensureImage", script)
                self.assertNotIn("function attachTooltipPinning", script)
                self.assertNotIn("function unpinTooltip", script)

    def test_home_page_has_compact_gateway_and_timeline_filters(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "index.html"
        css_path = REPO_ROOT / "css" / "home.css"
        script_path = REPO_ROOT / "js" / "home.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/home.css" />', html)
        self.assertIn('<script src="js/home.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Codex Command Center",
            "Codex Entry Points",
            "Data Pipeline Snapshot",
            "Project Rogue Timeline",
            "Timeline Filter",
            "data-home-timeline",
            "data-home-timeline-item",
            "data-era-filter=\"project-rogue\"",
            "data-home-result-count",
            "Dransik Classic",
            "Project Rogue Begins",
            "Fresh Wipes &amp; Live Upkeep",
            "pages/General/play-the-game.html",
            "pages/General/build-planner.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
            "pages/systems/perks.html",
            "pages/stats/resistances.html",
            "https://traecneh.github.io/Project-Rogue-Map/",
        ]:
            self.assertIn(expected, html)

        for expected in [
            ".home-hero",
            ".home-entry-grid",
            ".home-pipeline-grid",
            ".home-filter-bar",
            ".home-timeline",
            ".home-link-grid",
        ]:
            self.assertIn(expected, css)

        for expected in [
            "const HOME_TIMELINE_FILTERS",
            "function initHomeTimelineFilters",
            "function updateHomeTimelineFilter",
            "data-era-filter",
            "data-home-result-count",
            'document.addEventListener("DOMContentLoaded"',
        ]:
            self.assertIn(expected, script)

    def test_monsters_page_script_supports_detail_deep_links(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script_path = REPO_ROOT / "js" / "monsters-page.js"
        script = script_path.read_text(encoding="utf-8")

        self.assertIn("const buildMonsterDetailUrl", script)
        self.assertIn("const updateMonsterDetailUrl", script)
        self.assertIn('window.addEventListener("popstate"', script)
        self.assertRegex(script, r"history\.pushState\([^)]*monsterId")
        self.assertIn("nameLink.href = buildMonsterDetailUrl(monster);", script)
        self.assertIn("selectMonster(monster, { updateUrl: true", script)

    def test_drop_source_views_use_shared_detail_links(self):
        from tools.codex_pipeline.config import REPO_ROOT

        utils_script = (REPO_ROOT / "js" / "utils.js").read_text(encoding="utf-8")
        item_utils_script = (REPO_ROOT / "js" / "items-page-utils.js").read_text(encoding="utf-8")
        monsters_script = (REPO_ROOT / "js" / "monsters-page.js").read_text(encoding="utf-8")
        weapons_script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")
        armors_script = (REPO_ROOT / "js" / "armors-page.js").read_text(encoding="utf-8")

        self.assertIn("function buildMonsterDetailUrl", utils_script)
        self.assertIn("function buildWeaponDetailUrl", utils_script)
        self.assertIn("function buildArmorDetailUrl", utils_script)
        self.assertNotIn("UNIQUE_WEAPON_DROP_SOURCES", weapons_script)
        self.assertIn("utils.getDropSourceMonsterIdsByItem(dropSources, itemKind, item?.name)", item_utils_script)
        self.assertIn('itemKind: "weapons"', weapons_script)
        self.assertIn('itemKind: "armors"', armors_script)
        self.assertIn("nameLink.href = buildMonsterDetailUrl(entry.id || entry.name);", item_utils_script)
        self.assertIn("label.href = buildWeaponDetailUrl(entry.name);", monsters_script)
        self.assertIn("label.href = buildArmorDetailUrl(entry.name);", monsters_script)
        self.assertIn("const stopTooltipLinkPropagation", item_utils_script)
        self.assertIn("const stopTooltipLinkPropagation", monsters_script)
        self.assertIn('nameLink.addEventListener("click", stopTooltipLinkPropagation);', item_utils_script)
        self.assertIn('label.addEventListener("click", stopTooltipLinkPropagation);', monsters_script)

    def test_item_pages_support_detail_url_state(self):
        from tools.codex_pipeline.config import REPO_ROOT

        weapons_script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")
        armors_script = (REPO_ROOT / "js" / "armors-page.js").read_text(encoding="utf-8")
        helper_script = (REPO_ROOT / "js" / "items-page-utils.js").read_text(encoding="utf-8")

        self.assertIn("const updateWeaponDetailUrl", weapons_script)
        self.assertIn("const selectWeapon", weapons_script)
        self.assertIn('window.addEventListener("popstate"', weapons_script)
        self.assertIn("const updateWeaponDetailUrl = weaponRouteHelpers.updateDetailUrl;", weapons_script)
        self.assertIn("selectWeapon(item, { updateUrl: true });", weapons_script)
        self.assertIn("clearDetails({ updateUrl: true });", weapons_script)

        self.assertIn("const updateArmorDetailUrl", armors_script)
        self.assertIn("const selectArmor", armors_script)
        self.assertIn('window.addEventListener("popstate"', armors_script)
        self.assertIn("const updateArmorDetailUrl = armorRouteHelpers.updateDetailUrl;", armors_script)
        self.assertIn("selectArmor(item, { updateUrl: true });", armors_script)
        self.assertIn("clearDetails({ updateUrl: true });", armors_script)
        self.assertIn('history.pushState(state, "", targetUrl);', helper_script)

    def test_weapons_page_uses_linked_names(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "weapons.css").read_text(encoding="utf-8")

        self.assertIn("const buildWeaponDetailUrl = weaponRouteHelpers.buildDetailStateUrl;", script)
        self.assertIn('nameLink.className = "weapon-link";', script)
        self.assertIn("nameLink.href = buildWeaponDetailUrl(item);", script)
        self.assertIn("event.preventDefault();", script)
        self.assertIn("event.stopPropagation();", script)
        self.assertIn(".weapon-link", css)

    def test_weapons_page_links_perks_and_explains_weapon_speed(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "items" / "weapons.html").read_text(encoding="utf-8")
        script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "weapons.css").read_text(encoding="utf-8")

        self.assertIn('<label class="filter-label" for="filter-attack-speed">Weapon Speed</label>', html)
        self.assertIn("const buildPerkDetailUrl", script)
        self.assertIn('resolved.pathname = "/pages/systems/perks.html";', script)
        self.assertIn('resolved.searchParams.set("perk", baseName);', script)
        self.assertIn('pill.className = "detail-pill perk-link";', script)
        self.assertIn("pill.href = buildPerkDetailUrl(baseName);", script)
        self.assertIn('pill.addEventListener("click", stopPerkLinkClickPropagation);', script)
        self.assertIn("const createWeaponSpeedPill", script)
        self.assertIn('["Weapon Speed", createWeaponSpeedPill(item.attackSpeed)]', script)
        self.assertIn("Base weapon speed", script)
        self.assertIn(".perk-link", css)
        self.assertIn(".weapon-speed-pill", css)

    def test_weapons_page_table_compares_speed_and_dps_breakdown(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "weapons.css").read_text(encoding="utf-8")

        self.assertIn('{ key: "attackSpeed", label: "Speed"', script)
        self.assertIn('render: (_, item) => createDpsBreakdownPill(item)', script)
        self.assertIn("const createDpsBreakdownPill", script)
        self.assertIn("const createTableSpeedPill", script)
        self.assertIn('"DPS Breakdown"', script)
        self.assertIn('"Damage Range"', script)
        self.assertIn('"Attacks/Sec"', script)
        self.assertIn(".table-metric-pill", css)
        self.assertIn(".dps-breakdown-tooltip", css)
        self.assertIn(".speed-column", css)
        self.assertRegex(css, r"\.detail-tooltip\.dps-breakdown-tooltip\s*\{[^}]*bottom:\s*110%;")

    def test_weapons_page_search_includes_detail_and_drop_source_text(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")

        self.assertIn("const getWeaponSearchText", script)
        self.assertIn('utils.getDropSourceMonsterIdsByItem(dropSources, "weapons", item.name)', script)
        self.assertIn("uniqueSet.has(normalizeMonsterId(monster.name))", script)
        self.assertIn("formatRequirement(item.skillRequirement)", script)
        self.assertIn("getWeaponSearchText(item).includes(searchTerm.toLowerCase())", script)

    def test_weapons_page_formats_empty_requirements_as_none(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "weapons-page.js").read_text(encoding="utf-8")

        self.assertIn("const formatRequirement", script)
        self.assertIn('if (numeric === 0) return "None";', script)
        self.assertIn("[\"Requirement\", formatRequirement(item.skillRequirement)]", script)

    def test_build_planner_uses_external_assets(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "General" / "build-planner.html"
        html = html_path.read_text(encoding="utf-8")
        css_path = REPO_ROOT / "css" / "build-planner.css"
        script_path = REPO_ROOT / "js" / "build-planner.js"

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertTrue(css_path.exists())
        self.assertTrue(script_path.exists())
        self.assertIn('<link rel="stylesheet" href="css/build-planner.css" />', html)
        self.assertIn('<script src="js/build-planner.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertNotIn("const RARITY_TIERS = [", html)
        self.assertNotIn("var LZString=function()", html)

    def test_build_planner_script_preserves_share_state_contract(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script_path = REPO_ROOT / "js" / "build-planner.js"
        self.assertTrue(script_path.exists())
        script = script_path.read_text(encoding="utf-8")

        self.assertIn('const SHORT_STATE_PARAM = "b";', script)
        self.assertIn('const LEGACY_STATE_PARAM = "build";', script)
        self.assertIn("compressToEncodedURIComponent", script)
        self.assertIn("decompressFromEncodedURIComponent", script)
        self.assertIn("getBuildParamFromSearch", script)
        self.assertIn("applySavedState", script)

    def test_build_planner_compact_ui_contracts(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")
        script_path = REPO_ROOT / "js" / "build-planner.js"
        css_path = REPO_ROOT / "css" / "build-planner.css"
        self.assertTrue(script_path.exists())
        self.assertTrue(css_path.exists())
        script = script_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8")

        self.assertIn('id="reset-build"', html)
        self.assertIn('id="planner-status"', html)
        self.assertIn('id="quick-summary"', html)
        self.assertIn("const updatePlannerStatus", script)
        self.assertIn("const resetBuild", script)
        self.assertNotIn('id="slot-editor"', html)
        self.assertNotIn("Select a filled slot", html)
        self.assertNotIn("const selectSlot", script)
        self.assertNotIn("const updateSlotEditor", script)

    def test_build_planner_summary_uses_single_combined_strip(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")
        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "build-planner.css").read_text(encoding="utf-8")

        for stat in ["armor", "dps", "weight", "str", "con", "dex", "health", "dr"]:
            self.assertIn(f'data-quick-stat="{stat}"', html)

        self.assertIn('id="build-details"', html)
        self.assertIn("<h3>Build Details</h3>", html)
        self.assertIn('id="sum-element"', html)
        self.assertIn('id="sum-tohit"', html)
        self.assertIn('id="sum-resists"', html)
        self.assertIn('id="sum-perks"', html)
        self.assertIn('id="calc-regen"', html)
        self.assertIn('id="calc-melee-mult"', html)
        self.assertIn('id="calc-max-weight"', html)
        self.assertIn('id="calc-bleed"', html)
        self.assertIn('id="calc-crit"', html)
        self.assertNotIn("<h3>Calculated Details</h3>", html)
        self.assertNotIn("<h3>Combined Stats</h3>", html)
        self.assertNotIn('id="calc-max-health"', html)
        self.assertNotIn('id="calc-dr"', html)
        for duplicate_id in ["sum-armor", "sum-weight", "sum-dps", "sum-str", "sum-con", "sum-dex"]:
            self.assertNotIn(f'id="{duplicate_id}"', html)

        self.assertIn("const setElementTextAndTitle", script)
        self.assertIn("const setQuickSummary", script)
        self.assertIn('setQuickSummary("armor"', script)
        self.assertIn('setQuickSummary("health"', script)
        self.assertIn('setQuickSummary("dr"', script)
        self.assertIn(".quick-summary-card[title]", css)

    def test_build_planner_has_compact_issue_indicators(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")
        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "build-planner.css").read_text(encoding="utf-8")

        self.assertIn('id="build-issues"', html)
        self.assertIn('data-build-issue-list', html)
        self.assertIn('data-build-issue-count', html)
        self.assertIn("Build issues", html)

        self.assertIn("const collectBuildIssues", script)
        self.assertIn("const renderBuildIssues", script)
        self.assertIn("const getRequirementIssues", script)
        self.assertIn("const getMissingSlotIssues", script)
        self.assertIn("const getWeightIssue", script)
        self.assertIn("const getBaseStatCapIssue", script)
        self.assertIn("renderBuildIssues(collectBuildIssues(", script)
        self.assertIn("skillRequirement: toNumber(fields.skill_requirement)", script)
        self.assertIn("levelRequirement: toNumber(fields.level_requirement)", script)
        self.assertIn("playerLevelRequirement: toNumber(fields.player_level_requirement)", script)

        self.assertIn(".build-issues", css)
        self.assertIn(".build-issue-chip", css)
        self.assertIn('[data-issue-level="ok"]', css)
        self.assertIn('[data-issue-level="warning"]', css)
        self.assertIn('[data-issue-level="error"]', css)

    def test_build_planner_links_items_to_detail_pages(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")
        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "build-planner.css").read_text(encoding="utf-8")

        self.assertIn('class="slot-name slot-item-link"', html)
        self.assertIn("const getItemHref", script)
        self.assertIn('if (item.kind === "weapon") return `pages/items/weapons.html?weapon=${encodeURIComponent(name)}`;', script)
        self.assertIn('if (item.kind === "armor") return `pages/items/armors.html?armor=${encodeURIComponent(name)}`;', script)
        self.assertIn('const title = document.createElement("a");', script)
        self.assertIn('title.className = "suggestion-title suggestion-link";', script)
        self.assertIn("title.href = getItemHref(item);", script)
        self.assertIn('title.addEventListener("click", (event) => event.stopPropagation());', script)
        self.assertIn(".suggestion-link", css)
        self.assertNotIn("selectedSlotName", script)
        self.assertIn(".slot-card:not(.has-item) .slot-rarity", css)
        self.assertNotIn(".slot-card .slot-stat-adjust", css)
        self.assertNotIn(".slot-card .slot-extra-perk", css)
        self.assertNotIn(".slot-editor", css)
        self.assertIn(".formula-tip", css)

    def test_build_planner_suggestions_include_compare_deltas(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "build-planner.css").read_text(encoding="utf-8")

        self.assertIn("const COMPARE_STATS", script)
        self.assertIn("const buildSuggestionDeltas", script)
        self.assertIn("const buildSuggestionCompareTitle", script)
        self.assertIn("const renderSuggestionDeltas", script)
        self.assertIn('deltaRow.className = "suggestion-deltas";', script)
        self.assertIn('chip.className = "suggestion-delta";', script)
        self.assertIn("chip.dataset.deltaDirection = getDeltaDirection(entry);", script)
        self.assertIn("div.title = buildSuggestionCompareTitle(item, deltas);", script)
        self.assertIn(".suggestion-deltas", css)
        self.assertIn(".suggestion-delta", css)
        self.assertIn('[data-delta-direction="up"]', css)

    def test_perks_page_uses_external_assets_and_reference_controls(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "perks.html"
        css_path = REPO_ROOT / "css" / "perks.css"
        calc_script_path = REPO_ROOT / "js" / "perk-calculations.js"
        script_path = REPO_ROOT / "js" / "perks-page.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        calc_script = calc_script_path.read_text(encoding="utf-8") if calc_script_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(calc_script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/perks.css" />', html)
        self.assertIn('<script src="js/perk-calculations.js" defer></script>', html)
        self.assertIn('<script src="js/perks-page.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            'id="perk-search"',
            'id="perk-type-filter"',
            'id="perk-group-filter"',
            'id="perk-speed-context"',
            '<label for="perk-speed-context">Weapon Speed</label>',
            'id="perk-result-count"',
            'data-perk-results',
            'data-perk-empty',
        ]:
            self.assertIn(expected, html)

        for expected in [
            'const PERK_ROUTE_PARAM = "perk";',
            "const buildPerkSourceIndex",
            "const renderPerkSources",
            "const renderPerkMath",
            "const updatePerkMath",
            "const applyPerkFilters",
            "const clearSelectedPerk",
            "const selectPerk",
            "url.searchParams.delete(PERK_ROUTE_PARAM)",
            "pages/items/weapons_data05.json",
            "pages/items/armors_data06.json",
            "pages/items/weapons.html?weapon=",
            "pages/items/armors.html?armor=",
            "pages/stats/races.html",
        ]:
            self.assertIn(expected, script)

        for expected in [
            "RogueCodexPerkCalculations",
            "const SPEED_OPTIONS",
            "const STACK_SCENARIOS",
            "const PERK_CALCULATIONS",
            '"Bloodlust"',
            '"Demon Blood"',
            "Juggernaut:",
            "Parry:",
            "independentProc: true",
            "const formatIndependentProcScenarioValue",
            "const appendIndependentDamageTakenExample",
            "Independent copies roll separately",
            "damageTakenExample: 1000",
            "const attacksPerMinute",
            "const formatExampleNumber",
            "const appendDivider",
            "const appendScenarioRow",
            "const appendDamageTakenExample",
            "const renderPerkMath",
            '"perk-math-separator"',
            '"perk-math-scenario"',
            '"perk-math-example-title"',
        ]:
            self.assertIn(expected, calc_script)
        self.assertEqual(
            ["750", "1000", "1250", "1500"],
            re.findall(r'\{\s*value:\s*"(\d+)",\s*label:\s*"\d+ms"\s*\}', calc_script),
        )

        for expected in [
            ".perk-controls",
            ".perk-speed-context",
            ".perk-grid .stat-card",
            ".perk-math",
            ".perk-math-tooltip",
            ".perk-math-separator",
            ".perk-math-scenario",
            ".perk-math-example-title",
            ".perk-source-chip",
            ".perk-card-hidden",
            ".stat-card.perk-selected",
            ".perk-empty-state",
        ]:
            self.assertIn(expected, css)
        self.assertRegex(css, r"\.perk-math-title\s*\{[^}]*text-align:\s*center;")
        self.assertRegex(css, r"\.perk-grid \.stat-card\s*\{[^}]*position:\s*relative;")
        self.assertRegex(css, r"\.perk-grid \.stat-card:hover,\s*\.perk-grid \.stat-card:focus-within\s*\{[^}]*z-index:\s*30;")
        self.assertIn("@media (max-width: 640px)", css)
        self.assertIn("width: min(320px, calc(100vw - 4rem));", css)

    def test_rarity_page_has_compact_reference_and_upgrade_roll(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "rarity.html"
        css_path = REPO_ROOT / "css" / "rarity.css"
        script_path = REPO_ROOT / "js" / "rarity-roller.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8")

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/rarity.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "What Rarity Affects",
            "Bonus Stats",
            "Perk Eligibility",
            "Max Rarity",
            "Item Power",
            "Rarity Ladder",
            "Upgrade Preview",
            'class="rarity-reference-table"',
            'data-rarity-upgrade',
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/systems/perks.html",
            "pages/systems/re-roll.html",
            "pages/systems/crafting.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn("Common", html)
        self.assertNotIn(">Normal<", html)
        self.assertIn('{ name: "Common"', script)
        self.assertNotIn('{ name: "Normal"', script)
        self.assertIn("Upgrade +1", html)
        self.assertIn("currentMaxIndex", script)
        self.assertIn(".rarity-reference-table", css)
        self.assertIn(".rarity-summary-grid", css)
        self.assertIn(".rarity-link-grid", css)

    def test_reroll_page_has_compact_decision_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "re-roll.html"
        css_path = REPO_ROOT / "css" / "reroll.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/reroll.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "What Changes",
            "What Does Not Change",
            "Re-Roll Flow",
            "Before You Roll",
            "When Re-Roll Helps",
            "Related Item Pages",
            "Stat Spread",
            "Current Rarity",
            "Item Identity",
            "Max Rarity",
            "Reroll Shards",
            "Reroll Stone",
            "pages/systems/rarity.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/systems/deconstruct.html",
            "pages/systems/crafting.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".reroll-summary-grid", css)
        self.assertIn(".reroll-compare-grid", css)
        self.assertIn(".reroll-flow", css)
        self.assertIn(".reroll-link-grid", css)

    def test_deconstruct_page_has_compact_shard_decision_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "deconstruct.html"
        css_path = REPO_ROOT / "css" / "deconstruct.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/deconstruct.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "What Deconstruct Returns",
            "What Affects Value",
            "Deconstruct Flow",
            "Deconstruct or Keep",
            "Bulk Safety",
            "Dirty Loot",
            "Half Value",
            "No Takebacks",
            "Ascendency Shards",
            "T1 Imbuements",
            "25 Tattered Imbuements",
            "Deconstruct All",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/systems/re-roll.html",
            "pages/systems/ascend.html",
            "pages/systems/craft.html",
            "pages/systems/rarity.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".deconstruct-summary-grid", css)
        self.assertIn(".deconstruct-decision-grid", css)
        self.assertIn(".deconstruct-flow", css)
        self.assertIn(".deconstruct-link-grid", css)

    def test_ascend_page_has_compact_progression_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "ascend.html"
        css_path = REPO_ROOT / "css" / "ascend.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/ascend.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "What Ascend Uses",
            "What Changes",
            "What Stays Fixed",
            "Ascend Flow",
            "Ascend or Save",
            "Current Rarity",
            "Max Rarity",
            "Promotion Cost",
            "Ascendency Shards",
            "One Tier",
            "Item Ceiling",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/systems/deconstruct.html",
            "pages/systems/rarity.html",
            "pages/systems/re-roll.html",
            "pages/General/build-planner.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".ascend-summary-grid", css)
        self.assertIn(".ascend-compare-grid", css)
        self.assertIn(".ascend-flow", css)
        self.assertIn(".ascend-link-grid", css)

    def test_craft_page_has_compact_ascendancy_shop_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "craft.html"
        css_path = REPO_ROOT / "css" / "craft.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/craft.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Craft Menu Role",
            "Ethereal Shard Purchases",
            "Scrolls of Imbuement",
            "Craft vs Crafting",
            "Ethereal Shards",
            "Augment Orb",
            "Scroll of Regret",
            "Race Change Scroll",
            "Collector's Pouch",
            "Berserker Potion",
            "250 Tattered Imbuements",
            "25 Tattered Imbuements",
            "Epic+ Only",
            "pages/systems/crafting.html",
            "pages/systems/imbuements.html",
            "pages/systems/deconstruct.html",
            "pages/systems/purge.html",
            "pages/systems/rarity.html",
            "pages/systems/ascend.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".craft-summary-grid", css)
        self.assertIn(".craft-shop-grid", css)
        self.assertIn(".craft-flow", css)
        self.assertIn(".craft-link-grid", css)

    def test_imbuements_page_has_compact_targeting_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "imbuements.html"
        css_path = REPO_ROOT / "css" / "imbuements.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/imbuements.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Imbuement Flow",
            "Source Mechanics",
            "Tier Roll Odds",
            "Targeting Decisions",
            "Tattered Imbuement",
            "Scroll of Imbuement",
            "250 Matching Tatters",
            "25 Tattered Imbuements",
            "80% T1",
            "15% T2",
            "5% T3",
            "Epic+ Item",
            "Uncommon Tatter",
            "Rare Tatter",
            "Level Scaling",
            "Hell Spawn",
            "Bloodthirster",
            "pages/systems/perks.html?perk=Bloodthirster",
            "pages/enemies/monsters.html?monster=hell-spawn",
            "pages/enemies/monsters.html?monster=werewolf",
            "pages/systems/craft.html",
            "pages/systems/purge.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".imbuement-summary-grid", css)
        self.assertIn(".imbuement-flow", css)
        self.assertIn(".imbuement-odds-grid", css)
        self.assertIn(".imbuement-link-grid", css)

    def test_purge_page_has_compact_cleanup_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "purge.html"
        css_path = REPO_ROOT / "css" / "purge.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/purge.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Purge or Cleanse",
            "What Purge Removes",
            "What Cleanse Removes",
            "Cleanup Flow",
            "Before You Confirm",
            "Recovery Rules",
            "Special Effect",
            "Corrupted Innate",
            "25 Tattered Imbuements",
            "No Tier Refund",
            "No Item Reset",
            "Epic+ Item",
            "pages/systems/imbuements.html",
            "pages/systems/corruption.html",
            "pages/systems/craft.html",
            "pages/systems/deconstruct.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".purge-summary-grid", css)
        self.assertIn(".purge-compare-grid", css)
        self.assertIn(".purge-flow", css)
        self.assertIn(".purge-link-grid", css)

    def test_corruption_page_has_compact_cleanse_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "corruption.html"
        css_path = REPO_ROOT / "css" / "corruption.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/corruption.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Corruption Roles",
            "Corrupted Innate",
            "Hard Bosses",
            "Cleanse with Purge",
            "What Corruption Changes",
            "Cleanse Flow",
            "Before You Cleanse",
            "No Item Reset",
            "Purge Tool",
            "pages/systems/purge.html",
            "pages/systems/imbuements.html",
            "pages/systems/rarity.html",
            "pages/systems/re-roll.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".corruption-summary-grid", css)
        self.assertIn(".corruption-compare-grid", css)
        self.assertIn(".corruption-flow", css)
        self.assertIn(".corruption-link-grid", css)

    def test_encounter_page_has_compact_elite_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "encounter.html"
        css_path = REPO_ROOT / "css" / "encounter.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/encounter.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Encounter Flow",
            "Active vs Passive",
            "Escalation Flow",
            "Variant Rules",
            "Despawns and Leashes",
            "Prolonged Activity",
            "10 chunks (160 tiles)",
            "4+ minutes Passive",
            "1 minute of continuous Active time",
            "6-minute grace window",
            "Purple Lightning",
            "Green Lightning",
            "Yellow Lightning",
            "1 in 33",
            "1 in 66",
            "1 in 100",
            "Night only",
            "Corrupts loot",
            "pages/systems/corruption.html",
            "pages/enemies/monsters.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".encounter-summary-grid", css)
        self.assertIn(".encounter-state-grid", css)
        self.assertIn(".encounter-flow", css)
        self.assertIn(".encounter-variant-grid", css)
        self.assertIn(".encounter-link-grid", css)

    def test_pvp_page_has_compact_rule_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "pvp-system.html"
        css_path = REPO_ROOT / "css" / "pvp.css"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/pvp.css" />', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "PVP at a Glance",
            "Safe Zones and Flagging",
            "Death and Loot Flow",
            "Criminal Consequences",
            "Tracking and Community",
            "Safe Zone Dove",
            "Open Combat",
            "Body Timers",
            "4 minutes",
            "10 minutes",
            "Looted Item Flag",
            "Clean Ground Drop",
            "Criminal Status",
            "5 minutes out of sight",
            "2 counts",
            "1 count",
            "50+ Counts",
            "criminal gate",
            "global-chat",
            "kill-feed",
            "leaderboard-levels",
            "pages/systems/anti-zerg.html",
            "pages/systems/guild.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".pvp-summary-grid", css)
        self.assertIn(".pvp-rule-grid", css)
        self.assertIn(".pvp-flow", css)
        self.assertIn(".pvp-consequence-grid", css)
        self.assertIn(".pvp-link-grid", css)

    def test_anti_zerg_page_has_compact_calculator_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "anti-zerg.html"
        css_path = REPO_ROOT / "css" / "anti-zerg.css"
        script_path = REPO_ROOT / "js" / "anti-zerg.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/anti-zerg.css" />', html)
        self.assertIn('<script src="js/anti-zerg.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Anti-Zerg at a Glance",
            "Mode and Sizing Rules",
            "Focus Fire and Collaboration",
            "Damage Reduction Calculator",
            "Reduction Reference",
            "Moderation Rules",
            "Warfront Mode",
            "Open-World Mode",
            "3-Minute High-Water",
            "128x128 Tiles",
            "10+ direct attacks",
            "66%",
            "5-Minute Activity",
            "10.0 EFFECTIVE",
            "750 to 1500",
            "10 chunks (160 tiles)",
            "180 seconds",
            "20%",
            "30%",
            "27.27%",
            "Self-Heal Mirror",
            "pages/systems/pvp-system.html",
            "pages/systems/guild.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".anti-zerg-summary-grid", css)
        self.assertIn(".anti-zerg-mode-grid", css)
        self.assertIn(".anti-zerg-flow", css)
        self.assertIn(".anti-zerg-calculator", css)
        self.assertIn(".anti-zerg-reference-grid", css)
        self.assertIn(".anti-zerg-link-grid", css)

        self.assertIn("const ANTI_ZERG_REDUCTION_TABLE", script)
        self.assertIn("function evaluateAntiZergMatchup", script)
        self.assertIn("function initAntiZergCalculator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_monster_damage_reduction_page_has_compact_calculator_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "monster-damage-reduction.html"
        css_path = REPO_ROOT / "css" / "monster-damage-reduction.css"
        script_path = REPO_ROOT / "js" / "monster-damage-reduction.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/monster-damage-reduction.css" />', html)
        self.assertIn('<script src="js/monster-damage-reduction.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Monster Damage Reduction at a Glance",
            "Scaling Rules",
            "Damage Reduction Calculator",
            "Threshold Reference",
            "Example Outcomes",
            "Related Pages",
            "+20 level gap",
            "+30 level gap",
            "25%",
            "Level 100 Cap",
            "monsters 100+ count as 100",
            "Player Level",
            "Monster Level",
            "Level Difference",
            "Monster Damage Dealt",
            "Your Damage vs Monster",
            "12.5%",
            "112.5%",
            "87.5%",
            "data-player-input",
            "data-monster-input",
            "pages/enemies/monsters.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/systems/anti-zerg.html",
            "pages/systems/pvp-system.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".monster-dr-summary-grid", css)
        self.assertIn(".monster-dr-rule-grid", css)
        self.assertIn(".monster-dr-calculator", css)
        self.assertIn(".monster-dr-reference-grid", css)
        self.assertIn(".monster-dr-example-grid", css)
        self.assertIn(".monster-dr-link-grid", css)

        self.assertIn("const MONSTER_DR_RULES", script)
        self.assertIn("function calculateMonsterDamageReduction", script)
        self.assertIn("function updateMonsterDamageReduction", script)
        self.assertIn("function initMonsterDamageReductionCalculator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_experience_page_has_compact_pool_simulator_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "experience.html"
        css_path = REPO_ROOT / "css" / "experience.css"
        script_path = REPO_ROOT / "js" / "experience.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/experience.css" />', html)
        self.assertIn('<script src="js/experience.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Experience Pool at a Glance",
            "Daily Pool Build",
            "Combat Conversion",
            "Experience Pool Simulator",
            "XP Threshold Reference",
            "Related Pages",
            "Levels 1-89",
            "+3.0 levels per 24 hours",
            "Levels 90+",
            "+1.0 level per 24 hours",
            "3.0 levels",
            "Double XP",
            "1% of a level",
            "0.01 pool",
            "150-235 XP",
            "XP Multiplier",
            "Weapon Speed",
            "Projected XP / Second",
            "Est. Time to Level",
            "Run Tick",
            "data-xp-run-tick",
            "pages/General/build-planner.html",
            "pages/systems/perks.html",
            "pages/systems/monster-damage-reduction.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".experience-summary-grid", css)
        self.assertIn(".experience-build-grid", css)
        self.assertIn(".experience-conversion-grid", css)
        self.assertIn(".experience-sim-widget", css)
        self.assertIn(".experience-threshold-grid", css)
        self.assertIn(".experience-link-grid", css)

        self.assertIn("const EXPERIENCE_XP_THRESHOLDS", script)
        self.assertIn("function getExperiencePoolBuildRate", script)
        self.assertIn("function calculateExperienceTick", script)
        self.assertIn("function updateExperienceSimulator", script)
        self.assertIn("function initExperienceSimulator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_guild_page_has_compact_management_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "guild.html"
        css_path = REPO_ROOT / "css" / "guild.css"
        script_path = REPO_ROOT / "js" / "guild.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/guild.css" />', html)
        self.assertIn('<script src="js/guild.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Guild at a Glance",
            "Identity and Roster",
            "Rank and Management Flow",
            "Party Cycle Preview",
            "Operations Reference",
            "PVP and Group Context",
            "Related Pages",
            "G",
            "50 members",
            "[Rank] Character Name",
            "Member",
            "Elder",
            "Council",
            "Leader",
            "Add Member",
            "Kick Member",
            "Promote",
            "Demote",
            "Guild Party",
            "Party A",
            "Party B",
            "Party C",
            "Leave",
            "Anti-Zerg sizing",
            "pages/systems/anti-zerg.html",
            "pages/systems/pvp-system.html",
            "pages/systems/chat.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".guild-summary-grid", css)
        self.assertIn(".guild-roster-grid", css)
        self.assertIn(".guild-flow", css)
        self.assertIn(".guild-party-preview", css)
        self.assertIn(".guild-action-grid", css)
        self.assertIn(".guild-link-grid", css)

        self.assertIn("const GUILD_PARTY_SEQUENCE", script)
        self.assertIn("function setGuildParty", script)
        self.assertIn("function initGuildPartyPreview", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_chat_page_has_compact_channel_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "chat.html"
        css_path = REPO_ROOT / "css" / "chat.css"
        script_path = REPO_ROOT / "js" / "chat.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/chat.css" />', html)
        self.assertIn('<script src="js/chat.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Chat at a Glance",
            "Viewing Channels",
            "Send Mode Preview",
            "Hotkeys and Input Flow",
            "Scope Reference",
            "Related Pages",
            "All",
            "Local",
            "Global",
            "Guild",
            "T",
            "Tab",
            "Hold E",
            "Say",
            "Whisper",
            "Safe Zone Only",
            "World Channel",
            "Nearby Only",
            "Visible Area",
            "8 surrounding tiles",
            "server-wide messages sent from safe zones",
            "global-chat",
            "Discord",
            "pages/systems/guild.html",
            "pages/systems/pvp-system.html",
            "pages/systems/anti-zerg.html",
            "pages/General/play-the-game.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".chat-summary-grid", css)
        self.assertIn(".chat-channel-grid", css)
        self.assertIn(".chat-flow", css)
        self.assertIn(".chat-mode-preview", css)
        self.assertIn(".chat-scope-grid", css)
        self.assertIn(".chat-link-grid", css)

        self.assertIn("const CHAT_MODE_REFERENCE", script)
        self.assertIn("function setChatMode", script)
        self.assertIn("function initChatModePreview", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_floor_cleanup_page_has_compact_timing_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "floor-cleanup.html"
        css_path = REPO_ROOT / "css" / "floor-cleanup.css"
        script_path = REPO_ROOT / "js" / "floor-cleanup.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/floor-cleanup.css" />', html)
        self.assertIn('<script src="js/floor-cleanup.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Floor Cleanup at a Glance",
            "Creeper Timing Rules",
            "Sweep Timing Preview",
            "Loot Lifetime Flow",
            "What Resets the Risk",
            "Related Pages",
            "Creeper",
            "3 minutes",
            "8 minutes",
            "8-11 minutes",
            "abandoned loot",
            "undisturbed time",
            "more than 8 minutes",
            "about 8 minutes",
            "up to 11 minutes",
            "pages/systems/pvp-system.html",
            "pages/systems/corruption.html",
            "pages/systems/purge.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
            "pages/General/play-the-game.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".floor-cleanup-summary-grid", css)
        self.assertIn(".floor-cleanup-rule-grid", css)
        self.assertIn(".floor-cleanup-preview", css)
        self.assertIn(".floor-cleanup-flow", css)
        self.assertIn(".floor-cleanup-reset-grid", css)
        self.assertIn(".floor-cleanup-link-grid", css)

        self.assertIn("const FLOOR_CLEANUP_SCENARIOS", script)
        self.assertIn("function setFloorCleanupScenario", script)
        self.assertIn("function initFloorCleanupPreview", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_play_the_game_page_has_discord_first_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "General" / "play-the-game.html"
        css_path = REPO_ROOT / "css" / "play-the-game.css"
        script_path = REPO_ROOT / "js" / "play-the-game.js"
        endless_page_path = REPO_ROOT / "pages" / "General" / "endless-hunt.html"
        endless_script_path = REPO_ROOT / "js" / "endless-hunt-idler.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertFalse(endless_page_path.exists())
        self.assertFalse(endless_script_path.exists())
        self.assertIn('<link rel="stylesheet" href="css/play-the-game.css" />', html)
        self.assertIn('<script src="js/play-the-game.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")
        self.assertNotIn("discord-icon", html)
        self.assertNotIn("Endless Hunt", html)

        for expected in [
            "Play the Game",
            "Discord-first setup",
            "Join the Discord",
            "#welcome",
            "Create Your Account",
            "Log In and Play",
            "https://discord.gg/DW6zcWy",
            "data-play-monster",
            "data-play-elite",
            "Related Pages",
            "pages/General/build-planner.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".play-step-grid", css)
        self.assertIn(".play-discord-panel", css)
        self.assertIn(".play-link-grid", css)
        self.assertIn(".discord-cta", css)
        self.assertIn("function initPlayMonsterEscort", script)
        self.assertIn("images/monsters/manifest.json", script)
        self.assertIn("wrap.clientWidth", script)
        self.assertIn("wrap.clientHeight", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_level_page_has_compact_xp_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "level.html"
        css_path = REPO_ROOT / "css" / "level.css"
        script_path = REPO_ROOT / "js" / "level.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/level.css" />', html)
        self.assertIn('<script src="js/level.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Level at a Glance",
            "Damage to XP Preview",
            "Milestone Reference",
            "Level XP Requirements",
            "Related Pages",
            "Level 105",
            "1:1 Damage",
            "Experience Pool",
            "Catch-Up",
            "Weekend / Event",
            "data-level-damage-slider",
            "data-level-total-xp",
            "data-level-multiplier",
            "pages/systems/experience.html",
            "pages/General/build-planner.html",
            "pages/systems/monster-damage-reduction.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/enemies/monsters.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".level-summary-grid", css)
        self.assertIn(".level-xp-widget", css)
        self.assertIn(".level-milestone-grid", css)
        self.assertIn(".level-chart-card", css)
        self.assertIn(".level-link-grid", css)

        self.assertIn("const LEVEL_XP_TOTALS", script)
        self.assertIn("function initLevelXpWidget", script)
        self.assertIn("function renderLevelChart", script)
        self.assertIn("function renderLevelMilestones", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_skills_page_has_compact_melee_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "skills.html"
        css_path = REPO_ROOT / "css" / "skills.css"
        script_path = REPO_ROOT / "js" / "skills.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/skills.css" />', html)
        self.assertIn('<script src="js/skills.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Skills at a Glance",
            "Melee Skill Set",
            "Requirement Preview",
            "Skill XP Requirements",
            "Related Pages",
            "Large Blades",
            "Axes",
            "Blunts",
            "Polearms",
            "Small Blades",
            "Base Max",
            "110",
            "Race Bonus",
            "+10 Above Cap",
            "Equipment Requirements",
            "Race bonuses do not count toward equipment requirements",
            "data-skill-base-slider",
            "data-skill-race-toggle",
            "data-skill-effective",
            "data-skill-requirement",
            "data-skill-status",
            "pages/stats/races.html",
            "pages/General/build-planner.html",
            "pages/items/weapons.html",
            "pages/items/armors.html",
            "pages/stats/level.html",
            "pages/systems/experience.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".skills-summary-grid", css)
        self.assertIn(".skills-list-grid", css)
        self.assertIn(".skills-requirement-widget", css)
        self.assertIn(".skills-chart-card", css)
        self.assertIn(".skills-link-grid", css)

        self.assertIn("const SKILL_XP_TOTALS", script)
        self.assertIn("function initSkillRequirementWidget", script)
        self.assertIn("function renderSkillChart", script)
        self.assertIn("function renderSkillCurve", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_races_page_has_compact_bonus_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "races.html"
        css_path = REPO_ROOT / "css" / "races.css"
        script_path = REPO_ROOT / "js" / "races.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/races.css" />', html)
        self.assertIn('<script src="js/races.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Races at a Glance",
            "Playable Race Bonuses",
            "Race Bonus Preview",
            "Equipment Requirement Rule",
            "Related Pages",
            "Human",
            "Tundrian",
            "Brimlock",
            "Komodan",
            "Elf",
            "Orc",
            "Gnoll",
            "Dark Elf",
            "Tier 1",
            "Tier 2",
            "Tier 3",
            "Base values pass equipment checks",
            "data-race-option",
            "data-race-base-slider",
            "data-race-requirement-slider",
            "data-race-effective-stat",
            "data-race-effective-skill",
            "data-race-requirement-status",
            "pages/stats/skills.html",
            "pages/stats/strength.html",
            "pages/stats/constitution.html",
            "pages/stats/dexterity.html",
            "pages/General/build-planner.html",
            "pages/systems/perks.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".races-summary-grid", css)
        self.assertIn(".races-card-grid", css)
        self.assertIn(".races-preview-widget", css)
        self.assertIn(".races-rule-grid", css)
        self.assertIn(".races-link-grid", css)

        self.assertIn("const RACE_BONUSES", script)
        self.assertIn("function initRacePreviewWidget", script)
        self.assertIn("function renderRaceSummary", script)
        self.assertIn("function updateRacePreview", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_strength_page_has_compact_formula_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "strength.html"
        css_path = REPO_ROOT / "css" / "strength.css"
        script_path = REPO_ROOT / "js" / "strength.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/strength.css" />', html)
        self.assertIn('<script src="js/strength.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Strength at a Glance",
            "Strength Calculator",
            "Weight Benchmarks",
            "Bleed Threshold",
            "Build Context",
            "Perks",
            "Equipment Reference",
            "Related Pages",
            "Melee Multiplier",
            "Max Weight",
            "Max Health",
            "100 Base Strength",
            "7.5% of hit damage",
            "data-strength-skill-slider",
            "data-strength-str-slider",
            "data-strength-dex-slider",
            "data-strength-level-slider",
            "data-strength-con-slider",
            "data-strength-hit-slider",
            "data-strength-multiplier",
            "data-strength-max-weight",
            "data-strength-max-health",
            "data-strength-bleed-chance",
            "data-strength-bleed-damage",
            "data-strength-weight-chart",
            "data-perk-stats=\"strength\"",
            "data-weapon-specialty=\"Strength\"",
            "pages/stats/races.html",
            "pages/stats/skills.html",
            "pages/stats/constitution.html",
            "pages/stats/dexterity.html",
            "pages/General/build-planner.html",
            "pages/items/weapons.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".strength-summary-grid", css)
        self.assertIn(".strength-calculator-widget", css)
        self.assertIn(".strength-output-grid", css)
        self.assertIn(".strength-benchmark-grid", css)
        self.assertIn(".strength-context-grid", css)
        self.assertIn(".strength-link-grid", css)

        self.assertIn("const STRENGTH_WEIGHT_BENCHMARKS", script)
        self.assertIn("function initStrengthCalculator", script)
        self.assertIn("function renderWeightBenchmarks", script)
        self.assertIn("function updateStrengthCalculator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_constitution_page_has_compact_health_regen_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "constitution.html"
        css_path = REPO_ROOT / "css" / "constitution.css"
        script_path = REPO_ROOT / "js" / "constitution.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/constitution.css" />', html)
        self.assertIn('<script src="js/constitution.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Constitution at a Glance",
            "Constitution Calculator",
            "Regeneration Benchmarks",
            "Race Context",
            "Perks",
            "Equipment Reference",
            "Related Pages",
            "Max Health",
            "Baseline Regen",
            "Con / 3",
            "HP every 2 seconds",
            "data-constitution-level-slider",
            "data-constitution-con-slider",
            "data-constitution-str-slider",
            "data-constitution-regen-bonus-slider",
            "data-constitution-max-health",
            "data-constitution-regen-tick",
            "data-constitution-regen-per-sec",
            "data-constitution-effective-regen",
            "data-constitution-regen-chart",
            "data-perk-stats=\"constitution\"",
            "data-weapon-specialty=\"Constitution\"",
            "pages/stats/races.html",
            "pages/stats/strength.html",
            "pages/stats/dexterity.html",
            "pages/General/build-planner.html",
            "pages/items/armors.html",
            "pages/systems/perks.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".constitution-summary-grid", css)
        self.assertIn(".constitution-calculator-widget", css)
        self.assertIn(".constitution-output-grid", css)
        self.assertIn(".constitution-benchmark-grid", css)
        self.assertIn(".constitution-context-grid", css)
        self.assertIn(".constitution-link-grid", css)

        self.assertIn("const CONSTITUTION_REGEN_BENCHMARKS", script)
        self.assertIn("function initConstitutionCalculator", script)
        self.assertIn("function renderRegenBenchmarks", script)
        self.assertIn("function updateConstitutionCalculator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_dexterity_page_has_compact_combat_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "dexterity.html"
        css_path = REPO_ROOT / "css" / "dexterity.css"
        script_path = REPO_ROOT / "js" / "dexterity.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/dexterity.css" />', html)
        self.assertIn('<script src="js/dexterity.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Dexterity at a Glance",
            "Dexterity Calculator",
            "Damage Reduction Benchmarks",
            "Race Context",
            "Build Context",
            "Perks",
            "Equipment Reference",
            "Related Pages",
            "Melee Multiplier",
            "Crit Chance",
            "Damage Reduction",
            "1.35x",
            "Base Dex / 2.5",
            "Total Dex * 0.00125",
            "data-dexterity-skill-slider",
            "data-dexterity-str-slider",
            "data-dexterity-dex-slider",
            "data-dexterity-crit-dex-slider",
            "data-dexterity-dr-slider",
            "data-dexterity-multiplier",
            "data-dexterity-crit-chance",
            "data-dexterity-crit-multiplier",
            "data-dexterity-dr",
            "data-dexterity-post-dr",
            "data-dexterity-dr-chart",
            "data-perk-stats=\"dexterity\"",
            "data-weapon-specialty=\"Dexterity\"",
            "pages/stats/races.html",
            "pages/stats/strength.html",
            "pages/stats/constitution.html",
            "pages/General/build-planner.html",
            "pages/items/weapons.html",
            "pages/systems/perks.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".dexterity-summary-grid", css)
        self.assertIn(".dexterity-calculator-widget", css)
        self.assertIn(".dexterity-output-grid", css)
        self.assertIn(".dexterity-benchmark-grid", css)
        self.assertIn(".dexterity-context-grid", css)
        self.assertIn(".dexterity-link-grid", css)

        self.assertIn("const DEXTERITY_DR_BENCHMARKS", script)
        self.assertIn("function initDexterityCalculator", script)
        self.assertIn("function renderDamageReductionBenchmarks", script)
        self.assertIn("function updateDexterityCalculator", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

    def test_resistances_page_has_compact_damage_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "stats" / "resistances.html"
        css_path = REPO_ROOT / "css" / "resistances.css"
        script_path = REPO_ROOT / "js" / "resistances.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/resistances.css" />', html)
        self.assertIn('<script src="js/resistances.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )
        self.assertNotRegex(html, r"\sstyle\s*=")

        for expected in [
            "Resistance at a Glance",
            "Player Damage Preview",
            "Monster Type Matchups",
            "Build Context",
            "Perks",
            "Related Pages",
            "60%",
            "Applied after armor",
            "data-resistance-value-slider",
            "data-resistance-incoming-slider",
            "data-resistance-final-damage",
            "data-resistance-reduced-damage",
            "data-resistance-cap-warning",
            "data-resistance-type-grid",
            "data-neutral-toggle",
            "data-perk-stats=\"resistances\"",
            "pages/items/armors.html",
            "pages/General/build-planner.html",
            "pages/enemies/monsters.html",
            "pages/items/weapons.html",
            "pages/systems/perks.html",
            "pages/systems/pvp-system.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".resistance-summary-grid", css)
        self.assertIn(".resistance-calculator-widget", css)
        self.assertIn(".resistance-output-grid", css)
        self.assertIn(".resistance-type-grid", css)
        self.assertIn(".resistance-context-grid", css)
        self.assertIn(".resistance-link-grid", css)

        self.assertIn("const RESISTANCE_CAP", script)
        self.assertIn("function initResistanceCalculator", script)
        self.assertIn("function renderMonsterTypeResistances", script)
        self.assertIn("function updateNeutralVisibility", script)
        self.assertIn('document.addEventListener("DOMContentLoaded"', script)

        perk_embed_script = (REPO_ROOT / "js" / "perks.js").read_text(encoding="utf-8")
        self.assertIn('name: "resistances"', perk_embed_script)
        self.assertIn("resistance", perk_embed_script)

    def test_crafting_page_has_compact_armor_crafting_reference(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "systems" / "crafting.html"
        css_path = REPO_ROOT / "css" / "crafting.css"
        script_path = REPO_ROOT / "js" / "crafting-page.js"
        html = html_path.read_text(encoding="utf-8")
        css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""
        script = script_path.read_text(encoding="utf-8") if script_path.exists() else ""

        self.assertIn(html_path, cli.VALIDATED_HTML_PATHS)
        self.assertIn(css_path, cli.VALIDATED_STYLE_PATHS)
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertIn('<link rel="stylesheet" href="css/crafting.css" />', html)
        self.assertIn('<script src="js/crafting-page.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertEqual(
            [],
            [
                block.strip()
                for block in re.findall(
                    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                    html,
                    flags=re.IGNORECASE,
                )
                if block.strip()
            ],
        )

        for expected in [
            "Armor Crafting Scope",
            "Frost vs Dragon Materials",
            "Material Costs",
            "Crafting Flow",
            "Materials Calculator",
            "Set Preview",
            "Ice Crystals",
            "Dragon Scales",
            "Hammer &amp; Anvil",
            "100% Success",
            "Random Rarity",
            "Full Suit",
            "455",
            "Current Materials",
            "data-materials-range",
            "data-set-option",
            "pages/systems/craft.html",
            "pages/items/armors.html",
            "pages/systems/rarity.html",
        ]:
            self.assertIn(expected, html)

        self.assertIn(".crafting-summary-grid", css)
        self.assertIn(".crafting-cost-grid", css)
        self.assertIn(".crafting-flow", css)
        self.assertIn(".crafting-link-grid", css)
        self.assertIn("const ARMOR_SETS", script)
        self.assertIn("data-materials-range", script)
        self.assertIn("data-set-option", script)
        self.assertIn("Select at least one slot to see totals.", script)

    def test_armors_page_uses_linked_names_and_non_sortable_image_column(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "armors-page.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "armors.css").read_text(encoding="utf-8")

        self.assertIn('if (col.sortable !== false) {', script)
        self.assertIn('th.style.cursor = "default";', script)
        self.assertIn("const buildArmorDetailUrl = armorRouteHelpers.buildDetailStateUrl;", script)
        self.assertIn('nameLink.className = "armor-link";', script)
        self.assertIn("nameLink.href = buildArmorDetailUrl(item);", script)
        self.assertIn("event.preventDefault();", script)
        self.assertIn("event.stopPropagation();", script)
        self.assertIn(".armor-link", css)

    def test_armors_page_detail_hides_empty_corrupted_perks_and_empty_requirements(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "armors-page.js").read_text(encoding="utf-8")

        self.assertIn("const isPerkValueSet", script)
        self.assertIn("if (isPerkValueSet(item.corruptedPerk))", script)
        self.assertIn('if (numeric === 0) return "None";', script)

    def test_armors_page_search_includes_detail_and_drop_source_text(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "armors-page.js").read_text(encoding="utf-8")

        self.assertIn("const getArmorSearchText", script)
        self.assertIn('utils.getDropSourceMonsterIdsByItem(dropSources, "armors", item.name)', script)
        self.assertIn("uniqueSet.has(normalizeMonsterId(monster.name))", script)
        self.assertIn("formatRequirement(item.playerLevelRequirement)", script)
        self.assertIn("getArmorSearchText(item).includes(searchTerm.toLowerCase())", script)

    def test_manifest_self_reference_is_an_error(self):
        from tools.codex_pipeline.validators.site import validate_manifest_entries

        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "Axe.gif").write_bytes(b"gif")
            issues = validate_manifest_entries(folder, ["images/weapons/Axe.gif", "images/weapons/manifest.json"])

        self.assertIn("manifest includes itself", "\n".join(issue.message for issue in issues))

    def test_drop_overrides_reference_existing_data(self):
        from tools.codex_pipeline.validators.site import validate_drop_references
        from tools.codex_pipeline.drops import load_drop_sources

        sources = load_drop_sources(DROP_SOURCES_PATH)
        issues = validate_drop_references(
            sources,
            armor_names={
                "Iceburst Amulet",
                "Mystic Robe",
                "Rune Armor",
                "Rune Lord's Robe",
                "Rune Helmet",
                "Rune Shield",
                "Rune Leggings",
                "Rune Gauntlets",
                "Banished Gauntlets",
                "Banished Shield",
                "Banished Platemail",
                "Banished Helmet",
                "Banished Leggings",
            },
            weapon_names={"Rune Sword", "Vengeance Hammer"},
            monster_names={
                "Ice Devil",
                "Greater Yeti",
                "Dark Monk",
                "Hell Spawn",
                "Werewolf",
                "Demon",
                "Infernal",
                "Banished Spirit",
                "Banished Soldier",
                "Rune Warrior",
                "Balron",
                "Demon Lord",
                "Banished Knight",
                "Banished Warden",
            },
        )

        self.assertEqual([], issues)

    def test_drop_overrides_report_missing_item_and_monster(self):
        from tools.codex_pipeline.validators.site import validate_drop_references

        issues = validate_drop_references(
            {"armors": {"Unknown Amulet": ["Unknown Monster"]}, "weapons": {}},
            armor_names={"Iceburst Amulet"},
            weapon_names={"Rune Sword"},
            monster_names={"Ice Devil"},
        )

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("armors drop override item not found: Unknown Amulet", messages)
        self.assertIn("armors drop override monster not found: Unknown Monster", messages)

    def test_corrupted_perk_validation_requires_unknown_overrides_for_unlabeled_codes(self):
        from tools.codex_pipeline.validators.site import validate_corrupted_perk_labels

        item_data = {
            "weapons": [
                {
                    "id": 1,
                    "name": "Grips of Winter",
                    "fields": {"corrupted_perk": 41},
                }
            ],
            "armors": [],
        }

        issues = validate_corrupted_perk_labels(item_data, corrupted_perk_overrides={})
        self.assertIn("unmapped corrupted perk code 41", "\n".join(issue.message for issue in issues))

        self.assertEqual(
            [],
            validate_corrupted_perk_labels(item_data, corrupted_perk_overrides={41: None}),
        )

    def test_corrupted_perk_validation_checks_explicit_label_overrides(self):
        from tools.codex_pipeline.validators.site import validate_corrupted_perk_labels

        item_data = {
            "weapons": [
                {
                    "id": 1,
                    "name": "Mapped Label",
                    "fields": {"corrupted_perk": 41, "corrupted_perk_label": "Wrong Label"},
                },
                {
                    "id": 2,
                    "name": "Known Unknown",
                    "fields": {"corrupted_perk": 24, "corrupted_perk_label": "Should Not Exist"},
                },
            ],
            "armors": [],
        }

        issues = validate_corrupted_perk_labels(
            item_data,
            corrupted_perk_overrides={41: "Mapped Frost Effect", 24: None},
        )

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("expected corrupted perk 41 label", messages)
        self.assertIn("configured as unknown but has label", messages)

    def test_inline_script_parser_reports_syntax_errors(self):
        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = ;</script></body></html>"
        issues = validate_inline_scripts("broken.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("broken.html inline script #1", issues[0].message)

    def test_inline_script_parser_reports_missing_node(self):
        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = 1;</script></body></html>"
        with patch("tools.codex_pipeline.validators.site.subprocess.run", side_effect=FileNotFoundError):
            issues = validate_inline_scripts("missing-node.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("node executable not found", issues[0].message)

    def test_inline_script_parser_handles_empty_node_error_output(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = 1;</script></body></html>"
        completed = CompletedProcess(args=["node"], returncode=1, stdout="", stderr="")
        with patch("tools.codex_pipeline.validators.site.subprocess.run", return_value=completed):
            issues = validate_inline_scripts("quiet-node.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("node --check returned no output", issues[0].message)

    def test_cli_reports_missing_and_malformed_inputs_as_errors(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "missing_monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "missing.html"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()

            weapons_data.write_text("not json", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            (weapon_images / "manifest.json").write_text('"not a list"', encoding="utf-8")
            (armor_images / "manifest.json").write_text("[", encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("failed to read data JSON", messages)
        self.assertIn("missing_monsters.json", messages)
        self.assertIn("manifest must be a list", messages)
        self.assertIn("failed to read manifest", messages)
        self.assertIn("failed to read HTML", messages)

    def test_cli_validates_configured_external_javascript_files(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "page.html"
            script = root / "broken.js"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()
                (folder / "manifest.json").write_text("[]", encoding="utf-8")

            weapons_data.write_text("[]", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            monsters_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            html.write_text("<html><body><script>const ok = 1;</script></body></html>", encoding="utf-8")
            script.write_text("const broken = ;", encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
                patch.object(cli, "VALIDATED_SCRIPT_PATHS", [script]),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("broken.js failed parse", messages)

    def test_cli_validates_configured_external_css_files(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "page.html"
            style = root / "broken.css"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()
                (folder / "manifest.json").write_text("[]", encoding="utf-8")

            weapons_data.write_text("[]", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            monsters_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            html.write_text("<html><body></body></html>", encoding="utf-8")
            style.write_text(".ok { color: red; } } .lost { color: blue; }", encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
                patch.object(cli, "VALIDATED_STYLE_PATHS", [style]),
                patch.object(cli, "VALIDATED_SCRIPT_PATHS", []),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("broken.css unexpected closing brace", messages)

    def test_cli_reports_inline_style_attributes_in_html(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "page.html"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()
                (folder / "manifest.json").write_text("[]", encoding="utf-8")

            weapons_data.write_text("[]", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            monsters_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            html.write_text('<html><body><div style="display: flex"></div></body></html>', encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
                patch.object(cli, "VALIDATED_STYLE_PATHS", []),
                patch.object(cli, "VALIDATED_SCRIPT_PATHS", []),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("inline style attribute #1", messages)
