// app/lib/services/checklist-service.ts
// Checklist: categories → items (packing + pre-trip tasks). Tenant-scoped.
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';

export interface ChecklistItem {
  item_id: number; item_name: string; is_done: number; priority: string | null; display_order: number;
}
export interface ChecklistCategory {
  category_id: number; category_name: string; kind: string; display_order: number; items: ChecklistItem[];
}

export async function listChecklist(ctx: TenantContext, tripId: number): Promise<ChecklistCategory[]> {
  const cats = await scopedQuery(
    ctx,
    `SELECT category_id, category_name, kind, display_order
     FROM checklist_categories WHERE {{tenant}} AND trip_id = ?
     ORDER BY display_order, category_id`,
    [tripId]
  );
  const result: ChecklistCategory[] = [];
  for (const c of cats) {
    const cid = Number(c.category_id);
    const items = await scopedQuery(
      ctx,
      `SELECT item_id, item_name, is_done, priority, display_order
       FROM checklist_items WHERE {{tenant}} AND category_id = ?
       ORDER BY display_order, item_id`,
      [cid]
    );
    result.push({
      category_id: cid,
      category_name: String(c.category_name),
      kind: String(c.kind),
      display_order: Number(c.display_order),
      items: items.map((i) => ({
        item_id: Number(i.item_id),
        item_name: String(i.item_name),
        is_done: Number(i.is_done),
        priority: i.priority == null ? null : String(i.priority),
        display_order: Number(i.display_order),
      })),
    });
  }
  return result;
}

export async function addCategory(ctx: TenantContext, tripId: number, name: string, kind: 'packing' | 'task' = 'packing'): Promise<number> {
  const mx = await scopedQuery(ctx, `SELECT COALESCE(MAX(display_order),-1) AS m FROM checklist_categories WHERE {{tenant}} AND trip_id = ?`, [tripId]);
  await scopedInsert(ctx, 'checklist_categories', { trip_id: tripId, category_name: name.trim(), kind, display_order: Number(mx[0]?.m ?? -1) + 1 });
  const r = await scopedQuery(ctx, `SELECT category_id FROM checklist_categories WHERE {{tenant}} AND trip_id = ? ORDER BY category_id DESC LIMIT 1`, [tripId]);
  return Number(r[0].category_id);
}

export async function renameCategory(ctx: TenantContext, tripId: number, categoryId: number, name: string): Promise<void> {
  await scopedExecute(ctx, `UPDATE checklist_categories SET category_name = ? WHERE {{tenant}} AND trip_id = ? AND category_id = ?`, [name.trim(), tripId, categoryId]);
}

export async function removeCategory(ctx: TenantContext, tripId: number, categoryId: number): Promise<void> {
  await scopedExecute(ctx, `DELETE FROM checklist_categories WHERE {{tenant}} AND trip_id = ? AND category_id = ?`, [tripId, categoryId]);
}

export async function addItem(ctx: TenantContext, tripId: number, categoryId: number, name: string, priority: string | null = null): Promise<void> {
  // verify the category belongs to this trip (guard)
  const owns = await scopedQuery(ctx, `SELECT category_id FROM checklist_categories WHERE {{tenant}} AND trip_id = ? AND category_id = ? LIMIT 1`, [tripId, categoryId]);
  if (owns.length === 0) throw new Error('Category not found.');
  const mx = await scopedQuery(ctx, `SELECT COALESCE(MAX(display_order),-1) AS m FROM checklist_items WHERE {{tenant}} AND category_id = ?`, [categoryId]);
  await scopedInsert(ctx, 'checklist_items', { category_id: categoryId, item_name: name.trim(), is_done: 0, priority, display_order: Number(mx[0]?.m ?? -1) + 1 });
}

export async function updateItem(ctx: TenantContext, tripId: number, itemId: number, patch: { name?: string; isDone?: boolean; priority?: string | null }): Promise<void> {
  const sets: string[] = []; const args: (string | number | null)[] = [];
  if (patch.name !== undefined) { sets.push('item_name = ?'); args.push(patch.name.trim()); }
  if (patch.isDone !== undefined) { sets.push('is_done = ?'); args.push(patch.isDone ? 1 : 0); }
  if (patch.priority !== undefined) { sets.push('priority = ?'); args.push(patch.priority); }
  if (sets.length === 0) return;
  // {{tenant}} guards tenant; the subquery guards trip ownership.
  args.push(itemId, tripId);
  await scopedExecute(
    ctx,
    `UPDATE checklist_items SET ${sets.join(', ')}
     WHERE {{tenant}} AND item_id = ?
       AND category_id IN (SELECT category_id FROM checklist_categories WHERE trip_id = ?)`,
    args as import('@libsql/client').InValue[]
  );
}

export async function removeItem(ctx: TenantContext, tripId: number, itemId: number): Promise<void> {
  await scopedExecute(
    ctx,
    `DELETE FROM checklist_items
     WHERE {{tenant}} AND item_id = ? AND category_id IN (SELECT category_id FROM checklist_categories WHERE trip_id = ?)`,
    [itemId, tripId]
  );
}

/**
 * Additive merge of AI-generated categories/items. Existing categories (by name,
 * case-insensitive) are reused; duplicate items (by name within a category) are
 * skipped. Never wipes anything.
 */
export async function mergeGenerated(
  ctx: TenantContext, tripId: number,
  generated: { category: string; kind?: 'packing' | 'task'; items: { name: string; priority?: string | null }[] }[]
): Promise<{ addedCategories: number; addedItems: number }> {
  let addedCategories = 0, addedItems = 0;
  const existingCats = await listChecklist(ctx, tripId);

  for (const g of generated) {
    const gname = g.category.trim();
    let cat = existingCats.find((c) => c.category_name.toLowerCase() === gname.toLowerCase());
    let catId: number;
    let existingItemNames: Set<string>;
    if (cat) {
      catId = cat.category_id;
      existingItemNames = new Set(cat.items.map((i) => i.item_name.toLowerCase()));
    } else {
      catId = await addCategory(ctx, tripId, gname, g.kind ?? 'packing');
      addedCategories++;
      existingItemNames = new Set();
      existingCats.push({ category_id: catId, category_name: gname, kind: g.kind ?? 'packing', display_order: 0, items: [] });
    }
    for (const it of g.items) {
      const nm = it.name.trim();
      if (!nm || existingItemNames.has(nm.toLowerCase())) continue;
      await addItem(ctx, tripId, catId, nm, it.priority ?? null);
      existingItemNames.add(nm.toLowerCase());
      addedItems++;
    }
  }
  return { addedCategories, addedItems };
}

export async function getChecklistStats(ctx: TenantContext, tripId: number): Promise<{ total: number; done: number; highPending: number }> {
  const rows = await scopedQuery(
    ctx,
    `SELECT i.is_done, i.priority
     FROM checklist_items i
     JOIN checklist_categories c ON c.category_id = i.category_id
     WHERE {{tenant:i}} AND c.trip_id = ?`,
    [tripId]
  );
  let total = 0, done = 0, highPending = 0;
  for (const r of rows) {
    total++;
    if (Number(r.is_done) === 1) done++;
    else if (r.priority === 'high') highPending++;
  }
  return { total, done, highPending };
}