let scene, camera, renderer, controls;
let sunLight, ambientLight, fillLight, backLight, rimLight;

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2A3B7A);
    camera =new THREE.PerspectiveCamera(65, window.innerWidth /  window.innerHeight, 0.1, 10000);
    camera.position.set(40, 45, 60);
    camera.lookAt(0, 10, 0);
    renderer =new THREE.WebGLRenderer({antialias: true, powerPreference:"high-performance"
        });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace =THREE.SRGBColorSpace;
    renderer.toneMapping =THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    window.addEventListener('resize', onWindowResize);
    function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
    controls =new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.9;
    controls.zoomSpeed = 1.3;
    controls.panSpeed = 0.8;
    controls.target.set(0, 8, 0);
    controls.minDistance = 10;
    controls.maxDistance = 5000;
    controls.maxPolarAngle = Math.PI / 2.05;
    setupLights();
    animate();
}

function setupLights() {
    ambientLight =new THREE.AmbientLight(0x5f6f8f,  1.8);
    scene.add(ambientLight);
    sunLight =new THREE.DirectionalLight(0xfff4dd,  2.0);
    sunLight.position.set(120, 140, 70);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 600;
    sunLight.shadow.camera.left = -180;
    sunLight.shadow.camera.right = 180;
    sunLight.shadow.camera.top = 180;
    sunLight.shadow.camera.bottom = -180;
    sunLight.shadow.bias = -0.0012;
    sunLight.shadow.normalBias = 0.05;
    scene.add(sunLight);
    fillLight =new THREE.PointLight( 0x7799cc, 0.25 );
    fillLight.position.set(0, -15, 0);
    scene.add(fillLight);
    backLight =new THREE.DirectionalLight(0x99bbff, 0.28);
    backLight.position.set(-60, 70, -80);
    scene.add(backLight);
    rimLight =new THREE.PointLight( 0xccaa77, 0.18);
    rimLight.position.set( 40, 15, 40);
    scene.add(rimLight);
    const sideFill =new THREE.DirectionalLight(0xaaccff, 0.18 );
    sideFill.position.set( 80, 40, 30);
    scene.add(sideFill);
}

function addGroundReflection() {

    const groundPlane =new THREE.Mesh(
            new THREE.PlaneGeometry( 500, 500),
            new THREE.MeshStandardMaterial({
                color: 0x4a6a3a,
                roughness: 1,
                transparent: true,
                opacity: 0
            })
        );

    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -20;
    groundPlane.receiveShadow =false;
    groundPlane.castShadow =false;
    scene.add(groundPlane);
}

function createEmptyPlane() {

    if (window.currentTerrain) {
        scene.remove(window.currentTerrain
        );
        if ( window.currentTerrain.geometry) {
            window.currentTerrain.geometry.dispose();
        }
        if (window.currentTerrain.material) {
            window.currentTerrain.material.dispose();
        }
    }
    if (typeof removeWater ==='function') {
        removeWater();
    }

    if (typeof removeTrees ==='function') {
        removeTrees();
    }
    

    const geometry =new THREE.PlaneGeometry( 280, 280, 64, 64);
    geometry.rotateX( -Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 1, metalness: 0});
    const plane =new THREE.Mesh( geometry, material );
    plane.position.y = -0.8;
    plane.receiveShadow = false;
    plane.castShadow = false;
    scene.add(plane);
    window.currentTerrain =
        plane;
}

let time = 0;
function animateLights() {
    time += 0.003;
    if (sunLight) {
        sunLight.intensity = 1.32 + Math.sin(time) * 0.03;
    }
}

function onWindowResize() {
    camera.aspect =window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {

    requestAnimationFrame(animate);
    animateLights();
    controls.update();
    renderer.render(scene, camera);
}