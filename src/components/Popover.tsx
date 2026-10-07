import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * A chip that opens a panel. On wide screens the panel drops down under the
 * chip; on phones it slides up as a bottom sheet. Closes on outside click and Esc.
 */
export function Popover({ label, active, children, width = 340, align = 'left', title, icon, footer }: {
  label: ReactNode;
  active?: boolean;
  children: (close: () => void) => ReactNode;
  width?: number;
  align?: 'left' | 'right';
  title?: string;
  icon?: ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="chip" data-active={active ? 'true' : 'false'} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <ChevronDown size={15} className={clsx('transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1190] bg-black/30 sm:hidden" aria-hidden="true" onClick={close} />
          <div
            id={id}
            role="dialog"
            aria-label={title}
            className={clsx(
              'z-[1200] flex flex-col bg-surface shadow-[var(--shadow-float)]',
              'fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-[min(640px,75dvh)] sm:rounded-3xl sm:border sm:border-border',
              align === 'right' ? 'sm:right-0' : 'sm:left-0',
            )}
            style={{ ['--pop-w' as string]: `${width}px` }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:pt-5">
              <span className="text-lg font-extrabold tracking-tight">{title}</span>
              <button type="button" onClick={close} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-ink hover:bg-border"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-4 scrollbar-thin sm:w-[var(--pop-w)]">{children(close)}</div>
            {footer && <div className="border-t border-border px-5 py-3">{footer(close)}</div>}
          </div>
        </>
      )}
    </div>
  );
}
