import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


// Configurações
const config = {
    terrainWidth: 1000,
    terrainHeight: 1000,
    terrainSegments: 40,
    terrainAmplitude: 5,
    terrainRoughness: 0.6,
    treesCount: 1000,
    buildingsCount: 50,
    lakesCount: 2,
    seed: Math.random() * 1000,
    enemyIndividualSpawnDelay: 500 // 0.5 segundos entre cada inimigo
};

// Variáveis globais
let scene, camera, renderer, controls, composer; // Added composer
let terrain, heightData = [];
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();
let playerScore = 0;
let currentWave = 1;
let baseEnemySpeed = 12;
let currentEnemySpeed = baseEnemySpeed;
const projectiles = [];
const enemies = [];
const enemySpeed = 8;
const projectileSpeed = 800;
const buildings = [];
const clock = new THREE.Clock();
const explosions = [];
const explosionParticles = 50;
const explosionParticleSpeed = 10;
const explosionDuration = 0.8;
const enemyProjectiles = [];
const enemyProjectileSpeed = 400;
const enemyFireRate = 3;
const enemyProjectileLifetime = 4;
const enemyShootingRange = 150;
const fragments = [];
const fragmentSpeed = 6;
const fragmentLifetime = 0.8;
const fragmentCount = 35;

function createExplosion(position) {
    const particleGeometry = new THREE.SphereGeometry(0.2, 6, 6);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800 });

    for (let i = 0; i < explosionParticles; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
        particle.position.copy(position);

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 9,
            (Math.random() - 0.5) * 9,
            (Math.random() - 0.5) * 9
        );
        velocity.normalize().multiplyScalar(explosionParticleSpeed);

        particle.userData.velocity = velocity;
        particle.userData.lifeTime = explosionDuration;

        scene.add(particle);
        explosions.push(particle);
    }

    const flashIntensity = 1;
    const flashDistance = 25;
    const flashDecay = 1;
    const flashDurationMs = 85;

    const flashLight = new THREE.PointLight(0xffaa33, flashIntensity, flashDistance, flashDecay);
    flashLight.position.copy(position);
    scene.add(flashLight);

    setTimeout(() => {
        scene.remove(flashLight);
    }, flashDurationMs);
}

function shoot() {
    const projectileRadius = 2.15;
    const projectileHeight = 1.0;
    // Using CylinderGeometry for an elongated "bolt" shape
    const projectileGeometry = new THREE.CylinderGeometry(projectileRadius, projectileRadius, projectileHeight, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xFFEF00, transparent: true, opacity: 0.7 }); // Bright yellow/gold
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Gets the direction the camera is looking

    // Position and Orientation
    // Spawn slightly in front of the camera to avoid clipping through the player/camera
    const spawnOffsetDistance = 2.0; // How far in front to spawn
    const spawnOffset = direction.clone().multiplyScalar(spawnOffsetDistance);
    projectile.position.copy(camera.position).add(spawnOffset);

    // Align cylinder's main axis (Y) with the direction of travel
    // The default CylinderGeometry is aligned with the Y-axis.
    // We need to rotate it to align with the 'direction' vector.
    const defaultCylinderUp = new THREE.Vector3(0, 1, 0);
    projectile.quaternion.setFromUnitVectors(defaultCylinderUp, direction.clone().normalize());

    projectile.userData.velocity = direction.clone().multiplyScalar(projectileSpeed);
    projectile.userData.lifeTime = 5; // Lifetime in seconds

    scene.add(projectile);
    projectiles.push(projectile);
}

const terrainRaycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);
const rayOrigin = new THREE.Vector3();
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
let reaperModel = null;
let criticalAssetLoadError = false; // Flag for critical asset loading errors
let isGameOver = false; // Flag for game over state

let playerHealth = 5; // Número de vezes que o jogador pode ser atingido antes de morrer

const healthBar = document.createElement('div');
healthBar.id = 'health-bar';
healthBar.style.position = 'absolute';
healthBar.style.bottom = '10px';
healthBar.style.left = '50%';
healthBar.style.transform = 'translateX(-50%)';
healthBar.style.width = '200px';
healthBar.style.height = '20px';
healthBar.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
healthBar.style.border = '2px solid white';
healthBar.style.borderRadius = '5px';
healthBar.style.overflow = 'hidden';

const healthBarFill = document.createElement('div');
healthBarFill.id = 'health-bar-fill';
healthBarFill.style.width = '100%';
healthBarFill.style.height = '100%';
healthBarFill.style.backgroundColor = 'green';

healthBar.appendChild(healthBarFill);
document.body.appendChild(healthBar);

function updateHealthBar() {
    const healthPercentage = (playerHealth / 5) * 100;
    healthBarFill.style.width = healthPercentage + '%';
    
               
}

function checkPlayerHealth() {
    updateHealthBar();
    if (playerHealth <= 0) {
        gameOver();
    }
}

