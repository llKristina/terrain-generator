let terrainSeedX = 0;
let terrainSeedZ = 0;
let mountainPeaks = [];
let oasisDataGlobal = null;

function getFeatureCenterFromHints(featureName, params, half, fallbackX = 0, fallbackZ = 0) {
    const placement = params.layoutHints && params.layoutHints[featureName] ? params.layoutHints[featureName] : null;

    if (!placement || (!placement.x && !placement.z)) {
        return { x: fallbackX, z: fallbackZ };
    }

    const center = getPlacementCenter(placement, half, 0.38);

    return {
        x: placement.x ? center.x : fallbackX,
        z: placement.z ? center.z : fallbackZ
    };
}


function generateMountainPeaks(params, half) {
    mountainPeaks = [];

    const count = params.mountain_count || 1;
    const center = getFeatureCenterFromHints('mountain', params, half, 0, 0);

    if (count === 1) {
        mountainPeaks.push({ x: center.x, z: center.z, radius: 95 + Math.random() * 15, height: 45 + params.height_scale * 42, main: true });
        return;
    }

    mountainPeaks.push({ x: center.x + (-15 + Math.random() * 30), z: center.z + (-10 + Math.random() * 20), radius: 85 + Math.random() * 20, height: 42 + params.height_scale * 38, main: true });

    for (let i = 1; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 45 + Math.random() * 70;

        mountainPeaks.push({
            x: clamp(center.x + Math.cos(angle) * dist, -half + 35, half - 35),
            z: clamp(center.z + Math.sin(angle) * dist, -half + 35, half - 35),
            radius: 45 + Math.random() * 28,
            height: 18 + Math.random() * 28 + params.height_scale * 18,
            main: false
        });
    }
}

function smoothHeightMap(heightMap, iterations = 2, strength = 0.55) {
    for (let iter = 0; iter < iterations; iter++) {
        const copy = heightMap.map(row => row.slice());

        for (let i = 1; i < heightMap.length - 1; i++) {
            for (let j = 1; j < heightMap[i].length - 1; j++) {
                let sum = 0;
                let count = 0;

                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        sum += copy[i + di][j + dj];
                        count++;
                    }
                }

                const avg = sum / count;
                heightMap[i][j] = copy[i][j] * (1 - strength) + avg * strength;
            }
        }
    }
}

