import { createContext, useContext, useRef, MutableRefObject } from 'react';

interface IDEContextType {
  editorRef: MutableRefObject<any>;
  terminalRef: MutableRefObject<any>;
}

const IDEContext = createContext<IDEContextType | null>(null);

export const IDEProvider = ({ children }: { children: React.ReactNode }) => {
  const editorRef = useRef<any>(null);
  const terminalRef = useRef<any>(null);

  return (
    <IDEContext.Provider value={{ editorRef, terminalRef }}>
      {children}
    </IDEContext.Provider>
  );
};

export const useIDEContext = () => {
  const context = useContext(IDEContext);
  if (!context) {
    throw new Error('useIDEContext must be used within an IDEProvider');
  }
  return context;
};
