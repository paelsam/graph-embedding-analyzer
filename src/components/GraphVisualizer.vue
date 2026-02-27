<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import Sigma from 'sigma';
import Graph from 'graphology';
import { circlepack } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { NButton, NIcon } from 'naive-ui'; // Keeping imports just in case, though unused now (could clean up)

const props = defineProps({
  graph: {
    type: Object, // Graphology instance
    required: true
  },
  isDark: {
      type: Boolean,
      default: true
  }
});

const container = ref(null);
let renderer = null;

// State for interactions
const hoveredNode = ref(null); // Used for click selection now
const isDragging = ref(false);
const draggedNode = ref(null);

const initializeSigma = () => {
  if (renderer) {
    renderer.kill();
  }
  
  if (container.value && props.graph) {
    renderer = new Sigma(props.graph, container.value, {
        renderEdgeLabels: false,
    });

    // --- Click Logic ---
    renderer.on("clickNode", ({ node }) => {
        if (!isDragging.value) {
             setHoveredNode(node);
        }
    });

    renderer.on("clickStage", () => {
        setHoveredNode(null);
    });

    // --- Drag & Drop Logic ---
    renderer.on("downNode", (e) => {
        isDragging.value = true;
        draggedNode.value = e.node;
        if (!renderer.getCustomBBox()) renderer.getCamera().disable();
    });

    renderer.getMouseCaptor().on("mousemovebody", (e) => {
        if (!isDragging.value || !draggedNode.value) return;

        // Get new position from mouse
        const pos = renderer.viewportToGraph(e);
        props.graph.setNodeAttribute(draggedNode.value, "x", pos.x);
        props.graph.setNodeAttribute(draggedNode.value, "y", pos.y);

        // Prevent browser selection
        e.original.preventDefault();
        e.original.stopPropagation();
    });

    renderer.getMouseCaptor().on("mouseup", () => {
        if (isDragging.value) {
             isDragging.value = false;
             draggedNode.value = null;
             renderer.getCamera().enable();
        }
    });
  }
};

const setHoveredNode = (node) => {
    if (node) {
        hoveredNode.value = node;
        const neighbors = props.graph.neighbors(node);
        
        renderer.setSetting("nodeReducer", (node, data) => {
            if (node === hoveredNode.value || neighbors.includes(node)) {
                return { ...data, zIndex: 1, highlighted: true };
            }
            return { ...data, zIndex: 0, label: "", color: "#E0E0E0", image: null };
        });

        renderer.setSetting("edgeReducer", (edge, data) => {
            if (props.graph.hasExtremity(edge, hoveredNode.value)) {
                return { ...data, zIndex: 1 };
            }
            return { ...data, zIndex: 0, hidden: true };
        });
    } else {
        hoveredNode.value = null;
        renderer.setSetting("nodeReducer", null);
        renderer.setSetting("edgeReducer", null);
    }
};

// Handle Theme Changes
watch(() => props.isDark, (isDark) => {
    if (container.value) {
        container.value.style.backgroundColor = isDark ? '#2c2c32' : '#ffffff';
    }
    if (renderer) {
        renderer.refresh();
    }
}, { immediate: true });


onMounted(() => {
  initializeSigma();
});

watch(() => props.graph, () => {
    initializeSigma();
}, { deep: false });

onBeforeUnmount(() => {
  if (renderer) {
    renderer.kill();
  }
});
</script>

<template>
  <div class="visualizer-wrapper">
      <div ref="container" class="sigma-container" :class="{ 'dark-bg': isDark }"></div>
  </div>
</template>

<style scoped>
.visualizer-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

.sigma-container {
  width: 100%;
  height: 100%; /* Fill the parent container */
  background-color: #2c2c32; /* Default dark */
  border-radius: 4px; /* Optional: match Naive UI card radius */
  transition: background-color 0.3s ease;
}
.sigma-container.dark-bg {
    background-color: #2c2c32;
}

.controls-overlay {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;
}
</style>
