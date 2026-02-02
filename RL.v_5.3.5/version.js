// Single source of truth for version/build info.
// Update rules:
// - Patch: patch += 1
// - Feature: minor += 1, patch = 0
// - Save schema change: saveSchema += 1
(() => {
    'use strict';

    const v = {
        brandName: 'RECLAIM',
        major: 5,
        minor: 3,
        patch: 5,
        build: '2026-02-03.3',
        saveSchema: 1
    };

    v.brand = `${v.brandName} ${v.major}`;
    v.version = `v${v.major}.${v.minor}.${v.patch}`;
    v.label = `${v.brand} · ${v.version} · build ${v.build}`;

    window.RECLAIM_VERSION = v;
})();
