from fastapi.testclient import TestClient


def test_health_returns_phase_zero_status(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "test-request-id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request-id"

    body = response.json()
    assert body == {
        "status": "ok",
        "service": "n0tune-api",
        "version": "0.1.0",
        "phase": "7",
        "request_id": "test-request-id",
        "dependencies": {
            "database": "not_checked",
            "redis": "not_checked",
        },
    }


def test_deep_health_checks_dependencies(client: TestClient) -> None:
    response = client.get("/health?deep=true")

    assert response.status_code == 200
    body = response.json()
    assert body["dependencies"]["database"] in {"ok", "error"}
    assert body["dependencies"]["redis"] in {"ok", "error"}
