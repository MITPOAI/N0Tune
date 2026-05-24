import json
import subprocess
from pathlib import Path
from typing import cast

from fastapi.testclient import TestClient


def _make_project(root: Path, name: str) -> Path:
    root.mkdir()
    (root / "package.json").write_text(json.dumps({"name": name}), encoding="utf-8")
    try:
        subprocess.run(["git", "init"], cwd=root, check=False, capture_output=True)  # noqa: S607
    except OSError:
        pass
    return root


def _detect(client: TestClient, cwd: Path, tool_name: str = "codex") -> dict[str, object]:
    response = client.post(
        "/v1/projects/detect",
        json={"app_id": "demo", "cwd": str(cwd), "tool_name": tool_name},
    )
    assert response.status_code == 200, response.text
    return cast(dict[str, object], response.json())


def test_project_detection_maps_same_folder_to_same_project(
    client: TestClient,
    tmp_path: Path,
) -> None:
    repo = _make_project(tmp_path / "project-a", "project-a")
    nested = repo / "src"
    nested.mkdir()
    other = _make_project(tmp_path / "project-b", "project-b")

    first = _detect(client, repo, "claude")
    second = _detect(client, nested, "codex")
    third = _detect(client, other, "cursor")

    assert first["project_id"] == second["project_id"]
    assert second["status"] == "existing"
    assert first["project_id"] != third["project_id"]
    assert first["project_name"] == "project-a"


def test_project_memory_is_scoped_by_project(client: TestClient, tmp_path: Path) -> None:
    project_a = _detect(client, _make_project(tmp_path / "a", "a"))["project_id"]
    project_b = _detect(client, _make_project(tmp_path / "b", "b"))["project_id"]

    created_a = client.post(
        f"/v1/projects/{project_a}/memories",
        json={
            "app_id": "demo",
            "user_id": "project",
            "type": "decision",
            "text": "Use Tauri plus SQLite for desktop project A.",
        },
    )
    assert created_a.status_code == 201
    created_b = client.post(
        f"/v1/projects/{project_b}/memories",
        json={
            "app_id": "demo",
            "user_id": "project",
            "type": "decision",
            "text": "Use Electron for unrelated project B.",
        },
    )
    assert created_b.status_code == 201

    result = client.get(f"/v1/projects/{project_a}/memories?app_id=demo&q=desktop")
    assert result.status_code == 200
    body = result.json()
    assert [item["project_id"] for item in body] == [project_a]
    assert "project B" not in json.dumps(body)


def test_handoff_capsule_can_be_continued_by_another_tool(
    client: TestClient,
    tmp_path: Path,
) -> None:
    project_id = _detect(client, _make_project(tmp_path / "handoff", "handoff"))["project_id"]
    session_response = client.post(
        f"/v1/projects/{project_id}/sessions",
        json={
            "app_id": "demo",
            "tool_name": "claude",
            "goal": "Wire project context into MCP.",
            "context_tokens_estimated": 82_000,
            "files_touched": ["integrations/mcp-server/src/server.mjs"],
            "next_steps": ["Add Codex continuation prompt."],
        },
    )
    assert session_response.status_code == 201
    assert session_response.json()["context_pressure"] == "danger"

    handoff_response = client.post(
        f"/v1/projects/{project_id}/handoffs",
        json={
            "app_id": "demo",
            "source_tool": "claude",
            "target_tool": "codex",
            "session_id": session_response.json()["id"],
            "goal": "Wire project context into MCP.",
            "current_state": "Claude added project detection and needs Codex to finish tests.",
            "decisions": ["Project folder identity is the source of truth."],
            "next_steps": ["Run MCP tests.", "Document Claude to Codex workflow."],
            "tests_run": ["pytest apps/api/app/tests/test_project_context.py"],
        },
    )
    assert handoff_response.status_code == 201
    handoff_id = handoff_response.json()["id"]

    latest = client.get(f"/v1/projects/{project_id}/handoffs?app_id=demo")
    assert latest.status_code == 200
    assert latest.json()[0]["id"] == handoff_id

    continued = client.post(
        f"/v1/handoffs/{handoff_id}/continue-prompt",
        json={"app_id": "demo", "target_tool": "codex"},
    )
    assert continued.status_code == 200
    prompt = continued.json()["continuation_prompt"]
    assert "Run MCP tests." in prompt
    assert "Source tool: claude" in prompt
    assert f"project `{project_id}`" in prompt
