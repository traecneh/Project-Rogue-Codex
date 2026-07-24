from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from tools.codex_pipeline.config import (
    ARMORS_DATA_PATH,
    COLLECTABLES_DATA_PATH,
    MONSTERS_DATA_PATH,
    QUESTS_DATA_PATH,
    REPO_ROOT,
    USEABLES_DATA_PATH,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.validators.site import ValidationIssue


QUEST_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ENTITY_DATA_PATHS = {
    "armor": ARMORS_DATA_PATH,
    "collectable": COLLECTABLES_DATA_PATH,
    "monster": MONSTERS_DATA_PATH,
    "useable": USEABLES_DATA_PATH,
    "weapon": WEAPONS_DATA_PATH,
}
QUEST_CATEGORIES = {"Progression", "Side", "Tutorial"}


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _entity_indexes(entity_paths: dict[str, Path]) -> tuple[dict[str, dict[str, str]], list[ValidationIssue]]:
    indexes: dict[str, dict[str, str]] = {}
    issues: list[ValidationIssue] = []
    for entity_type, path in entity_paths.items():
        try:
            records = _read_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            issues.append(ValidationIssue("error", f"{path} failed to read quest entity data: {exc}"))
            continue
        if not isinstance(records, list):
            issues.append(ValidationIssue("error", f"{path} quest entity data must be a list"))
            continue
        indexes[entity_type] = {
            str(record["id"]): str(record["name"])
            for record in records
            if isinstance(record, dict) and "id" in record and "name" in record
        }
    return indexes, issues


def _walk_entities(value: Any, context: str = "root"):
    if isinstance(value, dict):
        entity = value.get("entity")
        if isinstance(entity, dict):
            yield context, entity
        for key, child in value.items():
            yield from _walk_entities(child, f"{context}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_entities(child, f"{context}[{index}]")


def _walk_objects(value: Any, context: str = "root"):
    if isinstance(value, dict):
        yield context, value
        for key, child in value.items():
            yield from _walk_objects(child, f"{context}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _walk_objects(child, f"{context}[{index}]")


def _validate_entity_references(
    data: dict[str, Any],
    indexes: dict[str, dict[str, str]],
    *,
    repo_root: Path,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for context, entity in _walk_entities(data):
        entity_type = str(entity.get("type", ""))
        entity_id = str(entity.get("id", ""))
        entity_name = str(entity.get("name", ""))
        if entity_type not in ENTITY_DATA_PATHS:
            issues.append(ValidationIssue("error", f"{context} uses unsupported quest entity type: {entity_type}"))
            continue
        expected_name = indexes.get(entity_type, {}).get(entity_id)
        if expected_name is None:
            issues.append(
                ValidationIssue("error", f"{context} references missing {entity_type} ID {entity_id}")
            )
        elif expected_name != entity_name:
            issues.append(
                ValidationIssue(
                    "error",
                    f"{context} {entity_type} ID {entity_id} is {expected_name}, not {entity_name}",
                )
            )
        image = entity.get("image")
        if image:
            image_path = Path(str(image))
            if image_path.is_absolute() or ".." in image_path.parts or not (repo_root / image_path).is_file():
                issues.append(ValidationIssue("error", f"{context} references missing entity image: {image}"))
    for context, record in _walk_objects(data):
        if record.get("type") != "gold":
            continue
        entity = record.get("entity")
        if not isinstance(entity, dict) or (
            entity.get("type"),
            entity.get("id"),
            entity.get("name"),
        ) != ("collectable", 0, "Gold"):
            issues.append(
                ValidationIssue(
                    "error",
                    f"{context} gold entries must reference collectable ID 0 (Gold) for display and linking",
                )
            )
    return issues


def _validate_coordinates(value: Any, context: str) -> list[ValidationIssue]:
    if value is None:
        return []
    if (
        not isinstance(value, list)
        or len(value) != 2
        or any(not isinstance(coordinate, int) for coordinate in value)
    ):
        return [ValidationIssue("error", f"{context} coordinates must contain two integers")]
    return []


def validate_quest_data(
    data: Any,
    *,
    entity_indexes: dict[str, dict[str, str]],
    repo_root: Path = REPO_ROOT,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not isinstance(data, dict):
        return [ValidationIssue("error", "quest data must be an object")]
    if data.get("schema_version") != 1:
        issues.append(ValidationIssue("error", "quest data schema_version must be 1"))

    quests = data.get("quests")
    services = data.get("services")
    if not isinstance(quests, list):
        issues.append(ValidationIssue("error", "quest data quests must be a list"))
        quests = []
    if not isinstance(services, list):
        issues.append(ValidationIssue("error", "quest data services must be a list"))
        services = []

    identifiers: set[str] = set()
    quest_ids = {
        str(quest.get("id", ""))
        for quest in quests
        if isinstance(quest, dict) and quest.get("id")
    }

    for index, quest in enumerate(quests):
        context = f"quest[{index}]"
        if not isinstance(quest, dict):
            issues.append(ValidationIssue("error", f"{context} must be an object"))
            continue
        quest_id = str(quest.get("id", ""))
        if not QUEST_ID_PATTERN.fullmatch(quest_id):
            issues.append(ValidationIssue("error", f"{context} has invalid ID: {quest_id}"))
        elif quest_id in identifiers:
            issues.append(ValidationIssue("error", f"duplicate quest/service ID: {quest_id}"))
        identifiers.add(quest_id)

        for field in ("name", "region", "area"):
            if not str(quest.get(field, "")).strip():
                issues.append(ValidationIssue("error", f"{quest_id or context} is missing {field}"))
        if quest.get("category") not in QUEST_CATEGORIES:
            issues.append(
                ValidationIssue("error", f"{quest_id or context} has invalid category: {quest.get('category')}")
            )
        if not isinstance(quest.get("min_level"), int) or quest["min_level"] < 1:
            issues.append(ValidationIssue("error", f"{quest_id or context} min_level must be a positive integer"))
        if not isinstance(quest.get("repeatable"), bool):
            issues.append(ValidationIssue("error", f"{quest_id or context} repeatable must be a boolean"))

        giver = quest.get("giver")
        if not isinstance(giver, dict) or not str(giver.get("name", "")).strip():
            issues.append(ValidationIssue("error", f"{quest_id or context} must define a named giver"))
        elif "coordinates" in giver:
            issues.extend(_validate_coordinates(giver["coordinates"], f"{quest_id}.giver"))

        for prerequisite in quest.get("prerequisites", []):
            if prerequisite == quest_id:
                issues.append(ValidationIssue("error", f"{quest_id} cannot require itself"))
            elif prerequisite not in quest_ids:
                issues.append(ValidationIssue("error", f"{quest_id} references missing prerequisite: {prerequisite}"))

        stages = quest.get("stages")
        if not isinstance(stages, list) or not stages:
            issues.append(ValidationIssue("error", f"{quest_id or context} must define at least one stage"))
            continue
        stage_numbers = [stage.get("number") for stage in stages if isinstance(stage, dict)]
        if stage_numbers != list(range(1, len(stages) + 1)):
            issues.append(ValidationIssue("error", f"{quest_id} stage numbers must be sequential from 1"))

        objective_numbers: list[int] = []
        for stage_index, stage in enumerate(stages):
            if not isinstance(stage, dict):
                issues.append(ValidationIssue("error", f"{quest_id}.stages[{stage_index}] must be an object"))
                continue
            objectives = stage.get("objectives")
            if not isinstance(objectives, list) or not objectives:
                issues.append(
                    ValidationIssue("error", f"{quest_id}.stages[{stage_index}] must define objectives")
                )
                continue
            for objective_index, objective in enumerate(objectives):
                if not isinstance(objective, dict):
                    issues.append(
                        ValidationIssue(
                            "error",
                            f"{quest_id}.stages[{stage_index}].objectives[{objective_index}] must be an object",
                        )
                    )
                    continue
                number = objective.get("number")
                if isinstance(number, int):
                    objective_numbers.append(number)
                else:
                    issues.append(ValidationIssue("error", f"{quest_id} has an objective without a number"))
                if not str(objective.get("text", "")).strip():
                    issues.append(ValidationIssue("error", f"{quest_id} objective {number} is missing text"))
                target = objective.get("target")
                if isinstance(target, dict):
                    issues.extend(
                        _validate_coordinates(
                            target.get("coordinates"),
                            f"{quest_id}.objective[{number}].target",
                        )
                    )
                    issues.extend(
                        _validate_coordinates(
                            target.get("destination_coordinates"),
                            f"{quest_id}.objective[{number}].target.destination",
                        )
                    )
        if objective_numbers != list(range(1, len(objective_numbers) + 1)):
            issues.append(ValidationIssue("error", f"{quest_id} objective numbers must be sequential from 1"))

    for index, service in enumerate(services):
        context = f"service[{index}]"
        if not isinstance(service, dict):
            issues.append(ValidationIssue("error", f"{context} must be an object"))
            continue
        service_id = str(service.get("id", ""))
        if not QUEST_ID_PATTERN.fullmatch(service_id):
            issues.append(ValidationIssue("error", f"{context} has invalid ID: {service_id}"))
        elif service_id in identifiers:
            issues.append(ValidationIssue("error", f"duplicate quest/service ID: {service_id}"))
        identifiers.add(service_id)
        if not str(service.get("name", "")).strip():
            issues.append(ValidationIssue("error", f"{service_id or context} is missing name"))
        provider = service.get("provider")
        if not isinstance(provider, dict) or not str(provider.get("name", "")).strip():
            issues.append(ValidationIssue("error", f"{service_id or context} must define a named provider"))
        elif "coordinates" in provider:
            issues.extend(_validate_coordinates(provider["coordinates"], f"{service_id}.provider"))
        for related in service.get("related_pages", []):
            href = str(related.get("href", "")) if isinstance(related, dict) else ""
            if not href or not (repo_root / href.split("?", 1)[0]).is_file():
                issues.append(ValidationIssue("error", f"{service_id} has a broken related page: {href}"))

    issues.extend(_validate_entity_references(data, entity_indexes, repo_root=repo_root))
    return issues


def validate_quest_data_file(
    path: Path = QUESTS_DATA_PATH,
    *,
    entity_paths: dict[str, Path] = ENTITY_DATA_PATHS,
    repo_root: Path = REPO_ROOT,
) -> list[ValidationIssue]:
    indexes, issues = _entity_indexes(entity_paths)
    try:
        data = _read_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        return issues + [ValidationIssue("error", f"{path} failed to read quest data: {exc}")]
    return issues + validate_quest_data(data, entity_indexes=indexes, repo_root=repo_root)
