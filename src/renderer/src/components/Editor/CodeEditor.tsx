import { useRef, useEffect } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { useIDEStore } from '../../store/useIDEStore';
import { useIDEContext } from '../../context/IDEContext';
import { useLessonStore } from '../../store/useLessonStore';
import { createRoot } from 'react-dom/client';

// Configure Monaco to use local instance (avoids CDN/CSP issues)
loader.config({ monaco });

const CodeEditor = () => {
  const { files, openFile } = useFileSystemStore();
  const { activeTabId, tabs } = useIDEStore();
  const { tree, updateNode } = useLessonStore();
  const { editorRef } = useIDEContext();
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  const widgetRoots = useRef<Map<string, any>>(new Map()); // Keep track of react roots to unmount

  // Ensure file is loaded if active
  useEffect(() => {
     if (activeTab?.type === 'FILE' && activeTab.path) {
         if (!files[activeTab.path]?.isOpen) {
             openFile(activeTab.path);
         }
     }
  }, [activeTab, files, openFile]);

  // Helper to find node content if it's a Step/Flow
  const getNodeContent = (id: string, nodes: any[]): string => {
     for (const node of nodes) {
        if (node.id === id) {
           return (node.data?.action?.content) || `// Flow: ${node.title}\n// Children: ${node.children?.length}`;
        }
        if (node.children) {
           const found = getNodeContent(id, node.children);
           if (found) return found; 
        }
     }
     return '';
  };
  
  let content = '';
  let language = 'plaintext';
  let path = activeTabId || 'untitled';

  if (activeTab) {
      if (activeTab.type === 'FILE' && activeTab.path) {
          const file = files[activeTab.path];
          content = file?.content || '';
          language = file?.language || 'plaintext';
          path = activeTab.path;
      } else if (activeTab.type === 'STEP' || activeTab.type === 'FLOW') {
          content = getNodeContent(activeTab.id, tree);
          language = 'javascript'; 
          path = `virtual://${activeTab.id}`;
      }
  }

  // --- Placeholder Logic ---

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Scan for placeholders and inject widgets
    const scan = () => {
       // Clear existing
       const existingWidgets = (editor as any)._placeholderWidgets || [];
       existingWidgets.forEach((w: any) => {
          editor.removeContentWidget(w);
          if (widgetRoots.current.has(w.getId())) {
             widgetRoots.current.get(w.getId()).unmount();
             widgetRoots.current.delete(w.getId());
          }
       });
       (editor as any)._placeholderWidgets = [];

       const model = editor.getModel();
       if (!model) return;
       const text = model.getValue();
       const regex = /\[\[(.*?):(.*?)\]\]/g;
       let match;

       const widgets: any[] = [];

       while ((match = regex.exec(text)) !== null) {
          const startPos = model.getPositionAt(match.index);
          // const endPos = model.getPositionAt(match.index + match[0].length);
          const key = match[1];
          const value = match[2];
          const widgetId = `placeholder-${match.index}`;

          const widget = {
             getId: () => widgetId,
             getDomNode: () => {
                const domNode = document.createElement('div');
                domNode.className = 'placeholder-widget';
                domNode.style.display = 'inline-block';
                
                const root = createRoot(domNode);
                widgetRoots.current.set(widgetId, root);

                // Render Input
                root.render(
                   <input 
                      className="bg-blue-900/80 text-white border border-blue-500 rounded px-1 min-w-[50px] outline-none text-xs"
                      defaultValue={value}
                      style={{ height: '18px' }}
                      onKeyDown={(e) => e.stopPropagation()} // Prevent editor stealing focus
                      onChange={(e) => {
                         const newVal = e.target.value;
                         // const currentText = model.getValue(); // Unused
                         // Ideally we should find the updated range, but simplistic replacement:
                         const newText = `[[${key}:${newVal}]]`;
                         
                         // Find this specific token again to replace? 
                         // Or just rely on visual input updates and user saves?
                         // If we edit text, we need to replace the underlying code so execution gets new value.
                         // But we lost `startPos` accuracy if text changed before this widget.
                         
                         // We can find match near `startPos`?
                         // Or use Model's `findMatches`?
                         const matches = model.findMatches(`[[${key}:${value}]]`, true, false, false, null, true);
                         // Find the one closest to our `widget` position?
                         // Current widget position?
                         
                         if (matches.length > 0) {
                            // Just replace the first one for now? Or try to be smart?
                            // MVP: Replace first match or match at same line?
                            // Let's assume simplest case: One placeholder per key or duplicates update all?
                            
                            editor.executeEdits('placeholder', [{
                               range: matches[0].range,
                               text: newText,
                               forceMoveMarkers: true
                            }]);
                         }
                      }}
                   />
                );
                return domNode;
             },
             getPosition: () => {
                return {
                   position: {
                      lineNumber: startPos.lineNumber,
                      column: startPos.column
                   },
                   preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
                };
             }
          };

          editor.addContentWidget(widget);
          widgets.push(widget);
       }
       (editor as any)._placeholderWidgets = widgets;
    };

    // Initial scan
    scan();

    // Re-scan on change
    // Debounce this!
    let timeout: any;
    const disposable = editor.onDidChangeModelContent(() => {
       clearTimeout(timeout);
       timeout = setTimeout(scan, 500); 
       
       // Update Step Node Data if "Virtual"
       if (activeTab?.type === 'STEP' && activeTab.stepId) {
          const originalNode = tree.find(n => n.id === activeTab.stepId);
          if (originalNode && originalNode.data && originalNode.data.action) {
             const action = { ...originalNode.data.action };
             const value = editor.getValue();
             
             if (action.kind === 'FILE') {
                action.content = value;
             } else {
                action.command = value;
             }
             
             updateNode(activeTab.stepId, { 
                data: { 
                  ...originalNode.data,
                  action
                } 
             });
          }
       }
    });

    return () => {
       disposable.dispose();
       // Cleanup widgets
    };
  };

  if (!activeTabId) {
    return <div className="h-full flex items-center justify-center text-gray-500 bg-[#1e1e1e]">No file open</div>;
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        theme="vs-dark"
        path={path}
        defaultLanguage="plaintext"
        language={language}
        value={content}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          padding: { top: 10 }
        }}
      />
    </div>
  );
};

export default CodeEditor;