function gameOver() {
    isGameOver = true; // Set the game over flag
    console.log("Game Over! Você foi derrotado.");
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'game-over';
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '50%';
    gameOverDiv.style.left = '50%';
    gameOverDiv.style.transform = 'translate(-50%, -50%)';
    gameOverDiv.style.color = 'white';
    gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverDiv.style.padding = '20px';
    gameOverDiv.style.borderRadius = '10px';
    gameOverDiv.style.textAlign = 'center';
    gameOverDiv.style.zIndex = '200';
    gameOverDiv.innerHTML = '<h1>Game Over</h1><p>Você foi derrotado!</p>';
    document.body.appendChild(gameOverDiv);

    controls.unlock(); // Desbloqueia o cursor
    document.removeEventListener('mousedown', shoot); // Remove a habilidade de atirar
}

// Inicialização
loadGameAssets(init);

function loadGameAssets(callback) {
    let assetsLoaded = 0;
    const totalAssets = 2;

    let buildingTexture = null;
    let loadedReaperModel = null;

    function checkCompletion() {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            // console.log("Todos os assets carregados."); // Removed
            callback(buildingTexture, loadedReaperModel);
        }
    }

    const buildingTextureUrl = '/textures/brick_diffuse.jpg'; // Use local path
    // console.log("Iniciando carregamento da textura do prédio local..."); // Removed
    textureLoader.load(
        buildingTextureUrl,
        (texture) => {
            // console.log("Textura do prédio carregada."); // Removed
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            buildingTexture = texture;
            checkCompletion();
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar textura do prédio:", err);
            buildingTexture = null;
            checkCompletion();
        }
    );

    const reaperModelUrl = '/Forest_Guardian_0504101306_texture.glb';
    // console.log("Iniciando carregamento do modelo do ceifador..."); // Removed
    gltfLoader.load(
        reaperModelUrl,
        (gltf) => {
            // console.log("Modelo do ceifador carregado."); // Removed
            loadedReaperModel = gltf;
            checkCompletion();
        },
        undefined,
        (err) => {
            console.error("Erro ao carregar modelo do ceifador:", err);
            criticalAssetLoadError = true; // Set the flag
            loadedReaperModel = null;
            displayAssetLoadError("Falha ao carregar modelo do inimigo (Ceifador). O jogo pode não funcionar corretamente. Tente atualizar a página.");
            checkCompletion();
        }
    );
}

function displayAssetLoadError(message) {
    let errorDiv = document.getElementById('assetError');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'assetError';
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '40%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.zIndex = '200'; // Ensure it's on top
        document.body.appendChild(errorDiv);
    }
    errorDiv.innerHTML = `<h2>Erro Crítico</h2><p>${message}</p>`;

    // Hide instructions if they are visible
    const instructionsPanel = document.getElementById('instructions');
    if (instructionsPanel) {
        instructionsPanel.classList.add('hidden');
    }
}

function init(loadedBuildingTexture, loadedReaperModel) {
    // console.log("Iniciando cena..."); // Removed
    reaperModel = loadedReaperModel;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xFFA500, 0.005);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.y = 15;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x88ccff);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Post-processing composer
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), // Corrected to Vector2 for resolution
        0.7, // strength
        0.4, // radius
        0.85 // threshold
    );
    composer.addPass(bloomPass);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xFFE4B5, 1.5);
    directionalLight.position.set(1, 1, 0.5).normalize();
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; // Keep for decent quality
    directionalLight.shadow.mapSize.height = 2048; // Keep for decent quality
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -150; // Increased area coverage
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;
    directionalLight.shadow.bias = -0.0005; // Added bias
    directionalLight.shadow.normalBias = 0.02; // Added normalBias
    scene.add(directionalLight);

    controls = new PointerLockControls(camera, document.body);

    const instructions = document.getElementById('instructions');
    const info = document.getElementById('info');

    instructions.addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        instructions.classList.add('hidden');
        info.textContent = 'Pressione ESC para pausar';
        document.body.classList.add('locked');
    });

    controls.addEventListener('unlock', function () {
        instructions.classList.remove('hidden');
        info.textContent = 'Cenário 3D Imersivo - Clique para iniciar';
        document.body.classList.remove('locked');
    });

    scene.add(controls.getObject());

    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += 100;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    window.addEventListener('resize', onWindowResize);

    createSkybox();
    createTerrain();
    createTrees();
    createBuildings(loadedBuildingTexture);
    createLakes();

    finalizeInit();
}

function finalizeInit() {
    // console.log("Finalizando inicialização (Câmera)..."); // Removed
    const startX = 0;
    const startZ = 0;
    const startY = getHeightAt(startX, startZ) + 15;
    camera.position.set(startX, startY, startZ);

    if (criticalAssetLoadError || !reaperModel) {
        console.error("Critical asset (Reaper Model) failed to load or not available. Game initialization incomplete.");
        displayAssetLoadError("Modelo essencial do inimigo não carregado. O jogo não pode iniciar corretamente. Por favor, atualize a página.");
        // 'displayAssetLoadError' already hides the instructions panel.
        // The event listener for 'instructions' in init() checks 'criticalAssetLoadError'
        // and will prevent controls.lock() if true.
        // No need to add 'shoot' listener or call 'createEnemies()'.
    } else {
        window.addEventListener('mousedown', shoot);
        createEnemiesWithSpeed(currentEnemySpeed);
        // console.log("Inicialização completa."); // Removed
    }
    animate();
}

