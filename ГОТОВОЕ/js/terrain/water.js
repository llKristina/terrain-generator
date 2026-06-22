let waterMesh = null;
let waterShine = null;
let riverMesh = null;
let riverShine = null;
let lakeDataGlobal = null;
let riverDataGlobal = null;
let oasisGrassGroup = null;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function getPlacementCenter(placement, half, factor = 0.42) {
    const offset = half * factor;
    return {
        x: placement && placement.x === 'left' ? -offset : placement && placement.x === 'right' ? offset : 0,
        z: placement && placement.z === 'back' ? -offset : placement && placement.z === 'front' ? offset : 0
    };
}

function getPlacementScore(x, z, placement, half) {
    if (!placement || (!placement.x && !placement.z)) return 0;
    const target = getPlacementCenter(placement, half);
    let score = 0;
    if (placement.x) score -= Math.abs(x - target.x) * 1.8;
    if (placement.z) score -= Math.abs(z - target.z) * 1.8;
    return score;
}

function clampPointToTerrain(point, half, margin = 0.5) {
    return {
        x: clamp(point.x, -half + margin, half - margin),
        z: clamp(point.z, -half + margin, half - margin)
    };
}

function clampRiverPointsToTerrain(points, half, margin = 0.5) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
        const p = clampPointToTerrain(points[i], half, margin);
        const last = result[result.length - 1];
        if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.z - p.z) > 0.01) {
            result.push(p);
        }
    }
    return result;
}

function movePathToPlacement(points, placement, half, margin = 12) {
    if (!placement || (!placement.x && !placement.z)) return points;
    const target = getPlacementCenter(placement, half, 0.40);
    let cx = 0;
    let cz = 0;
    for (const p of points) {
        cx += p.x;
        cz += p.z;
    }
    cx /= points.length;
    cz /= points.length;
    const dx = placement.x ? target.x - cx : 0;
    const dz = placement.z ? target.z - cz : 0;
    return points.map(p => ({
        x: clamp(p.x + dx, -half + margin, half - margin),
        z: clamp(p.z + dz, -half + margin, half - margin)
    }));
}

function distanceToSegment(x, z, p1, p2) {
    const ax = x - p1.x;
    const az = z - p1.z;
    const bx = p2.x - p1.x;
    const bz = p2.z - p1.z;
    const len2 = bx * bx + bz * bz;
    let t = 0;
    if (len2 > 0) {
        t = clamp((ax * bx + az * bz) / len2, 0, 1);
    }
    const closestX = p1.x + bx * t;
    const closestZ = p1.z + bz * t;
    const dx = x - closestX;
    const dz = z - closestZ;
    return {
        distance: Math.sqrt(dx * dx + dz * dz),
        t: t,
        x: closestX,
        z: closestZ
    };
}

function getDistanceToRiver(x, z, riverData) {
    let minDistance = Infinity;
    let bestSegment = 0;
    let bestT = 0;
    for (let i = 0; i < riverData.points.length - 1; i++) {
        const result = distanceToSegment(x, z, riverData.points[i], riverData.points[i + 1]);
        if (result.distance < minDistance) {
            minDistance = result.distance;
            bestSegment = i;
            bestT = result.t;
        }
    }
    return {
        distance: minDistance,
        segment: bestSegment,
        t: bestT
    };
}

function sampleHeightFromMap(heightMap, x, z, half, step) {
    if (!heightMap || !heightMap.length) {
        return 0;
    }
    const maxIndex = heightMap.length - 1;
    const gx = clamp((x + half) / step, 0, maxIndex);
    const gz = clamp((z + half) / step, 0, maxIndex);
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = clamp(x0 + 1, 0, maxIndex);
    const z1 = clamp(z0 + 1, 0, maxIndex);
    const tx = gx - x0;
    const tz = gz - z0;
    const h00 = heightMap[z0][x0];
    const h10 = heightMap[z0][x1];
    const h01 = heightMap[z1][x0];
    const h11 = heightMap[z1][x1];
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;
    return h0 * (1 - tz) + h1 * tz;
}

function isInsideTerrainBounds(x, z, half, margin = 8) {
    return x > -half + margin && x < half - margin && z > -half + margin && z < half - margin;
}

