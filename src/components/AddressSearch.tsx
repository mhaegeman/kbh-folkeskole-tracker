import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import clsx from 'clsx';
import { searchAddress, type AddressHit } from '../lib/geo';

/** Home address search (Photon autocomplete), styled as a pill. */
export function AddressSearch({ value, onChange, className }: { value: AddressHit | null; onChange: (h: AddressHit | null) => void; className?: string }) {
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
    <div className={clsx('relative', className)} ref={ref}>
      <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2 pl-3.5 pr-1.5 focus-within:border-accent focus-within:bg-surface sm:h-12">
        <MapPin size={18} className="shrink-0 text-highlight" aria-hidden="true" />
        <input
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
          placeholder="Your address, e.g. Gammel Kongevej 10"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && hits[active]) pick(hits[active]);
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label="Your home address"
          aria-autocomplete="list"
          aria-expanded={open && hits.length > 0}
        />
        {loading ? <Loader2 size={18} className="mr-2 shrink-0 animate-spin text-ink-3" /> : value ? (
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-border" onClick={() => { onChange(null); setQ(''); }} aria-label="Clear address"><X size={16} /></button>
        ) : null}
      </div>
      {open && hits.length > 0 && (
        <ul className="absolute z-[1300] mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-surface py-1.5 shadow-[var(--shadow-float)]" role="listbox">
          {hits.map((h, i) => (
            <li key={h.label} role="option" aria-selected={i === active}>
              <button type="button" className={clsx('flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm', i === active && 'bg-surface-2')} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                <MapPin size={15} className="shrink-0 text-ink-3" aria-hidden="true" />{h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
