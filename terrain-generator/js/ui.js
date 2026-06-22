let lastGeneratedParams = null;
let paramsUpdateTimer = null;
let baseGeneratedParams = null;

function fallbackParseText(text) {
    const lower = text.toLowerCase().replace(/ё/g, 'е');

    let type = 'hills';
    let height_scale = 0.7;
    let roughness = 0.6;
    let water_level = 0;
    let tree_density = 0;

    if (lower.includes('вулкан')) {
        type = 'volcano';
        height_scale = 1.2;
        roughness = 0.8;
    } else if (lower.includes('каньон')) {
        type = 'canyon';
        height_scale = 0.9;
        roughness = 0.8;
        water_level = 0.7;
    } else if (lower.includes('пустын') || lower.includes('песок') || lower.includes('оазис')) {
        type = 'desert';
        height_scale = 0.4;
        roughness = 0.5;
    } else if (lower.includes('гор') || lower.includes('пик') || lower.includes('вершин')) {
        type = 'mountains';
        height_scale = 1.2;
        roughness = 0.9;
    } else if (lower.includes('джунгл')) {
        type = 'jungle';
        tree_density = 0.8;
        water_level = 0.5;
    } else if (lower.includes('сад')) {
        type = 'garden';
        tree_density = 0.6;
    } else if (lower.includes('лес')) {
        type = 'forest';
        tree_density = 0.7;
    } else if (lower.includes('холм')) {
        type = 'hills';
        height_scale = 0.6;
    } else if (lower.includes('равнин')) {
        type = 'plains';
        height_scale = 0.4;
    }

    if (lower.includes('озер') || lower.includes('река') || lower.includes('рек') || lower.includes('вод') || lower.includes('оазис')) {
        water_level = 0.7;
    }

    if (lower.includes('лес') || lower.includes('дерев')) {
        if (tree_density === 0) tree_density = 0.5;
    }

    return { type, height_scale, roughness, water_level, tree_density };
}

function getOasisFromText(text) {
    const t = text.toLowerCase().replace(/ё/g, 'е');
    return t.includes('оазис');
}

function getMountainCountFromText(text) {
    const lower = text.toLowerCase().replace(/ё/g, 'е');

    if (
        lower.includes('много гор') ||
        lower.includes('горный массив') ||
        lower.includes('горы') ||
        lower.includes('скалы') ||
        lower.includes('альпы')
    ) {
        return 3 + Math.floor(Math.random() * 3);
    }

    if (
        lower.includes('гора') ||
        lower.includes('одна гора') ||
        lower.includes('одну гору')
    ) {
        return 1;
    }

    return 0; 
}

function createEmptyPlacement() {
    return { x: null, z: null };
}

function extractPlacementForFeature(lower, names) {
    const p = createEmptyPlacement();
    for (const name of names) {
        const patterns = [
            name,
            name + 'а',
            name + 'ы',
            name + 'ом',
            name + 'ем',
            name + 'у',
            name + 'ой',
            name + 'ою'
        ];

        for (const word of patterns) {
            if (lower.includes(word + ' слева') || lower.includes(word + ' влево')) p.x = 'left';
            if (lower.includes(word + ' справа') || lower.includes(word + ' вправо')) p.x = 'right';

            if (
                lower.includes(word + ' в центре') ||
                lower.includes(word + ' по центру') ||
                lower.includes(word + ' посередине')
            ) {
                p.x = 'center';
                p.z = 'center';
            }

            if (
                lower.includes(word + ' сверху') ||
                lower.includes(word + ' сзади') ||
                lower.includes(word + ' вверху')
            ) {
                p.z = 'back';
            }

            if (
                lower.includes(word + ' снизу') ||
                lower.includes(word + ' спереди') ||
                lower.includes(word + ' внизу')
            ) {
                p.z = 'front';
            }
        }
    }

    return p;
}