function findBestLakePosition(heightMap, half, step, params) {
    const candidates = [];
    const lakePlacement = params.layoutHints && params.layoutHints.lake ? params.layoutHints.lake : null;
    const margin = 55;
    const isMountain = params.type === 'mountains';
    for (let i = margin; i < heightMap.length - margin; i += 5) {
        for (let j = margin; j < heightMap[i].length - margin; j += 5) {
            const y = heightMap[i][j];
            const x = -half + j * step;
            const z = -half + i * step;
            const distToCenter = Math.sqrt(x * x + z * z);
            let flatness = 0;
            let samples = 0;
            for (let di = -6; di <= 6; di++) {
                for (let dj = -6; dj <= 6; dj++) {
                    const ni = i + di;
                    const nj = j + dj;
                    if (
                        ni >= 0 &&
                        ni < heightMap.length &&
                        nj >= 0 &&
                        nj < heightMap[i].length
                    ) {
                        flatness += Math.abs(heightMap[ni][nj] - y);
                        samples++;
                    }
                }
            }

            flatness = flatness / Math.max(1, samples);
            let score = 0;
            score -= y * 5;
            score -= flatness * 12;
            if (Math.abs(x) > half - 45 || Math.abs(z) > half - 45) {
                score -= 100;
            }
            if (isMountain) {
                if (distToCenter < 45) {
                    score -= 120;
                }
                if (distToCenter > 55 && distToCenter < 115) {
                    score += 35;
                }
            }            
            score += getPlacementScore(x, z, lakePlacement, half);
            score += Math.random() * 55;
            candidates.push({
                x: x,
                z: z,
                y: y,
                score: score
            });
        }
    }
    candidates.sort(function(a, b) {
        return b.score - a.score;
    });
    const topCount = Math.min(18, candidates.length);
    const selected = candidates[Math.floor(Math.random() * topCount)];
    let radiusX = 34 + Math.random() * 22;
    let radiusZ = 28 + Math.random() * 19;
    if (params.type === 'mountains') {
        radiusX = 32 + Math.random() * 18;
        radiusZ = 26 + Math.random() * 15;
    }
    if (params.type === 'hills') {
        radiusX = 40 + Math.random() * 20;
        radiusZ = 32 + Math.random() * 18;
    }
    const safeEdge = 22;
    const maxRadiusX = Math.max(16, half - Math.abs(selected.x) - safeEdge);
    const maxRadiusZ = Math.max(16, half - Math.abs(selected.z) - safeEdge);
    radiusX = Math.min(radiusX, maxRadiusX * 0.75);
    radiusZ = Math.min(radiusZ, maxRadiusZ * 0.75);
    const rotation = Math.random() * Math.PI * 2;
    return {
    x: selected.x,
    z: selected.z,
    waterLevel: selected.y + 0.60,
    radius: Math.max(radiusX, radiusZ),
    radiusX: radiusX,
    radiusZ: radiusZ,
    rotation: rotation,
    depth: 8.0 + Math.random() * 5.0,
    shoreWidth: 0.20 + Math.random() * 0.08,
    noiseSeedX: Math.random() * 1000,
    noiseSeedZ: Math.random() * 1000,
    irregularity: 0.28 + Math.random() * 0.22,
    waterScale: 1.10,
    basinScale: 1.10
};
}

