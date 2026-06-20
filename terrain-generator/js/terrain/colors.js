
const textureLoader = new THREE.TextureLoader()
const grassTexture   = textureLoader.load('textures/grass.jpg');
const rockTexture    = textureLoader.load('textures/rock.jpg');
const snowTexture    = textureLoader.load('textures/snow.jpg');
const sandTexture    = textureLoader.load('textures/sand.jpg');
const canyonTexture1 = textureLoader.load('textures/can1.jpg');
const canyonTexture2 = textureLoader.load('textures/can2.jpg');
const volcanoTexture = textureLoader.load('textures/volcano.jpg');   // ← Добавлено

// ============================================
// TEXTURE SETTINGS
// ============================================

[
    grassTexture,
    rockTexture,
    snowTexture,
    sandTexture,
    canyonTexture1,
    canyonTexture2,
    volcanoTexture
].forEach(function(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
    texture.colorSpace = THREE.SRGBColorSpace;
});

// ============================================
// TEXTURE SCALE
// ============================================

grassTexture.repeat.set(90, 90);
rockTexture.repeat.set(70, 70);
snowTexture.repeat.set(60, 60);
sandTexture.repeat.set(35, 35);
canyonTexture1.repeat.set(45, 45);
canyonTexture2.repeat.set(55, 55);
volcanoTexture.repeat.set(38, 38);        

// ============================================
// HELPERS
// ============================================

function addNoiseToColor(color, noise, ao = 1, saturationVar = 0) {
    if (!noise) noise = 0;
    const intensity = 0.05;

    const r = Math.max(0, Math.min(1, (color.r * ao) + noise * intensity));
    const g = Math.max(0, Math.min(1, (color.g * ao) + noise * intensity + saturationVar * 0.05));
    const b = Math.max(0, Math.min(1, (color.b * ao) + noise * intensity - saturationVar * 0.03));

    return new THREE.Color(r, g, b);
}

// ============================================
// COLOR FUNCTION
// ============================================

function getTerrainColor(y, type, x = 0, z = 0) {
    const macroNoise = perlin ? perlin.noise2D(x * 0.012, z * 0.012) * 0.14 : 0;
    const detailNoise = perlin ? perlin.noise2D(x * 0.06, z * 0.06) * 0.05 : 0;
    const microNoise = perlin ? perlin.noise2D(x * 0.35, z * 0.35) * 0.015 : 0;
    const totalNoise = macroNoise + detailNoise + microNoise;

    const ambientOcclusion = Math.max(0.7, Math.min(1, (y + 20) / 45));

    if (type === 'desert' || type === 'beach' || type === 'shore') {
        return addNoiseToColor(new THREE.Color(0xCFA96A), totalNoise, ambientOcclusion);
    }

    if (type === 'canyon') {
    if (y > 20) 
        return addNoiseToColor(new THREE.Color(0xFBEBC1), totalNoise, ambientOcclusion); // очень светлые вершины (ближе к песочно-розовому)
    if (y > 10) 
        return addNoiseToColor(new THREE.Color(0xF5DBA7), totalNoise, ambientOcclusion); // тёплые средние стены (песочный с золотистым отливом)
    if (y > 4) 
        return addNoiseToColor(new THREE.Color(0xE6C09C), totalNoise, ambientOcclusion); // светлые нижние склоны (бежевый с коричневым)
    return addNoiseToColor(new THREE.Color(0xCBA888), totalNoise, ambientOcclusion); // дно каньона — уже не тёмное, а приглушённо-коричневое
}



    if (type === 'mountains' || type === 'volcano') {
    if (type === 'volcano') {
        if (y > 70) return addNoiseToColor(new THREE.Color(0x555555), totalNoise * 0.25, ambientOcclusion); // тёмно-серый (вершина, застывшая лава)
        if (y > 40) return addNoiseToColor(new THREE.Color(0x665544), totalNoise * 0.35, ambientOcclusion); // коричнево-серый (средние склоны, вулканическая порода)
        if (y > 10) return addNoiseToColor(new THREE.Color(0x776655), totalNoise, ambientOcclusion);        // тёплый серый (нижние склоны)
        return addNoiseToColor(new THREE.Color(0x887766), totalNoise, ambientOcclusion);                    // подножие (более светлый базальт)
        }

    
    if (y > 38) return addNoiseToColor(new THREE.Color(0xF2F5F8), totalNoise * 0.25, ambientOcclusion);
    if (y > 28) return addNoiseToColor(new THREE.Color(0x7E7A74), totalNoise * 0.35, ambientOcclusion);
    if (y > 10) return addNoiseToColor(new THREE.Color(0x496437), totalNoise, ambientOcclusion);
    return addNoiseToColor(new THREE.Color(0x496437), totalNoise, ambientOcclusion);
}

    return addNoiseToColor(new THREE.Color(0x496437), totalNoise, ambientOcclusion);

}

