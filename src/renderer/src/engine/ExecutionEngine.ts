import { ActionType, StepData, FileAction, TerminalAction } from '../types/schema';
import { useFileSystemStore } from '../store/useFileSystemStore';
import { useIDEStore } from '../store/useIDEStore';
import { useRef } from 'react';

export interface ExecutionContext {
  editorInstance?: any; // Monaco editor instance
  terminalInstance?: any; // XTerm instance
}

export const useExecutionEngine = () => {
  const fileStore = useFileSystemStore();
  const ideStore = useIDEStore();
  
  // Keep track of active intervals for typing animation to cancel them if needed
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeStep = async (stepId: string, data: StepData, context: ExecutionContext) => {
    // 1. Snapshot
    if (data.enableSnapshot) {
      fileStore.saveSnapshot(stepId);
    }

    // 2. Action
    await executeAction(data.action, context, fileStore, ideStore);
  };

  const executeAction = async (
    action: ActionType, 
    context: ExecutionContext,
    fileStore: ReturnType<typeof useFileSystemStore>,
    ideStore: ReturnType<typeof useIDEStore>
  ) => {
    
    // Clear previous animations
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    if (action.kind === 'FILE') {
      await handleFileAction(action, context, fileStore, ideStore, typingIntervalRef);
    } else if (action.kind === 'TERMINAL') {
      await handleTerminalAction(action, context);
    }
  };

  return { executeStep };
};

async function handleFileAction(
  action: FileAction, 
  context: ExecutionContext,
  fileStore: any,
  ideStore: any,
  intervalRef: React.MutableRefObject<NodeJS.Timeout | null>
) {
  // Resolve Target
  let targetPath = action.targetPath;
  if (action.targetMode === 'ACTIVE_FILE') {
    targetPath = ideStore.activeFileId;
  }
  
  if (!targetPath) {
     console.warn("No target path available for active file mode");
     return;
  }

  // Ensure file exists (Real FS)
  // If we are creating, we assume we can write. 
  // If modifying, we need to read it first if not in store?
  // Stores 'files' has open files. If not open, we might need to read it.
  
  let currentContent = '';
  if (fileStore.files[targetPath]) {
     currentContent = fileStore.files[targetPath].content;
  } else {
     // Try reading from disk if not "CREATE"
     if (action.operation !== 'CREATE') {
        try {
           currentContent = await window.api.readFile(targetPath);
        } catch (e) {
           // File might not exist
           currentContent = '';
        }
     }
  }

  const originalContent = currentContent;
  let finalContent = originalContent;

  // Operations calculation
  if (action.operation === 'CREATE' || action.operation === 'OVERWRITE') {
    finalContent = action.content;
  } else if (action.operation === 'APPEND') {
    finalContent = originalContent + (originalContent ? '\n' : '') + action.content;
  } else if (action.operation === 'PREPEND') {
    finalContent = action.content + (originalContent ? '\n' : '') + originalContent;
  } else if (action.operation === 'REPLACE_TOKEN' && action.replaceToken) {
    finalContent = originalContent.replace(action.replaceToken, action.content);
  } else if (action.operation === 'CURSOR_POSITION') {
    if (!context.editorInstance) {
       finalContent = originalContent + '\n' + action.content;
    } else {
       // Monaco handles it, but we also want to persist to disk?
       // If we use Monaco edits, content update happens via onChange -> execution?
       // Usually onChange updates store. But for Step execution we want explicit control.
       // Let's defer CURSOR_POSITION to pure editor manipulation if possible.
       // But we still need to save to disk if we want persistence.
       // Monaco's value will be updated. We should get it.
       // However, strictly speaking, we calculate `finalContent` here.
    }
  }

  // Animation & Execution
  if (action.operation === 'CURSOR_POSITION' && context.editorInstance) {
       const editor = context.editorInstance;
       const text = action.content;
       
       if (action.config.typingAnimation) {
         let i = 0;
         const speed = action.config.typingSpeedMs || 50;
         intervalRef.current = setInterval(() => {
            if (i >= text.length) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              return;
            }
            const char = text[i];
            editor.executeEdits('typing-anim', [{
              range: {
                 startLineNumber: editor.getPosition().lineNumber,
                 startColumn: editor.getPosition().column,
                 endLineNumber: editor.getPosition().lineNumber,
                 endColumn: editor.getPosition().column
              },
              text: char,
              forceMoveMarkers: true
            }]);
            i++;
            // Note: Saving to disk during animation is expensive. 
            // We should save after animation? Or rely on editor `onChange` to autosave?
            // `CodeEditor` doesn't have autosave to disk yet.
            // We'll leave disk save for now for animation.
         }, speed);
       } else {
         editor.executeEdits('step-action', [{
           range: {
              startLineNumber: editor.getPosition().lineNumber,
              startColumn: editor.getPosition().column,
              endLineNumber: editor.getPosition().lineNumber,
              endColumn: editor.getPosition().column
           },
           text: text,
           forceMoveMarkers: true
         }]);
       }
       // We assume editor updates internal state.
       // For disk sync, we might miss it here.
       // ideally we wait for animation to finish.
  } else {
      // Non-cursor operations
      
      // Animation (Simulated for real FS?)
      // Writing char-by-char to disk is bad.
      // We should probably just write the final content for Real FS, 
      // OR only animate if file is OPEN in editor and let editor animate it?
      
      // Simplification: Write final content to disk.
      // If user wants animation, they should use 'CURSOR_POSITION' on active file.
      // Or we can simulate typing in editor if file IS active.
      
      try {
         await window.api.writeFile(targetPath, finalContent);
         // Refresh store
         await fileStore.openFile(targetPath);
         ideStore.setActiveFile(targetPath);
      } catch (e) {
         console.error("Write failed", e);
      }
  }
}

// Helper to parsing placeholders [[Key:Value]] -> Value
const parsePlaceholders = (text: string): string => {
  return text.replace(/\[\[(.*?):(.*?)\]\]/g, (_match, _key, value) => value);
};

async function handleTerminalAction(action: TerminalAction, _context: ExecutionContext) {
  if (action.command) {
    const finalCommand = parsePlaceholders(action.command);
    
    // Typing Animation for Terminal
    // We can support typingSpeedMs config if added to Scheme, using default for now.
    const typingAnimation = true; // Force true for now as per features?
    
    if (typingAnimation) {
       for (const char of finalCommand) {
          window.api.sendTerminalInput(char);
          await new Promise(r => setTimeout(r, 10)); // Fast typing
       }
    } else {
       window.api.sendTerminalInput(finalCommand);
    }

    if (action.executeImmediately) {
       window.api.sendTerminalInput('\r');
    }
  }
}
