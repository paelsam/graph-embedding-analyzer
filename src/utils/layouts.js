import { circlepack } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';

/**
 * Applies a random layout to the graph.
 * @param {Graph} graph 
 */
export function applyRandomLayout(graph) {
  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, 'x', Math.random());
    graph.setNodeAttribute(node, 'y', Math.random());
  });
}

/**
 * Applies a circular layout to the graph.
 * @param {Graph} graph 
 */
export function applyCircularLayout(graph) {
  circlepack.assign(graph);
}

/**
 * Applies the ForceAtlas2 layout.
 * @param {Graph} graph 
 * @param {number} iterations 
 */
export function applyForceAtlas2(graph, iterations = 50) {
  forceAtlas2.assign(graph, { iterations, settings: forceAtlas2.inferSettings(graph) });
}

/**
 * Applies a layout where nodes are grouped by their block.
 * @param {Graph} graph 
 * @param {number} k - Number of blocks
 */
export function applyBlockGroupedLayout(graph, k) {
  // Calculate centers for each block in a circle
  const centers = [];
  const radius = 0.5; // Radius of the circle of centers
  const centerX = 0.5;
  const centerY = 0.5;

  for (let i = 0; i < k; i++) {
    const angle = (2 * Math.PI * i) / k;
    centers.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }

  // Place nodes around their block center
  graph.forEachNode((node, attributes) => {
    const block = attributes.block;
    const center = centers[block % k];
    
    // Random offset within the block cluster
    const clusterRadius = 0.15; // Radius of the cluster
    const angle = Math.random() * 2 * Math.PI;
    const r = Math.sqrt(Math.random()) * clusterRadius;

    graph.setNodeAttribute(node, 'x', center.x + r * Math.cos(angle));
    graph.setNodeAttribute(node, 'y', center.y + r * Math.sin(angle));
  });
}
