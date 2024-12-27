function replace_all(s: string, search: string, replace: string): string {
    if (!s.includes(search)) {
        // Seems to improve speed overall.
        return s;
    }
    return s.split(search).join(replace);
}

export function debork_json(s: string): string {
    // Convert totally blank files into {}

    if (s.length < 50 && s.trim() === "") {
        s = "{}";
    }

    // Replace fruity quote characters. Note that these could exist in legit JSON,
    // which is why we only call this function if the first parse fails...

    s = replace_all(s, "“", '"');
    s = replace_all(s, "”", '"');

    // Replace single \ characters

    s = replace_all(s, "\\\\", "correct_zbcyg278gfdakjadjk");
    s = replace_all(s, "\\", "\\\\");
    s = replace_all(s, "correct_zbcyg278gfdakjadjk", "\\\\");

    return s;
}
