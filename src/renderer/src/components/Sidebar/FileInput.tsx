import { useState, useEffect, useRef } from 'react';
import { FileIcon } from '../UI/FileIcon';

interface FileInputProps {
  initialValue?: string;
  type: 'file' | 'folder';
  depth: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export const FileInput = ({ initialValue = '', type, depth, onSubmit, onCancel }: FileInputProps) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        if (value.trim()) onSubmit(value.trim());
        else onCancel();
    } else if (e.key === 'Escape') {
        onCancel();
    }
  };

  const handleBlur = () => {
    // Commit on blur if value exists, else cancel?
    // VS Code commits.
    if (value.trim()) onSubmit(value.trim());
    else onCancel();
  };

  return (
    <div 
       className="flex items-center py-1 bg-[#37373d] text-white"
       style={{ paddingLeft: `${depth * 10 + 10}px` }}
    >
       <span className="mr-1.5 flex-shrink-0">
          <FileIcon name={value || (type === 'folder' ? 'folder' : 'file')} isDirectory={type === 'folder'} />
       </span>
       <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="bg-transparent border border-blue-500 outline-none text-sm w-full min-w-0"
          spellCheck={false}
       />
    </div>
  );
};