function applyLakeToHeightmap(x, z, y, lakeData) {
    if (!lakeData) return y;
    if (lakeData.isOasis) {
    const local = getLakeLocalCoords(x, z, lakeData);
    const shapeFactor = getLakeShapeFactor(local.x, local.z, lakeData);
    const rx = lakeData.radiusX * shapeFactor * (lakeData.basinScale || 1.16);
    const rz = lakeData.radiusZ * shapeFactor * (lakeData.basinScale || 1.16);
    const d = Math.sqrt((local.x * local.x) / (rx * rx) + (local.z * local.z) / (rz * rz));
    const shore = lakeData.shoreWidth || 0.28;
    if (d > 1 + shore) return y;
    if (d <= 1) {
        const t = Math.max(0, Math.min(1, d));
        const centerDepth = lakeData.depth || 10.0;
        const edgeDepth = 0.45;
        const depthHere = edgeDepth + Math.pow(1 - t, 1.35) * centerDepth;
        const bottomY = lakeData.waterLevel - depthHere;
        return Math.min(y, bottomY);
    }
    const shoreT = (d - 1) / shore;
    const k = 1 - smoothstep(0, 1, shoreT);
    const shoreTarget = lakeData.waterLevel + 0.03;

    return y * (1 - k * 0.42) + shoreTarget * (k * 0.42);
}

    const radiusX = lakeData.radiusX || lakeData.radius || 25;
    const radiusZ = lakeData.radiusZ || lakeData.radius || 25;
    const rotation = lakeData.rotation || 0;
    const dx = x - lakeData.x;
    const dz = z - lakeData.z;
    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);
    let localX = dx * cosR - dz * sinR;
    let localZ = dx * sinR + dz * cosR;
    const shapeFactor = getLakeShapeFactor(localX, localZ, lakeData);
    const basinScale = lakeData.basinScale || 1.10;
    const effectiveRadiusX = radiusX * shapeFactor * basinScale;
    const effectiveRadiusZ = radiusZ * shapeFactor * basinScale;
    const d = Math.sqrt((localX * localX) / (effectiveRadiusX * effectiveRadiusX) + (localZ * localZ) / (effectiveRadiusZ * effectiveRadiusZ));

    const shoreWidth = lakeData.shoreWidth || 0.22;

    if (d > 1 + shoreWidth) return y;

    if (d <= 1) {
        const t = Math.max(0, Math.min(1, d));
        const centerDepth = lakeData.depth || 13.0;
        const shallowDepth = 0.45;
        const coneFactor = Math.pow(1 - t, 1.15);
        const currentDepth = shallowDepth + coneFactor * centerDepth;
        const bottomY = lakeData.waterLevel - currentDepth;
        return Math.min(y, bottomY);
    }
    const shoreT = (d - 1) / shoreWidth;
    const k = 1 - smoothstep(0, 1, shoreT);
    const shoreTarget = lakeData.waterLevel + 0.04;
    return y * (1 - k * 0.45) + shoreTarget * (k * 0.45);
}

function getLakeLocalCoords(x, z, lakeData) {
    const dx = x - lakeData.x;
    const dz = z - lakeData.z;
    const cosR = Math.cos(-(lakeData.rotation || 0));
    const sinR = Math.sin(-(lakeData.rotation || 0));
    return { x: dx * cosR - dz * sinR, z: dx * sinR + dz * cosR };
}

function getLakeShapeFactor(localX, localZ, lakeData) {
    const angle = Math.atan2(localZ, localX);
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);

    if (lakeData.isOasis) {
        const irregularity = lakeData.irregularity || 0.18;
        const wave1 = Math.sin(angle * 2.1 + lakeData.noiseSeedX * 0.01) * 0.55;
        const wave2 = Math.sin(angle * 3.7 + lakeData.noiseSeedZ * 0.01) * 0.30;
        const wave3 = Math.sin(angle * 5.2 + lakeData.noiseSeedX * 0.003) * 0.15;

        const factor = 1 + irregularity * (wave1 + wave2 + wave3);
        return clamp(factor, 0.82, 1.22);
    }

    let noise1 = 0;
    let noise2 = 0;
    let noise3 = 0;

    if (typeof perlin !== 'undefined' && perlin) {
        noise1 = perlin.noise2D(nx * 1.7 + lakeData.noiseSeedX, nz * 1.7 + lakeData.noiseSeedZ);
        noise2 = perlin.noise2D(nx * 2.8 + lakeData.noiseSeedX + 300, nz * 2.8 + lakeData.noiseSeedZ + 300);
        noise3 = perlin.noise2D(nx * 4.2 + lakeData.noiseSeedX + 700, nz * 4.2 + lakeData.noiseSeedZ + 700);
    }

    const irregularity = lakeData.irregularity || 0.22;
    return 1 + noise1 * irregularity + noise2 * irregularity * 0.45 + noise3 * irregularity * 0.2;
}

