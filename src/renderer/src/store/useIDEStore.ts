import { create } from 'zustand';

export type ActivityBarItem = 'EXPLORER' | 'STEPS';

export interface Tab {
  id: string;
  type: 'FILE' | 'STEP' | 'FLOW';
  title: string;
  path?: string; // For FILE
  stepId?: string; // For STEP/FLOW
  isDirty?: boolean;
}

export interface Annotation {
  id: string;
  message: string;
  type?: 'info' | 'warning' | 'error';
  duration?: number; // ms to auto-close
}

interface IDEStore {
  activeFileId: string | null;  // Legacy: keeps track of active "File" path if active tab is FILE
  openFiles: string[];          // Legacy: list of open file paths
  activeActivity: ActivityBarItem;
  
  tabs: Tab[];
  activeTabId: string | null;
  annotations: Annotation[];

  // Actions
  setActiveActivity: (item: ActivityBarItem) => void;
  
  // Legacy File API (Adapts to Tabs)
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;

  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;

  addAnnotation: (message: string, type?: Annotation['type'], duration?: number) => void;
  removeAnnotation: (id: string) => void;
}

export const useIDEStore = create<IDEStore>((set, get) => ({
  activeFileId: null,
  openFiles: [],
  activeActivity: 'EXPLORER',
  
  tabs: [],
  activeTabId: null,
  annotations: [],

  setActiveActivity: (item) => set({ activeActivity: item }),
  
  // Legacy File implementations adapting to Tabs
  openFile: (path) => {
     // Check if tab exists
     const { tabs, openTab } = get();
     const existing = tabs.find(t => t.id === path && t.type === 'FILE');
     if (existing) {
        set({ activeTabId: path, activeFileId: path });
     } else {
        // Create new tab
        const name = path.split(/[\\/]/).pop() || path;
        openTab({ id: path, type: 'FILE', title: name, path });
     }
     
     // also update openFiles cache?
     set(state => {
         if (!state.openFiles.includes(path)) return { openFiles: [...state.openFiles, path] };
         return {};
     });
  },

  closeFile: (path) => {
     get().closeTab(path);
     set(state => ({ openFiles: state.openFiles.filter(p => p !== path) }));
  },

  setActiveFile: (path) => {
     if (path) get().openFile(path);
     else set({ activeFileId: null });
  },

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find(t => t.id === tab.id);
    if (existing) {
      set({ activeTabId: existing.id });
    } else {
      set({ 
         tabs: [...tabs, tab],
         activeTabId: tab.id
      });
    }
    // Sync activeFileId for legacy components
    if (tab.type === 'FILE' && tab.path) {
       set({ activeFileId: tab.path });
    } else {
       set({ activeFileId: null });
    }
  },

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.tabs.filter(t => t.id !== id);
      let newActiveId = state.activeTabId;
      if (id === state.activeTabId) {
         newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      
      // Update active file if needed
      const newActiveTab = newTabs.find(t => t.id === newActiveId);
      const newActiveFile = (newActiveTab?.type === 'FILE') ? newActiveTab.path : null;

      return { tabs: newTabs, activeTabId: newActiveId, activeFileId: newActiveFile || null };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
    const tab = get().tabs.find(t => t.id === id);
    if (tab?.type === 'FILE' && tab.path) {
       set({ activeFileId: tab.path });
    } else {
       set({ activeFileId: null });
    }
  },

  addAnnotation: (message, type = 'info', duration = 3000) => {
     const id = Math.random().toString(36).substr(2, 9);
     const newAnn: Annotation = { id, message, type, duration };
     
     set(state => ({ annotations: [...state.annotations, newAnn] }));

     if (duration > 0) {
        setTimeout(() => {
           set(state => ({ annotations: state.annotations.filter(a => a.id !== id) }));
        }, duration);
     }
  },

  removeAnnotation: (id) => set(state => ({ 
     annotations: state.annotations.filter(a => a.id !== id) 
  }))
}));
