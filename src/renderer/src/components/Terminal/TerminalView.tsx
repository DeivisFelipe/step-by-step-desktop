import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useIDEContext } from '../../context/IDEContext';

const TerminalView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { terminalRef } = useIDEContext();
  
  useEffect(() => {
    if (!containerRef.current) return;

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
    
    term.write('Welcome to CodeLesson Terminal\r\n$ ');
    
    terminalRef.current = term;

    // Handle resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalRef.current = null;
    };
  }, []);

  return (
    <div className="h-full w-full bg-[#1e1e1e] p-2 overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

export default TerminalView;