function addWaterLake(lakeData) {
    if (!lakeData) return null;

    if (lakeData.isOasis) {
    const points = [];
    const segments = 160;
    const radiusX = lakeData.radiusX || lakeData.radius || 25;
    const radiusZ = lakeData.radiusZ || lakeData.radius || 25;
    const rotation = lakeData.rotation || 0;
    const waterScale = lakeData.waterScale || 0.94;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    for (let i = 0; i < segments; i++) {
        const angle = i / segments * Math.PI * 2;

        let localX = Math.cos(angle) * radiusX;
        let localZ = Math.sin(angle) * radiusZ;

        const shapeFactor = getLakeShapeFactor(localX, localZ, lakeData);

        localX *= shapeFactor * waterScale;
        localZ *= shapeFactor * waterScale;

        const rotatedX = localX * cosR - localZ * sinR;
        const rotatedZ = localX * sinR + localZ * cosR;

        points.push(new THREE.Vector2(rotatedX, -rotatedZ));
    }

    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geometry, window.createWaterMaterial(lakeData));
    water.position.set(lakeData.x, lakeData.waterLevel + 0.08, lakeData.z);
    water.renderOrder = 10;

    return water;
}
    const points = [];
    const segments = 180;
    const radiusX = lakeData.radiusX || lakeData.radius || 25;
    const radiusZ = lakeData.radiusZ || lakeData.radius || 25;
    const rotation = lakeData.rotation || 0;
    const waterScale = lakeData.waterScale || 0.96;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;

    let localX = Math.cos(angle) * radiusX;
    let localZ = Math.sin(angle) * radiusZ;

    const shapeFactor = getLakeShapeFactor(localX, localZ, lakeData);

    localX *= shapeFactor * waterScale;
    localZ *= shapeFactor * waterScale;

    const rotatedX = localX * cosR - localZ * sinR;
    const rotatedZ = localX * sinR + localZ * cosR;

    points.push(new THREE.Vector2(rotatedX, -rotatedZ));
}

    const shape = new THREE.Shape(points);
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);

    const water = new THREE.Mesh(geometry, createWaterMaterial(lakeData));
    water.position.set(lakeData.x, lakeData.waterLevel + 0.05, lakeData.z);
    water.renderOrder = 10;
    return water;
}

function getLakeInfluence(x, z, lakeData) {
    if (!lakeData) return 0;

    if (lakeData.isOasis) {
        const local = getLakeLocalCoords(x, z, lakeData);

        const rx = lakeData.radiusX * (lakeData.basinScale || 1.12);
        const rz = lakeData.radiusZ * (lakeData.basinScale || 1.12);

        const d = Math.sqrt(
            (local.x * local.x) / (rx * rx) +
            (local.z * local.z) / (rz * rz)
        );

        return 1 - smoothstep(1.0, 1.35, d);
    }

    const radiusX = lakeData.radiusX || lakeData.radius || 25;
    const radiusZ = lakeData.radiusZ || lakeData.radius || 25;
    const rotation = lakeData.rotation || 0;

    const dx = x - lakeData.x;
    const dz = z - lakeData.z;

    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);

    const localX = dx * cosR - dz * sinR;
    const localZ = dx * sinR + dz * cosR;

    const shapeFactor = getLakeShapeFactor(localX, localZ, lakeData);
    const basinScale = lakeData.basinScale || 1.14;

    const effectiveRadiusX = radiusX * shapeFactor * basinScale;
    const effectiveRadiusZ = radiusZ * shapeFactor * basinScale;

    const d = Math.sqrt(
        (localX * localX) / (effectiveRadiusX * effectiveRadiusX) +
        (localZ * localZ) / (effectiveRadiusZ * effectiveRadiusZ)
    );

    return 1 - smoothstep(1.0, 1.35, d);
}