// ============================================
// WATER MATERIALS
// ============================================

function getWaterMaterial(opacity = 0.82) {
    return new THREE.MeshPhysicalMaterial({
        color: 0x3E7FA6,
        roughness: 0.08,
        metalness: 0.02,
        transmission: 0.92,
        thickness: 3.5,
        transparent: true,
        opacity: opacity,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        ior: 1.33,
        reflectivity: 0.7,
        envMapIntensity: 1.4,
        side: THREE.DoubleSide
    });
}

function getWaterShineMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xE0F4FF,
        roughness: 0.01,
        metalness: 0.98,
        transparent: true,
        opacity: 0.08,
        emissive: 0x80C0E0,
        emissiveIntensity: 0.15
    });
}

// ============================================
// TERRAIN MATERIAL
// ============================================

function getTerrainMaterial() {

    let terrainType = 0;

    if (window.currentTerrainType === 'desert' || 
        window.currentTerrainType === 'beach' || 
        window.currentTerrainType === 'shore') {
        terrainType = 1;
    }
    else if (window.currentTerrainType === 'canyon') {
        terrainType = 2;
    }
    else if (window.currentTerrainType === 'mountains') {
        terrainType = 3;
    }
    else if (window.currentTerrainType === 'volcano') {
        terrainType = 4;                    
    }
    else {
        terrainType = 0;
    }

    const material = new THREE.MeshStandardMaterial({
        map: grassTexture,
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
    });

    material.onBeforeCompile = function(shader) {

        // ====================================
        // UNIFORMS
        // ====================================
        shader.uniforms.rockTexture    = { value: rockTexture };
        shader.uniforms.snowTexture    = { value: snowTexture };
        shader.uniforms.sandTexture    = { value: sandTexture };
        shader.uniforms.canyonTexture1 = { value: canyonTexture1 };
        shader.uniforms.canyonTexture2 = { value: canyonTexture2 };
        shader.uniforms.volcanoTexture = { value: volcanoTexture };   
        shader.uniforms.currentTerrainType = { value: terrainType };

        // ====================================
        // VERTEX SHADER
        // ====================================
        shader.vertexShader =
            `
            varying vec3 vWorldPosition;
            varying vec3 vNormal2;
            ` +
            shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldPosition = worldPosition.xyz;
                vNormal2 = normalize(normalMatrix * normal);
                `
            );

        // ====================================
        // FRAGMENT SHADER
        // ====================================
        shader.fragmentShader =
            `
            uniform sampler2D rockTexture;
            uniform sampler2D snowTexture;
            uniform sampler2D sandTexture;
            uniform sampler2D canyonTexture1;
            uniform sampler2D canyonTexture2;
            uniform sampler2D volcanoTexture;

            uniform int currentTerrainType;

            varying vec3 vWorldPosition;
            varying vec3 vNormal2;
            ` +
            shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                vec2 uv2 = vWorldPosition.xz * 0.035;

                vec4 grassColor   = texture2D(map, uv2);
                vec4 rockColor    = texture2D(rockTexture, uv2);
                vec4 snowColor    = texture2D(snowTexture, uv2);
                vec4 sandColor    = texture2D(sandTexture, uv2);
                vec4 canyonColor1 = texture2D(canyonTexture1, uv2);
                vec4 canyonColor2 = texture2D(canyonTexture2, uv2 * 1.3);
                vec4 volcanoColor = texture2D(volcanoTexture, uv2 * 1.05);

                float slope = 1.0 - vNormal2.y;
                float rockFactor = smoothstep(0.2, 0.55, slope);
                float snowFactor = smoothstep(65.0, 70.0, vWorldPosition.y);

                vec4 terrainColor;

                // ====================== ВУЛКАН ======================
                // ====================== ВУЛКАН ======================
                if (currentTerrainType == 4) {
                    // Высота: чем выше, тем больше вулканической породы
                    float h = smoothstep(0.0, 65.0, vWorldPosition.y);

                    // Крутизна склонов
                    float s = smoothstep(0.18, 0.75, slope);

                    // Базовые серые цвета для вулканического ландшафта
                    vec4 ashBase = vec4(0.30, 0.29, 0.26, 1.0);      // пепельно-серая земля
                    vec4 darkRock = vec4(0.16, 0.15, 0.14, 1.0);     // тёмная вулканическая порода
                    vec4 midRock = vec4(0.38, 0.35, 0.31, 1.0);      // серо-коричневые склоны
                    vec4 craterRock = vec4(0.08, 0.08, 0.08, 1.0);   // почти чёрная вершина/кратер

                    // Текстурные детали
                    vec4 rockDetail = rockColor;
                    vec4 volcanoDetail = volcanoColor;

                    // Основной цвет: снизу пепельный, выше серо-коричневый
                    vec4 baseMix = mix(ashBase, midRock, h * 0.75);

                    // На крутых местах добавляем тёмные скалы
                    baseMix = mix(baseMix, darkRock, s * 0.55);

                    // Добавляем текстуру камня, но не делаем её зелёной
                    baseMix = mix(baseMix, rockDetail, s * 0.25);

                    // На верхней части вулкана делаем цвет темнее
                    float topDark = smoothstep(45.0, 85.0, vWorldPosition.y);
                    baseMix = mix(baseMix, craterRock, topDark * 0.45);

                    // Немного вулканической текстуры
                    baseMix = mix(baseMix, volcanoDetail, h * 0.18);

                    terrainColor = baseMix;
                }

                // ====================================
                // ПУСТЫНЯ / ПЛЯЖ
                // ====================================
                else if (currentTerrainType == 1) {
                    terrainColor = mix(sandColor, rockColor, rockFactor * 0.04);
                }

                // ====================================
                // КАНЬОН
                // ====================================
                else if (currentTerrainType == 2) {
                    terrainColor = mix(canyonColor1, canyonColor2, slope * 0.7);
                }

                // ====================================
                // ОБЫЧНЫЕ ГОРЫ
                // ====================================
                else if (currentTerrainType == 3) {
                    terrainColor = mix(grassColor, rockColor, rockFactor);
                    terrainColor = mix(terrainColor, snowColor, snowFactor);
                }

                // ====================================
                // ПО УМОЛЧАНИЮ
                // ====================================
                else {
                    terrainColor = mix(grassColor, rockColor, rockFactor * 0.25);
                }

                diffuseColor *= terrainColor;
                `
            );
    };

    return material; 
}
 // ============================================
