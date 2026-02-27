
import Graph from 'graphology';

/**
 * Generates a Stochastic Block Model (SBM) graph.
 * 
 * @param {number} n - Total number of nodes.
 * @param {number[]} blockSizes - Array of sizes for each block. Sum must equal n.
 * @param {number[][]} pMatrix - k x k matrix where pMatrix[i][j] is the probability of an edge between block i and block j.
 * @returns {Graph} A graphology Graph instance.
 */
export function generateSBM(n, blockSizes, pMatrix) {
  if (blockSizes.reduce((a, b) => a + b, 0) !== n) {
    throw new Error("Sum of block sizes must equal total number of nodes n.");
  }
  
  const k = blockSizes.length;
  if (pMatrix.length !== k || pMatrix.some(row => row.length !== k)) {
     throw new Error("pMatrix dimensions must match the number of blocks.");
  }

  const graph = new Graph();
  
  // Create nodes with block assignment
  let nodeId = 0;
  const nodes = [];
  
  for (let b = 0; b < k; b++) {
    for (let i = 0; i < blockSizes[b]; i++) {
      const id = nodeId++;
      graph.addNode(id, { 
          label: `Node ${id}`,
          block: b,
          // Random initial position for visualization
          x: Math.random(), 
          y: Math.random(),
          size: 5,
          color: getColorForBlock(b)
      });
      nodes.push({ id, block: b });
    }
  }

  // Create edges based on probabilities
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
       const blockI = nodes[i].block;
       const blockJ = nodes[j].block;
       const prob = pMatrix[blockI][blockJ];
       
       if (Math.random() < prob) {
         graph.addEdge(nodes[i].id, nodes[j].id);
       }
    }
  }
  
  return graph;
}

function getColorForBlock(blockIndex) {
    const colors = ['#d62728', '#1f77b4', '#2ca02c', '#ff7f0e', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    return colors[blockIndex % colors.length];
}