function generateRiverPath(segments = 72, heightMap = null, half = 140, step = 1, params = {}) {
    const points = [];
    const edgePadding = 18;
    const startX = -half - edgePadding;
    const endX = half + edgePadding;

    let peakX = 0;
    let peakZ = 0;
    let maxHeight = -Infinity;

    if (heightMap) {
        for (let i = 0; i < heightMap.length; i += 4) {
            for (let j = 0; j < heightMap[i].length; j += 4) {
                if (heightMap[i][j] > maxHeight) {
                    maxHeight = heightMap[i][j];
                    peakX = -half + j * step;
                    peakZ = -half + i * step;
                }
            }
        }
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const baseZ = params.type === 'mountains' ? side * (70 + Math.random() * 30) : -70 + Math.random() * 140;

    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    const phase3 = Math.random() * Math.PI * 2;
    const phase4 = Math.random() * Math.PI * 2;

    let currentZ = baseZ;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = startX + (endX - startX) * t;

        let z = baseZ;
        z += Math.sin(t * Math.PI * 2.1 + phase1) * 42;
        z += Math.sin(t * Math.PI * 4.6 + phase2) * 22;
        z += Math.sin(t * Math.PI * 8.2 + phase3) * 10;
        z += Math.sin(t * Math.PI * 13.0 + phase4) * 4;

        if (heightMap && params.type === 'mountains') {
            const distToPeak = Math.sqrt((x - peakX) * (x - peakX) + (z - peakZ) * (z - peakZ));
            if (distToPeak < 95) {
                const push = (95 - distToPeak) / 95;
                const direction = z < peakZ ? -1 : 1;
                z += direction * push * 75;
            }
        }

        if (heightMap) {
            let bestZ = z;
            let bestScore = Infinity;

            for (let offset = -22; offset <= 22; offset += 4) {
                const testZ = clamp(z + offset, -half - 10, half + 10);
                const y = sampleHeightFromMap(heightMap, clamp(x, -half, half), clamp(testZ, -half, half), half, step);

                let score = y * 1.4;
                score += Math.abs(testZ - z) * 0.6;
                score += Math.abs(testZ - currentZ) * 0.35;

                if (params.type === 'mountains') {
                    const distToPeak = Math.sqrt((x - peakX) * (x - peakX) + (testZ - peakZ) * (testZ - peakZ));
                    if (distToPeak < 70) score += 8000;
                    if (distToPeak >= 70 && distToPeak < 105) score += (105 - distToPeak) * 60;
                }

                if (Math.abs(testZ) > half - 4) score += 120;

                if (score < bestScore) {
                    bestScore = score;
                    bestZ = testZ;
                }
            }

            z = bestZ;
        }

        currentZ = currentZ * 0.45 + z * 0.55;
        points.push({ x: x, z: clamp(currentZ, -half - 8, half + 8) });
    }

    return points;
}

function smoothRiverPath(points, passes = 3) {
    let result = points.map(p => ({ x: p.x, z: p.z }));

    for (let pass = 0; pass < passes; pass++) {
        const smoothed = [];

        for (let i = 0; i < result.length; i++) {
            if (i === 0 || i === result.length - 1) {
                smoothed.push({ x: result[i].x, z: result[i].z });
                continue;
            }

            const prev = result[i - 1];
            const curr = result[i];
            const next = result[i + 1];

            smoothed.push({
                x: prev.x * 0.2 + curr.x * 0.6 + next.x * 0.2,
                z: prev.z * 0.2 + curr.z * 0.6 + next.z * 0.2
            });
        }

        result = smoothed;
    }

    return result;
}

function findDesertOasisPosition(heightMap, half, step, params) {
    const oasisPlacement = params.layoutHints && params.layoutHints.oasis ? params.layoutHints.oasis : null;

    let bestX = 0;
    let bestZ = 0;
    let bestY = Infinity;
    let bestScore = -Infinity;

    const margin = 25;

    for (let i = margin; i < heightMap.length - margin; i += 2) {
        for (let j = margin; j < heightMap[i].length - margin; j += 2) {
            const x = -half + j * step;
            const z = -half + i * step;
            const y = heightMap[i][j];

            const distToCenter = Math.sqrt(x * x + z * z);
            if (distToCenter > half * 0.75) continue;

            let score = -y * 8;
            score += getPlacementScore(x, z, oasisPlacement, half);

            if (score > bestScore) {
                bestScore = score;
                bestY = y;
                bestX = x;
                bestZ = z;
            }
        }
    }

    const radiusX = 34 + Math.random() * 8;
    const radiusZ = 24 + Math.random() * 6;
    const rotation = Math.random() * Math.PI * 2;

    return {
        x: bestX,
        z: bestZ,
        waterLevel: bestY - 0.1,
        radius: Math.max(radiusX, radiusZ),
        radiusX: radiusX,
        radiusZ: radiusZ,
        rotation: rotation,
        depth: 10.0 + Math.random() * 2.5,
        shoreWidth: 0.28,
        basinScale: 1.16,
        waterScale: 1.16,
        noiseSeedX: Math.random() * 1000,
        noiseSeedZ: Math.random() * 1000,
        irregularity: 0.16 + Math.random() * 0.08,
        isOasis: true
    };
}


