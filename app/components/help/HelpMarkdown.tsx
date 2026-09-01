// app/components/help/HelpMarkdown.tsx
'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Splits markdown into segments the renderer understands:
 *   :::note | :::tip | :::warn   … content …   :::   → styled callout box
 *   :::faq                       … Q/A pairs …  :::   → accordion (### = question)
 *   :::lifecycle:::  /  :::doors:::                    → diagram blocks (self-closing)
 * Everything else is plain markdown.
 */
type Segment =
  | { kind: 'md'; text: string }
  | { kind: 'callout'; variant: string; text: string }
  | { kind: 'diagram'; variant: string; text: string };

function parseSegments(src: string): Segment[] {
  const segs: Segment[] = [];
  const re = /:::(note|tip|warn|faq)\s*\n([\s\S]*?)\n:::|:::(lifecycle|doors):::/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) segs.push({ kind: 'md', text: src.slice(last, m.index) });
    if (m[3]) {
      segs.push({ kind: 'diagram', variant: m[3], text: '' });
    } else {
      segs.push({ kind: 'callout', variant: m[1], text: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) segs.push({ kind: 'md', text: src.slice(last) });
  return segs;
}

const MD_COMPONENTS = {
  h2: ({ children }: any) => <h2 className="help-h2">{children}</h2>,
  h3: ({ children }: any) => <h3 className="help-h3">{children}</h3>,
  p: ({ children }: any) => <p className="help-p">{children}</p>,
  ul: ({ children }: any) => <ul className="help-ul">{children}</ul>,
  ol: ({ children }: any) => <ol className="help-ol">{children}</ol>,
  li: ({ children }: any) => <li className="help-li">{children}</li>,
  strong: ({ children }: any) => <strong className="help-strong">{children}</strong>,
  em: ({ children }: any) => <em className="help-em">{children}</em>,
  a: ({ href, children }: any) => <a href={href} className="help-a">{children}</a>,
};

const CALLOUT_ICON: Record<string, string> = { note: 'ℹ', tip: '✦', warn: '⚠' };

function LifecycleDiagram() {
  const stages = [
    { chip: 'Shortlisted', cls: 'sl', title: 'Considering', desc: 'Options weighed side by side. Not in your budget yet.' },
    { chip: 'Planned', cls: 'pl', title: 'Planned', desc: 'The flight you chose, at an estimated price. Now in your forecast.' },
    { chip: '✓ Booked', cls: 'bk', title: 'Booked', desc: 'Really booked, at the real price. Forecast updates to match.' },
  ];
  return (
    <div className="dg-life">
      {stages.map((s, i) => (
        <React.Fragment key={s.title}>
          <div className="dg-stage">
            <span className={`dg-chip dg-${s.cls}`}>{s.chip}</span>
            <div className="dg-stage-t">{s.title}</div>
            <div className="dg-stage-d">{s.desc}</div>
          </div>
          {i < stages.length - 1 && <div className="dg-arrow" aria-hidden="true">→</div>}
        </React.Fragment>
      ))}
      <style>{`
        .dg-life { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; margin: 20px 0 28px; }
        .dg-stage { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
        .dg-chip { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
        .dg-sl { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink-soft); }
        .dg-pl { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-deep); }
        .dg-bk { background: color-mix(in srgb, var(--success, #2E7D5B) 16%, transparent); color: var(--success, #2E7D5B); }
        .dg-stage-t { font-family: var(--font-display); font-weight: 500; font-size: 18px; color: var(--ink); margin-bottom: 3px; }
        .dg-stage-d { font-size: 12.5px; color: var(--ink-soft); line-height: 1.45; }
        .dg-arrow { align-self: center; color: var(--ink-faint); font-size: 18px; }
        @media (max-width: 600px) {
          .dg-life { grid-template-columns: 1fr; }
          .dg-arrow { transform: rotate(90deg); justify-self: center; }
        }
      `}</style>
    </div>
  );
}

function DoorsDiagram() {
  const doors = [
    { ic: '✦', t: 'Ask AI', d: 'Co-pilot suggests options with estimated fares.', soon: false },
    { ic: '📄', t: 'Upload a booking', d: 'Drop a confirmation PDF; details read in automatically.', soon: false },
    { ic: '🔍', t: 'Search in-app', d: 'Browse live fares for your route.', soon: true },
  ];
  return (
    <div className="dg-doors">
      {doors.map((d) => (
        <div key={d.t} className={`dg-door${d.soon ? ' soon' : ''}`}>
          <div className="dg-door-ic">{d.ic}</div>
          <div className="dg-door-t">{d.t}{d.soon && <span className="dg-soon">Soon</span>}</div>
          <div className="dg-door-d">{d.d}</div>
        </div>
      ))}
      <style>{`
        .dg-doors { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 18px 0 26px; }
        .dg-door { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
        .dg-door.soon { border-style: dashed; background: transparent; opacity: 0.75; }
        .dg-door-ic { font-size: 22px; margin-bottom: 8px; }
        .dg-door-t { font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        .dg-soon { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink-faint); }
        .dg-door-d { font-size: 12.5px; color: var(--ink-soft); line-height: 1.45; }
        @media (max-width: 600px) { .dg-doors { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function FaqBlock({ raw }: { raw: string }) {
  // Each "### question" line starts a new item; following lines are its answer (markdown).
  const items: { q: string; a: string }[] = [];
  let cur: { q: string; a: string } | null = null;
  for (const line of raw.split('\n')) {
    const qm = line.match(/^###\s+(.*)/);
    if (qm) {
      if (cur) items.push(cur);
      cur = { q: qm[1].trim(), a: '' };
    } else if (cur) {
      cur.a += (cur.a ? '\n' : '') + line;
    }
  }
  if (cur) items.push(cur);

  return (
    <div className="help-faq">
      {items.map((it, i) => (
        <details key={i}>
          <summary>{it.q}</summary>
          <div className="help-faq-a">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{it.a.trim()}</ReactMarkdown>
          </div>
        </details>
      ))}
      <style>{`
        .help-faq { display: flex; flex-direction: column; gap: 10px; margin: 18px 0 8px; }
        .help-faq details { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 2px 18px; }
        .help-faq summary {
          cursor: pointer; padding: 15px 0; font-weight: 600; font-size: 15px; color: var(--ink);
          list-style: none; display: flex; justify-content: space-between; gap: 12px; align-items: center;
        }
        .help-faq summary::-webkit-details-marker { display: none; }
        .help-faq summary::after { content: "+"; color: var(--accent-deep); font-size: 20px; font-weight: 400; flex-shrink: 0; }
        .help-faq details[open] summary::after { content: "–"; }
        .help-faq-a { padding: 0 0 16px; }
        .help-faq-a .help-p { margin: 0; font-size: 14px; max-width: none; }
      `}</style>
    </div>
  );
}

export default function HelpMarkdown({ content }: { content: string }) {
  const segments = parseSegments(content);
  return (
    <div className="help-prose">
      {segments.map((s, i) => {
        if (s.kind === 'md') {
          return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{s.text}</ReactMarkdown>;
        }
        if (s.kind === 'diagram') {
          return s.variant === 'lifecycle' ? <LifecycleDiagram key={i} /> : <DoorsDiagram key={i} />;
        }
        if (s.variant === 'faq') {
          return <FaqBlock key={i} raw={s.text} />;
        }
        return (
          <div key={i} className={`help-callout help-callout-${s.variant}`}>
            <span className="help-callout-ic">{CALLOUT_ICON[s.variant]}</span>
            <div className="help-callout-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{s.text}</ReactMarkdown>
            </div>
          </div>
        );
      })}

      <style>{`
        .help-prose { color: var(--ink); font-size: 16px; line-height: 1.68; }
        .help-h2 {
          font-family: var(--font-display); font-weight: 500; font-size: 25px; line-height: 1.18;
          margin: 44px 0 10px; color: var(--ink); letter-spacing: -0.01em; text-wrap: balance;
        }
        .help-h3 { font-size: 16px; font-weight: 600; margin: 26px 0 6px; color: var(--ink); }
        .help-p { margin: 0 0 15px; color: var(--ink-soft); max-width: 65ch; }

        .help-ul, .help-ol {
          margin: 4px 0 18px; padding-left: 0; list-style: none;
          display: flex; flex-direction: column; gap: 10px;
        }
        .help-ol { counter-reset: hol; }
        .help-li { display: flex; gap: 11px; color: var(--ink-soft); align-items: baseline; }
        .help-ul .help-li::before { content: "→"; color: var(--accent-deep); font-weight: 600; flex: 0 0 auto; }
        .help-ol .help-li { counter-increment: hol; align-items: flex-start; }
        .help-ol .help-li::before {
          content: counter(hol); font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 600;
          color: var(--accent-deep); background: color-mix(in srgb, var(--accent) 14%, transparent);
          width: 21px; height: 21px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          flex: 0 0 21px; margin-top: 1px;
        }
        .help-li > * { min-width: 0; flex: 1 1 auto; margin: 0; }
        .help-li p, .help-li .help-p { margin: 0; max-width: none; }

        .help-strong { color: var(--ink); font-weight: 600; }
        .help-em { font-style: italic; }
        .help-a { color: var(--accent-deep); text-decoration: underline; text-underline-offset: 3px; }

        .help-callout {
          display: grid; grid-template-columns: 22px 1fr; gap: 12px; align-items: start;
          margin: 20px 0; padding: 15px 18px; border-radius: 0 12px 12px 0;
          background: var(--surface); border-left: 3px solid var(--accent);
        }
        .help-callout-tip  { border-left-color: var(--accent); }
        .help-callout-note { border-left-color: var(--ink-faint); }
        .help-callout-warn { border-left-color: var(--plan, #B5811E); }
        .help-callout-ic { font-size: 15px; color: var(--accent-deep); margin-top: 2px; }
        .help-callout-warn .help-callout-ic { color: var(--plan, #B5811E); }
        .help-callout-note .help-callout-ic { color: var(--ink-faint); }
        .help-callout-body .help-p { margin: 0; font-size: 14px; max-width: none; }
        .help-callout-body .help-p + .help-p { margin-top: 8px; }
      `}</style>
    </div>
  );
}