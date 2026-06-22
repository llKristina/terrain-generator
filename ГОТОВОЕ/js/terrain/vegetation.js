let treesGroup = null;
let flowersGroup = null;
const gltfLoader =new THREE.GLTFLoader();

const treeModels = [];
const rockModels = [];
const grassModels = [];
const cactusModels = [];

const cactusFiles = ['models/cactus.glb'];

cactusFiles.forEach(function(path) {
    gltfLoader.load(
        path,
        function(gltf) {
            cactusModels.push(gltf.scene);
            console.log('CACTUS LOADED:', path);
        },
        undefined,
        function(error) {
            console.error('CACTUS LOAD ERROR:', path, error);
        }
    );
});

const treeFiles = ['models/tree_animate.glb'];

treeFiles.forEach(function(path) {
    gltfLoader.load(path, function(gltf) {
        treeModels.push(gltf.scene);
            console.log('TREE LOADED:',path);
        }
    );
});



gltfLoader.load('models/rock.glb',function(gltf) {
        rockModels.push(gltf.scene);
        console.log( 'ROCK LOADED');
    }
);

const grassFiles = ['models/grass.glb','models/grass_02.glb'];

grassFiles.forEach(function(path) {

    gltfLoader.load(path,function(gltf) {
            grassModels.push(gltf.scene);
            console.log( 'GRASS LOADED:', path);
        }
    );
});

function isInsideLake(x, z) {

    if (!lakeDataGlobal) {
        return false;
    }
    const influence = getLakeInfluence(x, z, lakeDataGlobal);
    return influence > 0.03;
}

function isInsideRiver(x, z) {

    if (!riverDataGlobal) {
        return false;
    }

    let minDist = Infinity;
    const points = riverDataGlobal.points;

    for (
        let k = 0;
        k < points.length - 1;
        k++
    ) {

        const p1 = points[k];
        const p2 = points[k + 1];
        const ax = x - p1.x;
        const az = z - p1.z;
        const bx = p2.x - p1.x;
        const bz = p2.z - p1.z;
        const dot = ax * bx + az * bz;
        const len2 = bx * bx + bz * bz;

        let t = 0;

        if (len2 > 0) {
            t = Math.max(0, Math.min(1, dot / len2));
        }

        const closestX = p1.x + t * bx;
        const closestZ = p1.z + t * bz;
        const dx = x - closestX;
        const dz =z - closestZ;
        const dist =Math.sqrt( dx * dx + dz * dz);
        minDist =Math.min(minDist, dist);
    }

    return minDist < riverDataGlobal.width + 1.8;
}

function getForestDensity(x, z) {

    return perlin.octaveNoise2D(x * 0.006, z * 0.006, 3, 0.5, 1.0);
}

function getMapHeight(heightMap,worldX,worldZ,half,step) {
    const mapX =Math.floor((worldX + half) / step);
    const mapZ =Math.floor((worldZ + half) / step);
    if (
        !heightMap[mapZ] ||
        heightMap[mapZ][mapX] === undefined
    ) {
        return 0;
    }

    return heightMap[mapZ][mapX];
}

function addTrees(heightMap, type, step, half, density) {
    if (!treeModels || treeModels.length === 0) return;
    treesGroup = new THREE.Group();
    const segments = heightMap.length - 1;
    const maxTrees = Math.floor(700 * density);
    let count = 0;
    while (count < maxTrees) {

        // Случайная ячейка
        const i = Math.floor(Math.random() * segments);
        const j = Math.floor(Math.random() * segments);
        // Случайное смещение внутри ячейки
        const offsetX = (Math.random() - 0.5) * step;
        const offsetZ = (Math.random() - 0.5) * step;
        // Мировые координаты X/Z
        const x = -half + j * step + offsetX;
        const z = -half + i * step + offsetZ;
        // Получаем корректную Y из heightMap после смещения
        const y = getMapHeight(heightMap, x, z, half, step);
        // Проверка на воду
        if (isInsideLake(x, z) || isInsideRiver(x, z)) continue;
        // Проверка на высоту 
        if (y > 18 || y < 2) continue;
        // Проверка лесной маски
        const forestNoise = getForestDensity(x, z);
        if (forestNoise < 0.3) continue;
        // Случайная модель дерева
        const randomTree = treeModels[Math.floor(Math.random() * treeModels.length)];
        const tree = randomTree.clone(true);
        // Масштаб и поворот
        const scale = 0.045 + Math.random() * 0.06;
        tree.scale.set(scale, scale, scale);
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.rotation.z = (Math.random() - 0.5) * 0.05;
        // Ключевой момент: позиция Y точно по рельефу
        tree.position.set(x, y + 0.05, z); // маленький offset, чтобы не зарывался в землю
        tree.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = false;
                if (child.material) {
                    child.material.transparent = true;
                    child.material.alphaTest = 0.2;
                    child.material.depthWrite = true;
                    child.material.side = THREE.DoubleSide;
                }
            }
        });

        treesGroup.add(tree);
        count++;
        if (rockModels.length > 0 && Math.random() < 0.08) {
            const randomRock = rockModels[Math.floor(Math.random() * rockModels.length)];
            const rock = randomRock.clone(true);
            const rockScale = 0.18 + Math.random() * 0.35;
            rock.position.set(x + (Math.random() - 0.5) * 2, y - 0.05, z + (Math.random() - 0.5) * 2);
            rock.scale.set(rockScale, rockScale, rockScale);
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            treesGroup.add(rock);
        }
        if (grassModels.length > 0 && Math.random() < 0.18) {
            const randomGrass = grassModels[Math.floor(Math.random() * grassModels.length)];
            const grass = randomGrass.clone(true);
            const grassScale = 0.15 + Math.random() * 0.25;
            grass.position.set(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5));
            grass.scale.set(grassScale, grassScale, grassScale);
            grass.rotation.y = Math.random() * Math.PI * 2;
            grass.traverse(c => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = true; } });
            treesGroup.add(grass);
        }
    }

    scene.add(treesGroup);
}

function getRiverInfluence(x, z, riverData) {
    if (!riverData) return 0;
    let minDist = Infinity;
    const points = riverData.points;
    for (let k = 0; k < points.length - 1; k++) {
        const p1 = points[k];
        const p2 = points[k + 1];
        const ax = x - p1.x;
        const az = z - p1.z;
        const bx = p2.x - p1.x;
        const bz = p2.z - p1.z;
        const dot = ax * bx + az * bz;
        const len2 = bx * bx + bz * bz;
        let t = 0;
        if (len2 > 0) t = Math.max(0, Math.min(1, dot / len2));
        const closestX = p1.x + t * bx;
        const closestZ = p1.z + t * bz;
        const dx = x - closestX;
        const dz = z - closestZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        minDist = Math.min(minDist, dist);
    }
    const width = riverData.width || 4.5;
    if (minDist < width) return 1 - minDist / width;
    return 0;
}

function removeTrees() {
    if (treesGroup) {
        scene.remove(treesGroup);
        treesGroup = null;
    }
}

window.grassModels = grassModels;
window.cactusModels = cactusModels;