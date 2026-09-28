import { LANGUAGE_LABEL } from '../lib/format';

/** Compact language badge (emoji flags don't render on Windows). */
export function LangTag({ lang }: { lang: string }) {
  return (
    <span title={LANGUAGE_LABEL[lang] ?? lang}
      className="inline-grid h-4 place-items-center rounded-[4px] border border-border bg-surface-2 px-1 text-[9px] font-bold uppercase leading-none tracking-wide text-ink-2">
      {lang}
    </span>
  );
}
