<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { generateSBM } from './utils/sbm';
import { applyRandomLayout, applyCircularLayout, applyForceAtlas2, applyBlockGroupedLayout } from './utils/layouts';
import { useHistory } from './composables/useHistory';
import GraphVisualizer from './components/GraphVisualizer.vue';
import { 
  NConfigProvider, NGlobalStyle, NCard, NGrid, NGi, 
  NInputNumber, NSlider, NSwitch, NButton, NSpace, NText, NH2, NH3,
  darkTheme, lightTheme, NSelect, NIcon, NModal, NList, NListItem, NThing, NTag, NInput,
  NSpin, NStatistic, NRadioGroup, NRadioButton
} from 'naive-ui';

const n = ref(100);
const k = ref(3);
const blockSizes = ref([]); 
const pIn = ref(0.2);
const pOut = ref(0.01);
const useMatrix = ref(false); 
const pMatrix = ref([]);
const graph = ref(null);
const isDark = ref(true);

const { history, addToHistory, deleteFromHistory, clearHistory } = useHistory();
const showHistory = ref(false);
const showSaveModal = ref(false);
const saveName = ref('');

// Polarization State
const polarization = ref(null);
const loadingPolarization = ref(false);
const svdKMethod = ref('full'); // 'full' or 'custom'
const customKValue = ref(50);

const layoutOptions = [
    { label: 'Block Grouped', value: 'grouped' },
    { label: 'ForceAtlas2', value: 'forceAtlas2' },
    { label: 'Circular', value: 'circular' },
    { label: 'Random', value: 'random' }
];
const selectedLayout = ref('grouped');

const theme = computed(() => isDark.value ? darkTheme : lightTheme);

// Initialize or update arrays when n or k changes
const updateParams = () => {
  // Update block sizes to roughly equal distribution
  const size = Math.floor(n.value / k.value);
  const remainder = n.value % k.value;
  const newBlockSizes = new Array(k.value).fill(size);
  for (let i = 0; i < remainder; i++) {
    newBlockSizes[i]++;
  }
  blockSizes.value = newBlockSizes;

  // Update pMatrix (k x k)
  const newMatrix = [];
  for (let i = 0; i < k.value; i++) {
    const row = [];
    for (let j = 0; j < k.value; j++) {
      if (i === j) row.push(pIn.value);
      else row.push(pOut.value);
    }
    newMatrix.push(row);
  }
  pMatrix.value = newMatrix;
};

const autoSaveEnabled = ref(true);

const CONFIG_STORAGE_KEY = 'sbm_app_current_config';

const saveCurrentConfig = () => {
    const config = {
        n: n.value,
        k: k.value,
        blockSizes: blockSizes.value,
        pIn: pIn.value,
        pOut: pOut.value,
        useMatrix: useMatrix.value,
        pMatrix: pMatrix.value,
        selectedLayout: selectedLayout.value,
        isDark: isDark.value,
        svdKMethod: svdKMethod.value,
        customKValue: customKValue.value,
        autoSaveEnabled: autoSaveEnabled.value
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
};

const loadCurrentConfig = () => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (config.n) n.value = config.n;
            if (config.k) k.value = config.k;
            // Arrays need careful handling to avoid reactivity issues/overwrites
            if (config.blockSizes) blockSizes.value = [...config.blockSizes];
            if (config.pIn !== undefined) pIn.value = config.pIn;
            if (config.pOut !== undefined) pOut.value = config.pOut;
            if (config.useMatrix !== undefined) useMatrix.value = config.useMatrix;
            if (config.pMatrix) pMatrix.value = JSON.parse(JSON.stringify(config.pMatrix));
            if (config.selectedLayout) selectedLayout.value = config.selectedLayout;
            if (config.isDark !== undefined) isDark.value = config.isDark;
            if (config.svdKMethod) svdKMethod.value = config.svdKMethod;
            if (config.customKValue) customKValue.value = config.customKValue;
            if (config.autoSaveEnabled !== undefined) autoSaveEnabled.value = config.autoSaveEnabled;
            
            return true; // Config loaded
        } catch (e) {
            console.error("Failed to load config", e);
        }
    }
    return false; // No config loaded
};

