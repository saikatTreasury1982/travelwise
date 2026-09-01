// app/lib/help/loader.ts
import { promises as fs } from 'fs';
import path from 'path';

export interface HelpMeta {
  slug: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  updated: string;
}
export interface HelpDoc extends HelpMeta { body: string; }

const DIR = path.join(process.cwd(), 'content', 'help');

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

/** All articles' metadata (for the index), sorted by category then title. */
export async function listHelpDocs(): Promise<HelpMeta[]> {
  let files: string[] = [];
  try { files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.md')); } catch { return []; }
  const docs: HelpMeta[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(DIR, file), 'utf8');
    const { meta } = parseFrontMatter(raw);
    docs.push({
      slug: file.replace(/\.md$/, ''),
      title: meta.title ?? file,
      summary: meta.summary ?? '',
      category: meta.category ?? 'Guides',
      icon: meta.icon ?? '📄',
      updated: meta.updated ?? '',
    });
  }
  return docs;
}

/** One article by slug, with its body. */
export async function getHelpDoc(slug: string): Promise<HelpDoc | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null; // guard against path traversal
  try {
    const raw = await fs.readFile(path.join(DIR, `${slug}.md`), 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    return {
      slug, body,
      title: meta.title ?? slug, summary: meta.summary ?? '',
      category: meta.category ?? 'Guides', icon: meta.icon ?? '📄', updated: meta.updated ?? '',
    };
  } catch { return null; }
}