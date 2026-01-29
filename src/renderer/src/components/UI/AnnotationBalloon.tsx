import { useIDEStore, Annotation } from '../../store/useIDEStore';
import { X, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

const AnnotationItem = ({ item, onRemove }: { item: Annotation; onRemove: () => void }) => {
   const [visible, setVisible] = useState(false);

   useEffect(() => {
     requestAnimationFrame(() => setVisible(true));
   }, []);

   const getIcon = () => {
      switch(item.type) {
         case 'error': return <AlertCircle size={20} className="text-red-400" />;
         case 'warning': return <AlertTriangle size={20} className="text-yellow-400" />;
         default: return <Info size={20} className="text-blue-400" />;
      }
   };

   return (
      <div className={clsx(
         "mb-2 p-3 rounded shadow-lg bg-[#252526] border border-[#3e3e42] text-white flex items-start w-80 transition-all duration-300 transform",
         visible ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
      )}>
         <span className="mr-3 mt-0.5">{getIcon()}</span>
         <div className="flex-1 text-sm leading-relaxed">{item.message}</div>
         <button 
           onClick={onRemove}
           className="ml-2 text-gray-400 hover:text-white"
         >
            <X size={14} />
         </button>
      </div>
   );
};

const AnnotationBalloon = () => {
   const { annotations, removeAnnotation } = useIDEStore();

   return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
         {annotations.map(ann => (
            <AnnotationItem 
               key={ann.id} 
               item={ann} 
               onRemove={() => removeAnnotation(ann.id)} 
            />
         ))}
      </div>
   );
};

export default AnnotationBalloon;
