import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { MindMapNode } from "./mindMap";

export interface MindMapFlowNodeData extends Record<string, unknown> {
  title: string;
  summary: string;
  pageReferences: number[];
  collapsed: boolean;
  hasChildren: boolean;
  selected: boolean;
  depth: number;
}

const NODE_WIDTH = 230;
const NODE_HEIGHT = 120;

export function toMindMapFlow(
  root: MindMapNode,
  collapsedIds: ReadonlySet<string>,
  selectedId: string | null,
): { nodes: Node<MindMapFlowNodeData>[]; edges: Edge[] } {
  const visible: { node: MindMapNode; depth: number }[] = [];
  const edges: Edge[] = [];
  
  const visit = (node: MindMapNode, depth: number, parentId?: string) => {
    visible.push({ node, depth });
    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#818cf8", strokeWidth: 2, opacity: 0.8 },
      });
    }
    if (!collapsedIds.has(node.id)) {
      node.children.forEach((child) => visit(child, depth + 1, node.id));
    }
  };
  visit(root, 0);

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80, marginx: 24, marginy: 24 });
  visible.forEach(({ node }) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  return {
    edges,
    nodes: visible.map(({ node, depth }) => {
      const position = graph.node(node.id);
      return {
        id: node.id,
        type: "mindMapNode",
        position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
        data: {
          title: node.title,
          summary: node.summary,
          pageReferences: node.pageReferences,
          collapsed: collapsedIds.has(node.id),
          hasChildren: node.children.length > 0,
          selected: selectedId === node.id,
          depth,
        },
      };
    }),
  };
}