function getLayoutHintsFromText(text) {
    const lower = text.toLowerCase().replace(/ё/g, 'е');

    return {
        mountain: extractPlacementForFeature(lower, ['гор', 'гора', 'горы']),
        volcano: extractPlacementForFeature(lower, ['вулкан']),
        lake: extractPlacementForFeature(lower, ['озер', 'озеро']),
        river: extractPlacementForFeature(lower, ['рек', 'река', 'реку']),
        oasis: extractPlacementForFeature(lower, ['оазис']),
        canyon: extractPlacementForFeature(lower, ['каньон'])
    };
}

function setupParamsPanel() {
    const toggleBtn = document.getElementById('paramsToggleBtn');
    const content = document.getElementById('paramsContent');
    const resetBtn = document.getElementById('resetParamsBtn');
    const randomBtn = document.getElementById('randomParamsBtn');

    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', function() {
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });
    }

    bindParamRange('heightScaleInput', 'heightScaleValue');
    bindParamRange('roughnessInput', 'roughnessValue');
    bindParamRange('treeDensityInput', 'treeDensityValue');
    bindParamRange('mountainCountInput', 'mountainCountValue');

    if (resetBtn) resetBtn.addEventListener('click', resetManualParams);
    if (randomBtn) randomBtn.addEventListener('click', randomizeManualParams);
}

function bindParamRange(inputId, valueId) {
    const input = document.getElementById(inputId);
    const value = document.getElementById(valueId);

    if (!input || !value) {
        console.warn('PARAM INPUT NOT FOUND:', inputId, valueId);
        return;
    }

    value.textContent = input.value;

    input.addEventListener('input', function() {
        value.textContent = input.value;
        updateGeneratedTerrainFromPanel();
    });
}

function getManualParams() {
    return {
        height_scale: Number(document.getElementById('heightScaleInput').value),
        roughness: Number(document.getElementById('roughnessInput').value),
        tree_density: Number(document.getElementById('treeDensityInput').value),
        mountain_count: Number(document.getElementById('mountainCountInput').value)
    };
}

function updateGeneratedTerrainFromPanel() {
    if (!baseGeneratedParams) {
        console.warn('Сначала нужно сгенерировать ландшафт');
        return;
    }

    const manual = getManualParams();
    const nextParams = { ...baseGeneratedParams };

    if (manual.height_scale > 0) nextParams.height_scale = manual.height_scale;
    if (manual.roughness > 0) nextParams.roughness = manual.roughness;

    if (manual.tree_density > 0) {
        nextParams.tree_density = manual.tree_density;
        nextParams.hasTrees = true;
    }

    if (nextParams.type === 'mountains' || nextParams.type === 'volcano') {
        nextParams.mountain_count = manual.mountain_count;
    }

    lastGeneratedParams = nextParams;

    clearTimeout(paramsUpdateTimer);

    paramsUpdateTimer = setTimeout(function() {
        generateTerrain(lastGeneratedParams);
    }, 250);
}

function resetManualParams() {
    setRangeValue('heightScaleInput', 'heightScaleValue', 0);
    setRangeValue('roughnessInput', 'roughnessValue', 0);
    setRangeValue('treeDensityInput', 'treeDensityValue', 0);
    setRangeValue('mountainCountInput', 'mountainCountValue', 0);

    updateGeneratedTerrainFromPanel();
}

function randomizeManualParams() {
    setRangeValue('heightScaleInput', 'heightScaleValue', (0.6 + Math.random() * 1.5).toFixed(1));
    setRangeValue('roughnessInput', 'roughnessValue', (0.25 + Math.random() * 0.65).toFixed(2));
    setRangeValue('treeDensityInput', 'treeDensityValue', (Math.random() * 0.9).toFixed(2));
    setRangeValue('mountainCountInput', 'mountainCountValue', 1 + Math.floor(Math.random() * 6));

    updateGeneratedTerrainFromPanel();
}

function setRangeValue(inputId, valueId, value) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(valueId);

    if (!input || !label) return;

    input.value = value;
    label.textContent = value;
}

