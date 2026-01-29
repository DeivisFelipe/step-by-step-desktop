import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useIDEContext } from '../../context/IDEContext';
import { useFileSystemStore } from '../../store/useFileSystemStore';

interface TerminalViewProps {
  shell: string;
}

const TerminalView = ({ shell }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalRef } = useIDEContext();
  const { rootPath } = useFileSystemStore();

  useEffect(() => {
    // Wait for shell to be selected and container to be ready
    if (!shell || !containerRef.current) return;

    // Dispose existing terminal if any
    if (terminalRef.current) {
       terminalRef.current.dispose();
       terminalRef.current = null;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);
    fitAddon.fit();
    
    term.writeln(`\x1b[1;34mStarting ${shell}...\x1b[0m`);
    
    // Subscribe to incoming data BEFORE creating terminal (to capture initial output)
    const cleanupDataListener = window.api.onTerminalData((data) => {
       term.write(data);
    });

    // Handle user input
    const inputDisposable = term.onData((data) => {
       window.api.sendTerminalInput(data);
    });

    // Create backend terminal
    window.api.createTerminal({ 
       shell: shell,
       cwd: rootPath || undefined 
    });
    
    terminalRef.current = term;

    // Handle resize
    const handleResize = () => {
       try {
         fitAddon.fit();
         window.api.resizeTerminal(term.cols, term.rows);
       } catch (e) {
         // Ignore resize errors if terminal is disposed
       }
    };
    window.addEventListener('resize', handleResize);
    
    // Initial resize sync
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupDataListener();
      inputDisposable.dispose();
      term.dispose();
      terminalRef.current = null;
    };
  }, [shell, rootPath]); // Re-create if shell or workspace changes

  return (
    <div className="h-full w-full bg-[#1e1e1e] p-2 overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

export default TerminalView;
