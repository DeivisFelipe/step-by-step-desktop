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
  reconnectEdge,
  MarkerType,
  getConnectedEdges,

  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { StepNode } from './StepNode';
import { FlowContextMenu } from './FlowContextMenu';
import { useIDEStore } from '../../store/useIDEStore';
import { useLessonStore } from '../../store/useLessonStore';
import { v4 as uuidv4 } from 'uuid';

// Node Types
const nodeTypes = {
  step: StepNode
};

const defaultEdgeOptions = {
    markerEnd: {
        type: MarkerType.ArrowClosed
    },
    type: 'smoothstep' 
};

const FlowEditor = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState<{ x: number, y: number, type: 'node' | 'pane' | 'edge', id?: string } | null>(null);
  
  const { addAnnotation, openTab } = useIDEStore(); // For Toast and Opening Step
  const { tree, addNode, updateNode, removeNode } = useLessonStore(); // Sync with actual step data? 
  // NOTE: Syncing 'tree' with 'nodes' is complex. For now, assuming Flow is independent OR mapping tree to nodes.
  // Prompt implies "ordem dos passos no menu se atualizam" -> connection updates menu order.
  // This implies Flow IS the source of truth for execution order.
  // We'll tackle order sync in onConnect.

  // Initial Data Mock (if empty)
  useEffect(() => {
     if (nodes.length === 0) {
         setNodes([
             { id: '1', type: 'step', position: { x: 50, y: 50 }, data: { label: 'Start' } },
             { id: '2', type: 'step', position: { x: 50, y: 150 }, data: { label: 'Step 1' } }
         ]);
     }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
        // Validation: 1 Input / 1 Output
        // Count edges for source and target
        // Source (Output) check
        const sourceEdges = edges.filter(e => e.source === params.source);
        if (sourceEdges.length >= 1) {
            addAnnotation('A step can only have one output connection.', 'warning');
            return;
        }

        // Target (Input) check
        const targetEdges = edges.filter(e => e.target === params.target);
        if (targetEdges.length >= 1) {
             addAnnotation('A step can only have one input connection.', 'warning');
             return;
        }

        setEdges((eds) => addEdge(params, eds));
        
        // TODO: Update Step Order in Store based on this connection
        // console.log("Connected", params.source, "to", params.target);
        // This effectively sets target as 'next' of source.
        // We'd walk the graph to reorder the linear list.
    },
    [edges, setEdges, addAnnotation],
  );

  const onPaneContextMenu = (event: React.MouseEvent) => {
      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY, type: 'pane' });
  };

  const onNodeContextMenu = (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation(); // Stop pane menu
      setMenu({ x: event.clientX, y: event.clientY, type: 'node', id: node.id });
  };

  const onEdgeContextMenu = (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      setMenu({ x: event.clientX, y: event.clientY, type: 'edge', id: edge.id });
  };
  
  // Handlers
  const handleAddNode = () => {
      const id = uuidv4();
      const position =  { x: menu?.x ? menu.x - 250 : 100, y: menu?.y ? menu.y - 100 : 100 };
      // Map screen to flow coords? Using simplified logic for now.
      // Ideally project({x,y})
      
      const newNode: Node = {
          id,
          type: 'step',
          position, 
          data: { label: 'New Step' }
      };
      
      setNodes((nds) => [...nds, newNode]);
      setMenu(null);
      
      // Also add to LessonStore?
      addNode(null, 'STEP', 'New Step'); 
  };

  const handleEditStep = () => {
      if (menu?.id) {
          // Open Tab for Step ID
          // Assuming Node ID === Step ID
          openTab({ id: menu.id, type: 'STEP', title: 'Edit Step', stepId: menu.id });
          setMenu(null);
      }
  };
  
  const handleRename = () => {
      if (menu?.id) {
          const newName = window.prompt("Enter new name:");
          if (newName) {
              setNodes(nds => nds.map(n => n.id === menu.id ? { ...n, data: { ...n.data, label: newName } } : n));
              // Sync store
              updateNode(menu.id, { title: newName });
          }
          setMenu(null);
      }
  };

  const handleDeleteNode = () => {
      if (menu?.id) {
          setNodes(nds => nds.filter(n => n.id !== menu.id));
          setEdges(eds => eds.filter(e => e.source !== menu.id && e.target !== menu.id));
          removeNode(menu.id);
          setMenu(null);
      }
  };

  const handleDeleteEdge = () => {
      if (menu?.id) {
          setEdges(eds => eds.filter(e => e.id !== menu.id));
          setMenu(null);
      }
  };

  const onPaneClick = () => setMenu(null);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
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
