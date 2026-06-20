

function getMountainHeight(x, z, params) {
    const heightScale = params.height_scale || 0.7;
    const dist = Math.sqrt(x*x + z*z);
    let y = 0;
    
    if (dist < 40) {
        y += Math.max(0, (1 - dist/40) * 18) * heightScale;
        y += Math.sin(x * 0.12) * 2.5;
        y += Math.cos(z * 0.1) * 2.0;
    }
    
    return y;
}

function getVolcanoHeight(x, z, params) {
    const heightScale = params.height_scale || 0.7;
    const craterDist = Math.sqrt(x*x + z*z);
    let y = Math.max(0, (1 - Math.abs(craterDist - 15) / 10) * 25);
    if (craterDist < 8) y -= 8;
    return y * heightScale;
}

function getCanyonHeight(x, z, params) {
    const heightScale = params.height_scale || 0.7;
    const distFromCenter = Math.abs(z);
    const canyonWidth = 18;
    let y = 0;
    
    if (distFromCenter < canyonWidth) {
        const t = distFromCenter / canyonWidth;
        const canyonDepth = 15 * heightScale;
        y = - (1 - t) * canyonDepth;
    }
    y += Math.sin(x * 0.15) * 2;
    
    return y;
}

function getDesertHeight(x, z) {
    let y = Math.sin(x * 0.08) * 3.5;
    y += Math.cos(z * 0.06) * 2.8;
    y += Math.sin((x + z) * 0.25) * 0.8;
    return y * 0.35;
}

function getJungleHeight(x, z) {
    let y = perlin.octaveNoise2D(x * 0.12, z * 0.12, 5, 0.6, 1.0) * 4;
    y += Math.sin(x * 0.03) * 3;
    return y * 0.9;
}

function getHillsHeight(x, z) {
    let y = Math.sin(x * 0.04) * 5;
    y += Math.cos(z * 0.04) * 5;
    return y * 0.9;
}

function getPlainsHeight(x, z) {
    return perlin.octaveNoise2D(x * 0.03, z * 0.03, 2, 0.3, 1.0) * 1.2 * 0.2;
}

function getTundraHeight(x, z) {
    let y = Math.sin(x * 0.07) * 2.5;
    y += Math.cos(z * 0.07) * 2.5;
    const dist = Math.sqrt(x*x + z*z);
    y += Math.max(0, (1 - dist/50) * 4);
    return y * 0.5;
}

function getGardenHeight(x, z) {
    return perlin.octaveNoise2D(x * 0.1, z * 0.1, 3, 0.45, 1.0) * 2 * 0.6;
}

function getPlateauHeight(x, z) {
    let y = perlin.octaveNoise2D(x * 0.04, z * 0.04, 3, 0.4, 1.0) * 8;
    y = (y - 0.5) * 15;
    const plateauMask = Math.min(1, Math.max(0, (Math.sin(x * 0.08) * Math.cos(z * 0.08) + 0.5) * 1.5));
    return y * plateauMask + 8 * (1 - plateauMask);
}

function getWaterHeight(x, z) {
    const dist = Math.sqrt(x*x + z*z);
    let y = 0;
    if (dist < 28) {
        const t = 1 - dist / 28;
        y = -Math.pow(t, 2) * 12;
    }
    return Math.max(-3, Math.min(5, y));
}

function getForestHeight(x, z) {
    let y = Math.sin(x * 0.05) * 2;
    y += Math.cos(z * 0.05) * 2;
    y += perlin.octaveNoise2D(x * 0.08, z * 0.08, 2, 0.4, 1.0) * 2;
    return y * 0.75;
}

function getSwampHeight(x, z) {
    let y = Math.sin(x * 0.1) * 1.2;
    y += Math.cos(z * 0.1) * 1.2;
    y -= 2;
    return y * 0.25;
}

function getIslandHeight(x, z) {
    const dist = Math.sqrt(x*x + z*z);
    const islandShape = Math.max(0, (1 - dist / 45));
    let y = islandShape * 8;
    if (dist > 42) {
        y -= (dist - 42) * 2;
    }
    return Math.max(-2, Math.min(20, y));
}

function getBeachHeight(x, z) {
    const dist = Math.sqrt(x*x + z*z);
    let y = Math.sin(x * 0.06) * 1.5;
    y += Math.cos(z * 0.06) * 1.5;
    const islandShape = Math.max(0, (1 - dist / 52));
    y += islandShape * 4;
    if (dist > 38) {
        y -= (dist - 38) * 1.4;
    }
    if (dist < 20) {
        y += (1 - dist / 20) * 2;
    }
    return y * 0.18;
}

function getHeightByType(x, z, params) {
    const type = params.type || 'hills';
    const baseHeight = perlin.octaveNoise2D(x * 0.045, z * 0.045, 4, 0.55, 1.0);
    let baseY = (baseHeight - 0.5) * 2 * 18 * (params.height_scale || 0.7);
    
    switch(type) {
        case 'mountains': return baseY + getMountainHeight(x, z, params);
        case 'volcano': return baseY + getVolcanoHeight(x, z, params);
        case 'canyon': return baseY + getCanyonHeight(x, z, params);
        case 'desert': return getDesertHeight(x, z);
        case 'jungle': return getJungleHeight(x, z);
        case 'hills': return getHillsHeight(x, z);
        case 'plains': return getPlainsHeight(x, z);
        case 'tundra': return getTundraHeight(x, z);
        case 'garden': return getGardenHeight(x, z);
        case 'plateau': return getPlateauHeight(x, z);
        case 'water': return getWaterHeight(x, z);
        case 'forest': return getForestHeight(x, z);
        case 'swamp': return getSwampHeight(x, z);
        case 'island': return getIslandHeight(x, z);
        case 'beach': return getBeachHeight(x, z);
        default: return getHillsHeight(x, z);
    }
}