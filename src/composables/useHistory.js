
import { ref, watch } from 'vue';

const HISTORY_KEY = 'sbm_app_history';

export function useHistory() {
  const history = ref([]);

  // Load from local storage on init
  const loadHistory = () => {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        history.value = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse history", e);
        history.value = [];
      }
    }
  };

  // Save to local storage whenever history changes
  watch(history, (newVal) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newVal));
  }, { deep: true });

  const addToHistory = (config, type = 'auto', name = null) => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    
    const newItem = {
      id,
      timestamp,
      type,
      name: name || (type === 'auto' ? `Auto-save ${new Date(timestamp).toLocaleTimeString()}` : `Config ${new Date(timestamp).toLocaleTimeString()}`),
      config: JSON.parse(JSON.stringify(config)) // Deep copy
    };

    history.value.unshift(newItem);
    
    // Limit auto-saves to last 20 to prevent bloat? changing to 50
    if (history.value.length > 50) {
        history.value.pop();
    }
  };

  const deleteFromHistory = (id) => {
    history.value = history.value.filter(item => item.id !== id);
  };

  const clearHistory = () => {
    history.value = [];
  };

  // Load immediately
  loadHistory();

  return {
    history,
    addToHistory,
    deleteFromHistory,
    clearHistory
  };
}