function addOasisGrass(scene, oasisData, heightMap, half, step) {
    if (!scene || !oasisData) return;

    if (oasisGrassGroup) {
        scene.remove(oasisGrassGroup);
        oasisGrassGroup = null;
    }

    oasisGrassGroup = new THREE.Group();

    const grassModels = window.grassModels || [];
    const cactusModels = window.cactusModels || [];

    console.log('CACTUS MODELS COUNT:', cactusModels.length);

    const maxRadius = Math.max(oasisData.radiusX || 18, oasisData.radiusZ || 14);
    const innerRadius = maxRadius + 4;
    const outerRadius = maxRadius + 18;

    if (!grassModels.length) console.warn('OASIS: grass models are not loaded');
    if (!cactusModels.length) console.warn('OASIS: cactus models are not loaded');

    for (let i = 0; i < 90; i++) {
        if (!grassModels.length) break;

        const angle = Math.random() * Math.PI * 2;
        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
        const x = oasisData.x + Math.cos(angle) * dist;
        const z = oasisData.z + Math.sin(angle) * dist;
        if (!isInsideTerrainBounds(x, z, half, 6)) continue;
        const y = sampleHeightFromMap(heightMap, x, z, half, step);

        const sourceModel = grassModels[Math.floor(Math.random() * grassModels.length)];
        if (!sourceModel) continue;

        const grass = sourceModel.clone(true);

        grass.position.set(x, y, z);
        grass.rotation.y = Math.random() * Math.PI * 2;

        const scale = 0.45 + Math.random() * 0.25;
        grass.scale.set(scale, scale, scale);

        grass.traverse(function(obj) {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                if (obj.material) obj.material = obj.material.clone();
            }
        });

        oasisGrassGroup.add(grass);
    }

    for (let i = 0; i < 14; i++) {
    if (!cactusModels.length) break;

    const angle = Math.random() * Math.PI * 2;
    const dist = outerRadius - 6 + Math.random() * 18;

    const x = oasisData.x + Math.cos(angle) * dist;
    const z = oasisData.z + Math.sin(angle) * dist;
    if (!isInsideTerrainBounds(x, z, half, 8)) continue;
    const y = sampleHeightFromMap(heightMap, x, z, half, step);

    const sourceModel = cactusModels[Math.floor(Math.random() * cactusModels.length)];
    if (!sourceModel) continue;

    const cactus = sourceModel.clone(true);

    cactus.traverse(function(obj) {
        if (obj.isMesh) {
            obj.visible = true;
            obj.castShadow = true;
            obj.receiveShadow = true;

            if (obj.material) {
                obj.material = obj.material.clone();
                obj.material.side = THREE.DoubleSide;
            }
        }
    });

    const box = new THREE.Box3().setFromObject(cactus);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    cactus.position.sub(center);

    const targetHeight = 6 + Math.random() * 4;
    const maxSize = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetHeight / maxSize;

    cactus.scale.set(scale, scale, scale);

    cactus.position.set(x, y + 0.4, z);
    cactus.rotation.y = Math.random() * Math.PI * 2;

    oasisGrassGroup.add(cactus);
}

    scene.add(oasisGrassGroup);
}

function applyRiverToHeightmap(x, z, y, riverData) {
    if (!riverData || !riverData.points || riverData.points.length < 2) return y;

    const info = getDistanceToRiver(x, z, riverData);
    const dist = info.distance;

    const waterWidth = riverData.width || 26;
    const bedWidth = waterWidth * 0.85;
    const bankWidth = waterWidth * 6.5;
    const depth = riverData.depth || 1.8;

    if (dist > bankWidth) return y;

    let cut = 0;

    if (dist <= bedWidth) {
        const t = dist / bedWidth;
        cut = depth * (1.0 - t * t);
    } else {
        const t = (dist - bedWidth) / (bankWidth - bedWidth);
        const fade = 1.0 - smoothstep(0.0, 1.0, t);
        cut = depth * 0.25 * fade * fade;
    }

    return y - cut;
}
function finalSmoothRiverBanks(heightMap, riverData, half, step) {
    if (!heightMap || !riverData) return;
    for (let pass = 0; pass < 4; pass++) {
        const copy = heightMap.map(row => row.slice());
        
        for (let i = 3; i < heightMap.length - 3; i++) {
            for (let j = 3; j < heightMap[i].length - 3; j++) {
                const x = -half + j * step;
                const z = -half + i * step;
                
                const info = getDistanceToRiver(x, z, riverData);
                const riverInfluence = (riverData.width || 16) * 7;
                
                if (info.distance < riverInfluence) {
                    let sum = 0;
                    let weight = 0;
                    
                    for (let di = -3; di <= 3; di++) {
                        for (let dj = -3; dj <= 3; dj++) {
                            const w = 1 / (1 + Math.abs(di) + Math.abs(dj));
                            sum += copy[i + di][j + dj] * w;
                            weight += w;
                        }
                    }
                    
                    const avg = sum / weight;
                    const blend = 0.7 * (1 - info.distance / riverInfluence);
                    heightMap[i][j] = copy[i][j] * (1 - blend) + avg * blend;
                }
            }
        }
    }
}

