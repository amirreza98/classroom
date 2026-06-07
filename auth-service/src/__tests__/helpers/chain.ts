/**
 * Creates a Promise that also exposes every Drizzle ORM builder method,
 * each returning another chainable promise that resolves to the same `result`.
 *
 * This lets test code write:
 *   vi.mocked(db.select).mockReturnValueOnce(chain([{ count: 2 }]))
 *   vi.mocked(db.select).mockReturnValueOnce(chain(rows))
 *
 * And the route handler can do any combination of:
 *   await db.select({count}).from(x).where(y)            → [{ count: 2 }]
 *   await db.select().from(x).where(y).orderBy().limit(n).offset(m)  → rows
 *   await db.insert(x).values({}).returning()            → [created]
 */
export function chain<T>(result: T[]): any {
    const p = Promise.resolve(result);
    const methods: Record<string, (..._args: unknown[]) => any> = {};
    const names = [
        'from', 'where', 'orderBy', 'limit', 'offset',
        'leftJoin', 'innerJoin', 'set', 'values', 'returning',
    ];
    for (const name of names) {
        methods[name] = () => chain(result);
    }
    return Object.assign(p, methods);
}
