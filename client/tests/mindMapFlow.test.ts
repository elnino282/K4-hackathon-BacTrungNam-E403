import assert from "node:assert/strict";
import test from "node:test";
import { toMindMapFlow } from "../src/lib/mindMapFlow";

const root = {
  id: "root", title: "Root", summary: "", pageReferences: [1],
  children: [{
    id: "chapter", title: "Chapter", summary: "", pageReferences: [1],
    children: [{ id: "detail", title: "Detail", summary: "", pageReferences: [2], children: [] }],
  }],
};

test("hides collapsed node descendants while retaining its parent edge", () => {
  const graph = toMindMapFlow(root, new Set(["chapter"]), null);
  assert.deepEqual(graph.nodes.map((node) => node.id), ["root", "chapter"]);
  assert.deepEqual(graph.edges.map((edge) => edge.id), ["root-chapter"]);
});