function smoothRiverBanks(heightMap, riverData, half, step, passes = 7, strength = 0.55) {
    if (!heightMap || !riverData) return;

    for (let pass = 0; pass < passes; pass++) {
        const copy = heightMap.map(row => row.slice());

        for (let i = 2; i < heightMap.length - 2; i++) {
            for (let j = 2; j < heightMap[i].length - 2; j++) {
                const x = -half + j * step;
                const z = -half + i * step;

                const info = getDistanceToRiver(x, z, riverData);
                const maxInfluence = (riverData.width || 16) * 5.5;

                if (info.distance > maxInfluence) continue;

                let sum = 0;
                let weight = 0;

                for (let di = -2; di <= 2; di++) {
                    for (let dj = -2; dj <= 2; dj++) {
                        const w = (Math.abs(di) <= 1 && Math.abs(dj) <= 1) ? 2 : 1;
                        sum += copy[i + di][j + dj] * w;
                        weight += w;
                    }
                }

                const avg = sum / weight;
                const influence = 1.0 - smoothstep((riverData.width || 16) * 0.8, maxInfluence, info.distance);

                heightMap[i][j] = copy[i][j] * (1.0 - strength * influence) + avg * (strength * influence);
            }
        }
    }
}

function carveRiverIntoHeightMap(heightMap, riverData, half, step) {
    if (!heightMap || !riverData || !riverData.points) return;

    for (let i = 0; i < heightMap.length; i++) {
        for (let j = 0; j < heightMap[i].length; j++) {
            const x = -half + j * step;
            const z = -half + i * step;

            heightMap[i][j] = applyRiverToHeightmap(x, z, heightMap[i][j], riverData);
        }
    }

    smoothRiverBanks(heightMap, riverData, half, step, 16, 0.85);
    finalSmoothRiverBanks(heightMap, riverData, half, step);
}

function generateCanyonRiverPath(segments = 72, params = {}, half = 140) {
    const points = [];

    const placement = params.layoutHints && params.layoutHints.canyon ? params.layoutHints.canyon : null;
    const center = getPlacementCenter(placement, half, 0.38);

    const startX = -135;
    const endX = 135;

    const roughness = params.roughness || 0.6;
    const sinuousAmount = 5 + roughness * 8;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;

        const localX = startX + (endX - startX) * t;

        let centerOffset = 0;

        if (typeof perlin !== 'undefined' && perlin) {
            centerOffset = perlin.octaveNoise2D(localX * 0.005, 0, 2, 0.5, 1.0) * 15;
        }

        const sinuous = Math.sin(localX * 0.05) * sinuousAmount;

        const x = localX + center.x;
        const z = sinuous + centerOffset + center.z;

        points.push({ x: clamp(x, -half + 10, half - 10), z: clamp(z, -half + 10, half - 10) });
    }

    return points;
}

