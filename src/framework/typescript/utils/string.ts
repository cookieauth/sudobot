export function normalize(str: string, skip = false) {
    if (skip) {
        return str;
    }

    return str.replace(/[\u0300-\u036f]/g, "");
}

export function isDigit(char: string) {
    return char >= "0" && char <= "9";
}

export function isAlpha(char: string) {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}