"""Entry point: ``python -m evals`` runs every registered eval."""

from __future__ import annotations

import argparse
import importlib
from typing import Any

REGISTRY: dict[str, str] = {
    "token_savings": "evals.token_savings_eval.run",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Run N0Tune evaluations.")
    parser.add_argument(
        "eval",
        nargs="?",
        choices=list(REGISTRY) + ["all"],
        default="all",
        help="Eval to run. Defaults to 'all'.",
    )
    args = parser.parse_args()

    targets = list(REGISTRY) if args.eval == "all" else [args.eval]
    reports: list[dict[str, Any]] = []
    for name in targets:
        module = importlib.import_module(REGISTRY[name])
        report = module.run()
        from evals.harness import emit_report

        emit_report(name, report)
        reports.append(report)

    print("Total scenarios run:", sum(len(r.get("scenarios", [])) for r in reports))


if __name__ == "__main__":
    main()