function createSkybox() {
    const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition + offset).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
    `;

    const uniforms = {
                topColor: { value: new THREE.Color(0x87CEEB) },    // Sky Blue
                bottomColor: { value: new THREE.Color(0xFFA500) }, // Orange
                offset: { value: 3.0 },
                exponent: { value: 0.8 }
            };

    const skyGeo = new THREE.SphereGeometry(500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

function createTerrain() {
    const simplex = new SimplexNoise(config.seed.toString());
    const geometry = new THREE.PlaneGeometry(
        config.terrainWidth,
        config.terrainHeight,
        config.terrainSegments,
        config.terrainSegments
    );
    geometry.rotateX(-Math.PI / 2);
    heightData = [];
    const vertices = geometry.attributes.position.array;
    let minHeight = Infinity;
    let maxHeight = -Infinity;

   

    for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
        const x = vertices[j];
        const z = vertices[j + 2];
        let height = 0;
        let frequency = 0.01;
        let amplitude = config.terrainAmplitude;
        
        for (let o = 0; o < 4; o++) {
            height += simplex.noise2D(x * frequency, z * frequency) * amplitude;
            amplitude *= config.terrainRoughness;
            frequency *= 2;
        }
        
        vertices[j + 1] = height;
        
        if (j % 3 === 0) {
            const currentHeight = height;
            const dataIndex = i / 3;
            // Store an object with x, y, and z coordinates
            heightData[dataIndex] = { x: vertices[j], y: currentHeight, z: vertices[j + 2] };

            if (currentHeight < minHeight) minHeight = currentHeight;
            if (currentHeight > maxHeight) maxHeight = currentHeight;
        }
    }

    // console.log(`createTerrain (COM SIMPLEX, Amplitude=5): heightData populado. Tamanho: ${heightData.length}. ` +
    //             `Min Height: ${minHeight.toFixed(2)}, Max Height: ${maxHeight.toFixed(2)}`); // Removed

    geometry.computeVertexNormals();

    const groundTexture = createProceduralGroundTexture();
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(config.terrainSegments / 2, config.terrainSegments / 2);

    const material = new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: 0.8,
        metalness: 0.2
    });

    terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);

    terrain.position.set(0, 0, 0);
}

function createProceduralGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Define colors
    const baseColor = '#3E6443'; // Darker green
    const midToneColor = '#5A8C61'; // Mid green
    const highlightColor = '#7DB887'; // Lighter green
    const dirtColor = '#8B6913'; // Brownish

    // Fill with base color
    context.fillStyle = baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Add variations
    const numPatches = 30000; // Increased number of patches for potentially denser detail
    for (let i = 0; i < numPatches; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;

        const type = Math.random();

        if (type < 0.6) { // Larger mid-tone patches
            const size = Math.random() * 4 + 2; // Patch size: 2 to 6
            context.fillStyle = `rgba(${parseInt(midToneColor.slice(1,3),16)}, ${parseInt(midToneColor.slice(3,5),16)}, ${parseInt(midToneColor.slice(5,7),16)}, ${Math.random() * 0.2 + 0.2})`; // Alpha: 0.2 to 0.4
            context.fillRect(x - size, y - size, size * 2, size * 2);
        } else if (type < 0.85) { // Smaller highlight patches
            const size = Math.random() * 3 + 1; // Patch size: 1 to 4
            context.fillStyle = `rgba(${parseInt(highlightColor.slice(1,3),16)}, ${parseInt(highlightColor.slice(3,5),16)}, ${parseInt(highlightColor.slice(5,7),16)}, ${Math.random() * 0.15 + 0.1})`; // Alpha: 0.1 to 0.25
            context.fillRect(x - size, y - size, size * 2, size * 2);
        } else { // Sparse dirt patches
            const size = Math.random() * 2 + 1; // Patch size: 1 to 3
            context.fillStyle = `rgba(${parseInt(dirtColor.slice(1,3),16)}, ${parseInt(dirtColor.slice(3,5),16)}, ${parseInt(dirtColor.slice(5,7),16)}, ${Math.random() * 0.2 + 0.3})`; // Alpha: 0.3 to 0.5
            context.fillRect(x - size / 2, y - size / 2, size, size); // smaller dirt patches
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createTrees() {
    const trunkHeight = 30;
    const baseLeafSphereRadius = 5; // Base radius for leaf spheres
    const numLeafParts = 3; // Number of spheres per canopy

    const trunkGeometry = new THREE.CylinderGeometry(0.5, 1, trunkHeight, 10);
    // Single leaf geometry, will be instanced multiple times per tree with different transforms
    const leafGeometry = new THREE.SphereGeometry(baseLeafSphereRadius, 6, 5); // Reduced segments for performance

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const leavesMaterial = new THREE.MeshStandardMaterial({
        color: 0x2E8B57, // Single color for all leaf parts for now
        roughness: 0.8,
        flatShading: true
    });

    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, config.treesCount);
    // Adjust leavesMesh count for multiple parts per tree
    const leavesMesh = new THREE.InstancedMesh(leafGeometry, leavesMaterial, config.treesCount * numLeafParts);

    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    leavesMesh.castShadow = true;
    leavesMesh.receiveShadow = true;

    const trunkMatrix = new THREE.Matrix4();
    const leafMatrix = new THREE.Matrix4();
    const basePosition = new THREE.Vector3(); // Position of the base of the trunk
    const trunkCenterPosition = new THREE.Vector3();
    const leafPartPosition = new THREE.Vector3();
    const treeQuaternion = new THREE.Quaternion();
    const treeOverallScaleVec = new THREE.Vector3(); // For the entire tree (trunk + leaves)
    const leafPartScaleVec = new THREE.Vector3(); // For individual leaf parts

    for (let i = 0; i < config.treesCount; i++) {
        const x = (Math.random() - 0.5) * config.terrainWidth;
        const z = (Math.random() - 0.5) * config.terrainHeight;
        const yTerrain = getHeightAt(x, z);

        const slope = getApproximateSlope(x, z);

        if (slope < 0.5) { // Only place trees on flatter areas
            const randomTreeScale = 0.5 + Math.random() * 1.5;
            treeOverallScaleVec.set(randomTreeScale, randomTreeScale, randomTreeScale);
            
            treeQuaternion.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));

            // Trunk position (center of the trunk geometry)
            basePosition.set(x, yTerrain, z);
            trunkCenterPosition.set(x, yTerrain + (trunkHeight / 2) * randomTreeScale, z);
            trunkMatrix.compose(trunkCenterPosition, treeQuaternion, treeOverallScaleVec);
            trunkMesh.setMatrixAt(i, trunkMatrix);

            // Leaves cluster
            for (let p = 0; p < numLeafParts; p++) {
                const leafClusterBaseY = yTerrain + trunkHeight * randomTreeScale; // Base Y for the start of the canopy

                let R = baseLeafSphereRadius * randomTreeScale; // Radius for this part, scaled by tree size
                let partOffsetX = 0, partOffsetY = 0, partOffsetZ = 0;
                let currentPartScaleFactor = 1.0;

                if (p === 0) { // Main central sphere
                    partOffsetY = R * 0.5; // Position it slightly higher
                    currentPartScaleFactor = 1.0;
                } else if (p === 1) { // First side sphere
                    partOffsetX = R * 0.6;
                    partOffsetY = R * 0.2;
                    partOffsetZ = R * 0.2;
                    currentPartScaleFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
                } else if (p === 2) { // Second side sphere
                    partOffsetX = -R * 0.5;
                    partOffsetY = R * 0.1;
                    partOffsetZ = -R * 0.7;
                    currentPartScaleFactor = 0.7 + Math.random() * 0.4; // 0.7 to 1.1
                }

                // Apply tree's overall rotation to the offset, so cluster moves with tree rotation
                const offset = new THREE.Vector3(partOffsetX, partOffsetY, partOffsetZ);
                // No, don't rotate the offset itself, the offset is in the tree's local space.
                // The final leaf matrix will use the tree's quaternion.

                leafPartPosition.set(
                    basePosition.x + offset.x,
                    leafClusterBaseY + offset.y,
                    basePosition.z + offset.z
                );

                leafPartScaleVec.set(
                    randomTreeScale * currentPartScaleFactor,
                    randomTreeScale * currentPartScaleFactor,
                    randomTreeScale * currentPartScaleFactor
                );

                leafMatrix.compose(leafPartPosition, treeQuaternion, leafPartScaleVec);
                leavesMesh.setMatrixAt(i * numLeafParts + p, leafMatrix);
            }
        } else {
            // If tree is skipped due to slope, need to ensure its instances are also "skipped"
            // or set to a scale of 0 so they don't appear.
            // Easiest is to set scale to 0 for the trunk.
            trunkMatrix.compose(basePosition, treeQuaternion, new THREE.Vector3(0,0,0));
            trunkMesh.setMatrixAt(i, trunkMatrix);
            // And for all its potential leaf parts
            for (let p = 0; p < numLeafParts; p++) {
                leafMatrix.compose(basePosition, treeQuaternion, new THREE.Vector3(0,0,0));
                leavesMesh.setMatrixAt(i * numLeafParts + p, leafMatrix);
            }
        }
    }

    scene.add(trunkMesh);
    scene.add(leavesMesh);
}

function createBuildings(loadedTexture) {
    // console.log("Criando prédios..."); // Removed
    if (!loadedTexture) {
        console.warn("Textura do prédio não disponível, usando cores fallback.");
    }

    const fallbackBuildingColors = [
        0xaaaaaa, 0xa0a0a0, 0xb0b0b0, 0x999999,
        0xafafaf, 0x9f9f9f, 0xcccccc, 0xc0c0c0
    ]; // Added more shades

    for (let i = 0; i < config.buildingsCount; i++) {
        const x = (Math.random() - 0.5) * config.terrainWidth;
        const z = (Math.random() - 0.5) * config.terrainHeight;
        
        const y = getHeightAt(x, z);
        
        const slope = getApproximateSlope(x, z);
        
        if (slope < 0.3) {
            const width = 5 + Math.random() * 10;
            const height = 5 + Math.random() * 10;
            const depth = 5 + Math.random() * 10;
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            
            let material;
            if (loadedTexture) {
                const textureRepeatX = width / 5;
                const textureRepeatY = height / 5;
                const textureRepeatZ = depth / 5;

                const buildingTextureClone = loadedTexture.clone();
                buildingTextureClone.needsUpdate = true;
                buildingTextureClone.repeat.set((textureRepeatX + textureRepeatZ)/2, textureRepeatY);

                material = new THREE.MeshStandardMaterial({
                    map: buildingTextureClone,
                    roughness: 0.8,
                    metalness: 0.1
                });
            } else {
                // Fallback material with varied colors
                const randomColor = fallbackBuildingColors[Math.floor(Math.random() * fallbackBuildingColors.length)];
                material = new THREE.MeshStandardMaterial({
                    color: randomColor,
                    roughness: 0.7,
                    metalness: 0.2
                });
            }

            const building = new THREE.Mesh(geometry, material);
            building.position.set(x, y + height / 2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            
            building.rotation.y = Math.random() * Math.PI * 2;
            
            scene.add(building);
            buildings.push(building);
        }
    }
     // console.log("Prédios criados."); // Removed
}

function createLakes() {
    const lowPoints = findLowPoints(config.lakesCount);
    
    if (lowPoints.length === 0) {
        console.warn("Nenhum ponto baixo adequado encontrado para criar lagos.");
        return;
    }

    lowPoints.forEach((point, index) => {
        const lakeSize = 20 + Math.random() * 30;
        const lakeGeometry = new THREE.CircleGeometry(lakeSize, 32);
        const lakeMaterial = new THREE.MeshStandardMaterial({
            color: 0x005F9E,       // Slightly deeper blue
            transparent: true,
            opacity: 0.85,          // Slightly more opaque
            roughness: 0.15,        // Slightly rougher for softer reflections
            metalness: 0.8,         // Still quite reflective
        });
        
        const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
        lake.rotation.x = -Math.PI / 2;
        lake.receiveShadow = true; // Allow shadows on the lake surface
        
        // Adjust lakeY calculation to place the lake surface slightly above the lowest terrain point
        const lakeY = point.y + 0.1;
        lake.position.set(point.x, lakeY, point.z);

        // console.log(`Criando lago ${index + 1} em:`, lake.position, `Tamanho: ${lakeSize}`); // Removed

        scene.add(lake);
    });
}

function findLowPoints(count) {
    const sortedPoints = [...heightData].sort((a, b) => a.y - b.y);
    const lowPoints = [];
    const minDistance = 100;
    
    for (const point of sortedPoints) {
        let isFarEnough = true;
        for (const existingPoint of lowPoints) {
            const distance = Math.sqrt(
                Math.pow(point.x - existingPoint.x, 2) +
                Math.pow(point.z - existingPoint.z, 2)
            );
            if (distance < minDistance) {
                isFarEnough = false;
                break;
            }
        }
        if (isFarEnough) {
            lowPoints.push(point);
            if (lowPoints.length >= count) break;
        }
    }
    
    // console.log("Pontos baixos encontrados para lagos:", lowPoints); // Removed
    return lowPoints;
}

function getHeightAt(x, z) {
    if (!terrain || !terrain.parent) { // Check if terrain exists and is added to the scene
        console.warn("getHeightAt called before terrain is initialized or added to scene. Returning 0.");
        return 0;
    }
    rayOrigin.set(x, 100, z); // Position raycaster origin high above
    terrainRaycaster.set(rayOrigin, downVector);
    const intersects = terrainRaycaster.intersectObject(terrain);

    if (intersects.length > 0) {
        return intersects[0].point.y;
    } else {
        console.warn("getHeightAt: Raycaster did not intersect terrain at", x, z, ". Returning 0.");
        return 0; // Default height if no intersection
    }
}

function getApproximateSlope(x, z) {
    const y = getHeightAt(x, z);
    const y1 = getHeightAt(x + 1, z);
    const y2 = getHeightAt(x, z + 1);
    
    const dx = Math.abs(y1 - y);
    const dz = Math.abs(y2 - y);
    
    return Math.max(dx, dz);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight); // Update composer size
}

function handleProjectileCollision(projectile, targets, onHitCallback) {
    const projectileBox = new THREE.Box3().setFromObject(projectile);
    console.log("Verificando colisão para projétil:", projectile.uuid);

    for (let i = targets.length - 1; i >= 0; i--) {
        const target = targets[i];
        if (target === controls.getObject()) {
            // Para o jogador, usar uma esfera de colisão
            const playerSphere = new THREE.Sphere(target.position, 5.0);
            console.log("Verificando colisão com o jogador. Posição do projétil:", projectile.position, "Posição do jogador:", target.position, "Raio do jogador:", playerSphere.radius);
            if (projectileBox.intersectsSphere(playerSphere)) {
                console.log("COLISÃO DETECTADA COM O JOGADOR!");
                onHitCallback(target, i);
                return true;
            }
        } else {
            // Para outros alvos, usar caixa de colisão
            const targetBox = new THREE.Box3().setFromObject(target);
            if (projectileBox.intersectsBox(targetBox)) {
                console.log("COLISÃO DETECTADA COM INIMIGO!");
                onHitCallback(target, i);
                return true;
            }
        }
    }
    return false;
}

function animate() {
    if (isGameOver) {
        // Optionally, you could render one last static frame here if desired,
        // but for a full stop, just returning is fine.
        return;
    }
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const time = performance.now() * 0.001;

    // Atualização no loop de animação para verificar colisões com projéteis
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(delta));
        projectile.userData.lifeTime -= delta;

                  const hitEnemy = handleProjectileCollision(projectile, enemies, (enemy, index) => {
            createExplosion(enemy.position);
            enemy.userData.health -= 1;
            if (enemy.userData.health <= 0) {
                // Create floating score text
                const scoreText = document.createElement('div');
                scoreText.className = 'floating-score';
                scoreText.textContent = '+100';
                scoreText.style.position = 'absolute';
                scoreText.style.color = '#00ff00';
                scoreText.style.fontSize = '44px';
                scoreText.style.fontWeight = 'bold';
                scoreText.style.textShadow = '0 0 5px #000';
                scoreText.style.transition = 'all 1s ease-out';
                scoreText.style.opacity = '1';
                scoreText.style.transform = 'translate(-50%, -50%)';
                document.body.appendChild(scoreText);
                // Position based on enemy screen position
                const enemyPos = enemy.position.clone().project(camera);
                const x = (enemyPos.x * 0.5 + 0.5) * window.innerWidth;
                // Correct Y-coordinate: NDC Y is -1 (bottom) to 1 (top), screen Y is 0 (top) to window.innerHeight (bottom)
                const y = (-enemyPos.y * 0.5 + 0.5) * window.innerHeight;
                
                scoreText.style.left = `${x}px`;
                scoreText.style.top = `${y}px`;
                document.body.appendChild(scoreText);
                
                // Animate and remove
                setTimeout(() => {
                    scoreText.style.opacity = '0';
                    scoreText.style.top = `${y - 50}px`;
                    setTimeout(() => {
                        document.body.removeChild(scoreText);
                    }, 2000);
                }, 10);

                scene.remove(enemy);
                enemies.splice(index, 1);
                playerScore += 100;
                document.getElementById('score').textContent = `Score: ${playerScore}`;
                
                if (enemies.length === 0) {
                    currentWave++;
                    currentEnemySpeed = baseEnemySpeed + currentWave;
                 
                    playerHealth = 5;
                    const scoreText1 = document.createElement('div');
                scoreText1.className = 'floating-score';
                scoreText1.textContent = 'NOVA FASE';
                scoreText1.style.position = 'absolute';
                scoreText1.style.color = '#fcba03';
                scoreText1.style.fontSize = '44px';
                scoreText1.style.fontWeight = 'bold';
                scoreText1.style.textShadow = '0 0 5px #000';
                scoreText1.style.transition = 'all 2s ease-out';
                scoreText1.style.opacity = '1';
                scoreText1.style.transform = 'translate(280%, -550%)';
                document.body.appendChild(scoreText1);
                updateHealthBar();
                     
                    setTimeout(() => {
                        createEnemiesWithSpeed(currentEnemySpeed);
                    }, 5000); // 3 segundos de atraso

                    setTimeout(() => {
                    scoreText1.style.opacity = '0';
                   // scoreText1.style.top = `${y - 50}px`;
                    setTimeout(() => {
                        document.body.removeChild(scoreText1);
                    }, 2000);
                }, 10);
                }
            }
        });

        if (hitEnemy || projectile.userData.lifeTime <= 0) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
        }
    }

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = enemyProjectiles[i];
        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(delta));
        projectile.userData.lifeTime -= delta;

        const hitPlayer = handleProjectileCollision(projectile, [controls.getObject()], () => {
            console.log("JOGADOR ATINGIDO!");
            playerHealth -= 1;
            checkPlayerHealth();
        });

        if (hitPlayer || projectile.userData.lifeTime <= 0) {
            scene.remove(projectile);
            enemyProjectiles.splice(i, 1);
        }
    }

    const verticalOffset = 5.0;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const currentEnemy = enemies[i];

        if (camera && camera.position) {
            const directionToPlayer = new THREE.Vector3();
            directionToPlayer.subVectors(camera.position, currentEnemy.position);
            const distanceToPlayer = directionToPlayer.length();
            directionToPlayer.y = 0;
            directionToPlayer.normalize();
            currentEnemy.position.add(directionToPlayer.multiplyScalar(currentEnemySpeed * delta));

            const randomMovement = currentEnemy.userData.randomMovement.clone();
            currentEnemy.position.add(randomMovement.multiplyScalar(delta));

            const currentEnemyX = currentEnemy.position.x;
            const currentEnemyZ = currentEnemy.position.z;
            const groundY = getHeightAt(currentEnemyX, currentEnemyZ);
            currentEnemy.position.y = groundY + verticalOffset +5; //posição do inimigo eixo y

            const lookAtTarget = camera.position.clone();
            lookAtTarget.y = currentEnemy.position.y;
            currentEnemy.lookAt(lookAtTarget);

            if (distanceToPlayer <= enemyShootingRange) {
                if (!currentEnemy.userData.lastShotTime) {
                    currentEnemy.userData.lastShotTime = time + Math.random() * enemyFireRate;
                }

                if (time > currentEnemy.userData.lastShotTime + enemyFireRate) {
                    const projectileRadius = 1.0;
                    const projectileHeight = 0.8;
                    const enemyProjectileGeometry = new THREE.SphereGeometry(projectileRadius, 16, 16);
                    const enemyProjectileMaterial = new THREE.MeshBasicMaterial({ color: 0xcc0000 }); // Dark/Blood Red
                    const enemyProjectile = new THREE.Mesh(enemyProjectileGeometry, enemyProjectileMaterial);

                    // Determine the direction from enemy to player (already calculated as directionToPlayer)
                    // directionToPlayer is normalized.

                    // Spawn projectile slightly in front of the enemy.
                    // Enemy model scale is 10. A small offset like 2 or 3 units from origin might be suitable.
                    // Or relative to its bounding box if available. Let's use a fixed offset for simplicity.
                    const spawnOffsetDistance = 4.0; // How far in front of the enemy model's origin
                    const projectileSpawnPosition = currentEnemy.position.clone().add(directionToPlayer.clone().multiplyScalar(spawnOffsetDistance));
                    enemyProjectile.position.copy(projectileSpawnPosition);

                    // Align cone's Y-axis (its height, with the point at positive Y) with the shooting direction.
                    // The directionToPlayer is from enemy towards player, which is what we want for cone orientation & velocity.
                    const defaultConeUp = new THREE.Vector3(0, 1, 0);
                    enemyProjectile.quaternion.setFromUnitVectors(defaultConeUp, directionToPlayer.clone());

                    enemyProjectile.userData.velocity = directionToPlayer.clone().multiplyScalar(enemyProjectileSpeed);
                    enemyProjectile.userData.lifeTime = enemyProjectileLifetime;

                    scene.add(enemyProjectile);
                    enemyProjectiles.push(enemyProjectile);

                    currentEnemy.userData.lastShotTime = time;
                }
            }

            const enemyBox = new THREE.Box3().setFromObject(currentEnemy);
            const playerSphere = new THREE.Sphere(camera.position, 1.0);
            if (enemyBox.intersectsSphere(playerSphere)) {
                console.log("Você foi pego pelo ceifador!");
            }
        }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
        const particle = explosions[i];
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(delta*3));
        particle.userData.lifeTime -= delta;

        if (particle.userData.lifeTime <= 0) {
            scene.remove(particle);
            explosions.splice(i, 1);
        }
    }

    if (controls && controls.isLocked === true) { // Added null check for controls
        const time = performance.now();
        const deltaMove = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 12.0 * deltaMove;
        velocity.z -= velocity.z * 25.0 * deltaMove;
        velocity.y -= 9.8 * 10.0 * deltaMove;
        
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * deltaMove;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * deltaMove;
        
        const currentPosition = controls.getObject().position.clone();
        const proposedPosition = currentPosition.clone();
        
        const moveX = (-velocity.x * deltaMove);
        const moveZ = (-velocity.z * deltaMove);
        proposedPosition.x += moveX;
        proposedPosition.z += moveZ;

        proposedPosition.y += velocity.y * deltaMove;

        const terrainHeight = getHeightAt(proposedPosition.x, proposedPosition.z);
        const playerHeight = 15;

        if (proposedPosition.y < terrainHeight + playerHeight) {
            velocity.y = 0;
            proposedPosition.y = terrainHeight + playerHeight;
            canJump = true;
        } else {
            canJump = false;
        }

        if (!checkCollision(proposedPosition, 1)) {
            controls.moveRight(moveX);
            controls.moveForward(moveZ);
            controls.getObject().position.y = proposedPosition.y;
        } else {
            const testPosX = currentPosition.clone();
            testPosX.x += moveX;
            testPosX.y = proposedPosition.y;
            if (!checkCollision(testPosX, 1)) {
                controls.moveRight(moveX);
                controls.getObject().position.y = proposedPosition.y;
                velocity.z = 0;
                // console.log("Colisão: Movendo apenas X"); // Removed
            } else {
                const testPosZ = currentPosition.clone();
                testPosZ.z += moveZ;
                testPosZ.y = proposedPosition.y;
                if (!checkCollision(testPosZ, 1)) {
                    controls.moveForward(moveZ);
                    controls.getObject().position.y = proposedPosition.y;
                    velocity.x = 0;
                    // console.log("Colisão: Movendo apenas Z"); // Removed
                } else {
                    velocity.x = 0;
                    velocity.z = 0;
                    // console.log("Colisão: Bloqueado"); // Removed
                }
            }
        }

        const finalPlayerPos = controls.getObject().position;
        const finalTerrainHeight = getHeightAt(finalPlayerPos.x, finalPlayerPos.z);
        if (finalPlayerPos.y < finalTerrainHeight + playerHeight) {
            
            finalPlayerPos.y = finalTerrainHeight + playerHeight;
            velocity.y = 0;
        }
        
        prevTime = time;
    }
    
    // renderer.render(scene, camera); // Old rendering
    composer.render(); // New rendering with post-processing
}

function checkCollision(position, radius) {
    for (const building of buildings) {
        if (!building.geometry.boundingBox) {
            building.geometry.computeBoundingBox();
        }
            const box = new THREE.Box3().setFromObject(building);
            const sphere = new THREE.Sphere(position, radius);

            if (box.intersectsSphere(sphere)) {
           
                return true;
        }
    }

    return false;
}



function createEnemiesWithSpeed(speed) {
    if (!reaperModel) {
        console.error("Modelo do robo não está carregado!");
        return;
    }

    const spawnAreaMultiplier = 1;
    const enemyScale = 10.0;
    const verticalOffset = 1;
    const minSpawnDistance = 120; // Distância mínima
    const maxSpawnDistance = 200; // Distância máxima
    const spawnAngle = 120;
    const minDistanceBetweenEnemies = 100; // Distância mínima entre inimigos

    const overrideMaterial = new THREE.MeshStandardMaterial({
        color: '#fc0f03',
        roughness: 0.5,
        metalness: 0.1
    });

    const spawnedPositions = []; // Array para guardar posições já utilizadas

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            let validPosition = false;
            let attempts = 0;
            let enemyX, enemyZ, enemyY;
            
            // Tentar encontrar uma posição válida que respeite a distância mínima de outros inimigos
            while (!validPosition && attempts < 50) {
                const playerDirection = new THREE.Vector3();
                camera.getWorldDirection(playerDirection);
                
                const randomAngle = (Math.random() * spawnAngle - spawnAngle/2) * (Math.PI / 120);
                const spawnDirection = playerDirection.clone();
                spawnDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);
                
                const distance = minSpawnDistance + Math.random() * (maxSpawnDistance - minSpawnDistance);
                
                const spawnPosition = new THREE.Vector3();
                spawnPosition.copy(camera.position);
                spawnPosition.add(spawnDirection.multiplyScalar(distance));
                
                enemyX = spawnPosition.x;
                enemyZ = spawnPosition.z;
                
                // Verificar distância de outros inimigos já spawnados
                let tooClose = false;
                for (const pos of spawnedPositions) {
                    const dist = Math.sqrt(
                        Math.pow(enemyX - pos.x, 2) + 
                        Math.pow(enemyZ - pos.z, 2)
                    );
                    if (dist < minDistanceBetweenEnemies) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    validPosition = true;
                    spawnedPositions.push(new THREE.Vector3(enemyX, 0, enemyZ));
                }
                
                attempts++;
            }

            if (!validPosition) {
                console.log(`Não foi possível encontrar posição válida para inimigo ${i}`);
                return; // Sair se não encontrar posição válida
            }

            enemyY = getHeightAt(enemyX, enemyZ) + verticalOffset;
            
            const enemyMesh = reaperModel.scene.clone();
            enemyMesh.scale.set(enemyScale, enemyScale, enemyScale);
            enemyMesh.position.set(enemyX, enemyY, enemyZ);

            enemyMesh.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });

            enemyMesh.userData.health = 3;
            enemyMesh.userData.randomMovement = new THREE.Vector3(
                (Math.random() - 0.5) * speed,
                0,
                (Math.random() - 0.5) * speed
            );

            scene.add(enemyMesh);
            enemies.push(enemyMesh);
        }, i * config.enemyIndividualSpawnDelay); // Atraso escalonado
    }
}