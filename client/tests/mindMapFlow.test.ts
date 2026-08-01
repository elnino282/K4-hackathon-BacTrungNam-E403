import assert from "node:assert/strict";
import test from "node:test";

import { toMindMapFlow } from "../src/lib/mindMapFlow";


const root = {
  id: "root",
  title: "Root",
  summary: "Root summary",
  pageReferences: [1],
  children: [{
    id: "chapter",
    title: "Chapter",
    summary: "Chapter summary",
    pageReferences: [2],
    children: [{
      id: "detail",
      title: "Detail",
      summary: "Detail summary",
      pageReferences: [3],
      children: [],
    }],
  }],
};

test("thu gọn node chỉ ẩn hậu duệ và vẫn giữ cạnh từ node cha", () => {
  const graph = toMindMapFlow(root, new Set(["chapter"]), "chapter");
  assert.deepEqual(graph.nodes.map((node) => node.id), ["root", "chapter"]);
  assert.deepEqual(graph.edges.map((edge) => edge.id), ["root-chapter"]);
  assert.equal(graph.nodes[1].data.selected, true);
});
