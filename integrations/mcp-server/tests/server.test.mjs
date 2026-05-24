import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { toolDefinitions } from "../src/server.mjs";

describe("N0Tune MCP server", () => {
  it("exposes the required tools", () => {
    const names = toolDefinitions.map((tool) => tool.name);
    assert.deepEqual(names, [
      "n0tune_search_memories",
      "n0tune_save_memory",
      "n0tune_get_style_profile",
      "n0tune_search_docs",
      "n0tune_context_preview",
      "n0tune_forget_memory",
      "n0tune_get_persona",
      "n0tune_alignment_check",
      "n0tune_project_detect",
      "n0tune_get_project_context",
      "n0tune_create_handoff_capsule",
      "n0tune_get_latest_handoff",
      "n0tune_list_handoffs",
      "n0tune_continue_from_handoff",
      "n0tune_save_project_memory",
      "n0tune_search_project_memory",
    ]);
  });
});
