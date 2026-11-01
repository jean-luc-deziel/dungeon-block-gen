const w = (v, weight = 1) => ({ v, w: weight });
export const THEMES = [
    {
        id: 'UD',
        name: 'Ultimate Dungeon (UD)',
        floors: {
            stones: [w('UD-016', 6), w('UD-017', 3)],
            tiles: [w('UD-045', 5), w('UD-046', 2), w('UD-047', 2)],
            wood: [w('UD-035')],
        },
        corridorFloor: [w('UD-016', 5), w('UD-017', 2)],
        wall: [w('UD-001')],
        wallDecor: [
            w('UD-002'), w('UD-003'), w('UD-007'), w('UD-008'), w('UD-009'),
            w('UD-028'), w('UD-034'), w('UD-068'), w('UD-004', 0.5),
        ],
        torch: [w('UD-037', 3), w('UD-036', 1), w('UD-038', 1)],
        angle: [w('UD-014', 5), w('UD-013', 1)],
        corridor: [w('UD-012')],
        door: [w('UD-010', 3), w('UD-011', 1)],
        doubleDoor: { left: 'UD-082', right: 'UD-083' },
        stairsDown: 'UD-026',
        water: [w('UD-074', 6), w('UD-075', 2), w('UD-076', 1)],
        columns: [w('UD-084', 2), w('UD-086', 2), w('UD-087', 1)],
        brokenColumns: [w('UD-088'), w('UD-089')],
        braziers: [w('UD-039')],
        tables: [w('UD-031'), w('UD-032')],
        benches: [w('UD-033')],
        clutter: [w('UD-029', 2), w('UD-018', 1), w('UD-064', 1)],
        hazards: [w('UD-067', 2), w('UD-018', 2), w('UD-065', 1), w('UD-066', 1)],
        symbols: [w('UD-049', 2), w('UD-050'), w('UD-051'), w('UD-052'), w('UD-053')],
        wells: [w('UD-015'), w('UD-077')],
        altar: 'UD-080',
    },
];
//# sourceMappingURL=themes.js.map