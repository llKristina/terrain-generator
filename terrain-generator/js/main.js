let perlin;

function init() {
    if (typeof PerlinNoise === 'function') {
        perlin = new PerlinNoise();
        window.perlin = perlin;
    } else {
        console.error("PerlinNoise не найден! Проверь порядок подключения скриптов.");
    }
    initScene();
    if (typeof setupAuth === 'function') setupAuth();
    if (typeof createEmptyPlane === 'function') {
        createEmptyPlane();
    } else {console.error("createEmptyPlane не найдена!");
    }

    // UI
    if (typeof setupUI === 'function') {setupUI(); }
    if (typeof setupUI === 'function') setupUI();
    if (typeof setupAuth === 'function') setupAuth();
    if (typeof setupParamsPanel === 'function') setupParamsPanel();

    // Ресайз
    window.addEventListener('resize', onWindowResize);
}
window.addEventListener('DOMContentLoaded', init);