// Initial setup
onMounted(() => {
    const loaded = loadCurrentConfig();
    if (!loaded) {
        // If no saved config, initialize defaults
        updateParams();
    } 
    generateGraph();
});

watch([n, k], () => {
    updateParams();
    saveCurrentConfig(); // Save after params update
});

// Deep watch for array/object changes
watch([blockSizes, pIn, pOut, useMatrix, pMatrix, selectedLayout, isDark, svdKMethod, customKValue, autoSaveEnabled], () => {
    // Logic for matrix update is handled in the other watch, this is just for saving
    saveCurrentConfig();
}, { deep: true });

watch([pIn, pOut, useMatrix], () => {
    if (!useMatrix.value) {
        // If not using custom matrix, update the matrix based on pIn/pOut
        // We only update if k matches pMatrix size to avoid race conditions with k watcher
        if (pMatrix.value.length === k.value) {
             for (let i = 0; i < k.value; i++) {
                for (let j = 0; j < k.value; j++) {
                    pMatrix.value[i][j] = (i === j) ? pIn.value : pOut.value;
                }
            }
        }
    }
    saveCurrentConfig();
}, { deep: true });

const applyLayout = () => {
    if (!graph.value) return;

    switch (selectedLayout.value) {
        case 'grouped':
            applyBlockGroupedLayout(graph.value, k.value);
            break;
        case 'forceAtlas2':
            applyRandomLayout(graph.value); // Randomize first to avoid local minima
            applyForceAtlas2(graph.value, 100);
            break;
        case 'circular':
            applyCircularLayout(graph.value);
            break;
        case 'random':
            applyRandomLayout(graph.value);
            break;
    }
};

const getAdjacencyMatrix = () => {
    if (!graph.value) return [];
    const nodes = graph.value.nodes();
    const adj = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));
    
    // Map node ID to index
    const nodeToIndex = {};
    nodes.forEach((node, i) => {
        nodeToIndex[node] = i;
    });

    graph.value.forEachEdge((edge, attributes, source, target) => {
        const i = nodeToIndex[source];
        const j = nodeToIndex[target];
        adj[i][j] = 1;
        adj[j][i] = 1; // Assuming undirected
    });
    
    return adj;
};

