// app/components/help/HelpArticle.tsx
'use client';
import HelpMarkdown from './HelpMarkdown';

interface Section { title: string; body: string; }

/** Split markdown into sections at each "## " heading. Content before the first
 *  "## " (e.g. an intro callout) is the lead, shown open above the accordions. */
function splitSections(md: string): { lead: string; sections: Section[] } {
  const lines = md.split('\n');
  let lead = '';
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)/);
    if (h) {
      if (cur) sections.push(cur);
      cur = { title: h[1].trim(), body: '' };
    } else if (cur) {
      cur.body += line + '\n';
    } else {
      lead += line + '\n';
    }
  }
  if (cur) sections.push(cur);
  return { lead: lead.trim(), sections };
}

export default function HelpArticle({ body }: { body: string }) {
  const { lead, sections } = splitSections(body);
  return (
    <div className="help-article">
      {lead && <div className="help-lead"><HelpMarkdown content={lead} /></div>}

      <div className="help-sections">
        {sections.map((s, i) => (
          <details key={i} className="help-section" open={i === 0}>
            <summary>
              <span>{s.title}</span>
              <span className="chev" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </summary>
            <div className="help-section-body">
              <HelpMarkdown content={s.body} />
            </div>
          </details>
        ))}
      </div>

      <style>{`
        .help-lead { margin-bottom: 24px; }
        .help-sections { display: flex; flex-direction: column; gap: 12px; }
        .help-section {
          background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
          overflow: hidden; transition: border-color 0.15s;
        }
        .help-section[open] { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
        .help-section > summary {
          cursor: pointer; list-style: none; padding: 18px 22px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          font-family: var(--font-display); font-weight: 500; font-size: 20px; color: var(--ink);
        }
        .help-section > summary::-webkit-details-marker { display: none; }
        .help-section > summary:hover { color: var(--accent-deep); }
        .help-section .chev { color: var(--ink-faint); flex-shrink: 0; transition: transform 0.2s; display: flex; }
        .help-section[open] > summary .chev { transform: rotate(180deg); color: var(--accent-deep); }
        .help-section-body { padding: 0 22px 20px; }
        /* first heading inside a section body shouldn't add extra top margin */
        .help-section-body .help-prose > :first-child,
        .help-section-body .help-prose .help-h2:first-child { margin-top: 0; }
        @media (prefers-reduced-motion: reduce) { .help-section .chev { transition: none; } }
      `}</style>
    </div>
  );
}