function getHeight(x, z, params) {
    const heightScale = params.height_scale || 0.7;
    const warpX = perlin.octaveNoise2D(x * 0.003, z * 0.003, 2, 0.5, 1.0) * 12;
    const warpZ = perlin.octaveNoise2D(x * 0.003 + 100, z * 0.003 + 100, 2, 0.5, 1.0) * 12;

    const wx = x + warpX;
    const wz = z + warpZ;
    const large = perlin.octaveNoise2D(wx * 0.0025, wz * 0.0025, 4, 0.5, 1.0) * 16;
    const medium = perlin.octaveNoise2D(wx * 0.007, wz * 0.007, 2, 0.38, 1.0) * 0.75;

    let ridged = perlin.octaveNoise2D(wx * 0.012, wz * 0.012, 3, 0.45, 1.0);
    ridged = 1 - Math.abs(ridged * 2 - 1);
    ridged = Math.pow(ridged, 2.1);
    ridged *= 1.2;

    const detail = perlin.octaveNoise2D(wx * 0.006, wz * 0.006, 1, 0.15, 1.0) * 0.03;

    let y = (large + medium + ridged + detail) * heightScale;

    if (params.type === 'volcano') y *= 0.18;

    y += getHeightByType(x, z, params);
    const mx = x + terrainSeedX;
    const mz = z + terrainSeedZ;

    if (params.type === 'mountains') {
        let mountainMass = 0;

        for (let i = 0; i < mountainPeaks.length; i++) {
            const peak = mountainPeaks[i];

            const peakNoiseX = x + terrainSeedX + i * 200;
            const peakNoiseZ = z + terrainSeedZ + i * 200;

            const offsetX = perlin.octaveNoise2D(peakNoiseX * 0.008 + 200, peakNoiseZ * 0.008 + 200, 2, 0.5, 1.0) * 10;
            const offsetZ = perlin.octaveNoise2D(peakNoiseX * 0.008 + 500, peakNoiseZ * 0.008 + 500, 2, 0.5, 1.0) * 10;

            const dx = x - peak.x + offsetX;
            const dz = z - peak.z + offsetZ;
            const mountainDist = Math.sqrt(dx * dx + dz * dz);

            let mountain = 1 - mountainDist / peak.radius;
            mountain = Math.max(mountain, 0);

            const smoothMountain = mountain * mountain * (3 - 2 * mountain);
            const mountainShape = Math.pow(smoothMountain, peak.main ? 1.65 : 2.15);

            y += mountainShape * peak.height;
            mountainMass += mountainShape;

            const erosionNoise = perlin.octaveNoise2D(peakNoiseX * 0.02 + 400, peakNoiseZ * 0.02 + 400, 3, 0.45, 1.0);
            const erosion = (erosionNoise - 0.5) * (2.0 + params.roughness * 5.5);

            y -= erosion * mountainShape * 0.38;
        }

        if (mountainPeaks.length > 1) {
            const massifNoise = perlin.octaveNoise2D(mx * 0.004 + 800, mz * 0.004 + 800, 3, 0.5, 1.0);
            const mainPeak = mountainPeaks[0] || { x: 0, z: 0 };
            const distFromCenter = Math.sqrt((x - mainPeak.x) * (x - mainPeak.x) + (z - mainPeak.z) * (z - mainPeak.z));

            let massif = 1 - distFromCenter / 145;
            massif = Math.max(massif, 0);
            massif = massif * massif * (3 - 2 * massif);

            y += massif * (10 + params.height_scale * 14);
            y += massifNoise * massif * 5;
        }

        y *= 1 - Math.min(mountainMass, 1) * 0.04;
    }
    if (params.type === 'desert') {
        const dx = x + terrainSeedX;
        const dz = z + terrainSeedZ;

        const frequency = params.frequency || 0.03;
        const persistence = params.persistence || 0.5;
        const roughness = params.roughness || 0.5;
        const desertHeightScale = params.height_scale || 0.5;

        const duneDirection = terrainSeedX * 0.0001;

        const duneLarge = perlin.octaveNoise2D(dx * frequency * 0.12, dz * frequency * 0.12, 4, persistence, 1.0) * 60;
        const duneMedium = perlin.octaveNoise2D(dx * frequency * 0.35, dz * frequency * 0.35, 3, persistence * 0.85, 1.0) * 28;
        const duneSmall = perlin.octaveNoise2D(dx * frequency * 1.2, dz * frequency * 0.7, 2, 0.3, 1.0) * 4;

        const wind = Math.sin(dx * Math.cos(duneDirection) * 0.06 + dz * Math.sin(duneDirection) * 0.06) * 3.5;

        let ridges = perlin.octaveNoise2D(dx * frequency * 0.6 + 500, dz * frequency * 0.6 + 500, 2, 0.5, 1.0);
        ridges = 1 - Math.abs(ridges * 2 - 1);
        ridges = Math.pow(ridges, 3.5) * 10;

        const clusters = perlin.octaveNoise2D(dx * 0.003, dz * 0.003, 2, 0.5, 1.0);

        y = duneLarge * 0.95 + duneMedium + duneSmall + wind + ridges * clusters;
        y = Math.sign(y) * Math.pow(Math.abs(y), 1.1);
        y *= 0.6 + roughness;
        y *= 0.7 + desertHeightScale;

        const flatten = perlin.octaveNoise2D(dx * 0.002, dz * 0.002, 2, 0.5, 1.0);
        y *= 0.65 + flatten * 0.5;
    }
    if (params.type === 'plains') y *= 0.35;

    if (params.type === 'forest') {
        const forestNoise = perlin.octaveNoise2D(wx * 0.05, wz * 0.05, 6, 0.8, 1.5) * 6.0;
        y = y * 0.5 + forestNoise;
    }
    if (params.type === 'volcano') {
        const volcanoCenter = typeof getFeatureCenterFromHints === 'function'
            ? getFeatureCenterFromHints('volcano', params, 140, 0, 0)
            : { x: 0, z: 0 };

        const localX = x - volcanoCenter.x;
        const localZ = z - volcanoCenter.z;

        const volcanoNoiseX = x + (params.seedX || terrainSeedX || 0);
        const volcanoNoiseZ = z + (params.seedZ || terrainSeedZ || 0);

        const mountainNoise = perlin.octaveNoise2D(volcanoNoiseX * 0.01 + 200, volcanoNoiseZ * 0.01 + 200, 2, 0.5, 1.0);
        const offsetX = (mountainNoise - 0.5) * 18;
        const offsetZ = perlin.octaveNoise2D(volcanoNoiseX * 0.01 + 500, volcanoNoiseZ * 0.01 + 500, 2, 0.5, 1.0) * 18;

        const volcanoDist = Math.sqrt(Math.pow(localX + offsetX, 2) + Math.pow(localZ + offsetZ, 2));

        const radius = params.radius || 110;

        let volcano = 1 - volcanoDist / radius;
        volcano = Math.max(volcano, 0);

        const smoothVolcano = volcano * volcano * (3 - 2 * volcano);
        const volcanoShape = Math.pow(smoothVolcano, 1.32);

        y += volcanoShape * (45 + params.height_scale * 50);

        const craterRadius = params.craterRadius || 23;
        const craterDepth = params.craterDepth || 25;

        let crater = 1 - volcanoDist / craterRadius;
        crater = Math.max(crater, 0);
        crater = Math.pow(crater, 1.9);

        y -= crater * craterDepth;

        const craterWall = Math.max(0, 1 - volcanoDist / (craterRadius * 0.95));
        y += craterWall * 10;

        const rim = Math.pow(Math.max(0, 1 - volcanoDist / (craterRadius * 1.3)), 4);
        y += rim * 7;

        const lavaFlow = perlin.octaveNoise2D(volcanoNoiseX * 0.03, volcanoNoiseZ * 0.03, 4, 0.7, 1.0);
        const flowEffect = Math.max(0, 1 - volcanoDist / (radius * 0.8));
        y += flowEffect * lavaFlow * 15;

        if (volcanoDist < craterRadius * 1.5) {
            const erosionNoise = perlin.octaveNoise2D(volcanoNoiseX * 0.02, volcanoNoiseZ * 0.02, 5, 0.6, 1.0);
            const erosion = (erosionNoise - 0.5) * 30;
            y -= erosion * 0.5;
        }

        if (volcanoDist < craterRadius * 0.8) {
            const magmaTexture = perlin.octaveNoise2D(volcanoNoiseX * 0.1, volcanoNoiseZ * 0.1, 3, 0.8, 1.0) * 8;
            y += magmaTexture;
        }

        const rockNoise = perlin.octaveNoise2D(volcanoNoiseX * 0.05, volcanoNoiseZ * 0.05, 6, 0.9, 1.0);
        const rockEffect = Math.max(0, 1 - volcanoDist / (craterRadius * 2));
        y += rockEffect * rockNoise * 5;

        const craterZone = Math.max(0, 1 - volcanoDist / (craterRadius * 1.6));
        y *= 1 - craterZone * 0.25;

        const topSoft = Math.max(0, 1 - volcanoDist / (radius * 0.67));
        y *= 1 - topSoft * 0.27;
    }

    if (params.type === 'canyon') {
        lakeDataGlobal = null;
        riverDataGlobal = null;

        const canyonHeightScale = params.height_scale || 0.7;
        const roughness = params.roughness || 0.6;

        const canyonCenterHint = typeof getFeatureCenterFromHints === 'function'
            ? getFeatureCenterFromHints('canyon', params, 140, 0, 0)
            : { x: 0, z: 0 };

        const localX = x - canyonCenterHint.x;
        const localZ = z - canyonCenterHint.z;

        const canyonHalfWidth = 40 + (1 - roughness) * 8;
        const maxDepth = 25 + canyonHeightScale * 20;
        const wallSteepness = 1.8 + roughness * 1.5;
        const sinuousAmount = 5 + roughness * 8;

        const centerOffset = perlin.octaveNoise2D(localX * 0.005, localZ * 0.005, 2, 0.5, 1.0) * 15;
        const sinuous = Math.sin(localX * 0.05) * sinuousAmount;
        const adjustedZ = localZ - sinuous - centerOffset;
        const adjustedDist = Math.abs(adjustedZ);

        let canyonY = 0;

        if (adjustedDist < canyonHalfWidth) {
            const t = adjustedDist / canyonHalfWidth;
            const depthFactor = Math.pow(1 - t, wallSteepness);
            canyonY = -maxDepth * depthFactor;

            const flatBottomWidth = 12;
            if (adjustedDist < flatBottomWidth) canyonY = -maxDepth + 2;

            if (roughness > 0.4) {
                const wallDetail = perlin.octaveNoise2D(localX * (0.08 + roughness * 0.05), localZ * 0.15, 2, 0.5, 1.0) * (2 + roughness * 3);
                if (adjustedDist > 4 && adjustedDist < canyonHalfWidth - 2) canyonY += wallDetail * (1 - adjustedDist / canyonHalfWidth);
            }

            const scree = perlin.octaveNoise2D(localX * 0.12, localZ * 0.12, 2, 0.4, 1.0) * (1 + roughness);
            if (adjustedDist > canyonHalfWidth - 6 && adjustedDist < canyonHalfWidth - 1) canyonY -= scree * 1.5;
        } else {
            canyonY = perlin.octaveNoise2D(localX * 0.04, localZ * 0.04, 2, 0.3, 1.0) * (3 + roughness * 2);
        }

        y += canyonY;
        y = Math.max(-maxDepth - 2, Math.min(25, y));
    }

    if (lakeDataGlobal && params.type !== 'canyon') y = applyLakeToHeightmap(x, z, y, lakeDataGlobal);
    if (riverDataGlobal && params.type !== 'canyon') y = applyRiverToHeightmap(x, z, y, riverDataGlobal);


    y = Math.sign(y) * Math.pow(Math.abs(y), 0.98);

    return y;
}


