export function replace_all(s: string, search: string, replace: string): string {
    if (!s.includes(search)) return s; // Seems to improve speed overall.
    return s.split(search).join(replace);
}