function updateParamsPanelFromGeneratedParams(params) {
    if (!params) return;

    const heightScale = params.height_scale !== undefined ? Number(params.height_scale).toFixed(1) : 0;
    const roughness = params.roughness !== undefined ? Number(params.roughness).toFixed(2) : 0;
    const treeDensity = params.hasTrees ? Number(params.tree_density || 0).toFixed(2) : 0;
    const mountainCount = params.type === 'mountains' || params.type === 'volcano' ? Number(params.mountain_count || 0) : 0;

    setRangeValue('heightScaleInput', 'heightScaleValue', heightScale);
    setRangeValue('roughnessInput', 'roughnessValue', roughness);
    setRangeValue('treeDensityInput', 'treeDensityValue', treeDensity);
    setRangeValue('mountainCountInput', 'mountainCountValue', mountainCount);
}

async function generateTerrainFromText() {
    if (!localStorage.getItem('token')) {
        alert('Сначала войдите в аккаунт');
        return;
    }

    const text = document.getElementById('prompt').value;
    const statusDiv = document.getElementById('status');

    if (!text.trim()) {
        statusDiv.textContent = 'Введите описание!';
        setTimeout(() => statusDiv.textContent = 'Введите описание и нажмите "Создать мир"', 1500);
        return;
    }

    statusDiv.textContent = 'Генерация сцены...';

    try {
        const response = await fetch('/api/parse', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const aiParams = await response.json();
        console.log('Параметры от ИИ:', aiParams);

        statusDiv.textContent = 'Генерация ландшафта...';

        const layoutHints = getLayoutHintsFromText(text);
        console.log('LAYOUT HINTS:', layoutHints);

        const resolvedType =aiParams.type || aiParams.biome || 'hills';

        let finalParams = {
            type: resolvedType,
            biome: resolvedType,
            height_scale: aiParams.height_scale !== undefined ? aiParams.height_scale : 0.7,
            roughness: aiParams.roughness !== undefined ? aiParams.roughness : 0.6,
            octaves: aiParams.octaves !== undefined ? aiParams.octaves : 4,
            persistence: aiParams.persistence !== undefined ? aiParams.persistence : 0.5,
            frequency: aiParams.frequency !== undefined ? aiParams.frequency : 0.04,
            hasOasis: getOasisFromText(text),
            hasWater: aiParams.hasWater === true ||
                    aiParams.water_type === 'river' ||
                    aiParams.water_type === 'lake' ||
                    getOasisFromText(text),

            water_type: aiParams.water_type || 'none',
            water_level: aiParams.water_level !== undefined ? aiParams.water_level : 0.5,

            tree_density: aiParams.tree_density !== undefined ? aiParams.tree_density : 0,
            hasTrees: aiParams.hasTrees === true || (aiParams.tree_density || 0) > 0.1,

            mountain_count: getMountainCountFromText(text),

            layoutHints: layoutHints
        };

        console.log('FINAL PARAMS:', finalParams);

        updateParamsPanelFromGeneratedParams(finalParams);
        baseGeneratedParams = { ...finalParams };
        lastGeneratedParams = { ...finalParams };
        
        generateTerrain(lastGeneratedParams);
        statusDiv.textContent = 'Готово!';

        setTimeout(() => {
            if (statusDiv.textContent === 'Готово!') {
                statusDiv.textContent = 'Введите описание и нажмите "Создать мир"';
            }
        }, 2000);

    } catch (error) {
        console.error('Ошибка ИИ:', error);
        statusDiv.textContent = 'ИИ недоступен, использую обычный парсинг';

        const params = fallbackParseText(text);
        const layoutHints = getLayoutHintsFromText(text);
        const lower = text.toLowerCase().replace(/ё/g, 'е');

        lastGeneratedParams = {
            type: params.type,
            height_scale: params.height_scale,
            roughness: params.roughness,
            octaves: 4,
            persistence: 0.5,
            frequency: 0.04,
            water_level: params.water_level,
            tree_density: params.tree_density,
            hasWater: params.water_level > 0.3,
            hasTrees: params.tree_density > 0.1,
            water_type: lower.includes('рек') ? 'river' : (lower.includes('озер') || lower.includes('оазис') ? 'lake' : 'none'),
            hasOasis: getOasisFromText(text),
            mountain_count: getMountainCountFromText(text),
            biome: params.type,
            layoutHints: layoutHints
        };

        console.log('FALLBACK PARAMS:', lastGeneratedParams);

        updateParamsPanelFromGeneratedParams(lastGeneratedParams);
        baseGeneratedParams = { ...lastGeneratedParams };
        generateTerrain(lastGeneratedParams);

        setTimeout(() => {
            if (statusDiv.textContent.includes('ИИ недоступен')) {
                statusDiv.textContent = 'Введите описание и нажмите "Создать мир"';
            }
        }, 2500);
    }
}

function clearScene() {
    if (window.currentTerrain) {
        scene.remove(window.currentTerrain);

        if (window.currentTerrain.geometry) window.currentTerrain.geometry.dispose();
        if (window.currentTerrain.material) window.currentTerrain.material.dispose();

        window.currentTerrain = null;
    }

    if (typeof removeWater === 'function') removeWater();
    if (typeof removeRiver === 'function') removeRiver();
    if (typeof removeTrees === 'function') removeTrees();

    lastGeneratedParams = null;
    baseGeneratedParams = null;
    const geometry = new THREE.PlaneGeometry(180, 180, 50, 50);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.8 });
    const plane = new THREE.Mesh(geometry, material);

    plane.position.y = -0.5;
    plane.receiveShadow = true;

    scene.add(plane);
    window.currentTerrain = plane;

    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Сцена очищена!';

    setTimeout(() => {
        if (statusDiv.textContent === 'Сцена очищена!') {
            statusDiv.textContent = 'Введите описание и нажмите "Создать мир"';
        }
    }, 2000);

    document.getElementById('prompt').value = '';
}