function addRiver(riverData) {
    if (!riverData || !riverData.points || riverData.points.length < 2) return null;
    const half = riverData.half || 140;
    const points = clampRiverPointsToTerrain(riverData.points, half, 0.8);

    if (points.length < 2) return null;

    const width = riverData.width || 17;
    const halfWidth = width / 2;
    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];

        const dx = next.x - prev.x;
        const dz = next.z - prev.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;

        const nx = -dz / len;
        const nz = dx / len;

        const widthWave = Math.sin(i * 0.35) * 1.8 + Math.sin(i * 0.9) * 0.9;
        const localHalfWidth = halfWidth + widthWave;

        let leftX = points[i].x + nx * localHalfWidth;
        let leftZ = points[i].z + nz * localHalfWidth;
        let rightX = points[i].x - nx * localHalfWidth;
        let rightZ = points[i].z - nz * localHalfWidth;

        leftX = clamp(leftX, -half + 0.5, half - 0.5);
        leftZ = clamp(leftZ, -half + 0.5, half - 0.5);
        rightX = clamp(rightX, -half + 0.5, half - 0.5);
        rightZ = clamp(rightZ, -half + 0.5, half - 0.5);

        const centerY = sampleHeightFromMap(riverData.heightMap, points[i].x, points[i].z, riverData.half, riverData.step);
        const leftBankY = sampleHeightFromMap(riverData.heightMap, leftX, leftZ, riverData.half, riverData.step);
        const rightBankY = sampleHeightFromMap(riverData.heightMap, rightX, rightZ, riverData.half, riverData.step);
        const bankMin = Math.min(leftBankY, rightBankY);
        const waterSurfaceY = centerY + 0.95;
        vertices.push(leftX, waterSurfaceY, leftZ);
        vertices.push(rightX, waterSurfaceY, rightZ);
        uvs.push(0, i / (points.length - 1));
        uvs.push(1, i / (points.length - 1));
    }

    for (let i = 0; i < points.length - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;

        indices.push(a, b, c);
        indices.push(b, d, c);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = window.createRiverMaterial();

    const river = new THREE.Mesh(geometry, material);
    river.renderOrder = 20;

    river.updateWater = function(deltaTime) {
        if (this.material && this.material.uniforms) {
            this.material.uniforms.time.value += deltaTime;
        }
    };

    return river;
}

function addCanyonRiver(riverData) {
    if (!riverData) return null;

    const points = riverData.points;
    const width = riverData.width || 8;
    const halfWidth = width / 2;

    const vertices = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const dx = next.x - prev.x;
        const dz = next.z - prev.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const localWidth =halfWidth +Math.sin(i * 0.7) * 0.8 + Math.sin(i * 1.9) * 0.35;
        const leftX = points[i].x + nx * localWidth;
        const leftZ = points[i].z + nz * localWidth;
        const rightX = points[i].x - nx * localWidth;
        const rightZ = points[i].z - nz * localWidth;
        const centerY =sampleHeightFromMap(riverData.heightMap, points[i].x, points[i].z, riverData.half, riverData.step);
        const waterY = centerY + 7.75;
        vertices.push(leftX, waterY, leftZ);
        vertices.push(rightX, waterY, rightZ);
        uvs.push(0, i / (points.length - 1));
        uvs.push(1, i / (points.length - 1));
    }

    for (let i = 0; i < points.length - 1; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;

        indices.push(a, b, c);
        indices.push(b, d, c);
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            new Float32Array(vertices),
            3
        )
    );

    geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(
            new Float32Array(uvs),
            2
        )
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = window.createCanyonRiverMaterial();

    const river = new THREE.Mesh(geometry,material);

    river.renderOrder = 12;

    river.updateWater = function(deltaTime) {
        if (this.material && this.material.uniforms) {
            this.material.uniforms.time.value += deltaTime;
        }
    };

    return river;
}

function removeWater() {
    if (waterMesh) {
        scene.remove(waterMesh);
        waterMesh = null;
    }

    if (waterShine) {
        scene.remove(waterShine);
        waterShine = null;
    }
}

function removeRiver() {
    if (riverMesh) {
        scene.remove(riverMesh);
        riverMesh = null;
    }

    if (riverShine) {
        scene.remove(riverShine);
        riverShine = null;
    }
}

window.findBestLakePosition = findBestLakePosition;
window.applyLakeToHeightmap = applyLakeToHeightmap;
window.addWaterLake = addWaterLake;
window.getLakeInfluence = getLakeInfluence;
window.smoothRiverPath = smoothRiverPath;
window.smoothRiverBanks = smoothRiverBanks;
window.findDesertOasisPosition = findDesertOasisPosition;
window.addOasisGrass = addOasisGrass;
window.generateRiverPath = generateRiverPath;
window.generateCanyonRiverPath = generateCanyonRiverPath;
window.applyRiverToHeightmap = applyRiverToHeightmap;
window.carveRiverIntoHeightMap = carveRiverIntoHeightMap;
window.isInsideTerrainBounds = isInsideTerrainBounds;
window.addRiver = addRiver;
window.addCanyonRiver = addCanyonRiver;
window.getPlacementCenter = getPlacementCenter;
window.getPlacementScore = getPlacementScore;
window.movePathToPlacement = movePathToPlacement;
window.removeWater = removeWater;
window.removeRiver = removeRiver;