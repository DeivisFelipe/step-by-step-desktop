import { create } from 'zustand';
import { LessonNode } from '../types/schema';
import { v4 as uuidv4 } from 'uuid';

interface LessonStore {
  tree: LessonNode[];
  selectedNodeId: string | null;
  
  // Actions
  setTree: (tree: LessonNode[]) => void;
  addNode: (parentId: string | null, type: 'FLOW' | 'STEP', title?: string) => void;
  updateNode: (id: string, updates: Partial<LessonNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  moveNode: (activeId: string, overId: string) => void;
  moveNodeToFront: (id: string, parentId: string) => void;
  reorderNode: (id: string, direction: 'up' | 'down') => void;
  lastExecutedStepId: string | null;
  setLastExecutedStepId: (id: string | null) => void;
}

const INITIAL_TREE: LessonNode[] = [
  {
    id: 'root-flow',
    parentId: null,
    type: 'FLOW',
    title: 'Welcome to CodeLesson',
    isExpanded: true,
    children: []
  }
];

export const useLessonStore = create<LessonStore>((set, _get) => ({
  tree: INITIAL_TREE,
  selectedNodeId: null,
  lastExecutedStepId: null,

  setTree: (tree) => set({ tree }),
  setLastExecutedStepId: (id) => set({ lastExecutedStepId: id }),

  addNode: (parentId, type, title) => {
    // Enforce Flow Constraint: Flow cannot be inside a Flow (so parentId must be null for FLOW)
    if (type === 'FLOW' && parentId !== null) {
       console.warn("Cannot create a Flow inside another Flow");
       return;
    }

    const newNode: LessonNode = {
      id: uuidv4(),
      parentId,
      type,
      title: title || (type === 'FLOW' ? 'New Flow' : 'New Step'),
      children: type === 'FLOW' ? [] : undefined,
      isExpanded: true,
      data: type === 'STEP' ? {
        enableSnapshot: false,
        action: {
          kind: 'FILE',
          targetMode: 'ACTIVE_FILE',
          operation: 'APPEND',
          content: '// Code here',
          config: { typingAnimation: true }
        }
      } : undefined
    };

    set((state) => {
      // Helper to traverse and add
      const addChild = (nodes: LessonNode[]): LessonNode[] => {
        return nodes.map(node => {
          if (node.id === parentId) {
            return {
              ...node,
              children: [...(node.children || []), newNode],
              isExpanded: true
            };
          }
          if (node.children) {
            return { ...node, children: addChild(node.children) };
          }
          return node;
        });
      };
      
      if (parentId === null) {
        return { tree: [...state.tree, newNode] };
      }
      
      return { tree: addChild(state.tree) };
    });
  },

  updateNode: (id, updates) => {
    set((state) => {
      const updateRecursive = (nodes: LessonNode[]): LessonNode[] => {
        return nodes.map(node => {
          if (node.id === id) {
             // If updating data, merge it cautiously
             const newData = (updates.data && node.data) 
                ? { ...node.data, ...updates.data } 
                : updates.data || node.data;
             
             return { ...node, ...updates, data: newData };
          }
          if (node.children) {
            return { ...node, children: updateRecursive(node.children) };
          }
          return node;
        });
      };
      return { tree: updateRecursive(state.tree) };
    });
  },

  removeNode: (id) => {
    set((state) => {
       const removeRecursive = (nodes: LessonNode[]): LessonNode[] => {
         return nodes.filter(node => node.id !== id).map(node => {
           if (node.children) {
             return { ...node, children: removeRecursive(node.children) };
           }
           return node;
         });
       };
       return { tree: removeRecursive(state.tree) };
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  moveNode: (activeId, overId) => {
    // Keep legacy D&D logic for internal reordering if needed, or remove?
    // Maintaining it for now as "legacy" or if we add D&D back later.
    set((state) => {
      const newTree = JSON.parse(JSON.stringify(state.tree));
      let activeNode: LessonNode | null = null;
      const removeNode = (nodes: LessonNode[], id: string): LessonNode[] => {
        const filtered: LessonNode[] = [];
        for (const node of nodes) {
          if (node.id === id) {
            activeNode = node;
            continue;
          }
          if (node.children) {
            node.children = removeNode(node.children, id);
          }
          filtered.push(node);
        }
        return filtered;
      };
      const treeWithoutActive = removeNode(newTree, activeId);
      if (!activeNode) return state;
      const insertNode = (nodes: LessonNode[], id: string, nodeToInsert: LessonNode): boolean => {
         for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id) {
               nodes.splice(i + 1, 0, nodeToInsert);
               return true;
            }
            if (nodes[i].children) {
               if (insertNode(nodes[i].children!, id, nodeToInsert)) return true;
            }
         }
         return false;
      };
      insertNode(treeWithoutActive, overId, activeNode);
      return { tree: treeWithoutActive };
    });
  },

  moveNodeToFront: (id, parentId) => {
    set((state) => {
        const newTree = JSON.parse(JSON.stringify(state.tree));
        let activeNode: LessonNode | null = null;
        
        // 1. Remove
        const removeNode = (nodes: LessonNode[]): LessonNode[] => {
            const filtered: LessonNode[] = [];
            for (const node of nodes) {
                if (node.id === id) {
                    activeNode = node;
                    continue;
                }
                if (node.children) {
                    node.children = removeNode(node.children);
                }
                filtered.push(node);
            }
            return filtered;
        };
        const treeClean = removeNode(newTree);
        
        if (!activeNode) return state;

        // 2. Insert at front of parent
        const insertAtFront = (nodes: LessonNode[]): boolean => {
             for (const node of nodes) {
                 if (node.id === parentId) {
                     node.children = [activeNode!, ...(node.children || [])];
                     return true;
                 }
                 if (node.children && insertAtFront(node.children)) return true;
             }
             return false;
        };
        
        // Special case: parent is null (root level)? 
        if (parentId === null) {
             // Not supported for clean tree replacement here easily handled by logic above? 
             // Logic above works on 'nodes' array.
             // If parentId is null, we insert at root array?
             // But usually we are inside a flow.
             // Assume parentId is valid Flow ID.
        } else {
             insertAtFront(treeClean);
        }
        
        return { tree: treeClean };
    });
  },

  reorderNode: (id, direction) => {
    set((state) => {
       const reorderRecursive = (nodes: LessonNode[]): LessonNode[] => {
          const index = nodes.findIndex(n => n.id === id);
          if (index !== -1) {
             const newNodes = [...nodes];
             if (direction === 'up' && index > 0) {
                [newNodes[index - 1], newNodes[index]] = [newNodes[index], newNodes[index - 1]];
             } else if (direction === 'down' && index < newNodes.length - 1) {
                [newNodes[index], newNodes[index + 1]] = [newNodes[index + 1], newNodes[index]];
             }
             return newNodes;
          }
          // recurse
          return nodes.map(node => {
             if (node.children) {
                return { ...node, children: reorderRecursive(node.children) };
             }
             return node;
          });
       };

       return { tree: reorderRecursive(state.tree) };
    });
  }
}));
