import { useCallback, useMemo, useState, useEffect } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  Edge, 
  Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StepNode } from './StepNode';
import { StartNode } from './StartNode';
import { FlowContextMenu } from './FlowContextMenu';
import { useIDEStore } from '../../store/useIDEStore';
import { useLessonStore } from '../../store/useLessonStore';
import { v4 as uuidv4 } from 'uuid';

const nodeTypes = {
  step: StepNode,
  start: StartNode
};

const defaultEdgeOptions = {
    markerEnd: {
        type: MarkerType.ArrowClosed
    },
    type: 'smoothstep' 
};

// Layout constants
const START_X = 50;
const START_Y = 250; 
const NODE_SpacingX = 200;

const FlowEditor = () => {
  const { activeTabId, tabs, addAnnotation, openTab } = useIDEStore();
  const { tree, addNode, updateNode, removeNode, reorderNode, moveNode, moveNodeToFront } = useLessonStore(); 
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  
  // Robust Flow Detection: Try to match activeTab.id to a Flow Node in Tree
  // If not found, (or if activeTab is not set?), fallback to the first FLOW found (default behavior)
  const flowNode = useMemo(() => {
      // Recursive find
      const findFlow = (nodes: import('../../types/schema').LessonNode[]): import('../../types/schema').LessonNode | undefined => {
          for (const node of nodes) {
              if (node.type === 'FLOW' && (node.id === activeTabId || node.id === activeTab?.id)) {
                  return node;
              }
              if (node.children) {
                  const found = findFlow(node.children);
                  if (found) return found;
              }
          }
          return undefined;
      };
      
      let found = findFlow(tree);
      if (!found) {
          // Fallback: Find *any* flow if we are in a "Flow" tab context but ID might utilize path (legacy)
          // Or just default to root-flow for now if we only have one main flow.
          found = tree.find(n => n.type === 'FLOW');
      }
      return found;
  }, [tree, activeTabId, activeTab]);

  const steps = flowNode?.children || [];

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState<{ x: number, y: number, type: 'node' | 'pane' | 'edge', id?: string } | null>(null);

  // Sync Store -> ReactFlow
  useEffect(() => {
     if (!flowNode) return;

     const newNodes: Node[] = [];
     const newEdges: Edge[] = [];

     // 1. Add Start Node
     newNodes.push({
         id: 'start-node',
         type: 'start',
         position: { x: START_X, y: START_Y },
         data: { label: 'Start' },
         draggable: false, 
         deletable: false,
         selectable: false 
     });

     // 2. Add Step Nodes (Auto-layout Horizontal)
     steps.forEach((step, index) => {
         newNodes.push({
             id: step.id,
             type: 'step',
             position: { x: START_X + 150 + (index * NODE_SpacingX), y: START_Y - 20 }, // Center aligned vertically with start
             data: { label: step.title }
         });
     });

     // 3. Auto-Generate Edges (Start -> Step 1 -> Step 2 ...)
     if (steps.length > 0) {
         // Start -> First
         newEdges.push({
             id: 'e-start-first',
             source: 'start-node',
             target: steps[0].id,
             ...defaultEdgeOptions
         });

         // Step -> Step
         for (let i = 0; i < steps.length - 1; i++) {
             newEdges.push({
                 id: `e-${steps[i].id}-${steps[i+1].id}`,
                 source: steps[i].id,
                 target: steps[i+1].id,
                 ...defaultEdgeOptions
             });
         }
     }

     setNodes(newNodes);
     setEdges(newEdges);

  }, [steps, flowNode]); // Re-run when store steps change

  const onConnect = useCallback(
    (params: Connection) => {
        // Validation: 1 Input / 1 Output
        if (params.source === 'start-node') {
           // Start node only output
        }


        // Logic: "Adding an edge the order of steps updates"
        if (params.source && params.target) {
            const sourceId = params.source;
            const targetId = params.target;

            if (sourceId === 'start-node') {
               // Move connected node to the START of the current flow
               if (flowNode) {
                  moveNodeToFront(targetId, flowNode.id);
               }
            } else {
               // Move target to be after source
               moveNode(targetId, sourceId);
            }
        }
    },
    [moveNode],
  );

  // Context Menu Actions (Call Store)
  const handleAddNode = () => {
      // Add to store
      const parentId = flowNode?.id || null;
      addNode(parentId, 'STEP', 'New Step');
      setMenu(null);
  };

  const handleEditStep = () => {
      if (menu?.id && menu.id !== 'start-node') {
          openTab({ id: menu.id, type: 'STEP', title: 'Edit Step', stepId: menu.id });
          setMenu(null);
      }
  };
  
  const handleRename = () => {
      if (menu?.id && menu.id !== 'start-node') {
          const currentLabel = nodes.find(n => n.id === menu.id)?.data.label as string;
          const newName = window.prompt("Enter new name:", currentLabel);
          if (newName) {
              updateNode(menu.id, { title: newName });
          }
          setMenu(null);
      }
  };

  const handleDeleteNode = () => {
      if (menu?.id && menu.id !== 'start-node') {
          if(confirm('Delete step?')) {
             removeNode(menu.id);
          }
          setMenu(null);
      }
  };

  const handleDeleteEdge = () => {
      // Deleting edge in linked list logic? 
      // Does it mean reordering? Or just breaking the link (which breaks the list)?
      // If A->B is deleted, B is "orphaned"?
      // Or maybe we treat it as no-op for order, just visual removal?
      // Since order drives edges, deleting edge might not make sense unless we remove the node or move it to end?
      // User asked for "Option to delete edge".
      // Let's allow visual deletion but it will reappear on sync if order persists.
      // ACTUALLY: Maybe deleting edge A->B means B is no longer after A?
      // This conflicts with "Linked List". 
      // Implementation: Just remove local edge for now or warn.
      if (menu?.id) {
          setEdges(eds => eds.filter(e => e.id !== menu.id));
          setMenu(null);
      }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, type: 'pane' }); }}
        onNodeContextMenu={(e, node) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, type: 'node', id: node.id }); }}
        onEdgeContextMenu={(e, edge) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, type: 'edge', id: edge.id }); }}
        onPaneClick={() => setMenu(null)}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        colorMode="dark"
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
        
        {menu && (
           <FlowContextMenu 
              position={{ x: menu.x, y: menu.y }} 
              type={menu.type} 
              onClose={() => setMenu(null)}
              onAddNode={handleAddNode}
              onEdit={handleEditStep}
              onRename={handleRename}
              onDelete={menu.type === 'node' ? handleDeleteNode : handleDeleteEdge}
           />
        )}
      </ReactFlow>
    </div>
  );
};

export default FlowEditor;
