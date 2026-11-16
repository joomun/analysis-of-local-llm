export const fmt = (v, digits = 2, suffix = '') => {
    return (v === null || v === undefined) ? '—' : Number(v).toFixed(digits) + suffix;
};

export const round = (v, digits = 2) => {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
};