const calculatePolarization = async () => {
    if (!graph.value) return;
    
    loadingPolarization.value = true;
    polarization.value = null;
    
    try {
        const adjMatrix = getAdjacencyMatrix();
        const backendURL = import.meta.env.VITE_BACKEND_URL || '';
        
        let kParam = null;
        if (svdKMethod.value === 'custom') {
            kParam = customKValue.value;
        }
        // If 'full', we send k=null (or don't send it), and backend defaults to n.
        
        const payload = { adj_matrix: adjMatrix };
        if (kParam !== null) {
            payload.k = kParam;
        }
        
        const response = await fetch(`${backendURL}/api/polarization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Backend Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        polarization.value = data.polarization; // Expected to be d_hat
        
    } catch (e) {
        console.error("Polarization calculation failed:", e);
        alert("Failed to calculate polarization. Ensure backend is running.");
    } finally {
        loadingPolarization.value = false;
    }
};

const generateGraph = () => {
  try {
    graph.value = generateSBM(n.value, blockSizes.value, pMatrix.value);
    applyLayout();
    
    // Reset polarization result on new graph
    polarization.value = null;
    
    // Auto-save history if enabled
    if (autoSaveEnabled.value) {
        addToHistory({
            n: n.value,
            k: k.value,
            blockSizes: [...blockSizes.value],
            pIn: pIn.value,
            pOut: pOut.value,
            useMatrix: useMatrix.value,
            pMatrix: JSON.parse(JSON.stringify(pMatrix.value)),
            selectedLayout: selectedLayout.value,
            svdKMethod: svdKMethod.value,
            customKValue: customKValue.value
        }, 'auto');
    }
    
    saveCurrentConfig(); // Ensure config is saved on generation

  } catch (e) {
    console.error(e);
    alert(e.message);
  }
};

const openSaveModal = () => {
    saveName.value = '';
    showSaveModal.value = true;
};

const manualSave = () => {
    addToHistory({
        n: n.value,
        k: k.value,
        blockSizes: [...blockSizes.value],
        pIn: pIn.value,
        pOut: pOut.value,
        useMatrix: useMatrix.value,
        pMatrix: JSON.parse(JSON.stringify(pMatrix.value)),
        selectedLayout: selectedLayout.value,
        svdKMethod: svdKMethod.value,
        customKValue: customKValue.value
    }, 'manual', saveName.value || 'Untitled Configuration');
    showSaveModal.value = false;
};

const restoreConfig = (config) => {
    n.value = config.n;
    k.value = config.k;
    blockSizes.value = config.blockSizes;
    pIn.value = config.pIn;
    pOut.value = config.pOut;
    useMatrix.value = config.useMatrix;
    pMatrix.value = config.pMatrix;
    selectedLayout.value = config.selectedLayout;
    if (config.svdKMethod) svdKMethod.value = config.svdKMethod;
    if (config.customKValue) customKValue.value = config.customKValue;
    if (config.autoSaveEnabled !== undefined) autoSaveEnabled.value = config.autoSaveEnabled;
    
    // Regenerate graph with restored settings
    try {
        graph.value = generateSBM(n.value, blockSizes.value, pMatrix.value);
         applyLayout();
    } catch (e) { console.error(e) }
    
    showHistory.value = false;
    saveCurrentConfig(); // Save restored config
};

watch(selectedLayout, () => {
    applyLayout();
    saveCurrentConfig();
});
</script>

<template>
  <n-config-provider :theme="theme">
    <n-global-style />
    <div class="main-layout" :class="{ 'light-mode': !isDark }">
      <div class="centered-container">
        
        <!-- Top Request Bar for History -->
        <div class="top-bar">
            <n-button @click="showHistory = true">History</n-button>
        </div>

        <n-grid x-gap="12" :y-gap="12" :cols="24" item-responsive responsive="screen" class="full-height">
          <!-- Graph Visualization (Left) -->
          <n-gi span="24 m:16" class="full-height">
            <n-card class="full-height-card graph-card" :bordered="false">
               <GraphVisualizer v-if="graph" :graph="graph" :is-dark="isDark" style="flex: 1; width: 100%; height: 100%;" />
               <div v-else class="empty-state">Generate a graph to visualize</div>
            </n-card>
          </n-gi>
          
          <!-- Configuration (Right) -->
          <n-gi span="24 m:8" class="full-height">
            <n-card title="RDPG+SVD Polarization Analysis" class="full-height-card config-card" :bordered="false">
                <template #header-extra>
                    <n-switch v-model:value="isDark">
                        <template #checked>Dark</template>
                        <template #unchecked>Light</template>
                    </n-switch>
                </template>
              <n-space vertical size="large">
                
                <n-space vertical>
                  <n-text strong>Total Nodes (n)</n-text>
                  <n-input-number v-model:value="n" :min="1" />
                </n-space>

                <n-space vertical>
                  <n-text strong>Number of Blocks (k)</n-text>
                  <n-input-number v-model:value="k" :min="1" :max="10" />
                </n-space>

                <n-space vertical>
                  <n-h3>Block Sizes</n-h3>
                  <div v-for="(size, index) in blockSizes" :key="index">
                     <n-space justify="space-between" align="center">
                       <n-text>Block {{ index }}</n-text>
                       <n-input-number v-model:value="blockSizes[index]" :min="1" size="small" style="width: 100px" />
                     </n-space>
                  </div>
                  <n-text type="error" v-if="blockSizes.reduce((a,b)=>a+b,0) !== n">
                    Sum must equal {{ n }} (current: {{ blockSizes.reduce((a,b)=>a+b,0) }})
                  </n-text>
                </n-space>

                <n-space vertical>
                  <n-h3>Probabilities</n-h3>
                  <n-space align="center">
                     <n-switch v-model:value="useMatrix" />
                     <n-text>Custom Matrix</n-text>
                  </n-space>
                  
                  <div v-if="!useMatrix">
                      <n-space vertical>
                        <n-text>P_in (within block)</n-text>
                        <n-slider v-model:value="pIn" :min="0" :max="1" :step="0.01" />
                        <n-input-number v-model:value="pIn" :min="0" :max="1" :step="0.01" />
                      </n-space>
                      <n-space vertical>
                         <n-text>P_out (between blocks)</n-text>
                         <n-slider v-model:value="pOut" :min="0" :max="1" :step="0.01" />
                         <n-input-number v-model:value="pOut" :min="0" :max="1" :step="0.01" />
                      </n-space>
                  </div>
                  
                  <div v-else class="matrix-container">
                      <!-- Column Headers -->
                      <div class="matrix-header-row">
                          <div class="matrix-cell-empty"></div> <!-- Top-left corner -->
                          <div v-for="i in k" :key="'col-'+i" class="matrix-header-col">
                              <n-text depth="3" class="matrix-label">B{{ i-1 }}</n-text>
                          </div>
                      </div>
                      
                      <!-- Matrix Rows -->
                      <div v-for="(row, i) in pMatrix" :key="i" class="matrix-row">
                          <!-- Row Header -->
                          <div class="matrix-header-row-label">
                              <n-text depth="3" class="matrix-label">B{{ i }}</n-text>
                          </div>
                          <!-- Cells -->
                          <div v-for="(val, j) in row" :key="j" class="matrix-cell">
                              <n-input-number 
                                v-model:value="pMatrix[i][j]" 
                                :min="0" :max="1" :step="0.01" 
                                :show-button="false"
                                size="tiny"
                                :bordered="false"
                                style="text-align: center;"
                              />
                          </div>
                      </div>
                  </div>
                </n-space>

                <n-space vertical>
                    <n-h3>Layout</n-h3>
                    <n-select v-model:value="selectedLayout" :options="layoutOptions" />
                </n-space>

                 <!-- Polarization Analysis -->
                <n-card size="small" title="Analysis Settings" embedded :bordered="false" style="background: rgba(128,128,128,0.1)">
                    <n-space vertical>
                        <n-text strong>SVD Embedding Dimension (k)</n-text>
                        <n-space>
                            <n-radio-group v-model:value="svdKMethod" name="svdkmethod">
                                <n-radio-button value="full">Full Rank (All Nodes)</n-radio-button>
                                <n-radio-button value="custom">Custom Value</n-radio-button>
                            </n-radio-group>
                        </n-space>
                        <n-input-number 
                            v-if="svdKMethod === 'custom'" 
                            v-model:value="customKValue" 
                            :min="1" 
                            :max="n" 
                            placeholder="Enter k"
                        />

                        <n-button 
                            secondary 
                            type="info" 
                            block 
                            @click="calculatePolarization" 
                            :loading="loadingPolarization"
                            style="margin-top: 10px;"
                        >
                            Calculate Polarization (d_hat)
                        </n-button>
                        
                        <n-spin :show="loadingPolarization">
                            <n-statistic label="Optimization Result" v-if="polarization !== null">
                                <template #prefix>Embedding dimension (d_hat) =</template>
                                {{ polarization }}
                            </n-statistic>
                            <div v-else-if="!loadingPolarization" style="height: 20px;"></div>
                        </n-spin>
                    </n-space>
                </n-card>

                <n-space vertical>
                    <n-button type="primary" block @click="generateGraph">
                      Generate Graph
                    </n-button>
                    <n-button block @click="openSaveModal">
                      Save Configuration
                    </n-button>
                </n-space>

              </n-space>
            </n-card>
          </n-gi>
        </n-grid>
      </div>

      <!-- History Modal -->
      <n-modal v-model:show="showHistory" preset="card" title="Configuration History" style="width: 600px;">
          <n-space v-if="history.length > 0" vertical>
              <n-button size="small" @click="clearHistory">Clear History</n-button>
              <n-list hoverable clickable>
                  <n-list-item v-for="item in history" :key="item.id">
                      <n-thing :title="item.name" content-style="margin-top: 10px;">
                          <template #description>
                              <n-space size="small">
                                  <n-tag :type="item.type === 'manual' ? 'success' : 'info'" size="small">
                                      {{ item.type }}
                                  </n-tag>
                                  <n-text depth="3">{{ new Date(item.timestamp).toLocaleString() }}</n-text>
                              </n-space>
                          </template>
                           <template #header-extra>
                               <n-space>
                                   <n-button size="small" type="primary" @click="restoreConfig(item.config)">Restore</n-button>
                                   <n-button size="small" type="error" @click="deleteFromHistory(item.id)">Delete</n-button>
                               </n-space>
                           </template>
                           <n-text depth="3">
                               n={{ item.config.n }}, k={{ item.config.k }}, layout={{ item.config.selectedLayout }}
                           </n-text>
                      </n-thing>
                  </n-list-item>
              </n-list>
          </n-space>
          <div v-else class="empty-history">
              No history available.
          </div>
      </n-modal>

      <!-- Save Config Modal -->
      <n-modal v-model:show="showSaveModal" preset="card" title="Save Configuration" style="width: 400px;">
          <n-space vertical>
              <n-input v-model:value="saveName" placeholder="Configuration Name" />
              <n-button type="primary" block @click="manualSave" :disabled="!saveName">Save</n-button>
          </n-space>
      </n-modal>

    </div>
  </n-config-provider>
</template>

<style scoped>
.main-layout {
  height: 100dvh; /* Use dynamic viewport height */
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #101014; /* Match dark theme bg */
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden; /* Prevent body scroll */
}

.main-layout.light-mode {
    background-color: #f0f2f5; 
}

.top-bar {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
}

.centered-container {
  width: 95vw; 
  height: 95dvh; /* Use dynamic viewport height */
  max-width: 1800px; /* Relaxed max width */
  max-height: 1000px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

@media (max-width: 768px) {
    .centered-container {
        width: 100%;
        height: 100dvh; /* Full height on mobile */
        max-height: none; /* Allow full height on mobile */
        padding: 10px;
    }
    .main-layout {
        overflow-y: auto; /* Allow body scroll on mobile */
    }
    .graph-card {
        min-height: 400px;
    }
}

@media (min-width: 1024px) {
    .centered-container {
        width: 85%;
        height: 85dvh;
    }
}

.full-height {
  height: 100%;
  min-height: 0; /* Crucial for scrolling inside flex/grid items */
}

/* Ensure grid fits in container */
.centered-container > .n-grid {
    flex: 1;
    min-height: 0;
}

.full-height-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.full-height-card :deep(.n-card-header) {
  flex-shrink: 0;
}

.full-height-card :deep(.n-card__content) {
  flex-grow: 1;
  overflow: hidden; 
  display: flex;
  flex-direction: column;
}

.graph-card :deep(.n-card__content) {
    padding: 0;
}

.config-card :deep(.n-card__content) {
    overflow-y: auto;
    padding: 24px; /* default padding */
}

.matrix-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    align-items: flex-start; /* Align to left */
}

.matrix-header-row {
    display: flex;
    gap: 4px;
}

.matrix-row {
    display: flex;
    gap: 4px;
    align-items: center;
}

.matrix-cell, .matrix-header-col, .matrix-cell-empty, .matrix-header-row-label {
    width: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.matrix-header-row-label {
    justify-content: flex-end;
    padding-right: 8px;
}

.matrix-label {
    font-size: 12px;
    font-weight: bold;
}

.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: #666;
}

.empty-history {
    text-align: center;
    padding: 20px;
    color: #666;
}
</style>
