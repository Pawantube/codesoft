import { useEffect, useState } from 'react';
import { onToast } from '../utils/toast';

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsub = onToast((t) => {
      setItems((prev) => [...prev, t]);
      if (t.timeout !== 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== t.id));
        }, t.timeout || 5000);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[1000] space-y-2">
      {items.map((t) => (
        <div key={t.id} className="max-w-xs rounded-lg border bg-white shadow-md p-3">
          <div className="font-medium text-sm">{t.title}</div>
          {t.message && <div className="text-sm text-gray-700 mt-1 whitespace-pre-line">{t.message}</div>}
          {t.link && (
            <a href={t.link} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              Open
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