function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;

    if (!isError) {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = 'Введите описание и нажмите "Создать мир"';
            }
        }, 3000);
    }
}

function exportToOBJ() {
    if (!window.currentTerrain || !window.currentTerrain.geometry) {
        showStatus('Нет ландшафта для экспорта!');
        return;
    }

    showStatus('Экспорт в OBJ...');

    const geometry = window.currentTerrain.geometry;
    const positionAttribute = geometry.attributes.position;
    const indexAttribute = geometry.index;

    if (!positionAttribute || !indexAttribute) {
        showStatus('Ошибка: нет данных для экспорта');
        return;
    }

    const vertices = positionAttribute.array;
    const indices = indexAttribute.array;

    let objContent = '';

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];

        objContent += `v ${x} ${y} ${z}\n`;
    }

    for (let i = 0; i < indices.length; i += 3) {
        const v1 = indices[i] + 1;
        const v2 = indices[i + 1] + 1;
        const v3 = indices[i + 2] + 1;

        objContent += `f ${v1} ${v2} ${v3}\n`;
    }

    if (typeof downloadFile === 'function') {
        downloadFile(objContent, `landscape_${Date.now()}.obj`, 'text/plain');
        showStatus('OBJ файл сохранён!');
    } else {
        showStatus('Функция скачивания файла не найдена!', true);
    }
}

function setupUI() {
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportObjBtn = document.getElementById('exportObjBtn');
    const exportPlyBtn = document.getElementById('exportPlyBtn');

    if (generateBtn) generateBtn.addEventListener('click', generateTerrainFromText);
    if (clearBtn) clearBtn.addEventListener('click', clearScene);
    if (exportObjBtn) exportObjBtn.addEventListener('click', exportToOBJ);
    if (exportPlyBtn && typeof exportToPLY === 'function') exportPlyBtn.addEventListener('click', exportToPLY);
}

window.setupUI = setupUI;
window.setupParamsPanel = setupParamsPanel;
window.generateTerrainFromText = generateTerrainFromText;
window.exportToOBJ = exportToOBJ;
window.clearScene = clearScene;