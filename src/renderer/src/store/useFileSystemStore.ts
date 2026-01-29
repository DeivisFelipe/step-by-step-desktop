import { create } from 'zustand';
import { FileSystem, Snapshots } from '../types/schema';

// We now support "Real FS" mode where 'files' might be just a cache of open files
// and we have a rootPath.

interface FileSystemState {
  rootPath: string | null;
  files: FileSystem; // Cache of OPEN files content
  fileTree: FileNode[]; // Directory structure
  
  // Actions
  setRootPath: (path: string) => void;
  loadDir: (path: string) => Promise<void>;
  
  toggleDirectory: (path: string) => void;

  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  saveFile: (path: string, content: string) => Promise<void>;
  createFile: (path: string, content?: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  deleteNode: (path: string) => Promise<void>;
  renameNode: (oldPath: string, newPath: string) => Promise<void>;
  
  // Keep snapshots logic? 
  // User asked for "Snapshots" support.
  // With Real FS, snapshots are harder (need strict backups).
  // For MVP refactor, we might disable snapshots or just warn.
  snapshots: Snapshots;
  saveSnapshot: (stepId: string) => void;
  restoreSnapshot: (stepId: string) => void;
}

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  rootPath: null,
  files: {},
  fileTree: [],
  snapshots: {},

  setRootPath: (path) => set({ rootPath: path }),

  toggleDirectory: (path) => {
     set((state) => {
        const toggleNode = (nodes: FileNode[]): FileNode[] => {
           return nodes.map(node => {
              if (node.path === path) {
                 return { ...node, isExpanded: !node.isExpanded };
              }
              if (node.children) {
                 return { ...node, children: toggleNode(node.children) };
              }
              return node;
           });
        };
        return { fileTree: toggleNode(state.fileTree) };
     });
  },

  loadDir: async (path) => {
    // Read dir via API
    try {
      const items = await window.api.readDir(path);
      // Sort: folders first
      items.sort((a, b) => {
         if (a.isDirectory && !b.isDirectory) return -1;
         if (!a.isDirectory && b.isDirectory) return 1;
         return a.name.localeCompare(b.name);
      });
      
      const nodes: FileNode[] = items.map(item => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory,
        children: item.isDirectory ? [] : undefined // placeholder
      }));

      // If we are refreshing root
      if (path === get().rootPath) {
         set({ fileTree: nodes });
      } else {
         // Update sub-tree
         set((state) => {
             const updateTree = (list: FileNode[]): FileNode[] => {
                return list.map(node => {
                   if (node.path === path) {
                      return { ...node, children: nodes, isExpanded: true };
                   }
                   if (node.children) {
                      return { ...node, children: updateTree(node.children) };
                   }
                   return node;
                });
             };
             return { fileTree: updateTree(state.fileTree) };
         });
      }
    } catch (e) {
      console.error("Failed to read dir", e);
    }
  },

  openFile: async (path) => {
    // Check if already open
    if (get().files[path]?.isOpen) return;

    try {
      const content = await window.api.readFile(path);
      // Detect language extension
      const ext = path.split('.').pop() || 'plaintext';
      const language = getLanguageFromExt(ext);

      set((state) => ({
        files: {
          ...state.files,
          [path]: {
             content,
             language,
             isOpen: true
          }
        }
      }));
    } catch (e) {
      console.error("Failed to open file", e);
    }
  },

  closeFile: (path) => {
    set((state) => {
       const newFiles = { ...state.files };
       if (newFiles[path]) {
          newFiles[path] = { ...newFiles[path], isOpen: false };
       }
       return { files: newFiles };
    });
  },

  saveFile: async (path, content) => {
     await window.api.writeFile(path, content);
     set((state) => ({
        files: {
           ...state.files,
           [path]: { ...state.files[path], content }
        }
     }));
  },

  createFile: async (path, content = '') => {
    await window.api.writeFile(path, content);
    await get().openFile(path);
    // Reload parent?
    // For now rely on manual refresh or caller to reload parent. 
    // Ideally we deduce parent and reload.
    // const parent = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
    // if (parent) get().loadDir(parent);
  },

  createDirectory: async (path) => {
    await window.api.createDir(path);
    // Reload parent?
  },

  deleteNode: async (path) => {
    await window.api.delete(path);
    get().closeFile(path);
    // Reload parent?
  },

  renameNode: async (oldPath, newPath) => {
    await window.api.rename(oldPath, newPath);
    const { files, closeFile, openFile } = get();
    if (files[oldPath]?.isOpen) {
       // Re-open with new path
       closeFile(oldPath);
       await openFile(newPath);
    }
  },

  saveSnapshot: (_stepId) => {
    // TODO: Implement Real FS snapshot (maybe Git integration?)
    console.warn("Snapshots on Real FS not fully implemented");
  },

  restoreSnapshot: (_stepId) => {
    console.warn("Snapshots on Real FS not fully implemented");
  }
}));

function getLanguageFromExt(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript', ts: 'typescript', py: 'python', 
    html: 'html', css: 'css', json: 'json', md: 'markdown'
  };
  return map[ext] || 'plaintext';
}