// WATER SHADER MATERIALS
// ============================================

function createWaterMaterial(lakeData = null) {
    const isOasis = lakeData && lakeData.isOasis;

    return new THREE.ShaderMaterial({
        uniforms: {
            isOasis: { value: isOasis ? 1.0 : 0.0 }
        },

        vertexShader: `
            varying vec3 vWorldPos;

            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,

        fragmentShader: `
            uniform float isOasis;
            varying vec3 vWorldPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);

                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));

                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;

                for (int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p = p * 2.0 + vec2(13.7, 8.3);
                    a *= 0.5;
                }

                return v;
            }

            void main() {
                vec2 p = vWorldPos.xz;

                // Обычное озеро — темнее
                vec3 lakeBase = vec3(0.06, 0.25, 0.34);

                // Оазис — почти прозрачная вода с лёгким голубым оттенком
                vec3 oasisBase = vec3(0.52, 0.76, 0.70);

                vec3 baseColor = mix(lakeBase, oasisBase, isOasis);
                vec3 color = baseColor;

                // Мелкая статичная рябь, без анимации
                float wave1 = sin(p.x * 1.15 + p.y * 0.55) * 0.5 + 0.5;
                float wave2 = sin(p.x * 0.75 - p.y * 1.05) * 0.5 + 0.5;
                float wave3 = fbm(p * 0.18);

                float waves = wave1 * 0.28 + wave2 * 0.22 + wave3 * 0.50;

                // Очень слабое изменение цвета от волн
                color += vec3(0.010, 0.018, 0.020) * (waves - 0.5);

                // Мягкие блики пятнами
                float glintNoise = fbm(p * 0.13 + vec2(24.7, 11.3));
                float glint = smoothstep(0.70, 0.88, glintNoise);

                color += vec3(0.75, 0.92, 0.95) * glint * 0.12;

                // Мелкие светлые блики
                float smallGlint = fbm(p * 0.32 + vec2(71.2, 35.6));
                smallGlint = smoothstep(0.80, 0.96, smallGlint);

                color += vec3(0.90, 1.00, 0.98) * smallGlint * 0.06;

                // Для оазиса чуть осветляем, но не делаем кислотно-голубым
                if (isOasis > 0.5) {
                    color = mix(color, vec3(0.62, 0.86, 0.80), 0.18);
                }

                color = clamp(color, 0.0, 1.0);

                // Оазис делаем прозрачнее, обычное озеро плотнее
                float alpha = mix(0.88, 0.62, isOasis);

                gl_FragColor = vec4(color, alpha);
            }
        `,

        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}

function createRiverMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
                vUv = uv;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2  vUv;
            varying vec3  vWorldPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1,0)), u.x),
                    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
                    u.y
                );
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p  = p * 2.1 + vec2(13.7, 8.3);
                    a *= 0.5;
                }
                return v;
            }
            vec2 waterNormal(vec2 uv) {
                float eps = 0.015;
                float h0  = fbm(uv);
                return vec2(fbm(uv + vec2(eps, 0.0)) - h0,
                            fbm(uv + vec2(0.0, eps)) - h0) / eps;
            }

            void main() {
                vec2 flowUV = vec2(vUv.x, vUv.y * 18.0 - time * 1.4);

                float ripple = (fbm(flowUV * vec2(1.8, 1.2) + vec2( time * 0.08, -time * 0.22)) - 0.5) * 0.55
                             + (fbm(flowUV * vec2(2.4, 0.9) - vec2( time * 0.06,  time * 0.18)) - 0.5) * 0.35;

                vec2 nrm = waterNormal(flowUV * 1.1 + vec2(time * 0.04, -time * 0.12));

                vec3 sunDir  = normalize(vec3(0.5, 1.8, 0.6));
                vec3 viewDir = normalize(vec3(0.3, 1.0, 0.5));
                vec3 N       = normalize(vec3(nrm.x * 0.8, 1.0, nrm.y * 0.8));
                float spec   = pow(max(dot(N, normalize(sunDir + viewDir)), 0.0), 48.0);

                vec2  sparkUV = vec2(vUv.x * 6.0, vUv.y * 22.0 - time * 2.2);
                float spark   = pow(max(0.0, fbm(sparkUV + vec2(time * 0.15, 0.0)) - 0.62), 2.8)
                              + pow(max(0.0, fbm(sparkUV * 1.4 - vec2(time * 0.09, time * 0.07)) - 0.65), 3.2) * 0.6;

                float microWave = sin(vUv.y * 80.0  - time * 3.8) * 0.025
                                + sin(vUv.y * 130.0 - time * 5.5 + vUv.x * 4.0) * 0.012;

                float edgeDist  = abs(vUv.x - 0.5) * 2.0;
                vec3 deepColor = vec3(0.025, 0.14, 0.22);
                vec3 shallowColor = vec3(0.07, 0.32, 0.42);
                vec3  foamColor    = vec3(0.55, 0.78, 0.82);

                vec3 color = mix(deepColor, shallowColor, edgeDist * 0.7);
                color = mix(color, shallowColor, clamp(ripple * 0.6 + 0.3, 0.0, 1.0));
                color += microWave;
                color += vec3(0.9, 0.95, 1.0) * spec * 0.35;
                color += foamColor * spark * 0.35;
                color  = mix(color, vec3(0.25, 0.50, 0.75),
                             pow(1.0 - edgeDist, 2.5) * 0.12);
                color  = clamp(color, 0.0, 1.0);

                float edgeFade = smoothstep(0.0, 0.10, vUv.x) * (1.0 - smoothstep(0.90, 1.0, vUv.x));
                float alpha    = clamp((0.72 + edgeDist * 0.08) * edgeFade, 0.0, 0.88);

                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite:  false,
        side:        THREE.DoubleSide
    });
}

function createCanyonRiverMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2  vUv;

            void main() {
                float flow     = sin(vUv.y * 55.0 - time * 4.0) * 0.08;
                float sideFade = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
                vec3  color    = mix(vec3(0.01, 0.18, 0.26), vec3(0.05, 0.42, 0.58), 0.38 + flow);
                gl_FragColor   = vec4(color, 0.82 * sideFade);
            }
        `,
        transparent: true,
        depthWrite:  false,
        side:        THREE.DoubleSide
    });
}



window.createWaterMaterial = createWaterMaterial;
window.createRiverMaterial = createRiverMaterial;
window.createCanyonRiverMaterial = createCanyonRiverMaterial;