function generateTerrain(params) {

    window.currentTerrainType =
    params.type;


    if (window.currentTerrain) {

        scene.remove(window.currentTerrain);

        if (window.currentTerrain.geometry) {
            window.currentTerrain.geometry.dispose();
        }

        if (window.currentTerrain.material) {
            window.currentTerrain.material.dispose();
        }

        window.currentTerrain = null;
    }

    if (typeof removeWater === 'function') {
        removeWater();
    }

    if (typeof removeRiver === 'function') {
        removeRiver();
    }

    if (typeof removeTrees === 'function') {
        removeTrees();
    }

    if (typeof removeFlowers === 'function') {
        removeFlowers();
    }

    if (oasisGrassGroup) {
        scene.remove(oasisGrassGroup);
        oasisGrassGroup = null;
    }
    oasisDataGlobal = null;

    const width = 280;
    const segments = 420;
    const step = width / segments;
    const half =width / 2;
    const vertices = [];
    const colors = [];
    const indices = [];

    const heightMap = [];

    terrainSeedX = Math.random() * 10000;
    terrainSeedZ = Math.random() * 10000;

    lakeDataGlobal = null;
    riverDataGlobal = null;

    if (params.type === 'mountains') generateMountainPeaks(params, half);
    else mountainPeaks = [];

    for (let i = 0; i <= segments; i++) {

        const z = -half + i * step;

        heightMap[i] = [];

        for (let j = 0; j <= segments; j++) {
            const x =-half + j * step;
            const y =getHeight(x,z,params );
            heightMap[i][j] = y;
        }
    }

smoothHeightMap(heightMap, params.type === 'mountains' ? 2 : 3, params.type === 'mountains' ? 0.42 : 0.58); 

const forbiddenWaterTypes = ['volcano'];
const waterType = params.water_type ? String(params.water_type).trim().toLowerCase() : 'none';
const isDesertOasis = params.type === 'desert' && params.hasOasis;

const hasWater = params.hasWater === true || waterType === 'lake' || waterType === 'river' || isDesertOasis;
const allowWater = hasWater && (!forbiddenWaterTypes.includes(params.type) || isDesertOasis);

lakeDataGlobal = null;
riverDataGlobal = null;
oasisDataGlobal = null;

if (allowWater) {
    if (params.type === 'canyon') {
        const canyonPoints = generateCanyonRiverPath(96, params, half);

        riverDataGlobal = {
            points: canyonPoints,
            width: params.river_width || 20,
            depth: 1.0,
            heightMap: heightMap,
            half: half,
            step: step,
            isCanyonRiver: true,
            waterLevel: params.water_level || 0.5
        };

        lakeDataGlobal = null;
    } else if (isDesertOasis) {
        lakeDataGlobal = findDesertOasisPosition(heightMap, half, step, params);
        oasisDataGlobal = lakeDataGlobal;
        riverDataGlobal = null;
    }
    else if (waterType === 'river') {
        let riverPoints = smoothRiverPath(generateRiverPath(96, heightMap, half, step, params), 4);
        riverPoints = movePathToPlacement(riverPoints, params.layoutHints ? params.layoutHints.river : null, half);

        riverDataGlobal = {
            points: riverPoints,
            width: params.river_width || (params.type === 'mountains' ? 18 : 17),
            depth: 3.2,
            heightMap: heightMap,
            half: half,
            step: step,
            isCanyonRiver: false,
            waterLevel: params.water_level || 0.5
        };

carveRiverIntoHeightMap(heightMap, riverDataGlobal, half, step);

    lakeDataGlobal = null;
}
    else if (waterType === 'lake') {
        lakeDataGlobal = findBestLakePosition(heightMap, half, step, params);
        riverDataGlobal = null;
    }
}

    for (let i = 0; i <= segments; i++) {

        const z =-half + i * step;

        for (let j = 0; j <= segments; j++) {

            const x = -half + j * step;

            let y =  heightMap[i][j];

            if (lakeDataGlobal) {

                y =applyLakeToHeightmap(x,z,y,lakeDataGlobal);
            }

            if (riverDataGlobal) {

                y =applyRiverToHeightmap(x,z,y,riverDataGlobal);
            }

            heightMap[i][j] = y;

            vertices.push(x, y,z );

            const color = getTerrainColor(y,params.type,x,z);

            colors.push(color.r, color.g, color.b
            );
        }
    }

    for (let i = 0; i < segments; i++) {

        for (let j = 0; j < segments; j++) {

            const a = i * (segments + 1) + j;

            const b = i * (segments + 1) + j + 1;

            const c = (i + 1) * (segments + 1) + j;

            const d = (i + 1) * (segments + 1) + j + 1;

            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position',new THREE.BufferAttribute( new Float32Array(vertices), 3)
    );

    geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(colors),3)
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.normalizeNormals();
    const terrain =new THREE.Mesh(geometry, getTerrainMaterial() );
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    window.currentTerrain = terrain;
if (lakeDataGlobal && !riverDataGlobal) {
    const lake = addWaterLake(lakeDataGlobal);
    if (lake) {waterMesh = lake;
        scene.add(lake);
        if (params.type === 'desert' && params.hasOasis && oasisDataGlobal) addOasisGrass(scene, oasisDataGlobal, heightMap, half, step);
    }
}

if (riverDataGlobal && !lakeDataGlobal) {
    let river = null;
    if (
        riverDataGlobal.isCanyonRiver &&
        typeof addCanyonRiver === 'function'
    ) {
        river =addCanyonRiver(riverDataGlobal);
    }

    else {
        river =addRiver(riverDataGloba);
    }

    if (river) {
        riverMesh = river;
        scene.add(river);
    }
}
  

    const treeDensity = params.tree_density !== undefined ? params.tree_density : 0.8; 
    const hasTrees =treeDensity > 0.1 && params.type !== 'desert' && params.type !== 'water' && params.type !== 'volcano';
    if (hasTrees && typeof addTrees === 'function') {

        addTrees(heightMap, params.type, step, half, treeDensity);
    }
}

window.generateTerrain =generateTerrain;