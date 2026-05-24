from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Project, ProjectTool, now_utc
from app.services.security.auth import ensure_app

PROJECT_CONFIG = ".n0tune/project.json"
ROOT_MARKERS = (".n0tune/project.json", ".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod")


@dataclass(frozen=True)
class ProjectFingerprint:
    name: str
    root: Path
    root_path_hash: str
    git_remote_hash: str | None
    fingerprint: dict[str, Any]
    config_path: Path | None = None
    config_project_id: str | None = None


def detect_project_from_cwd(cwd: str | None = None) -> ProjectFingerprint:
    start = Path(cwd or ".").expanduser()
    if not start.exists():
        raise ValueError(f"Project cwd does not exist: {start}")
    if start.is_file():
        start = start.parent
    start = start.resolve()

    root = _git_root(start) or _marker_root(start) or start
    config_path = root / PROJECT_CONFIG
    config = _read_project_config(config_path)
    git_remote = _git_remote(root)
    package_name = _package_name(root)
    repo_name = _repo_name(git_remote)
    name = str(config.get("name") or package_name or repo_name or root.name)
    root_path_hash = _hash_text(_normalize_path(root))
    git_remote_hash = _hash_text(git_remote) if git_remote else None
    marker = _root_marker(root)

    fingerprint: dict[str, Any] = {
        "root_path_hash": root_path_hash,
        "git_remote_hash": git_remote_hash,
        "package_name": package_name,
        "repository_name": repo_name,
        "workspace_name": root.name,
        "marker": marker,
        "has_project_config": config_path.exists(),
    }
    config_project_id = config.get("project_id")
    if isinstance(config_project_id, str) and config_project_id.startswith("proj_"):
        fingerprint["config_project_id"] = config_project_id
    else:
        config_project_id = None

    return ProjectFingerprint(
        name=name,
        root=root,
        root_path_hash=root_path_hash,
        git_remote_hash=git_remote_hash,
        fingerprint=fingerprint,
        config_path=config_path if config_path.exists() else None,
        config_project_id=config_project_id,
    )


def get_or_create_project(
    session: Session,
    *,
    app_id: str,
    detection: ProjectFingerprint,
    tool_name: str | None = None,
) -> tuple[Project, bool]:
    ensure_app(session, app_id)
    project = session.scalar(
        select(Project).where(
            Project.app_id == app_id,
            Project.root_path_hash == detection.root_path_hash,
        )
    )
    created = False
    if project is None:
        project_kwargs: dict[str, Any] = {}
        if detection.config_project_id:
            project_kwargs["id"] = detection.config_project_id
        project = Project(
            **project_kwargs,
            app_id=app_id,
            name=detection.name,
            root_path_hash=detection.root_path_hash,
            git_remote_hash=detection.git_remote_hash,
            fingerprint_json=detection.fingerprint,
            metadata_json={
                "root_name": detection.root.name,
                "config_path": PROJECT_CONFIG if detection.config_path else None,
            },
        )
        session.add(project)
        session.flush()
        created = True
    else:
        project.name = detection.name
        project.git_remote_hash = detection.git_remote_hash
        project.fingerprint_json = detection.fingerprint
        project.metadata_json = {
            **(project.metadata_json or {}),
            "root_name": detection.root.name,
            "config_path": PROJECT_CONFIG if detection.config_path else None,
        }
        project.updated_at = now_utc()
        session.flush()

    if tool_name:
        mark_project_tool_seen(session, project_id=project.id, tool_name=tool_name)

    return project, created


def mark_project_tool_seen(
    session: Session,
    *,
    project_id: str,
    tool_name: str,
    metadata: dict[str, Any] | None = None,
) -> ProjectTool:
    normalized = tool_name.strip().lower() or "unknown"
    row = session.scalar(
        select(ProjectTool).where(
            ProjectTool.project_id == project_id,
            ProjectTool.tool_name == normalized,
        )
    )
    if row is None:
        row = ProjectTool(
            project_id=project_id,
            tool_name=normalized,
            enabled=True,
            metadata_json=metadata or {},
        )
        session.add(row)
    elif metadata:
        row.metadata_json = {**(row.metadata_json or {}), **metadata}
    row.last_seen_at = now_utc()
    session.flush()
    return row


def context_pressure_for(tokens: int) -> str:
    if tokens >= 95_000:
        return "critical"
    if tokens >= 80_000:
        return "danger"
    if tokens >= 60_000:
        return "watch"
    return "healthy"


def _hash_text(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _normalize_path(path: Path) -> str:
    return str(path.resolve()).replace("\\", "/").casefold()


def _git_root(cwd: Path) -> Path | None:
    output = _git(cwd, ["rev-parse", "--show-toplevel"])
    return Path(output).resolve() if output else None


def _git_remote(cwd: Path) -> str | None:
    return _git(cwd, ["config", "--get", "remote.origin.url"])


def _git(cwd: Path, args: list[str]) -> str | None:
    try:
        result = subprocess.run(  # noqa: S603
            ["git", *args],  # noqa: S607
            cwd=cwd,
            capture_output=True,
            check=False,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    output = result.stdout.strip()
    return output or None


def _marker_root(cwd: Path) -> Path | None:
    for current in (cwd, *cwd.parents):
        if any((current / marker).exists() for marker in ROOT_MARKERS):
            return current
    return None


def _root_marker(root: Path) -> str | None:
    for marker in ROOT_MARKERS:
        if (root / marker).exists():
            return marker
    return None


def _read_project_config(config_path: Path) -> dict[str, Any]:
    if not config_path.exists():
        return {}
    try:
        parsed = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _package_name(root: Path) -> str | None:
    package_json = root / "package.json"
    if package_json.exists():
        try:
            parsed = json.loads(package_json.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            parsed = {}
        name = parsed.get("name") if isinstance(parsed, dict) else None
        if isinstance(name, str) and name:
            return name

    go_mod = root / "go.mod"
    if go_mod.exists():
        try:
            first = go_mod.read_text(encoding="utf-8").splitlines()[0]
        except (OSError, IndexError):
            first = ""
        if first.startswith("module "):
            return first.removeprefix("module ").strip().split("/")[-1]

    cargo_toml = root / "Cargo.toml"
    if cargo_toml.exists():
        try:
            for line in cargo_toml.read_text(encoding="utf-8").splitlines():
                stripped = line.strip()
                if stripped.startswith("name ="):
                    return stripped.split("=", 1)[1].strip().strip('"')
        except OSError:
            return None

    return None


def _repo_name(remote_url: str | None) -> str | None:
    if not remote_url:
        return None
    tail = remote_url.rstrip("/").rsplit("/", 1)[-1]
    return tail.removesuffix(".git") or None
