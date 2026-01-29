import { useIDEStore } from '../../store/useIDEStore';
import { Files, List } from 'lucide-react';
import clsx from 'clsx';

const ActivityBar = () => {
  const { activeActivity, setActiveActivity } = useIDEStore();

  const items = [
    { id: 'EXPLORER', icon: Files, title: 'Explorer' },
    { id: 'STEPS', icon: List, title: 'Lesson Steps' },
  ] as const;

  return (
    <div className="w-12 bg-[#333333] flex flex-col items-center py-2 border-r border-[#252526]">
      {items.map(item => (
        <div
          key={item.id}
          className={clsx(
            "p-3 mb-2 cursor-pointer transition-colors relative",
            activeActivity === item.id ? "text-white" : "text-[#858585] hover:text-white"
          )}
          onClick={() => setActiveActivity(item.id)}
          title={item.title}
        >
          <item.icon size={24} strokeWidth={1.5} />
          {activeActivity === item.id && (
             <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
          )}
        </div>
      ))}

    </div>
  );
};

export default ActivityBar;
