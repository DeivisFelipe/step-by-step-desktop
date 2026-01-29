import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: LucideIcon;
  danger?: boolean;
}

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu = ({ position, items, onClose }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (position) {
       document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [position, onClose]);

  if (!position) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-48 bg-[#252526] border border-[#454545] rounded shadow-xl py-1"
      style={{ top: position.y, left: position.x }}
      onContextMenu={(e) => e.preventDefault()} // Prevent native menu on the menu itself
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={clsx(
            "flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-[#094771] hover:text-white transition-colors",
            item.danger ? "text-red-400" : "text-[#cccccc]"
          )}
          onClick={(e) => {
            e.stopPropagation();
            item.action();
            onClose();
          }}
        >
          {item.icon && <item.icon size={14} className="mr-2" />}
          <span>{item.label}</span>
        </div>
      ))}
    </div>,
    document.body
  );
};

export default ContextMenu;
