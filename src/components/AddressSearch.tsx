import { useEffect, useRef, useState } from 'react';
import { Home, Loader2, X } from 'lucide-react';
import { searchAddress, type AddressHit } from '../lib/geo';

export function AddressSearch({ value, onChange }: { value: AddressHit | null; onChange: (h: AddressHit | null) => void }) {
  const [q, setQ] = useState(value?.label ?? '');
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(value?.label ?? ''); }, [value]);

  useEffect(() => {
    if (!open || q === value?.label) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      searchAddress(q, ctrl.signal)
        .then((h) => { setHits(h); setActive(0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open, value]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (h: AddressHit) => { onChange(h); setOpen(false); setHits([]); };

  return (
    <div className="relative" ref={ref}>
      <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        className="input pl-9 pr-9"
        placeholder="Your home address, e.g. Gammel Kongevej 10"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && hits[active]) pick(hits[active]);
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Home address"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">
        {loading ? <Loader2 size={16} className="animate-spin" /> : value ? (
          <button onClick={() => { onChange(null); setQ(''); }} aria-label="Clear address"><X size={16} /></button>
        ) : null}
      </span>
      {open && hits.length > 0 && (
        <ul className="card absolute z-[1000] mt-1 max-h-72 w-full overflow-auto py-1 shadow-xl">
          {hits.map((h, i) => (
            <li key={h.label}>
              <button className={`w-full px-3 py-2 text-left text-sm ${i === active ? 'bg-surface-2' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
