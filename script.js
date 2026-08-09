const board = document.getElementById("board-container");
const mapImage = document.getElementById("map-image");
const grid = document.getElementById("grid");
const entityMenu = document.getElementById("entityMenu");
const boardsToggle = document.getElementById("boardsToggle");
const boardsContent = document.getElementById("boardsContent");
const tooltip = document.getElementById("entityTooltip");

// Canvases y Contextos
const lightingCanvas = document.getElementById("lightingCanvas");
const lctx = lightingCanvas.getContext("2d");

const drawCanvas = document.getElementById("drawCanvas");
const drawCtx = drawCanvas.getContext("2d");

const fogCanvas = document.getElementById("fogCanvas");
const fogCtx = fogCanvas.getContext("2d");

const measureCanvas = document.getElementById("measureCanvas");
const measureCtx = measureCanvas.getContext("2d");

const fogMaskCanvas = document.createElement("canvas");
const fogMaskCtx = fogMaskCanvas.getContext("2d");

// Herramientas e Inputs
const lightToolBtn = document.getElementById("lightToolBtn");
const wallToolBtn = document.getElementById("wallToolBtn");
const doorToolBtn = document.getElementById("doorToolBtn");
const moveToolBtn = document.getElementById("moveToolBtn");
const eraseToolBtn = document.getElementById("eraseToolBtn");
const measureToolBtn = document.getElementById("measureToolBtn");
const drawToolBtn = document.getElementById("drawToolBtn");
const eraserDrawToolBtn = document.getElementById("eraserDrawToolBtn");
const toggleLightingEditor = document.getElementById("toggleLightingEditor");

let lightingDirty = true;
let fogDirty = false;
let lightingEditor = false;
let lightingTool = "light";

let currentLightRadius = 350;
let currentLightColor = "#fff4aa";
let currentDarkLevel = "0.55";
let currentLightIntensity = 0.35;

let drawingWall = false;
let wallStartX = 0, wallStartY = 0;
let currentLightPolygons = [];
let movingLight = null, movingWall = null;
let dragOffsetX = 0, dragOffsetY = 0;
let lastMouseX = 0, lastMouseY = 0;

let pendingEntity = null;
let editingEntity = null;
let selectedEntity = null;
let characterLightRadius = 250;
let characterFogRadius = 250;

let GRID_SIZE = 40;
let MAP_SCALE = 1;
let imageWidth = 0, imageHeight = 0;

let selectingTarget = false;
let pendingAttack = null;
let isPanning = false, isDraggingToken = false;
let panStartX = 0, panStartY = 0;
let scrollStartX = 0, scrollStartY = 0;

let measureMode = false;
let measureStart = null;
let measurePreview = null;

let drawMode = false;
let eraseMode = false;
let drawing = false;
let drawColor = "#ff0000";
let drawSize = 3;

let autoSaveTimer = null;
const LOCAL_STORAGE_KEY = "miniversus_backup";

const DEFAULT_ENTITY_IMAGE = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';

window.entityBank = window.entityBank || [];

const entityTypesNames = {
    "character": "Personaje",
    "enemy": "Enemigo",
    "object": "Objeto"
};

const appState = {
    activeBoardId: null,
    boards: [],
    sessionLog: [],
    imageBank: [],
    autoSaveEnabled: true,
    autoSaveInterval: 5
};

// INICIALIZACION
function initApp() {
    const loaded = loadFromLocalStorage();

    if (!loaded) {
        const defaultBoard = createEmptyBoard();
        appState.boards.push(defaultBoard);
        appState.activeBoardId = defaultBoard.id;
        
        document.getElementById("autoSaveToggle").checked = appState.autoSaveEnabled;
        document.getElementById("autoSaveIntervalInput").value = appState.autoSaveInterval;
        
        switchBoard(defaultBoard.id);
    }

    resizeBoard();
    effectsLoop();
    updateLightingUI();
    selectLightingTool("light", lightToolBtn);
    
    startAutoSaveTimer();
}

// SISTEMA DE PERSISTENCIA Y AUTOGUARDADO

function saveToLocalStorage() {
    const currentBoard = getCurrentBoard();
    if (currentBoard) {
        const notesTextArea = document.getElementById("sessionNotes");
        if (notesTextArea) currentBoard.notes = notesTextArea.value;
        currentBoard.map.drawData = drawCanvas.toDataURL();
        currentBoard.entityBank = window.entityBank;
    }

    const dataToSave = {
        appState: appState,
        entityBank: window.entityBank
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    console.log("Sesión autoguardada:", new Date().toLocaleTimeString());
    
    logEvent('system', 'Sesión guardada automáticamente');
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedData) return false;

    try {
        const data = JSON.parse(savedData);
        
        Object.assign(appState, data.appState);
        
        window.entityBank = data.entityBank || [];

        document.getElementById("autoSaveToggle").checked = appState.autoSaveEnabled;
        document.getElementById("autoSaveIntervalInput").value = appState.autoSaveInterval;

        loadAppState(appState);
        return true;
    } catch (e) {
        console.error("Error al cargar el backup:", e);
        return false;
    }
}

function updateAutoSaveSettings() {
    let saveToggle = document.getElementById("autoSaveToggle").checked;
    appState.autoSaveEnabled = saveToggle;
    appState.autoSaveInterval = parseInt(document.getElementById("autoSaveIntervalInput").value) || 5;
    
    if (saveToggle === false) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }

    startAutoSaveTimer();
}

function startAutoSaveTimer() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    
    if (appState.autoSaveEnabled) {
        const ms = appState.autoSaveInterval * 60 * 1000;
        autoSaveTimer = setInterval(saveToLocalStorage, ms);
    }
}

function resetSession() {
    const confirm1 = confirm("¿Estás seguro de que quieres iniciar una nueva sesión?");
    if (!confirm1) return;
    
    const confirm2 = confirm("¡ATENCIÓN! Esto borrará todos los tableros, entidades y progreso guardado en este navegador. Se recomienda exportar los datos. ¿Proceder?");
    
    if (confirm2) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        location.reload();
    }
}

// FUNCIONES DE TABLERO
function createEmptyBoard(name = "Tablero") {
    return {
        id: crypto.randomUUID(),
        name: name || "Tablero",
        notes: "",
        map: {
            image: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
            baseWidth: 1920,
            baseHeight: 1080,
            width: 1920,
            height: 1080,
            scale: 1,
            gridSize: 40,
            visionMode: "normal",
            drawData: null
        },
        entities: [],
        entityBank: [],
        lighting: { enabled: false, lights: [], walls: [], darkLevel: 0.55, lightIntensity: 0.35 },
        fog: { enabled: false, cells: {} },
        undoEntities: [],
        undoLights: [],
        undoWalls: []
    };
}

function getCurrentBoard() {
    return appState.boards.find(b => b.id === appState.activeBoardId);
}

function switchBoard(boardId) {
    clearMeasurement();
    appState.activeBoardId = boardId;
    renderBoardTabs();
    renderCurrentBoard();
}

function renderBoardTabs() {
    const container = document.getElementById("boardsTabs");
    container.innerHTML = "";

    appState.boards.forEach(boardData => {
        const btn = document.createElement("button");
        btn.textContent = boardData.name;
        if (boardData.id === appState.activeBoardId) btn.classList.add("active");
        btn.onclick = () => switchBoard(boardData.id);
        container.appendChild(btn);
    });
}

function syncAllCanvases() {
    const { width, height } = getCurrentBoard().map;
    const canvases = [drawCanvas, fogCanvas, fogMaskCanvas, measureCanvas];

    canvases.forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    });

    syncLightingCanvas();
}

function resizeBoard() {
    clearMeasurement();

    const newGridSize = parseInt(document.getElementById("cellSizeInput").value, 10) || 40;
    const currentBoard = getCurrentBoard();
    const oldGridSize = currentBoard.map.gridSize || GRID_SIZE;

    if (oldGridSize > 0 && oldGridSize !== newGridSize) {
        const factor = newGridSize / oldGridSize;

        currentBoard.entities.forEach(entity => {
            entity.x = Math.round((entity.x * factor) / newGridSize) * newGridSize;
            entity.y = Math.round((entity.y * factor) / newGridSize) * newGridSize;

            validateEntityPosition(entity, currentBoard.map.width, currentBoard.map.height, newGridSize);
        });
    }

    GRID_SIZE = newGridSize;
    currentBoard.map.gridSize = GRID_SIZE;

    syncGrid();
    renderCurrentBoard();
    resetFog();
}

function syncGrid() {
    const { width, height } = getCurrentBoard().map;
    grid.style.backgroundSize = `${GRID_SIZE}px ${GRID_SIZE}px`;
    grid.style.width = `${width}px`;
    grid.style.height = `${height}px`;
    syncAllCanvases();
}

function exportBoard() {
    const currentBoard = getCurrentBoard();
    if (currentBoard) {
        const notesTextArea = document.getElementById("sessionNotes");
        if (notesTextArea) {
            currentBoard.notes = notesTextArea.value;
        }
        currentBoard.map.drawData = drawCanvas.toDataURL();
        currentBoard.entityBank = window.entityBank;
    }

    const data = JSON.stringify(appState, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sesion_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importBoard(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const data = JSON.parse(reader.result);

        if (data.boards) {
            loadAppState(data);
            
            const activeBoard = getCurrentBoard();
            window.entityBank = activeBoard ? (activeBoard.entityBank || []) : [];
            if (typeof renderEntityBank === "function") renderEntityBank();
            return;
        }

        const newBoard = createEmptyBoard();
        newBoard.map = data.map;
        newBoard.entities = data.entities || [];
        newBoard.entityBank = data.entityBank || [];

        appState.boards = [newBoard];
        appState.sessionLog = data.sessionLog || [];
        appState.activeBoardId = newBoard.id;

        window.entityBank = newBoard.entityBank;

        renderCurrentBoard();
        renderSessionLog();
        renderEntityBank();
    };
    reader.readAsText(file);
}

function loadAppState(data) {
    appState.imageBank = data.imageBank || [];
    appState.boards = data.boards || [];
    appState.sessionLog = data.sessionLog || [];
    appState.activeBoardId = data.activeBoardId || (appState.boards[0] ? appState.boards[0].id : null);
    
    const activeBoard = getCurrentBoard();
    if (activeBoard && activeBoard.entityBank) {
        window.entityBank = activeBoard.entityBank;
    }

    renderBoardTabs();
    renderCurrentBoard();
    renderSessionLog();
    renderEntityBank();
}

function renderCurrentBoard() {
    const boardData = getCurrentBoard();
    if (!boardData) return;

    GRID_SIZE = boardData.map.gridSize;
    MAP_SCALE = boardData.map.scale || 1;

    const scaleInput = document.getElementById("mapScaleInput");
    if (scaleInput) scaleInput.value = MAP_SCALE;

    const boardNameInput = document.getElementById("boardNameInput");
    if (boardNameInput) boardNameInput.value = boardData.name || "";

    const notesTextArea = document.getElementById("sessionNotes");
    if (notesTextArea) notesTextArea.value = boardData.notes || "";

    mapImage.src = getImgData(boardData.map.image);

    applyVisionMode();
    document.querySelectorAll(".token").forEach(t => t.remove());

    boardStateToDom(boardData);
    boardData.entities.forEach(createEntityToken);

    syncAllCanvases();

    if (boardData.map.drawData) {
        const img = new Image();
        img.onload = () => {
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
            drawCtx.drawImage(img, 0, 0);
        };
        img.src = boardData.map.drawData;
    } else {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    }

    if (boardData.entityBank) {
        window.entityBank = boardData.entityBank || [];
        renderEntityBank();
    }

    invalidateLighting();
    invalidateFog();
}

function boardStateToDom(boardData) {
    GRID_SIZE = boardData.map.gridSize;
    mapImage.src = getImgData(boardData.map.image);
    board.style.width = `${boardData.map.width}px`;
    board.style.height = `${boardData.map.height}px`;

    document.getElementById("cellSizeInput").value = GRID_SIZE;
    syncGrid();
}

function openMoveBoardModal() {
    entityMenu.classList.add("hidden");
    const select = document.getElementById("targetBoardSelect");
    select.innerHTML = "";

    appState.boards
        .filter(b => b.id !== appState.activeBoardId)
        .forEach(b => {
            const option = document.createElement("option");
            option.value = b.id;
            option.textContent = b.name;
            select.appendChild(option);
        });

    document.getElementById("moveBoardModal").classList.remove("hidden");
}

function closeMoveBoardModal() {
    document.getElementById("moveBoardModal").classList.add("hidden");
}

function toggleGridColor() {
    grid.classList.toggle("dark");
    grid.classList.toggle("light");
}

function applyMapScale() {
    clearMeasurement();
    const value = parseFloat(document.getElementById("mapScaleInput").value);
    if (!value || value <= 0) return;

    const boardData = getCurrentBoard();
    const oldWidth = boardData.map.width;
    const oldHeight = boardData.map.height;

    MAP_SCALE = value;
    const newWidth = imageWidth * MAP_SCALE;
    const newHeight = imageHeight * MAP_SCALE;

    const scaleFactorX = newWidth / oldWidth;
    const scaleFactorY = newHeight / oldHeight;

    boardData.map.width = newWidth;
    boardData.map.height = newHeight;

    board.style.width = `${newWidth}px`;
    board.style.height = `${newHeight}px`;
    mapImage.style.width = `${newWidth}px`;
    mapImage.style.height = `${newHeight}px`;

    if (oldWidth > 0 && oldHeight > 0) {
        boardData.entities.forEach(entity => {
            entity.x = Math.round((entity.x * scaleFactorX) / GRID_SIZE) * GRID_SIZE;
            entity.y = Math.round((entity.y * scaleFactorY) / GRID_SIZE) * GRID_SIZE;

            validateEntityPosition(entity, newWidth, newHeight, GRID_SIZE);
        });
    }

    syncGrid();
    renderCurrentBoard();
}

function applyVisionMode() {
    const mode = getCurrentBoard().map.visionMode;
    const filters = {
        normal: "none",
        night: "brightness(0.4) contrast(1.2) saturate(0.6) hue-rotate(200deg)",
        sepia: "sepia(1) contrast(1.1) brightness(0.9)",
        thermal: "brightness(1.2) contrast(1.8) saturate(0) hue-rotate(320deg)",
        darkvision: "brightness(1.8) contrast(1.4) saturate(0.3) hue-rotate(90deg)"
    };
    mapImage.style.filter = filters[mode] || filters.normal;
}

function setVision(mode) {
    getCurrentBoard().map.visionMode = mode;
    applyVisionMode();
}

function effectsLoop(){
    if(lightingDirty){
        renderLighting();
        lightingDirty = false;
    }

    if(fogDirty){
        renderFog();
        fogDirty = false;
    }

    requestAnimationFrame(effectsLoop);
}

function updateTokenVisibility(){
    const board = getCurrentBoard();

    document.querySelectorAll(".token").forEach(token => {
        const data = token.entityData;

        if(data.type === "character"){
            token.style.opacity = "1";
            return;
        }

        let visibleByFog = true;
        if(board.fog.enabled){
            const cellX = Math.floor(data.x / GRID_SIZE);
            const cellY = Math.floor(data.y / GRID_SIZE);
            visibleByFog = isCellRevealed(cellX, cellY);
        }

        let visibleByLight = true;
        if(board.lighting.enabled){
            visibleByLight = false;
            const cx = data.x + (data.size * GRID_SIZE) / 2;
            const cy = data.y + (data.size * GRID_SIZE) / 2;

            for(const poly of currentLightPolygons){
                if(cx < poly.minX || cx > poly.maxX || cy < poly.minY || cy > poly.maxY){
                    continue;
                }
                if(pointInPolygon(cx, cy, poly.points)){
                    visibleByLight = true;
                    break;
                }
            }
        }

        token.style.opacity = (visibleByFog && visibleByLight) ? "1" : "0";
    });
}

// BANCO DE IMAGENES

let currentImageBankCallback = null;

function openImageBank(callback) {
    currentImageBankCallback = callback;
    renderImageBank();
    document.getElementById("imageBankModal").classList.remove("hidden");
}

function closeImageBank() {
    document.getElementById("imageBankModal").classList.add("hidden");
    currentImageBankCallback = null;
}

function renderImageBank() {
    const grid = document.getElementById("imageBankGrid");
    grid.innerHTML = "";

    if (appState.imageBank.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">El banco está vacío. Sube una imagen para comenzar.</div>`;
    }

    appState.imageBank.forEach(img => {
        const div = document.createElement("div");
        div.className = "image-bank-item";
        div.style.backgroundImage = `url(${img.data})`;
        div.title = img.name;
        div.onclick = () => {
            if (currentImageBankCallback) currentImageBankCallback(img.id);
            closeImageBank();
        };
        grid.appendChild(div);
    });
}

function handleNewBankImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const newImg = {
            id: 'img_' + crypto.randomUUID(),
            name: file.name,
            data: event.target.result // Base64
        };
        
        appState.imageBank.push(newImg);
        renderImageBank();

        if (currentImageBankCallback) {
            currentImageBankCallback(newImg.id);
        }
        closeImageBank();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
}

function getImgData(id) {
    if (!id) return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    
    if (typeof id === 'string' && id.startsWith('data:image')) {
        return id;
    }

    const img = appState.imageBank.find(i => i.id === id);
    if (img && img.data) {
        return img.data;
    }
    
    return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
}

// REGISTROS
function logEvent(category, description, details = {}) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { id: crypto.randomUUID(), timestamp, category, description, details };

    if (!appState.sessionLog) appState.sessionLog = [];
    appState.sessionLog.push(entry);
    renderSessionLog();
}

function renderSessionLog() {
    const container = document.getElementById("sessionLogContainer");
    if (!container) return;

    const logs = appState.sessionLog || [];

    if (logs.length === 0) {
        container.innerHTML = `<div style="color: #888;">No hay eventos registrados en la sesión.</div>`;
        return;
    }

    container.innerHTML = logs.slice().reverse().map(entry => {
        let categoryColor = "#22c55e";
        if (entry.category === "attack") categoryColor = "#ef4444";
        if (entry.category === "dice") categoryColor = "#facc15";

        return `
            <div style="border-bottom: 1px solid #222; padding-bottom: 4px;">
                <span style="color: #666;">[${entry.timestamp}]</span>
                <span style="color: ${categoryColor}; font-weight: bold;">[${entry.category.toUpperCase()}]</span>
                <span>${entry.description}</span>
            </div>
        `;
    }).join("");
}

function clearSessionLog() {
    appState.sessionLog = [];
    renderSessionLog();
}

// HERRAMIENTA DE MEDICION
function drawMeasurement(start, end) {
    measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const meters = Math.sqrt(dx * dx + dy * dy) / GRID_SIZE;

    measureCtx.strokeStyle = "#00ff66";
    measureCtx.lineWidth = 3;
    measureCtx.beginPath();
    measureCtx.moveTo(start.x, start.y);
    measureCtx.lineTo(end.x, end.y);
    measureCtx.stroke();

    measureCtx.fillStyle = "#00ff66";
    [start, end].forEach(pt => {
        measureCtx.beginPath();
        measureCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        measureCtx.fill();
    });

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const label = `${meters.toFixed(1)} m`;

    measureCtx.font = "bold 16px Arial";
    const textWidth = measureCtx.measureText(label).width;

    measureCtx.fillStyle = "rgba(0,0,0,.75)";
    measureCtx.fillRect(midX - textWidth / 2 - 6, midY - 14, textWidth + 12, 24);

    measureCtx.fillStyle = "#ffffff";
    measureCtx.fillText(label, midX - textWidth / 2, midY + 4);
}

function clearMeasurement() {
    measureCtx.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
    measureStart = null;
    measurePreview = null;
}

// HERRAMIENTA DE DIBUJO
function getCanvasCoords(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function startDrawing(e) {
    if (isDraggingToken || isPanning || (!drawMode && !eraseMode)) return;

    drawing = true;
    const pos = getCanvasCoords(e);
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);

    const onDraw = (moveEvent) => {
        if (!drawing) return;
        const p = getCanvasCoords(moveEvent);
        drawCtx.globalCompositeOperation = eraseMode ? "destination-out" : "source-over";
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = drawSize;
        drawCtx.lineCap = "round";
        drawCtx.lineTo(p.x, p.y);
        drawCtx.stroke();
    };

    const stopDrawing = () => {
        drawing = false;
        drawCtx.beginPath();
        window.removeEventListener("mousemove", onDraw);
        window.removeEventListener("mouseup", stopDrawing);
    };

    window.addEventListener("mousemove", onDraw);
    window.addEventListener("mouseup", stopDrawing);
}

// SISTEMA DE ILUMINACION
function invalidateLighting(){
    lightingDirty = true;
}

function syncLightingCanvas() {
    if (lightingCanvas.width !== board.clientWidth || lightingCanvas.height !== board.clientHeight) {
        lightingCanvas.width = board.clientWidth;
        lightingCanvas.height = board.clientHeight;
        invalidateLighting();
    }
}

function raySegmentIntersection(ray, segment) {
    const x1 = segment.x1, y1 = segment.y1;
    const x2 = segment.x2, y2 = segment.y2;
    const x3 = ray.x,  y3 = ray.y;
    const x4 = ray.x + ray.dx, y4 = ray.y + ray.dy;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const hitX = x1 + t * (x2 - x1);
        const hitY = y1 + t * (y2 - y1);
        const distX = hitX - ray.x;
        const distY = hitY - ray.y;
        
        return { x: hitX, y: hitY, distanceSq: (distX * distX) + (distY * distY) };
    }
    return null;
}

function getCharacterLights() {
    const boardData = getCurrentBoard();
    if (!boardData || !boardData.entities) return [];
    
    const HALF_GRID = GRID_SIZE / 2;
    return boardData.entities
        .filter(entity => entity.type === "character")
        .map(entity => {
            const offset = (entity.size * HALF_GRID);
            return {
                x: entity.x + offset,
                y: entity.y + offset,
                radius: characterLightRadius,
                color: "#fff5b8"
            };
        });
}

function getNearbyWalls(walls, light) {
    const r = light.radius;
    const minX = light.x - r, maxX = light.x + r;
    const minY = light.y - r, maxY = light.y + r;
    const nearbyWalls = [];

    for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        if (w.type === "door" && w.opened) continue;

        const wMinX = w.x1 < w.x2 ? w.x1 : w.x2;
        const wMaxX = w.x1 > w.x2 ? w.x1 : w.x2;
        const wMinY = w.y1 < w.y2 ? w.y1 : w.y2;
        const wMaxY = w.y1 > w.y2 ? w.y1 : w.y2;

        if (wMaxX < minX || wMinX > maxX || wMaxY < minY || wMinY > maxY) continue;

        nearbyWalls.push(w);
    }
    return nearbyWalls;
}

function getVisibilityAngles(light, walls) {
    const EPS = 0.0001;
    const angleSet = new Set(); 

    const normalizeAngle = (angle) => {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    };

    for (let a = 0; a < 360; a += 15) { 
        angleSet.add(normalizeAngle((a * Math.PI) / 180));
    }

    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        const a1 = Math.atan2(wall.y1 - light.y, wall.x1 - light.x);
        const a2 = Math.atan2(wall.y2 - light.y, wall.x2 - light.x);

        angleSet.add(normalizeAngle(a1 - EPS)); 
        angleSet.add(normalizeAngle(a1)); 
        angleSet.add(normalizeAngle(a1 + EPS));
        
        angleSet.add(normalizeAngle(a2 - EPS)); 
        angleSet.add(normalizeAngle(a2)); 
        angleSet.add(normalizeAngle(a2 + EPS));
    }

    return Array.from(angleSet).sort((a, b) => a - b);
}

function renderLighting() {
    const boardData = getCurrentBoard();

    lctx.clearRect(0, 0, lightingCanvas.width, lightingCanvas.height);
    lctx.globalCompositeOperation = "source-over";

    if (!boardData.lighting.enabled) {
        updateTokenVisibility();
        return;
    }

    lightingDirty = false;

    const lights = [...boardData.lighting.lights, ...getCharacterLights()];
    const walls = boardData.lighting.walls;
    currentLightPolygons = [];

    lctx.fillStyle = `rgba(0,0,0,${currentDarkLevel})`;
    lctx.fillRect(0, 0, lightingCanvas.width, lightingCanvas.height);

    lctx.globalCompositeOperation = "destination-out";

    for (let l = 0; l < lights.length; l++) {
        const light = lights[l];
        const points = [];
        const nearbyWalls = getNearbyWalls(walls, light);
        const angles = getVisibilityAngles(light, nearbyWalls);

        for (let a = 0; a < angles.length; a++) {
            const angle = angles[a];
            const ray = {
                x: light.x,
                y: light.y,
                dx: Math.cos(angle) * light.radius,
                dy: Math.sin(angle) * light.radius
            };

            let closest = null;
            for (let i = 0; i < nearbyWalls.length; i++) {
                const hit = raySegmentIntersection(ray, nearbyWalls[i]);
                if (hit && (!closest || hit.distanceSq < closest.distanceSq)) {
                    closest = hit;
                }
            }

            points.push(closest ? { x: closest.x, y: closest.y } : { x: light.x + ray.dx, y: light.y + ray.dy });
        }

        if (points.length === 0) continue;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }

        currentLightPolygons.push({ points, minX, minY, maxX, maxY });

        lctx.beginPath();
        lctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            lctx.lineTo(points[i].x, points[i].y);
        }
        lctx.closePath();

        const gradient = lctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
        gradient.addColorStop(0, "rgba(0,0,0,1)");
        gradient.addColorStop(0.4, "rgba(0,0,0,0.95)");
        gradient.addColorStop(0.75, "rgba(0,0,0,0.4)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        lctx.fillStyle = gradient;
        lctx.fill();
    }

    lctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        const poly = currentLightPolygons[i];
        if (!poly) continue;

        lctx.save();
        lctx.beginPath();
        lctx.moveTo(poly.points[0].x, poly.points[0].y);
        for (let p = 1; p < poly.points.length; p++) {
            lctx.lineTo(poly.points[p].x, poly.points[p].y);
        }
        lctx.closePath();
        lctx.clip();

        const glow = lctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
        const intensity = typeof currentLightIntensity !== 'undefined' ? currentLightIntensity : 1;
        glow.addColorStop(0, hexToRgba(light.color, intensity));
        glow.addColorStop(0.5, hexToRgba(light.color, intensity * 0.55));
        glow.addColorStop(1, hexToRgba(light.color, 0));

        lctx.beginPath();
        lctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
        lctx.fillStyle = glow;
        lctx.fill();
        lctx.restore();
    }

    if (typeof lightingEditor !== 'undefined' && lightingEditor) {
        lctx.lineWidth = 4;
        for (let i = 0; i < walls.length; i++) {
            const w = walls[i];
            lctx.strokeStyle = w.type === "door" ? (w.opened ? "#ff3333" : "#880000") : "#00ff88";
            lctx.beginPath();
            lctx.moveTo(w.x1, w.y1);
            lctx.lineTo(w.x2, w.y2);
            lctx.stroke();
        }

        for (let i = 0; i < lights.length; i++) {
            lctx.beginPath();
            lctx.arc(lights[i].x, lights[i].y, 8, 0, Math.PI * 2);
            lctx.fillStyle = "#ffd700";
            lctx.fill();
        }
    }

    updateTokenVisibility();
}

function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function findLightAt(x, y) {
    const lights = getCurrentBoard().lighting.lights;
    for (let i = 0; i < lights.length; i++) {
        const dx = x - lights[i].x;
        const dy = y - lights[i].y;
        if (dx * dx + dy * dy < 400) return i;
    }
    return -1;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1;
    const C = x2 - x1, D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) {
        xx = x1; yy = y1;
    } else if (param > 1) {
        xx = x2; yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx, dy = py - yy;
    return dx * dx + dy * dy;
}

function findWallAt(x, y) {
    const walls = getCurrentBoard().lighting.walls;
    for (let i = 0; i < walls.length; i++) {
        if (pointToSegmentDistance(x, y, walls[i].x1, walls[i].y1, walls[i].x2, walls[i].y2) < 100) {
            return i;
        }
    }
    return -1;
}

function findDoorAt(x, y) {
    const walls = getCurrentBoard().lighting.walls;
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        if (wall.type === "door" && pointToSegmentDistance(x, y, wall.x1, wall.y1, wall.x2, wall.y2) < 900) {
            return wall;
        }
    }
    return null;
}

function updateLightingUI(){
    const disabled = !lightingEditor;
    lightToolBtn.disabled = disabled;
    wallToolBtn.disabled = disabled;
    doorToolBtn.disabled = disabled;
    moveToolBtn.disabled = disabled;
    eraseToolBtn.disabled = disabled;
}

function selectLightingTool(tool, button) {
    lightingTool = tool;
    [lightToolBtn, wallToolBtn, doorToolBtn, moveToolBtn, eraseToolBtn].forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
}

const rgbCache = new Map();
function hexToRgba(hex, alpha) {
    let rgb = rgbCache.get(hex);
    if (!rgb) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        rgb = `${r}, ${g}, ${b}`;
        rgbCache.set(hex, rgb);
    }
    return `rgba(${rgb}, ${alpha})`;
}

// SISTEMA DE NIEBLA
function invalidateFog(){
    fogDirty = true;
}

function resetFog(){
    fogMaskCtx.clearRect(0, 0, fogMaskCanvas.width, fogMaskCanvas.height);
    getCurrentBoard().fog.cells = {};
    invalidateFog();
}

function revealCell(x, y) {
    const boardData = getCurrentBoard();
    const key = `${x},${y}`;
    boardData.fog.cells[key] = true;
}

function isCellRevealed(x, y){
    const boardData = getCurrentBoard();
    return !!boardData.fog.cells[`${x},${y}`];
}

function revealVisionSimple(light) {
    const radiusCells = Math.ceil(light.radius / GRID_SIZE);
    const cx = Math.floor(light.x / GRID_SIZE);
    const cy = Math.floor(light.y / GRID_SIZE);

    for (let x = cx - radiusCells; x <= cx + radiusCells; x++) {
        for (let y = cy - radiusCells; y <= cy + radiusCells; y++) {
            const dx = (x * GRID_SIZE) - light.x;
            const dy = (y * GRID_SIZE) - light.y;

            if (dx * dx + dy * dy <= light.radius * light.radius) {
                revealCell(x, y);
            }
        }
    }
}

function renderFog() {
    const boardData = getCurrentBoard();
    fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

    if (!boardData.fog.enabled) return;

    fogCtx.fillStyle = "rgba(0,0,0,0.9)";
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

    fogCtx.globalCompositeOperation = "destination-out";

    for (const key in boardData.fog.cells) {
        const [x, y] = key.split(",").map(Number);
        fogCtx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    }

    fogCtx.globalCompositeOperation = "source-over";
    updateTokenVisibility();
}

// DRAG OPTIMIZADO DE TOKENS
function makeDraggable(element){
    let offsetX = 0, offsetY = 0;
    let isDragging = false;
    let dragStarted = false;
    let startX = 0, startY = 0;

    element.addEventListener("mousedown", (e) => {

        if (typeof selectEntitiesOnBoardMode !== "undefined" && selectEntitiesOnBoardMode) {
            if (element.entityData && element.entityData.id) {
                toggleEntityInInitiative(element.entityData.id);
            }
            return;
        }

        if (e.altKey || lightingEditor || drawMode || measureMode) return;

        isDraggingToken = true;
        isDragging = true;
        dragStarted = false;

        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        element.style.zIndex = 999;

        const onMouseMove = (moveEvent) => {
            if (moveEvent.altKey || lightingEditor || drawMode || measureMode || !isDragging || isPanning) return;

            const dx = Math.abs(moveEvent.clientX - startX);
            const dy = Math.abs(moveEvent.clientY - startY);

            if(dx > 5 || dy > 5){
                dragStarted = true;
            }

            const boardRect = board.getBoundingClientRect();
            let x = moveEvent.clientX - boardRect.left - offsetX;
            let y = moveEvent.clientY - boardRect.top - offsetY;

            // Snap a la cuadrícula
            x = Math.round(x / GRID_SIZE) * GRID_SIZE;
            y = Math.round(y / GRID_SIZE) * GRID_SIZE;

            // Límites
            x = Math.max(0, Math.min(x, board.clientWidth - element.clientWidth));
            y = Math.max(0, Math.min(y, board.clientHeight - element.clientHeight));

            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            element.entityData.x = x;
            element.entityData.y = y;

            moveTooltip(moveEvent);

            invalidateLighting();

            if(element.entityData.type === "character"){
                revealVisionSimple({
                    x: element.entityData.x,
                    y: element.entityData.y,
                    radius: characterFogRadius
                });
            }

            invalidateFog();
            syncEntityToState(element);
        };

        const onMouseUp = () => {
            isDragging = false;
            isDraggingToken = false;
            element.wasDragged = dragStarted;
            element.style.zIndex = 10;

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

/* ==========================================================================
   SISTEMA DE MACROS REACTIVO
   ========================================================================== */
const MacroSystem = {
    listeners: [],

    emit(eventType, entity, extraData = {}) {
        if (!entity || !entity.macros || entity.macros.length === 0) return;

        const wrapIfEntity = (obj) => {
            if (obj && typeof obj === 'object' && obj.stats && !obj.getHp) {
                return this.createEntityContext(obj);
            }
            return obj;
        };

        const processedExtraData = {};
        for (const key in extraData) {
            processedExtraData[key] = wrapIfEntity(extraData[key]);
        }

        const event = { type: eventType, ...processedExtraData };
        const ctx = this.createEntityContext(entity);

        entity.macros.forEach(macro => {
            if (!macro.enabled) return;
            if (macro.triggerOnce && macro.hasExecuted) return;

            try {
                const conditionMet = this.evalCondition(macro.condition, ctx, event);

                if (conditionMet) {
                    this.evalAction(macro.action, ctx, event);
                    
                    if (macro.triggerOnce) {
                        macro.hasExecuted = true;
                    }

                    logEvent('macro', `Macro "${macro.name}" activada en ${entity.name}`);
                }
            } catch (err) {
                console.error(`Error ejecutando macro "${macro.name}":`, err);
            }
        });
    },

    createEntityContext(entity) {

        function parseNum(val) {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? 0 : parsed;
            }
            if (val && typeof val === 'object' && 'value' in val) {
                return parseNum(val.value);
            }
            return 0;
        }

        return {
            entity,
            // --- FUNCIONES DE LECTURA / COMPROBACIÓN ---
            getHp: () => parseFractionalStat(getStat(entity, "Vida"))[0],
            getMaxHp: () => parseFractionalStat(getStat(entity, "Vida"))[1],
            getMana: () => parseFractionalStat(getStat(entity, "Mana"))[0],
            getMaxMana: () => parseFractionalStat(getStat(entity, "Mana"))[1],
            getStatValue: (statName) => parseNum(getStat(entity, statName)),
            hasItem: (itemName) => entity.inventory?.items?.some(i => i.name.toLowerCase() === itemName.toLowerCase()),
            hasAbility: (abilityName) => entity.abilities?.some(a => a.name.toLowerCase() === abilityName.toLowerCase()),
            hasWeapon: (weaponName) => entity.inventory?.weapons?.some(w => w.name.toLowerCase() === weaponName.toLowerCase()),
            hasStatus: (statusName) => entity.statuses?.some(s => s.name.toLowerCase() === statusName.toLowerCase()),

            // --- FUNCIONES DE MODIFICACIÓN ---
            modifyHp: (amount) => {
                const [curr, max] = parseFractionalStat(getStat(entity, "Vida"));
                const next = Math.max(0, Math.min(max, curr + amount));
                setStatValue(entity, "Vida", `${next}/${max}`);
                MacroSystem.emit(amount < 0 ? 'hp_decreased' : 'hp_increased', entity, { amount, current: next });
            },
            modifyMana: (amount) => {
                const [curr, max] = parseFractionalStat(getStat(entity, "Mana"));
                const next = Math.max(0, Math.min(max, curr + amount));
                setStatValue(entity, "Mana", `${next}/${max}`);
                MacroSystem.emit(amount < 0 ? 'mana_decreased' : 'mana_increased', entity, { amount, current: next });
            },
            addStatus: (statusObj) => {
                if (!entity.statuses) entity.statuses = [];
                entity.statuses.push(statusObj);
                MacroSystem.emit('status_added', entity, { status: statusObj.name });
            },
            removeStatus: (statusName) => {
                if (!entity.statuses) return;
                entity.statuses = entity.statuses.filter(s => s.name.toLowerCase() !== statusName.toLowerCase());
                MacroSystem.emit('status_removed', entity, { status: statusName });
            },
            addAbility: (abilityObj) => {
                if (!entity.abilities) entity.abilities = [];
                entity.abilities.push(abilityObj);
                MacroSystem.emit('ability_added', entity, { ability: abilityObj.name });
            },
            removeAbility: (abilityName) => {
                if (!entity.abilities) return;
                entity.abilities = entity.abilities.filter(a => a.name.toLowerCase() !== abilityName.toLowerCase());
                MacroSystem.emit('ability_removed', entity, { ability: abilityName });
            },
            addItem: (itemObj) => {
                if (!entity.inventory) entity.inventory = { weapons: [], items: [] };
                entity.inventory.items.push(itemObj);
                MacroSystem.emit('item_added', entity, { item: itemObj.name });
            },
            removeItem: (objName) => {
                if (!entity.inventory?.items) return;
                entity.inventory.items = entity.inventory.items.filter(i => i.name.toLowerCase() !== objName.toLowerCase());
                MacroSystem.emit('item_removed', entity, { item: objName });
            },
            addWeapon: (weaponObj) => {
                if (!entity.inventory) entity.inventory = { weapons: [], items: [] };
                entity.inventory.weapons.push(weaponObj);
                MacroSystem.emit('weapon_added', entity, { weapon: weaponObj.name });
            },
            removeWeapon: (weaponName) => {
                if (!entity.inventory?.weapons) return;
                entity.inventory.weapons = entity.inventory.weapons.filter(w => w.name.toLowerCase() !== weaponName.toLowerCase());
                MacroSystem.emit('weapon_removed', entity, { weapon: weaponName });
            }
        };
    },

    evalCondition(code, ctx, event) {
        const func = new Function('entity', 'event', `return (${code});`);
        return func(ctx, event);
    },

    evalAction(code, ctx, event) {
        const func = new Function('entity', 'event', code);
        func(ctx, event);
    }
};

function setStatValue(entity, name, val) {
    const stat = entity.stats?.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (stat) stat.value = val;
}

// PERSONAJES
const DEFAULT_STATS = ["Fuerza", "Agilidad", "Destreza", "Constitución", "Inteligencia", "Sabiduría", "Carisma", "Espíritu"];
const DEFAULT_DND_STATS = DEFAULT_STATS.map(name => ({ name, value: 10 }));

const setInputs = (map) => Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
});

const getVal = (el, selector, fallback = "") => {
    const val = el.querySelector(selector)?.value?.trim();
    return val || fallback;
};
const getNum = (el, selector, fallback = 0) => parseFloat(el.querySelector(selector)?.value) || fallback;

const createOptionList = (options, selectedVal) => 
    options.map(opt => `<option value="${opt}" ${selectedVal == opt ? 'selected' : ''}>${typeof opt === 'number' ? 'd' + opt : opt}</option>`).join("");

const getAvailableStatOptions = () => {
    const stats = [...DEFAULT_STATS];
    document.querySelectorAll(".stat-name-input").forEach(i => {
        const val = i.value.trim();
        if (val && !stats.includes(val)) stats.push(val);
    });
    return stats;
};

function refreshStatSelects() {
    const options = getAvailableStatOptions();
    document.querySelectorAll(".stat-select").forEach(select => {
        const currentVal = select.value;
        select.innerHTML = options.map(s => `<option value="${s}">${s}</option>`).join("");
        if (options.includes(currentVal)) select.value = currentVal;
    });
}

function updateEntityModifiers() {
    refreshStatSelects();
    recalculateItemModifiers();
}

function handleTypeToggle(selectEl, config) {
    const container = selectEl.closest(".single-line-item, .nested-status-card");
    const val = selectEl.value;
    Object.entries(config).forEach(([selector, allowedTypes]) => {
        container.querySelector(selector)?.classList.toggle("hidden", !allowedTypes.includes(val));
    });
    updateEntityModifiers();
}

function createEntity(type) {
    pendingEntity = { type, image: DEFAULT_ENTITY_IMAGE };
    openEntityModal();
}

function switchEntityTab(tabId, btnElement) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".entity-tabs .tab-btn").forEach(btn => {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
    });
    document.getElementById(tabId)?.classList.remove("hidden");
    btnElement.classList.add("active");
    btnElement.setAttribute("aria-selected", "true");
}

function openEntityModal() {
    hideTooltip();
    document.getElementById("entityModal").classList.remove("hidden");
    document.getElementById("confirmEntityBtn").textContent = editingEntity ? "Guardar cambios" : "Crear";

    if (!editingEntity) {
        setInputs({ entityName: "", entityClass: "", vidaActual: 10, vidaMax: 10, manaActual: 5, manaMax: 5, velocidadInput: 10, initDiceSelect: "20" });
        
        ["statsContainer", "abilitiesContainer", "weaponsContainer", "itemsContainer", "statusContainer", "macrosContainer"].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.innerHTML = "";
        });
        
        DEFAULT_DND_STATS.forEach(s => addStatField(s.name, s.value));
    }
}

function closeEntityModal() {
    document.getElementById("entityModal").classList.add("hidden");
    document.getElementById("editEntityImageInput").value = "";
    editingEntity = pendingEntity = null;
}

function loadEntityIntoModal(data) {
    pendingEntity = { type: data.type, image: data.image };
    setInputs({ entityName: data.name, entitySize: data.size, entityClass: data.clase, velocidadInput: data.speed ?? 10, initDiceSelect: data.initDice || "20" });

    const parseStatPair = (statName, currentId, maxId) => {
        const found = data.stats?.find(s => s.name === statName);
        if (found) {
            const [curr, max] = found.value.split("/");
            setInputs({ [currentId]: curr, [maxId]: max });
        }
    };
    parseStatPair("Vida", "vidaActual", "vidaMax");
    parseStatPair("Mana", "manaActual", "manaMax");

    document.getElementById("statsContainer").innerHTML = "";
    data.stats?.filter(s => !["Vida", "Mana", "Velocidad"].includes(s.name)).forEach(s => addStatField(s.name, s.value));

    const containers = {
        abilitiesContainer: () => data.abilities?.forEach(addAbilityField),
        weaponsContainer: () => data.inventory?.weapons?.forEach(addWeaponField),
        itemsContainer: () => data.inventory?.items?.forEach(addItemField),
        statusContainer: () => data.statuses?.forEach(addStatusField),
        macrosContainer: () => data.macros?.forEach(addMacroField)
    };
    Object.entries(containers).forEach(([id, fillFn]) => {
        document.getElementById(id).innerHTML = "";
        fillFn();
    });

    updateEntityModifiers();
}

function recalculateItemModifiers() {
    const itemMods = {}, statusMods = {};

    const processMods = (containerSelector, typeClass, statClass, opClass, valClass) => {
        document.querySelectorAll(containerSelector).forEach(item => {
            const type = typeClass ? getVal(item, typeClass) : null;
            if (!typeClass || type === "stat_mod") {
                const targetStat = getVal(item, statClass);
                const op = getVal(item, opClass, "add");
                const val = getNum(item, valClass);

                if (targetStat) {
                    const mods = typeClass ? statusMods : itemMods;
                    mods[targetStat] = (mods[targetStat] || 0) + (op === "add" ? val : -val);
                }
            }
        });
    };

    processMods("#itemsContainer .single-line-item", null, ".item-target-stat", ".item-op", ".item-val");
    processMods("#statusContainer .single-line-item", ".status-type", ".status-target-stat", ".status-op", ".status-stat-val");

    document.querySelectorAll("#statsContainer .single-line-item").forEach(item => {
        const statName = getVal(item, ".stat-name-input");
        const modDisplay = item.querySelector(".stat-calculated-mod");

        if (statName && modDisplay) {
            const objMod = itemMods[statName] || 0;
            const estMod = statusMods[statName] || 0;
            modDisplay.textContent = `Obj: ${objMod >= 0 ? '+' : ''}${objMod} | Est: ${estMod >= 0 ? '+' : ''}${estMod}`;
            modDisplay.dataset.itemMod = objMod;
            modDisplay.dataset.statusMod = estMod;
        }
    });
}

function addStatField(name = "", value = 10) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    item.innerHTML = `
        <div class="item-content">
            <input placeholder="Nombre Stat" class="stat-name-input" value="${name}" oninput="updateEntityModifiers()">
            <label>Valor Base:</label>
            <input type="number" class="stat-value-input" value="${value}" style="width: 70px;">
            <span class="stat-calculated-mod" data-item-mod="0">Obj: +0</span>
        </div>
        <button class="btn-delete" onclick="this.closest('.single-line-item').remove(); updateEntityModifiers();">×</button>`;
    document.getElementById("statsContainer").appendChild(item);
    updateEntityModifiers();
}

function addAbilityField(data = null) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    item.style.flexDirection = "column";

    const statOptions = createOptionList(getAvailableStatOptions(), data?.statUsed || data?.targetStat);
    const diceOptions = createOptionList([4, 6, 8, 10, 12, 20], data?.diceType || 8);
    const type = data?.type || 'dice_damage';

    item.innerHTML = `
        <div style="display: flex; gap: 6px; width: 100%; align-items: center; flex-wrap: wrap;">
            <input placeholder="Nombre de Habilidad" class="ability-name" value="${data?.name || ''}">
            <label>Maná:</label>
            <input type="number" class="ability-mana" min="0" value="${data?.mana || 0}" style="width: 50px;">
            <label>Acción Principal:</label>
            <select class="ability-type" onchange="handleTypeToggle(this, {'.ability-flat-fields': ['flat_damage','heal_flat'], '.ability-dice-fields': ['dice_damage','heal_dice'], '.ability-stat-fields': ['stat_mod'], '.ability-scale-fields': ['dice_damage','flat_damage','stat_mod']})">
                <option value="dice_damage" ${type === 'dice_damage' ? 'selected' : ''}>Daño Dados</option>
                <option value="flat_damage" ${type === 'flat_damage' ? 'selected' : ''}>Daño Plano</option>
                <option value="heal_flat" ${type === 'heal_flat' ? 'selected' : ''}>Curación Plana</option>
                <option value="heal_dice" ${type === 'heal_dice' ? 'selected' : ''}>Curación Dados</option>
                <option value="stat_mod" ${type === 'stat_mod' ? 'selected' : ''}>Modificación Stat</option>
            </select>
            <button type="button" class="btn-delete" onclick="this.closest('.single-line-item').remove()">×</button>
        </div>
        <div class="ability-main-params" style="margin-top: 4px; width: 100%;">
            <div class="ability-flat-fields ${!['flat_damage', 'heal_flat'].includes(type) ? 'hidden' : ''}">
                <label>Cantidad directa:</label><input type="number" class="ability-flat-damage" value="${data?.flatDamage || 0}" style="width: 60px;">
            </div>
            <div class="ability-dice-fields ${!['dice_damage', 'heal_dice'].includes(type) ? 'hidden' : ''}" style="display: flex; gap: 4px; align-items: center;">
                <label>Dados:</label><input type="number" class="ability-dice-qty" value="${data?.diceQty || 1}" style="width: 40px;">
                <select class="ability-dice-type">${diceOptions}</select>
                <span class="ability-scale-fields ${type === 'heal_dice' ? 'hidden' : ''}" style="display: inline-flex; gap: 4px; align-items: center;">
                    <label>Escala con:</label><select class="stat-select ability-stat-used">${statOptions}</select>
                </span>
            </div>
            <div class="ability-stat-fields ${type !== 'stat_mod' ? 'hidden' : ''}">
                <label>Modifica Stat Objetivo:</label><select class="stat-select ability-target-stat">${statOptions}</select>
                <select class="ability-op"><option value="add" ${data?.op === 'add' ? 'selected' : ''}>+</option><option value="subtract" ${data?.op === 'subtract' ? 'selected' : ''}>-</option></select>
                <input type="number" class="ability-val" value="${data?.val || 1}" style="width: 50px;">
                <label style="margin-left: 6px;">Duración (Turnos):</label><input type="number" class="ability-duration" value="${data?.duration || 1}" min="1" style="width: 50px;">
            </div>
        </div>
        <div style="margin-top: 8px; width: 100%; border-top: 1px solid #444; padding-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <small style="color: #aaa;">Estados que aplicará al objetivo:</small>
                <button type="button" class="btn-secondary" onclick="addStatusToParent(this)" style="padding: 2px 6px; font-size: 11px;">+ Aplicar Estado</button>
            </div>
            <div class="applied-statuses-list" style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;"></div>
        </div>`;

    document.getElementById("abilitiesContainer").appendChild(item);
    data?.appliedStatuses?.forEach(st => item.querySelector(".applied-statuses-list").insertAdjacentHTML('beforeend', createStatusSubFormHTML(st)));
}

function addWeaponField(data = null) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    item.style.flexDirection = "column";

    const statOptions = createOptionList(getAvailableStatOptions(), data?.statUsed);
    const diceOptions = createOptionList([4, 6, 8, 10, 12, 20], data?.diceType || 8);
    const type = data?.type || 'dice_damage';

    item.innerHTML = `
        <div style="display: flex; gap: 6px; width: 100%; align-items: center; flex-wrap: wrap;">
            <input placeholder="Nombre del arma" class="weapon-name" value="${data?.name || ''}">
            <label>Tipo:</label>
            <select class="weapon-type" onchange="handleTypeToggle(this, {'.weapon-dice-fields': ['dice_damage'], '.weapon-flat-fields': ['flat_damage']})">
                <option value="dice_damage" ${type === 'dice_damage' ? 'selected' : ''}>Dados</option>
                <option value="flat_damage" ${type === 'flat_damage' ? 'selected' : ''}>Plano</option>
            </select>
            <div class="weapon-dice-fields ${type === 'flat_damage' ? 'hidden' : ''}" style="display: flex; gap: 4px; align-items: center;">
                <input type="number" class="weapon-dice-qty" value="${data?.diceQty || 1}" style="width: 40px;">
                <select class="weapon-dice-type">${diceOptions}</select>
                <label>Escala con:</label><select class="stat-select weapon-stat-used">${statOptions}</select>
            </div>
            <div class="weapon-flat-fields ${type !== 'flat_damage' ? 'hidden' : ''}" style="display: flex; gap: 4px; align-items: center;">
                <label>Daño directo:</label><input type="number" class="weapon-flat-damage" value="${data?.flatDamage || 0}" style="width: 55px;">
            </div>
            <button type="button" class="btn-delete" onclick="this.closest('.single-line-item').remove()">×</button>
        </div>
        <div style="margin-top: 8px; width: 100%; border-top: 1px solid #444; padding-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <small style="color: #aaa;">Estados que puede aplicar al golpear:</small>
                <button type="button" class="btn-secondary" onclick="addStatusToParent(this)" style="padding: 2px 6px; font-size: 11px;">+ Aplicar Estado</button>
            </div>
            <div class="applied-statuses-list" style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;"></div>
        </div>`;

    document.getElementById("weaponsContainer").appendChild(item);
    data?.appliedStatuses?.forEach(st => item.querySelector(".applied-statuses-list").insertAdjacentHTML('beforeend', createStatusSubFormHTML(st)));
}

function addItemField(data = null) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    const statOptions = createOptionList(getAvailableStatOptions(), data?.targetStat);

    item.innerHTML = `
        <div class="item-content">
            <input placeholder="Nombre del objeto" class="item-name" value="${data?.name || ''}">
            <label>Modifica:</label>
            <select class="stat-select item-target-stat" onchange="updateEntityModifiers()">${statOptions}</select>
            <select class="item-op" onchange="updateEntityModifiers()">
                <option value="add" ${data?.op === 'add' ? 'selected' : ''}>+</option>
                <option value="subtract" ${data?.op === 'subtract' ? 'selected' : ''}>-</option>
            </select>
            <label>Valor:</label>
            <input type="number" class="item-val" value="${data?.val ?? 1}" style="width: 55px;" oninput="updateEntityModifiers()">
        </div>
        <button class="btn-delete" onclick="this.closest('.single-line-item').remove(); updateEntityModifiers();">×</button>`;
    document.getElementById("itemsContainer").appendChild(item);
    updateEntityModifiers();
}

function addStatusField(data = null) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    const statOptions = createOptionList(getAvailableStatOptions(), data?.targetStat);
    const diceOptions = createOptionList([4, 6, 8, 10, 12, 20], data?.diceType || 8);
    const type = data?.type || 'flat_damage';

    item.innerHTML = `
        <div class="item-content" style="flex-wrap: wrap; gap: 6px;">
            <input placeholder="Nombre del estado" class="status-name" value="${data?.name || ''}">
            <label>Rondas:</label><input type="number" class="status-duration" value="${data?.duration || 1}" min="1" style="width: 50px;">
            <label>Tipo:</label>
            <select class="status-type" onchange="handleTypeToggle(this, {'.status-flat-fields': ['flat_damage','heal_flat'], '.status-dice-fields': ['dice_damage','heal_dice'], '.status-stat-fields': ['stat_mod']})">
                <option value="flat_damage" ${type === 'flat_damage' ? 'selected' : ''}>Daño Plano</option>
                <option value="dice_damage" ${type === 'dice_damage' ? 'selected' : ''}>Daño Dados</option>
                <option value="heal_flat" ${type === 'heal_flat' ? 'selected' : ''}>Curación Plana</option>
                <option value="heal_dice" ${type === 'heal_dice' ? 'selected' : ''}>Curación Dados</option>
                <option value="stat_mod" ${type === 'stat_mod' ? 'selected' : ''}>Modif. Stats</option>
            </select>
            <div class="status-flat-fields ${!['flat_damage', 'heal_flat'].includes(type) ? 'hidden' : ''}">
                <label>Valor/turno:</label><input type="number" class="status-flat-damage" value="${data?.flatDamage || 0}" style="width: 55px;">
            </div>
            <div class="status-dice-fields ${!['dice_damage', 'heal_dice'].includes(type) ? 'hidden' : ''}">
                <label>Dados:</label><input type="number" class="status-dice-qty" value="${data?.diceQty || 1}" style="width: 45px;"><select class="status-dice-type">${diceOptions}</select>
            </div>
            <div class="status-stat-fields ${type !== 'stat_mod' ? 'hidden' : ''}">
                <label>Stat:</label><select class="stat-select status-target-stat" onchange="updateEntityModifiers()">${statOptions}</select>
                <select class="status-op" onchange="updateEntityModifiers()"><option value="add" ${data?.op === 'add' ? 'selected' : ''}>+</option><option value="subtract" ${data?.op === 'subtract' ? 'selected' : ''}>-</option></select>
                <input type="number" class="status-stat-val" value="${data?.statVal || 1}" style="width: 55px;" oninput="updateEntityModifiers()">
            </div>
        </div>
        <button class="btn-delete" onclick="this.closest('.single-line-item').remove(); updateEntityModifiers();">×</button>`;
    document.getElementById("statusContainer").appendChild(item);
}

function addStatusToParent(buttonEl) {
    buttonEl.closest('div').nextElementSibling.insertAdjacentHTML('beforeend', createStatusSubFormHTML());
}

function createStatusSubFormHTML(statusData = null) {
    const statOptions = createOptionList(getAvailableStatOptions(), statusData?.targetStat);
    const diceOptions = createOptionList([4, 6, 8, 10, 12, 20], statusData?.diceType || 8);
    const type = statusData?.type || 'flat_damage';

    return `
        <div class="nested-status-card" style="border: 1px dashed #666; padding: 6px; margin-top: 4px; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                <input placeholder="Nombre del estado" class="sub-status-name" value="${statusData?.name || ''}" style="flex: 1;">
                <label>Duración (Turnos):</label><input type="number" class="sub-status-duration" value="${statusData?.duration || 1}" min="1" style="width: 50px;">
                <label>Efecto:</label>
                <select class="sub-status-type" onchange="handleTypeToggle(this, {'.sub-field-flat': ['flat_damage','heal_flat'], '.sub-field-dice': ['dice_damage','heal_dice'], '.sub-field-stat': ['stat_mod']})">
                    <option value="flat_damage" ${type === 'flat_damage' ? 'selected' : ''}>Daño Plano</option>
                    <option value="dice_damage" ${type === 'dice_damage' ? 'selected' : ''}>Daño Dados</option>
                    <option value="heal_flat" ${type === 'heal_flat' ? 'selected' : ''}>Curación Plana</option>
                    <option value="heal_dice" ${type === 'heal_dice' ? 'selected' : ''}>Curación Dados</option>
                    <option value="stat_mod" ${type === 'stat_mod' ? 'selected' : ''}>Modif. Stat</option>
                </select>
                <button type="button" class="btn-delete" onclick="this.closest('.nested-status-card').remove()">×</button>
            </div>
            <div class="sub-status-fields-container" style="margin-top: 4px;">
                <div class="sub-field-flat ${!['flat_damage', 'heal_flat'].includes(type) ? 'hidden' : ''}">
                    <label>Valor por turno:</label><input type="number" class="sub-status-flat-damage" value="${statusData?.flatDamage || 0}" style="width: 60px;">
                </div>
                <div class="sub-field-dice ${!['dice_damage', 'heal_dice'].includes(type) ? 'hidden' : ''}">
                    <label>Dados por turno:</label><input type="number" class="sub-status-dice-qty" value="${statusData?.diceQty || 1}" style="width: 40px;"><select class="sub-status-dice-type">${diceOptions}</select>
                </div>
                <div class="sub-field-stat ${type !== 'stat_mod' ? 'hidden' : ''}">
                    <label>Modifica:</label><select class="stat-select sub-status-target-stat">${statOptions}</select>
                    <select class="sub-status-op"><option value="add" ${statusData?.op === 'add' ? 'selected' : ''}>+</option><option value="subtract" ${statusData?.op === 'subtract' ? 'selected' : ''}>-</option></select>
                    <input type="number" class="sub-status-val" value="${statusData?.val || 1}" style="width: 50px;">
                </div>
            </div>
        </div>`;
}

function addMacroField(data = null) {
    const item = document.createElement("div");
    item.className = "single-line-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "stretch";

    item.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
            <input placeholder="Nombre de la Macro" class="macro-name" value="${data?.name || ''}" style="flex: 1;">
            
            <label style="font-size: 8pt; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" class="macro-once" ${data?.triggerOnce ? 'checked' : ''}> Ejecucción única
            </label>

            <label style="font-size: 8pt; display: flex; align-items: center; gap: 4px;">
                <input type="checkbox" class="macro-enabled" ${data?.enabled !== false ? 'checked' : ''}> Activa
            </label>

            <button type="button" class="btn-delete" onclick="this.closest('.single-line-item').remove()">×</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
            <label style="font-size: 7.5pt; color: #a3a3a3;">Condición (JS Boolean):</label>
            <input class="macro-condition" placeholder="event.type === 'hp_decreased' && entity.getHp() < 5" value="${data?.condition || ''}" style="font-family: monospace; font-size: 8pt;">
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
            <label style="font-size: 7.5pt; color: #a3a3a3;">Acción (Código a Ejecutar):</label>
            <textarea class="macro-action" rows="10" placeholder="entity.modifyHp(10);" style="font-family: monospace; font-size: 8pt; resize: vertical;">${data?.action || ''}</textarea>
        </div>
    `;

    document.getElementById("macrosContainer").appendChild(item);
}

function getAppliedStatusesFromContainer(parentEl) {
    return Array.from(parentEl.querySelectorAll(".nested-status-card")).map(card => {
        const type = getVal(card, ".sub-status-type");
        const statusObj = {
            name: getVal(card, ".sub-status-name", "Estado Sin Nombre"),
            duration: getNum(card, ".sub-status-duration", 1),
            type
        };

        if (['flat_damage', 'heal_flat'].includes(type)) statusObj.flatDamage = getNum(card, ".sub-status-flat-damage");
        else if (['dice_damage', 'heal_dice'].includes(type)) {
            statusObj.diceQty = getNum(card, ".sub-status-dice-qty", 1);
            statusObj.diceType = getVal(card, ".sub-status-dice-type");
        } else if (type === "stat_mod") {
            statusObj.targetStat = getVal(card, ".sub-status-target-stat");
            statusObj.op = getVal(card, ".sub-status-op");
            statusObj.val = getNum(card, ".sub-status-val");
        }
        return statusObj;
    });
}

function confirmEntity() {
    const size = getNum(document, "#entitySize", 1);
    const baseName = getVal(document, "#entityName", "Sin nombre");
    const entityClass = getVal(document, "#entityClass", "Sin clase");

    const stats = [
        { name: "Vida", value: `${getNum(document, "#vidaActual")}/${getNum(document, "#vidaMax")}`, itemMod: 0 },
        { name: "Mana", value: `${getNum(document, "#manaActual")}/${getNum(document, "#manaMax")}`, itemMod: 0 },
        { name: "Velocidad", value: getNum(document, "#velocidadInput", 10), itemMod: 0 }
    ];

    document.querySelectorAll("#statsContainer .single-line-item").forEach(item => {
        const name = getVal(item, ".stat-name-input");
        const val = getVal(item, ".stat-value-input");
        const itemMod = getNum(item, ".stat-calculated-mod", 0);
        if (name) stats.push({ name, value: val, itemMod });
    });

    const parseSection = (containerSelector, itemSelector, nameClass, typeClass, mapper) => {
        const result = [];
        document.querySelectorAll(`${containerSelector} ${itemSelector}`).forEach(item => {
            const name = getVal(item, nameClass);
            if (name) result.push(mapper(item, name, getVal(item, typeClass)));
        });
        return result;
    };

    const abilities = parseSection("#abilitiesContainer", ".single-line-item", ".ability-name", ".ability-type", (item, name, type) => {
        const obj = { name, mana: Math.max(0, getNum(item, ".ability-mana")), type, appliedStatuses: getAppliedStatusesFromContainer(item) };
        if (['flat_damage', 'heal_flat'].includes(type)) obj.flatDamage = getNum(item, ".ability-flat-damage");
        else if (['dice_damage', 'heal_dice'].includes(type)) {
            obj.diceQty = getNum(item, ".ability-dice-qty", 1);
            obj.diceType = getVal(item, ".ability-dice-type");
            obj.statUsed = getVal(item, ".ability-stat-used");
        } else if (type === "stat_mod") {
            obj.targetStat = getVal(item, ".ability-target-stat");
            obj.op = getVal(item, ".ability-op");
            obj.val = getNum(item, ".ability-val");
            obj.duration = getNum(item, ".ability-duration", 1);
        }
        return obj;
    });

    const weapons = parseSection("#weaponsContainer", ".single-line-item", ".weapon-name", ".weapon-type", (item, name, type) => {
        const obj = { name, type, appliedStatuses: getAppliedStatusesFromContainer(item) };
        if (type === "flat_damage") obj.flatDamage = getNum(item, ".weapon-flat-damage");
        else {
            obj.diceQty = getNum(item, ".weapon-dice-qty", 1);
            obj.diceType = getVal(item, ".weapon-dice-type");
            obj.statUsed = getVal(item, ".weapon-stat-used");
        }
        return obj;
    });

    const items = parseSection("#itemsContainer", ".single-line-item", ".item-name", null, (item, name) => ({
        name,
        targetStat: getVal(item, ".item-target-stat"),
        op: getVal(item, ".item-op"),
        val: getNum(item, ".item-val")
    }));

    const statuses = parseSection("#statusContainer", ".single-line-item", ".status-name", ".status-type", (item, name, type) => {
        const obj = { name, duration: getNum(item, ".status-duration", 1), type };
        if (['flat_damage', 'heal_flat'].includes(type)) obj.flatDamage = getNum(item, ".status-flat-damage");
        else if (['dice_damage', 'heal_dice'].includes(type)) {
            obj.diceQty = getNum(item, ".status-dice-qty", 1);
            obj.diceType = getVal(item, ".status-dice-type");
        } else if (type === "stat_mod") {
            obj.targetStat = getVal(item, ".status-target-stat");
            obj.op = getVal(item, ".status-op");
            obj.statVal = getNum(item, ".status-stat-val");
        }
        return obj;
    });

    const macros = Array.from(document.querySelectorAll("#macrosContainer .single-line-item")).map(item => ({
        id: crypto.randomUUID(),
        name: getVal(item, ".macro-name", "Macro Sin Nombre"),
        triggerOnce: item.querySelector(".macro-once").checked,
        enabled: item.querySelector(".macro-enabled").checked,
        hasExecuted: false,
        condition: getVal(item, ".macro-condition", "true"),
        action: getVal(item, ".macro-action", "")
    }));

    const boardMap = getCurrentBoard().map;
    const imageToUse = pendingEntity?.image || DEFAULT_ENTITY_IMAGE;

    const finalData = {
        ...pendingEntity,
        image: imageToUse,
        name: baseName, 
        clase: entityClass, 
        size, 
        speed: getNum(document, "#velocidadInput", 10),
        initDice: getVal(document, "#initDiceSelect", "20"),
        stats, 
        abilities, 
        statuses,
        macros, 
        inventory: { weapons, items },
        x: editingEntity ? editingEntity.entityData.x : Math.round((boardMap.width / GRID_SIZE / 2)) * GRID_SIZE,
        y: editingEntity ? editingEntity.entityData.y : Math.round((boardMap.height / GRID_SIZE / 2)) * GRID_SIZE
    };

    if (editingEntity) {
        Object.assign(editingEntity.entityData, finalData);
        syncEntityToState(editingEntity);
        updateEntityVisuals(editingEntity);
        editingEntity = null;
    } else {
        const newData = { id: crypto.randomUUID(), ...finalData };
        getCurrentBoard().entities.push(newData);
        createEntityToken(newData);
        logEvent('entity', `Se creo la entidad ${baseName}`);
    }
    saveToEntityBank(finalData);
    closeEntityModal();
}

function createEntityToken(data) {
    const token = document.createElement("div");
    token.entityData = data;
    token.classList.add("token");
    const imageUrl = getImgData(data.image);
    if (data.type === "enemy") token.classList.add("enemy");

    Object.assign(token.style, {
        width: `${data.size * GRID_SIZE}px`,
        height: `${data.size * GRID_SIZE}px`,
        left: `${data.x}px`,
        top: `${data.y}px`,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
    });

    if (data.type === "character") {
        const nameTag = document.createElement("div");
        nameTag.classList.add("name-tag");
        nameTag.textContent = data.name;
        token.appendChild(nameTag);
    }

    board.appendChild(token);
    updateEntityState(token);
    makeDraggable(token);

    invalidateLighting();
    if (token.entityData.type === "character") {
        revealVisionSimple({ x: token.entityData.x, y: token.entityData.y, radius: characterFogRadius });
    }
    invalidateFog();
}

function updateEntityVisuals(token) {
    const data = token.entityData;
    token.style.width = `${data.size * GRID_SIZE}px`;
    token.style.height = `${data.size * GRID_SIZE}px`;
    token.style.backgroundImage = `url(${getImgData(data.image)})`;

    token.querySelector(".name-tag")?.remove();
    if (data.type === "character") {
        const nameTag = document.createElement("div");
        nameTag.classList.add("name-tag");
        nameTag.textContent = data.name;
        token.appendChild(nameTag);
    }
    updateEntityState(token);
}

function updateEntityState(token) {
    if (!token?.entityData) return;
    
    const vidaStat = getStat(token.entityData, "Vida"); 
    if (!vidaStat) return;
    
    const [currentLife] = parseFractionalStat(vidaStat);
    token.style.filter = currentLife <= 0 ? "grayscale(100%)" : "grayscale(0%)";
}

function syncEntityToState(token) {
    const index = getCurrentBoard().entities.findIndex(e => e.id === token.entityData.id);
    if (index !== -1) getCurrentBoard().entities[index] = structuredClone(token.entityData);
}

function moveEntityToBoard(entityId, targetBoardId) {
    const source = getCurrentBoard();
    const entity = source.entities.find(e => e.id === entityId);
    if (!entity) return;

    source.entities = source.entities.filter(e => e.id !== entityId);
    appState.boards.find(b => b.id === targetBoardId)?.entities.push({ ...entity, x: 0, y: 0 });

    selectedEntity = null;
    entityMenu.classList.add("hidden");
    hideTooltip();
    renderCurrentBoard();
}

// TOOLTIP & DELEGACIÓN DE EVENTOS EN BOARD
function showTooltip(data, e){
    const vidaStat = data.stats.find(s => s.name === "Vida");
    const manaStat = data.stats.find(s => s.name === "Mana");
    const velStat = data.stats.find(s => s.name === "Velocidad");

    const vidaText = vidaStat ? vidaStat.value : "N/A";
    const manaText = manaStat ? manaStat.value : "N/A";
    const velText = velStat ? velStat.value : (data.speed !== undefined ? data.speed : "N/A");

    tooltip.innerHTML = `
        <h3>${data.name}</h3>
        <p><strong>Clase:</strong> ${data.clase || "Sin clase"}</p>
        <p><strong>Tipo:</strong> ${entityTypesNames[data.type] || data.type}</p>

        <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
            <div><strong>Vida:</strong> ${vidaText}</div>
            <div><strong>Maná:</strong> ${manaText}</div>
            <div><strong>Velocidad:</strong> ${velText}</div>
        </div>
    `;
    tooltip.classList.remove("hidden");
    moveTooltip(e);
}

function moveTooltip(e){
    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
}

function hideTooltip(){
    tooltip.classList.add("hidden");
}

function openEntityMenu(token, e){
    e.preventDefault();
    hideTooltip();
    selectedEntity = token;
    entityMenu.style.left = `${e.clientX}px`;
    entityMenu.style.top = `${e.clientY}px`;
    entityMenu.classList.remove("hidden");
}

// ==========================================
// BANCO DE ENTIDADES (GLOBAL ENTITY BANK)
// ==========================================
function saveToEntityBank(entityData) {
    const baseName = entityData.name.trim();
    if (!baseName) return;

    const templateData = structuredClone(entityData);
    delete templateData.x;
    delete templateData.y;
    delete templateData.id;

    const existingIndex = window.entityBank.findIndex(
        e => e.name.toLowerCase() === baseName.toLowerCase()
    );

    if (existingIndex !== -1) {
        window.entityBank[existingIndex] = templateData;
    } else {
        window.entityBank.push(templateData);
    }

    const currentBoard = getCurrentBoard();
    if (currentBoard) {
        currentBoard.entityBank = window.entityBank;
    }

    renderEntityBank();
}

function renderEntityBank() {
    const container = document.getElementById("entityBankList");
    if (!container) return;

    container.innerHTML = "";

    if (window.entityBank.length === 0) {
        container.innerHTML = `<div style="color: var(--color-text-muted); font-size: 8.5pt; text-align: center; padding: 12px;">No hay entidades guardadas aún.</div>`;
        return;
    }

    window.entityBank.forEach((template, index) => {
        const item = document.createElement("div");
        item.className = "bank-entity-card";
        item.draggable = true;
        item.dataset.bankIndex = index;

        item.innerHTML = `
            <div class="bank-card-icon" style="background-image: url('${getImgData(template.image)}')"></div>
            <div class="bank-card-info">
                <span class="bank-card-name">${template.name}</span>
                <span class="bank-card-sub">${template.clase || template.type}</span>
            </div>
            <button class="btn-delete" style="padding: 2px 6px; font-size: 10px;" title="Eliminar del banco" onclick="removeFromEntityBank(${index}, event)">×</button>
        `;

        item.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("application/json", JSON.stringify(template));
            e.dataTransfer.effectAllowed = "copy";
        });

        container.appendChild(item);
    });
}

function removeFromEntityBank(index, event) {
    event.stopPropagation();
    window.entityBank.splice(index, 1);

    const currentBoard = getCurrentBoard();
    if (currentBoard) {
        currentBoard.entityBank = window.entityBank;
    }

    renderEntityBank();
}

function setupBoardDropZone() {
    const boardContainer = document.getElementById("board-container");
    if (!boardContainer) return;

    boardContainer.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });

    boardContainer.addEventListener("drop", (e) => {
        e.preventDefault();
        const rawData = e.dataTransfer.getData("application/json");
        if (!rawData) return;

        try {
            const template = JSON.parse(rawData);
            
            const rect = boardContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const gridX = Math.floor(mouseX / GRID_SIZE) * GRID_SIZE;
            const gridY = Math.floor(mouseY / GRID_SIZE) * GRID_SIZE;

            const existingBoardEntities = getCurrentBoard().entities;
            const baseName = template.name;
            const count = existingBoardEntities.filter(ent => 
                ent.name && ent.name.replace(/\s+\d+$/, "").trim() === baseName
            ).length;

            const instanceName = count > 0 ? `${baseName} ${count + 1}` : baseName;

            const newEntity = {
                ...structuredClone(template),
                id: crypto.randomUUID(),
                name: instanceName,
                x: gridX,
                y: gridY
            };

            getCurrentBoard().entities.push(newEntity);
            createEntityToken(newEntity);

            if (typeof logEvent === "function") {
                logEvent('entity', `Instanciada entidad '${instanceName}' desde el Banco.`);
            }
        } catch (err) {
            console.error("Error al procesar el drop de entidad:", err);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    setupBoardDropZone();
});

// ==========================================
// UTILIDADES Y AYUDANTES BÁSICOS
// ==========================================

const rollDice = sides => Math.floor(Math.random() * (sides || 1)) + 1;
const getStat = (entityData, name) => entityData?.stats?.find(s => s.name === name);

function parseFractionalStat(statObj) {
    if (!statObj?.value) return [0, 0];
    const [curr, max] = statObj.value.toString().split("/").map(Number);
    return [curr || 0, max || 0];
}

function updateFractionalStat(statObj, delta, limitMode = "max") {
    if (!statObj) return;
    const [curr, max] = parseFractionalStat(statObj);
    const updated = limitMode === "max" 
        ? Math.min(max, Math.max(0, curr + delta))
        : Math.max(0, curr - delta);
    statObj.value = `${updated}/${max}`;
}

function updateElementText(id, text, display) {
    const el = document.getElementById(id);
    if (!el) return;
    if (text !== undefined) el.textContent = text;
    if (display !== undefined) el.style.display = display;
}

function toggleModal(id, show) {
    document.getElementById(id)?.classList.toggle("hidden", !show);
}

// ==========================================
// SISTEMA DE TIRADAS DE ESTADÍSTICAS (STAT ROLL)
// ==========================================

function calculateFormulaBonus(totalVal, formulaString) {
    const defaultBonus = Math.floor((totalVal - 10) / 2);
    const rawFormula = formulaString?.trim();
    if (!rawFormula) return defaultBonus;

    try {
        const forbidden = /['"`;={}[\]\\]|=>|\b(function|while|for|if|else|switch|case|try|catch|new|this|window|document|globalThis|process|eval|import|export|class|constructor)\b/;
        if (forbidden.test(rawFormula)) throw new Error();

        const allowedWords = new Set(["Math", "floor", "ceil", "round", "abs", "min", "max", "pow", "sqrt", "log", "log10", "sin", "cos", "tan", "PI", "E", "x"]);
        const words = rawFormula.match(/[A-Za-z_]+/g) || [];
        if (!words.every(word => allowedWords.has(word))) throw new Error();

        const mathFns = ["floor", "ceil", "round", "abs", "min", "max", "pow", "sqrt", "log10", "log", "sin", "cos", "tan", "PI", "E"];
        let cleanFormula = rawFormula;
        mathFns.forEach(fn => {
            cleanFormula = cleanFormula.replace(new RegExp(`\\b${fn}\\b`, "g"), `Math.${fn}`);
        });

        const fn = new Function("x", `"use strict"; return (${cleanFormula});`);
        const result = fn(totalVal);

        return (typeof result === "number" && Number.isFinite(result)) ? Math.floor(result) : defaultBonus;
    } catch {
        return defaultBonus;
    }
}

function getEffectiveStatValue(entityData, statName) {
    const statObj = getStat(entityData, statName);
    if (!statObj) return { baseVal: 0, itemMod: 0, statusMod: 0, totalVal: 0, bonus: 0 };

    const baseVal = Number(statObj.value) || 0;

    const calculateMods = (list, filterCondition, valGetter) => 
        (list || []).reduce((acc, item) => {
            if (!filterCondition(item)) return acc;
            const val = Number(valGetter(item)) || 0;
            return acc + (item.op === "add" ? val : -val);
        }, 0);

    const itemMod = calculateMods(entityData.inventory?.items, item => item.targetStat === statName, item => item.val);
    const statusMod = calculateMods(entityData.statuses, status => status.type === "stat_mod" && status.targetStat === statName, status => status.statVal ?? status.val);

    const totalVal = baseVal + itemMod + statusMod;
    const bonus = calculateFormulaBonus(totalVal, statObj.formula);

    return { baseVal, itemMod, statusMod, totalVal, bonus };
}

function openStatRollModal() {
    entityMenu.classList.add("hidden");
    if (!selectedEntity) return;

    const entityData = selectedEntity.entityData;
    updateElementText("statRollEntityName", entityData.name);

    const validStats = (entityData.stats || []).filter(s => !["Vida", "Mana", "Velocidad"].includes(s.name));
    if (!validStats.length) return showToast("La entidad no tiene estadísticas para tirar.");

    document.getElementById("statRollSelect").innerHTML = validStats.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    updateElementText("statRollTotalDisplay", undefined, "none");
    updateElementText("d20StatResultText", "20");

    updateStatRollPreview();
    toggleModal("statRollModal", true);
}

const closeStatRollModal = () => toggleModal("statRollModal", false);

function updateStatRollPreview() {
    if (!selectedEntity) return;

    const statName = document.getElementById("statRollSelect").value;
    const statObj = getStat(selectedEntity.entityData, statName);
    
    const formulaInput = document.getElementById("statFormulaInput");
    if (formulaInput && document.activeElement !== formulaInput) {
        formulaInput.value = statObj?.formula || "floor((x - 10) / 2)";
    }

    const calc = getEffectiveStatValue(selectedEntity.entityData, statName);
    const totalMods = calc.itemMod + calc.statusMod;

    updateElementText("statBaseVal", calc.baseVal);
    updateElementText("statModsVal", `${totalMods >= 0 ? "+" : ""}${totalMods}`);
    updateElementText("statTotalVal", calc.totalVal);
    updateElementText("statBonusVal", `${calc.bonus >= 0 ? "+" : ""}${calc.bonus}`);
}

function onFormulaChange() {
    if (!selectedEntity) return;
    const statObj = getStat(selectedEntity.entityData, document.getElementById("statRollSelect").value);
    if (statObj) {
        statObj.formula = document.getElementById("statFormulaInput").value;
        updateStatRollPreview();
    }
}

function executeStatRoll() {
    if (!selectedEntity) return;

    const d20 = document.getElementById("d20Stat");
    const d20Text = document.getElementById("d20StatResultText");
    const rollBtn = document.getElementById("rollStatActionBtn");
    const totalDisplay = document.getElementById("statRollTotalDisplay");
    const statName = document.getElementById("statRollSelect").value;

    const calc = getEffectiveStatValue(selectedEntity.entityData, statName);

    if (rollBtn) rollBtn.disabled = true;
    if (d20) d20.classList.add("rolling");

    const interval = setInterval(() => {
        if (d20Text) d20Text.innerText = rollDice(20);
    }, 30);

    setTimeout(() => {
        clearInterval(interval);
        if (d20) d20.classList.remove("rolling");

        const d20Result = rollDice(20);
        const totalResult = Math.min(20, Math.max(1, d20Result + calc.bonus));
        const signBonus = calc.bonus >= 0 ? "+" : "";

        if (d20Text) d20Text.innerText = d20Result;

        if (totalDisplay) {
            totalDisplay.style.display = "block";
            totalDisplay.innerText = `Resultado Total: ${totalResult}`;
        }

        const entityName = selectedEntity.entityData.name;
        logEvent("dice", `${entityName} realizó una tirada de ${statName}: ${d20Result} (d20) ${signBonus}${calc.bonus} (Bono) = Total ${totalResult}`, {
            entity: entityName, statName, d20Result, bonus: calc.bonus, totalResult
        });

        if (rollBtn) rollBtn.disabled = false;
    }, 700);
}

// ==========================================
// SISTEMA DE ATAQUE
// ==========================================

let availableAttacks = [];
let currentAttackCalculatedBonus = 0;

function openAttackModal() {
    hideTooltip();
    entityMenu.classList.add("hidden");
    if (!selectedEntity) return;

    const entityData = selectedEntity.entityData;
    updateElementText("attackEntityName", `Atacante: ${entityData.name}`);

    const weapons = (entityData.inventory?.weapons || []).map(w => ({ category: "weapon", data: w, label: `[Arma] ${w.name}` }));
    const abilities = (entityData.abilities || [])
        .filter(a => a.type === "dice_damage" || a.type === "flat_damage")
        .map(a => ({ category: "ability", data: a, label: `[Habilidad] ${a.name} (${a.mana || 0} MP)` }));

    availableAttacks = [...weapons, ...abilities];

    if (!availableAttacks.length) return showToast("La entidad no tiene armas ni habilidades ofensivas para atacar.");

    const select = document.getElementById("attackSelect");
    select.innerHTML = availableAttacks.map((atk, idx) => `<option value="${idx}">${atk.label}</option>`).join("");
    select.selectedIndex = 0;

    updateAttackPreview();
    document.getElementById("critEnabled").checked = true;
    toggleModal("attackModal", true);
}

const closeAttackModal = () => toggleModal("attackModal", false);

function updateAttackPreview() {
    if (!selectedEntity) return;

    const attackItem = availableAttacks[document.getElementById("attackSelect").value];
    if (!attackItem?.data) return;

    const attack = attackItem.data;
    const entityData = selectedEntity.entityData;
    const formulaContainer = document.getElementById("attackFormulaContainer");
    const formulaInput = document.getElementById("attackFormulaInput");

    if (attack.statUsed) {
        if (formulaContainer) formulaContainer.style.display = "block";
        const statInfo = getEffectiveStatValue(entityData, attack.statUsed);
        if (formulaInput) {
            formulaInput.value = attack.customFormula ?? (getStat(entityData, attack.statUsed)?.formula || "floor((x - 10) / 2)");
        }
        currentAttackCalculatedBonus = calculateFormulaBonus(statInfo.totalVal, formulaInput?.value);
        updateElementText("atkStatDisplay", `${attack.statUsed} (Total: ${statInfo.totalVal})`);
        updateElementText("atkBonusDisplay", `${currentAttackCalculatedBonus >= 0 ? '+' : ''}${currentAttackCalculatedBonus}`);
    } else {
        if (formulaContainer) formulaContainer.style.display = "none";
        currentAttackCalculatedBonus = 0;
        updateElementText("atkStatDisplay", "Ninguno");
        updateElementText("atkBonusDisplay", "+0");
    }

    const isDice = attack.type === "dice_damage";
    updateElementText("atkTypeDisplay", isDice ? "Lanzamiento de Dados" : "Daño Plano");
    updateElementText("atkBaseDisplay", isDice ? `${attack.diceQty || 1}d${attack.diceType || 6}` : `${attack.flatDamage || 0} pts`);
    updateElementText("atkManaDisplay", `${attack.mana || 0} MP`);

    const critCheck = document.getElementById("critEnabled");
    critCheck.checked = true;

    const critModeSelect = document.getElementById("critMode");
    const maxOption = critModeSelect.querySelector('option[value="max"]');

    if (attack.type !== "dice_damage") {
        maxOption.disabled = true;
        maxOption.textContent = "Máximo (Solo dados)";
        if (critModeSelect.value === "max") {
            critModeSelect.value = "percent";
        }
    } else {
        maxOption.disabled = false;
        maxOption.textContent = "Valor Máximo de Dados";
    }

    const statusesDisplay = document.getElementById("atkStatusesDisplay");
    if (statusesDisplay) {
        statusesDisplay.textContent = attack.appliedStatuses?.length 
            ? attack.appliedStatuses.map(s => `${s.name} (${s.duration || 1} t)`).join(", ")
            : "Ninguno";
    }

    toggleCritUI();
    updateCritUI();
}

function startTargetSelection() {
    if (!selectedEntity || !availableAttacks.length) return;

    const atk = availableAttacks[document.getElementById("attackSelect").value].data;
    const manaCost = atk.mana || 0;

    if (manaCost > 0) {
        const manaStat = getStat(selectedEntity.entityData, "Mana");
        const [currMana] = parseFractionalStat(manaStat);
        if (currMana < manaCost) return showToast(`Maná insuficiente. Requiere ${manaCost} MP (Tienes: ${currMana} MP).`);
    }

    pendingAttack = { attackerToken: selectedEntity, attackData: atk, category: availableAttacks[document.getElementById("attackSelect").value].category };
    closeAttackModal();
    selectingTarget = true;
    toggleModal("targetBanner", true);
}

function cancelTargetSelection() {
    selectingTarget = false;
    pendingAttack = null;
    toggleModal("targetBanner", false);
}

function toggleCritUI() {
    const isEnabled = document.getElementById("critEnabled").checked;
    const critOptions = document.getElementById("critOptions");
    const statusText = document.querySelector("#critEnabled + span");

    if (isEnabled) {
        critOptions.style.opacity = "1";
        critOptions.style.pointerEvents = "auto";
        if (statusText) statusText.textContent = "ACTIVO";
    } else {
        critOptions.style.opacity = "0.3";
        critOptions.style.pointerEvents = "none";
        if (statusText) statusText.textContent = "INACTIVO";
    }
}

function updateCritUI() {
    const mode = document.getElementById("critMode").value;
    const label = document.getElementById("critThresholdLabel");
    const container = document.getElementById("critThresholdContainer");

    if (mode === "max") {
        container.style.visibility = "hidden";
    } else {
        container.style.visibility = "visible";
        if (mode === "percent") {
            label.textContent = "Probabilidad %:";
        } else if (mode === "treshold") {
            label.textContent = "Si daño >= :";
        }
    }
}

function calculateCritDamage(formula, baseDamage, statBonus, totalStatValue) {
    const rawFormula = formula.trim() || "damage * 2";
    try {
        const fn = new Function("damage", "bonus", "x", "Math", `
            "use strict";
            return (${rawFormula.replace(/floor|ceil|round|abs|max|min/g, m => `Math.${m}`)});
        `);
        const result = fn(baseDamage, statBonus, totalStatValue, Math);
        return Math.floor(result);
    } catch (e) {
        console.error("Error en fórmula de crítico:", e);
        return baseDamage * 2;
    }
}

function executeAttackOnTarget(targetToken) {
    const { attackerToken, attackData: atk } = pendingAttack;
    const attackerData = attackerToken.entityData;
    const targetData = targetToken.entityData;

    if (atk.mana > 0) {
        updateFractionalStat(getStat(attackerData, "Mana"), atk.mana, "consume");
    }

    let baseDamage = 0;
    let maxRollReached = false;

    if (atk.type === "dice_damage") {
        const qty = atk.diceQty || 1;
        const faces = parseInt(atk.diceType) || 8;
        const rolls = Array.from({ length: qty }, () => rollDice(faces));
        baseDamage = rolls.reduce((a, b) => a + b, 0);
        
        if (rolls.every(r => r === faces)) maxRollReached = true;
    } else {
        baseDamage = atk.flatDamage || 0;
    }

    const statInfo = atk.statUsed ? getEffectiveStatValue(attackerData, atk.statUsed) : { bonus: 0, totalVal: 0 };
    const statBonus = statInfo.bonus;

    let isCrit = false;
    const critEnabled = document.getElementById("critEnabled").checked;
    
    if (critEnabled) {
        const mode = document.getElementById("critMode").value;
        if (mode === "max" && maxRollReached) {
            isCrit = true;
        } else if (mode === "percent") {
            const chance = parseInt(document.getElementById("critThreshold").value) || 15;
            if (rollDice(100) <= chance) isCrit = true;
        } else if (mode === "treshold") {
            const threshold = parseInt(document.getElementById("critThreshold").value) || 15;
            if ((baseDamage + statBonus) >= threshold) isCrit = true;
        }
    }

    let finalDamage;
    if (isCrit) {
        const formula = document.getElementById("critFormulaInput").value;
        finalDamage = calculateCritDamage(formula, baseDamage, statBonus, statInfo.totalVal);
    } else {
        finalDamage = Math.max(0, baseDamage + statBonus);
    }

    const targetVidaStat = getStat(targetData, "Vida");
    if (targetVidaStat) {
        updateFractionalStat(targetVidaStat, finalDamage, "consume");
        const [currentHp] = parseFractionalStat(targetVidaStat);
        MacroSystem.emit('hp_decreased', targetData, { amount: finalDamage, current: currentHp, attackerData: attackerData });
        updateEntityState(targetToken);
        syncEntityToState(targetToken);
    }

    const color = isCrit ? "#fbbf24" : "#ef4444";
    const critPrefix = isCrit ? "¡CRÍTICO! " : "";
    showFloatingText(targetToken, `${critPrefix}-${finalDamage} HP`, color);

    logEvent("attack", `${attackerData.name} atacó a ${targetData.name}. ${isCrit ? '¡GOLPE CRÍTICO!' : ''} Daño: ${finalDamage}`, { isCrit });

    cancelTargetSelection();
}

function showFloatingText(tokenElement, text, color = "#ff4444") {
    const container = document.getElementById("floating-text-container");
    if (!container) return;

    const rect = tokenElement.getBoundingClientRect();
    const el = document.createElement("div");
    
    Object.assign(el.style, {
        position: "absolute",
        left: `${rect.left + rect.width / 2}px`,
        top: `${rect.top}px`,
        color: color,
        fontWeight: "bold",
        fontSize: "16pt",
        textShadow: "0 0 5px #000, 0 0 10px #000",
        pointerEvents: "none",
        transition: "transform 0.8s ease-out, opacity 0.8s ease-out",
        zIndex: "9999"
    });
    el.textContent = text;

    container.appendChild(el);
    requestAnimationFrame(() => {
        el.style.transform = "translateY(-40px)";
        el.style.opacity = "0";
    });

    setTimeout(() => el.remove(), 800);
}

function onAttackFormulaChange() {
    if (!selectedEntity) return;

    const attackItem = availableAttacks[document.getElementById("attackSelect").value];
    if (!attackItem?.data?.statUsed) return;

    const attack = attackItem.data;
    const formulaInput = document.getElementById("attackFormulaInput");
    const statInfo = getEffectiveStatValue(selectedEntity.entityData, attack.statUsed);

    attack.customFormula = formulaInput.value;
    currentAttackCalculatedBonus = calculateFormulaBonus(statInfo.totalVal, formulaInput.value);
    updateElementText("atkBonusDisplay", `${currentAttackCalculatedBonus >= 0 ? '+' : ''}${currentAttackCalculatedBonus}`);
}

// ==========================================
// SISTEMA DE USO DE HABILIDADES Y ESTADOS
// ==========================================

let pendingSkill = null;
const getUsableSkills = entityData => (entityData?.abilities || []).filter(a => ["stat_mod", "heal_flat", "heal_dice"].includes(a.type));

function openSkillModal() {
    entityMenu.classList.add("hidden");
    if (!selectedEntity) return;

    updateElementText("skillEntityName", `Lanzador: ${selectedEntity.entityData.name}`);

    const skillSelect = document.getElementById("skillSelect");
    const usableSkills = getUsableSkills(selectedEntity.entityData);

    if (usableSkills.length === 0) {
        skillSelect.innerHTML = `<option value="">-- No tiene habilidades utilizables --</option>`;
        updateElementText("skillTargetStatDisplay", "-");
        updateElementText("skillModDisplay", "-");
        updateElementText("skillDurationDisplay", "-");
        updateElementText("skillManaDisplay", "0 MP");
        updateElementText("skillExtraStatusesDisplay", "Ninguno");
        toggleModal("skillModal", true);
        return;
    }

    skillSelect.innerHTML = usableSkills.map((s, i) => `<option value="${i}">${s.name} (${s.mana || 0} MP)</option>`).join("");
    toggleModal("skillModal", true);
    updateSkillPreview();
}

const closeSkillModal = () => toggleModal("skillModal", false);

function updateSkillPreview() {
    if (!selectedEntity) return;

    const usableSkills = getUsableSkills(selectedEntity.entityData);
    const skill = usableSkills[document.getElementById("skillSelect").value];
    if (!skill) return;

    if (skill.type === "stat_mod") {
        updateElementText("skillTargetStatDisplay", skill.targetStat || "Cualquiera");
        updateElementText("skillModDisplay", `${skill.op === "subtract" ? "-" : "+"}${skill.val || 0}`);
        updateElementText("skillDurationDisplay", `${skill.duration || 1} Turno(s)`);
    } else {
        const isFlat = skill.type === "heal_flat";
        updateElementText("skillTargetStatDisplay", `Vida (Curación ${isFlat ? 'Plano' : 'Dados'})`);
        updateElementText("skillModDisplay", isFlat ? `+${skill.flatDamage || 0} HP` : `${skill.diceQty || 1}d${skill.diceType || 8}`);
        updateElementText("skillDurationDisplay", "Instantáneo");
    }

    updateElementText("skillManaDisplay", `${skill.mana || 0} MP`);
    updateElementText("skillExtraStatusesDisplay", skill.appliedStatuses?.length ? skill.appliedStatuses.map(s => s.name).join(", ") : "Ninguno");
}

function startSkillTargetSelection() {
    if (!selectedEntity) return;

    const skill = getUsableSkills(selectedEntity.entityData)[document.getElementById("skillSelect").value];
    if (!skill) return alert("Selecciona una habilidad válida.");

    const casterManaStat = getStat(selectedEntity.entityData, "Mana");
    if (casterManaStat) {
        const [currMana] = parseFractionalStat(casterManaStat);
        if (currMana < (skill.mana || 0)) {
            return alert(`Maná insuficiente. Requiere ${skill.mana} MP y tienes ${currMana} MP.`);
        }
    }

    pendingSkill = skill;
    selectingTarget = true;
    closeSkillModal();
    toggleModal("targetBanner", true);
}

function applySkillToTarget(targetToken) {
    if (!selectedEntity || !pendingSkill || !targetToken) return;
    const casterData = selectedEntity.entityData;

    MacroSystem.emit('ability_used', casterData, { ability: pendingSkill.name });
    MacroSystem.emit('skill_used', casterData, { ability: pendingSkill.name });

    const targetData = targetToken.entityData;

    if (pendingSkill.mana > 0) {
        updateFractionalStat(getStat(casterData, "Mana"), pendingSkill.mana, "consume");
        MacroSystem.emit('mana_decreased', casterData, {amount: pendingSkill.mana, current: parseFractionalStat(getStat(casterData, "Mana"))[0]})
        syncEntityToState(selectedEntity);
    }

    targetData.statuses = targetData.statuses || [];

    if (pendingSkill.type === "stat_mod") {
        const newStatus = {
            name: pendingSkill.name,
            duration: pendingSkill.duration || 1,
            type: "stat_mod",
            targetStat: pendingSkill.targetStat,
            op: pendingSkill.op || "add",
            statVal: pendingSkill.val || 0
        };
        targetData.statuses.push(newStatus);
        MacroSystem.emit('status_added', targetData, { status: newStatus.name, statusData: newStatus, entityData: casterData });
    } else if (pendingSkill.type === "heal_flat" || pendingSkill.type === "heal_dice") {
        let healAmount = pendingSkill.type === "heal_flat" 
            ? (pendingSkill.flatDamage || 0)
            : Array.from({ length: pendingSkill.diceQty || 1 }).reduce((acc) => acc + rollDice(parseInt(pendingSkill.diceType) || 8), 0);

        if (pendingSkill.statUsed) {
            healAmount += getEffectiveStatValue(casterData, pendingSkill.statUsed).bonus;
        }
        healAmount = Math.max(0, healAmount);

        const targetVida = getStat(targetData, "Vida");
        if (targetVida) {
            updateFractionalStat(targetVida, healAmount, "max");
            const [currentHp] = parseFractionalStat(targetVida);
            MacroSystem.emit('hp_increased', targetData, { amount: healAmount, current: currentHp, casterData });
            updateEntityState(targetToken);
        }
        showFloatingText(targetToken, `+${healAmount} HP`, "#22c55e");
    }

    if (pendingSkill.appliedStatuses?.length) {
        pendingSkill.appliedStatuses.forEach(extraSt => targetData.statuses.push(structuredClone(extraSt)));
    }

    syncEntityToState(targetToken);
    logEvent("skill", `${casterData.name} usó ${pendingSkill.name} sobre ${targetData.name}`, {
        skill: pendingSkill.name,
        target: targetData.name
    });

    pendingSkill = null;
    selectingTarget = false;
    toggleModal("targetBanner", false);
}

// ==========================================
// ESTADO Y LÓGICA DEL SISTEMA DE INICIATIVA
// ==========================================

let initiativeList = [];
let currentTurnIndex = -1;
let selectEntitiesOnBoardMode = false;
let globalInitiativeFormula = "floor((x - 10) / 2)";

function toggleSelectEntitiesOnBoard() {
    selectEntitiesOnBoardMode = !selectEntitiesOnBoardMode;
    const btn = document.getElementById("toggleSelectEntitiesBtn");
    
    if (btn) {
        btn.style.background = selectEntitiesOnBoardMode ? "#ea0808" : "";
        btn.style.color = selectEntitiesOnBoardMode ? "#ffffff" : "";
        btn.textContent = selectEntitiesOnBoardMode ? "Cancelar selección" : "Modo selección";
    }

    if (selectEntitiesOnBoardMode) {
        showToast("Haz clic en los tokens del tablero para agregarlos/quitarlos de la iniciativa.");
        board.classList.add('measure-mode');
    } else {
        disableEditors();
    }
}

function toggleEntityInInitiative(entityId) {
    const boardData = getCurrentBoard();
    if (!boardData) return;

    const existingIndex = initiativeList.findIndex(item => item.id === entityId);

    if (existingIndex !== -1) {
        initiativeList.splice(existingIndex, 1);
        if (currentTurnIndex >= initiativeList.length) {
            currentTurnIndex = initiativeList.length - 1;
        }
    } else {
        const entity = boardData.entities.find(e => e.id === entityId);
        if (entity) {
            initiativeList.push({
                id: entity.id,
                name: entity.name,
                initiative: 0,
                speed: entity.speed || 10,
                initDice: entity.initDice || "20"
            });
        }
    }

    renderInitiativeTracker();
}

function rollAllInitiatives() {
    const boardData = getCurrentBoard();

    initiativeList.forEach(item => {
        const entity = boardData?.entities?.find(e => e.id === item.id);
        const statVal = entity ? (getEffectiveStatValue(entity, "Velocidad")?.totalVal ?? 10) : 10;
        const diceFaces = parseInt(entity?.initDice || item.initDice) || 20;
        
        item.initiative = rollDice(diceFaces) + calculateFormulaBonus(statVal, globalInitiativeFormula);
    });

    initiativeList.sort((a, b) => b.initiative - a.initiative);
    currentTurnIndex = 0;
    renderInitiativeTracker();
}

function nextTurn() {
    if (!initiativeList.length) return;
    currentTurnIndex = (currentTurnIndex + 1) % initiativeList.length;
    renderInitiativeTracker();
    startTurn(currentTurnIndex);
}

function startTurn(index) {
    const activeItem = initiativeList[index];
    if (!activeItem) return;

    const entity = getCurrentBoard()?.entities?.find(e => e.id === activeItem.id);
    if (!entity) return;

    const tokenElement = Array.from(document.querySelectorAll(".token")).find(t => t.entityData?.id === entity.id);
    processStatusEffects(entity, tokenElement);
}

function clearInitiative() {
    initiativeList = [];
    currentTurnIndex = -1;
    renderInitiativeTracker();
}

function updateInitiativeValue(index, newValue) {
    const val = parseInt(newValue);
    if (isNaN(val)) return;

    const currentActiveId = initiativeList[currentTurnIndex]?.id;
    initiativeList[index].initiative = val;
    initiativeList.sort((a, b) => b.initiative - a.initiative);

    if (currentActiveId) {
        currentTurnIndex = initiativeList.findIndex(item => item.id === currentActiveId);
    }

    renderInitiativeTracker();
}

function processStatusEffects(entityData, tokenElement) {
    if (!entityData) return;

    const boardEntity = getCurrentBoard()?.entities?.find(e => e.id === entityData.id) || entityData;
    const vidaStat = boardEntity.stats?.find(s => s.name === "Vida");
    if (!vidaStat) return;

    let [currVida, maxVida] = vidaStat.value.split("/").map(Number);
    let totalDamage = 0, totalHeal = 0;

    (boardEntity.statuses || []).forEach(status => {
        const qty = status.diceQty || 1;
        const faces = parseInt(status.diceType) || 6;
        const rollDiceTotal = () => Array.from({ length: qty }, () => rollDice(faces)).reduce((a, b) => a + b, 0);

        switch (status.type) {
            case "flat_damage": totalDamage += status.flatDamage || 0; break;
            case "dice_damage": totalDamage += rollDiceTotal(); break;
            case "heal_flat":   totalHeal += status.flatDamage || 0; break;
            case "heal_dice":   totalHeal += rollDiceTotal(); break;
        }

        if (status.duration !== undefined) status.duration -= 1;
    });

    const initialCount = boardEntity.statuses?.length || 0;
    if (boardEntity.statuses) {
        boardEntity.statuses = boardEntity.statuses.filter(s => {
            const keep = s.duration === undefined || s.duration > 0;
            if (!keep) {
                MacroSystem.emit('status_removed', entityData, { status: s.name });
            }
            return keep;
        });
    }

    if (totalDamage > 0) {
        currVida = Math.max(0, currVida - totalDamage);
        if (tokenElement) showFloatingText(tokenElement, `-${totalDamage} HP`, "#ef4444");
        MacroSystem.emit('hp_decreased', entityData, { amount: totalDamage, current: currVida });
    }

    if (totalHeal > 0) {
        currVida = Math.min(maxVida, currVida + totalHeal);
        if (tokenElement) showFloatingText(tokenElement, `+${totalHeal} HP`, "#22c55e");
        MacroSystem.emit('hp_increased', entityData, { amount: totalHeal, current: currVida });
    }

    vidaStat.value = `${currVida}/${maxVida}`;
    entityData.stats = boardEntity.stats;
    entityData.statuses = boardEntity.statuses;

    if (tokenElement) {
        tokenElement.entityData = boardEntity;
        updateEntityState(tokenElement);
        syncEntityToState(tokenElement);
    }
}

function renderInitiativeTracker() {
    const container = document.getElementById("initiativeList");
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; margin-bottom: 4px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 8px;">
            <span style="font-size: 8pt; color: var(--color-text-muted); font-weight: 500; white-space: nowrap;">Fórmula Global (x=Vel):</span>
            <input type="text" id="globalInitFormulaInput" value="${globalInitiativeFormula}" 
                placeholder="floor((x - 10) / 2)"
                oninput="updateGlobalInitiativeFormula(this.value)"
                style="flex: 1; background: #09090b; color: #38bdf8; border: 1px solid var(--color-border-light); border-radius: 6px; padding: 4px 8px; font-size: 8.5pt; font-family: monospace;">
        </div>
    `;

    const activeNameEl = document.getElementById("activeEntityName");

    if (initiativeList.length === 0) {
        container.insertAdjacentHTML("beforeend", `<div style="color: var(--color-text-muted); font-size: 8.5pt; text-align: center; padding: 16px;">No hay entidades seleccionadas.</div>`);
        if (activeNameEl) activeNameEl.textContent = "—";
        return;
    }

    const boardData = getCurrentBoard();

    initiativeList.forEach((item, index) => {
        const isCurrent = index === currentTurnIndex;
        const entity = boardData?.entities?.find(e => e.id === item.id);
        const statVal = entity ? (getEffectiveStatValue(entity, "Velocidad")?.totalVal ?? 10) : 10;
        const calculatedBonus = calculateFormulaBonus(statVal, globalInitiativeFormula);

        const row = document.createElement("div");
        row.className = `initiative-row ${isCurrent ? "active-turn" : ""}`;
        row.style.cssText = `
            display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 8px; 
            background: ${isCurrent ? "rgba(34, 197, 94, 0.12)" : "rgba(255, 255, 255, 0.03)"}; 
            border: ${isCurrent ? "1px solid var(--primary-color)" : "1px solid var(--color-border)"};
            box-shadow: ${isCurrent ? "0 0 10px var(--primary-glow)" : "none"};
            transition: all var(--transition-fast);
        `;

        row.innerHTML = `
            <span style="font-weight: 600; color: ${isCurrent ? 'var(--primary-color)' : 'var(--color-text-white)'}; font-size: 9pt; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
                ${isCurrent ? "▶ " : ""}${item.name}
            </span>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span class="init-bonus-tag" data-stat="${statVal}" style="font-size: 8pt; color: var(--primary-color); font-weight: 700; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(34, 197, 94, 0.2);">
                    ${calculatedBonus >= 0 ? '+' : ''}${calculatedBonus}
                </span>
                <span style="font-size: 8pt; color: var(--color-text-muted); font-weight: 500;">Init:</span>
                <input type="number" value="${item.initiative}" 
                    onchange="updateInitiativeValue(${index}, this.value)"
                    style="width: 50px; background: #09090b; color: #38bdf8; border: 1px solid var(--color-border-light); border-radius: 6px; padding: 3px 6px; font-size: 8.5pt; font-weight: 600; text-align: center;">
            </div>
        `;
        container.appendChild(row);
    });

    if (activeNameEl) {
        activeNameEl.textContent = initiativeList[currentTurnIndex]?.name || "—";
    }
}

function updateGlobalInitiativeFormula(newFormula) {
    globalInitiativeFormula = newFormula;
    document.querySelectorAll(".init-bonus-tag").forEach(tag => {
        const statVal = parseFloat(tag.getAttribute("data-stat")) || 10;
        const bonus = calculateFormulaBonus(statVal, globalInitiativeFormula);
        tag.textContent = `(${bonus >= 0 ? '+' : ''}${bonus})`;
    });
}

// MISC
function normalRoll() {
    const d20 = document.getElementById("d20");
    const d20Text = document.getElementById("d20ResultText");
    const rollBtn = document.getElementById("rollDiceBtn");
    const breakdownArea = document.getElementById("diceBreakdownArea");
    const totalDisplay = document.getElementById("diceTotalDisplay");
    const breakdownList = document.getElementById("diceBreakdownList");

    if (rollBtn) rollBtn.disabled = true;
    if (d20) d20.classList.add("rolling");

    const diceSelect = document.getElementById("normalRollSelect");
    const diceValue = parseInt(diceSelect.value);
    
    const quantityInput = document.getElementById("diceQuantityInput");
    let diceQuantity = parseInt(quantityInput.value) || 1;
    if (diceQuantity < 1) diceQuantity = 1;
    quantityInput.value = diceQuantity;

    const modInput = document.getElementById("diceModInput");
    let modValue = parseInt(modInput.value) || 0;
    if (modValue > 10) modValue = 10;
    if (modValue < -10) modValue = -10;
    modInput.value = modValue;

    const modTarget = document.getElementById("diceModTargetSelect").value;

    let total = 0;
    let rollsBreakdown = [];
    const sign = modValue > 0 ? "+" : "";

    for (let i = 0; i < diceQuantity; i++) {
        let baseRoll = rollDice(diceValue);
        
        if (modTarget === "each" && modValue !== 0) {
            let modifiedRoll = baseRoll + modValue;
            total += modifiedRoll;
            rollsBreakdown.push(`Dado ${i + 1}: ${baseRoll} (${sign}${modValue}) = ${modifiedRoll}`);
        } else {
            total += baseRoll;
            rollsBreakdown.push(`Dado ${i + 1}: ${baseRoll}`);
        }
    }

    if (modTarget === "total" && modValue !== 0) {
        let baseTotal = total;
        total += modValue;
        rollsBreakdown.push(`Suma base: ${baseTotal}`);
        rollsBreakdown.push(`Modificador total: ${sign}${modValue}`);
    }

    let interval = setInterval(() => {
        if (d20Text) {
            d20Text.innerText = Math.floor(Math.random() * diceValue) + 1;
        }
    }, 30);

    setTimeout(() => {
        clearInterval(interval);
        if (d20) d20.classList.remove("rolling");
        
        if (d20Text) d20Text.innerText = total;
        if (breakdownArea) breakdownArea.style.display = "block";
        if (totalDisplay) totalDisplay.innerText = `Resultado Total: ${total}`;
        if (breakdownList) breakdownList.innerText = rollsBreakdown.join("\n");

        logEvent("dice", `Lanzamiento: ${diceQuantity}d${diceValue} | Total: ${total}`, {
            diceQuantity, diceValue, modValue, total, rollsBreakdown
        });

        if (rollBtn) rollBtn.disabled = false;
    }, 700);
}

function disableEditors() {
    measureMode = false;
    drawing = false;
    drawMode = false;
    eraseMode = false;
    lightingEditor = false;

    board.classList.remove("measure-mode", "draw-mode", "lighting-editor");
    measureToolBtn.classList.remove("active");
    drawToolBtn.classList.remove("active");
    eraserDrawToolBtn.classList.remove("active");
    toggleLightingEditor.classList.remove("active");

    drawCanvas.style.pointerEvents = "none";
    clearMeasurement();
}

function validateEntityPosition(entity, mapWidth, mapHeight, gridSize) {
    const entityWidth = entity.size * gridSize;
    const entityHeight = entity.size * gridSize;

    const isOutOfBounds = 
        entity.x < 0 || 
        entity.y < 0 || 
        (entity.x + entityWidth) > mapWidth || 
        (entity.y + entityHeight) > mapHeight;

    if (isOutOfBounds) {
        const centerX = Math.floor((mapWidth / 2) / gridSize) * gridSize;
        const centerY = Math.floor((mapHeight / 2) / gridSize) * gridSize;

        entity.x = centerX;
        entity.y = centerY;
    }
}

function showToast(message) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}

function setTargetBannerVisible(visible) {
    const banner = document.getElementById("targetBanner");
    if (visible) {
        banner.classList.remove("hidden");
    } else {
        banner.classList.add("hidden");
    }
}

// CONTROL DE VENTANAS FLOTANTES
const panels = {
    tools: "toolsPanel", entities: "entitiesPanel", map: "mapPanel",
    lights: "lightsPanel", fogs: "fogsPanel", boards: "boardsPanel",
    notes: "notesPanel", dice: "dicePanel", log: "logPanel", initiative: "initiativePanel",
    entityBank: "entityBankPanel"
};

let highestZIndex = 10000;

function bringToFront(windowElement) {
    highestZIndex++;
    windowElement.style.zIndex = highestZIndex;
}

document.querySelectorAll(".floating-window").forEach(win => {
    const header = win.querySelector(".window-header");
    const closeBtn = win.querySelector(".close-window-btn");
    const minimizeBtn = win.querySelector(".minimize-window-btn");
    const titleText = win.querySelector(".window-title")?.textContent || "";

    win.addEventListener("mousedown", () => bringToFront(win));

    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            win.classList.add("hidden");
            const existingCard = document.querySelector(`.minimized-card[data-target="${win.id}"]`);
            if (existingCard) existingCard.remove();
        });
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            win.classList.add("hidden");

            const container = document.getElementById("minimized-container");
            const card = document.createElement("div");
            card.classList.add("minimized-card");
            card.textContent = titleText;
            card.setAttribute("data-target", win.id);

            card.addEventListener("click", () => {
                win.style.width = "";
                win.style.height = "";
                win.classList.remove("hidden");
                bringToFront(win);
                card.remove();
            });

            container.appendChild(card);
        });
    }

    if (header) {
        header.addEventListener("mousedown", (e) => {
            if (e.target === closeBtn || e.target === minimizeBtn) return;
            bringToFront(win);
            
            let shiftX = e.clientX - win.getBoundingClientRect().left;
            let shiftY = e.clientY - win.getBoundingClientRect().top;

            const onMouseMove = (event) => {
                win.style.left = event.clientX - shiftX + 'px';
                win.style.top = event.clientY - shiftY + 'px';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
});

document.querySelectorAll(".sub-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const panelId = panels[btn.dataset.panel];
        const targetWindow = document.getElementById(panelId);

        if (targetWindow) {
            if (targetWindow.classList.contains("hidden")) {
                targetWindow.style.width = "";
                targetWindow.style.height = "";
                targetWindow.classList.remove("hidden");
                bringToFront(targetWindow);
                
                const existingCard = document.querySelector(`.minimized-card[data-target="${panelId}"]`);
                if (existingCard) existingCard.remove();
            } else {
                targetWindow.classList.add("hidden");
            }
        }
    });
});

// UI EVENT LISTENERS
document.getElementById("menuTrigger").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("floating-toolbar").classList.toggle("hidden");
});

document.getElementById("confirmMoveBoardBtn").addEventListener("click", () => {
    const targetId = document.getElementById("targetBoardSelect").value;
    moveEntityToBoard(selectedEntity.entityData.id, targetId);
    closeMoveBoardModal();
});

document.getElementById("addBoardBtn").addEventListener("click", () => {
    const defaultName = `Tablero ${appState.boards.length + 1}`;
    const userPrompt = prompt("Nombre del nuevo tablero:", defaultName);
    
    if (userPrompt === null) return; 

    const finalName = userPrompt.trim() !== "" ? userPrompt.trim() : defaultName;
    const newBoard = createEmptyBoard(finalName);
    appState.boards.push(newBoard);
    switchBoard(newBoard.id);
});

document.getElementById("renameBoardBtn")?.addEventListener("click", () => {
    const currentBoard = getCurrentBoard();
    const input = document.getElementById("boardNameInput");
    
    if (currentBoard && input) {
        const newName = input.value.trim();
        if (newName !== "") {
            currentBoard.name = newName;
            renderBoardTabs();
        }
    }
});

document.getElementById("importBoard").addEventListener("change", importBoard);

// DELEGACIÓN DE ELIMINAR STATS Y MODIFICADORES
document.getElementById("statsContainer").addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-stat-btn")) {
        e.target.closest(".stat-row").remove();
    }
});

// PANNING GLOBAL (ALT + CLIC)
document.addEventListener("mousedown", (e) => {
    if(!e.altKey) return;

    isPanning = true;
    document.body.classList.add("alt-dragging");
    panStartX = e.clientX;
    panStartY = e.clientY;
    scrollStartX = window.scrollX;
    scrollStartY = window.scrollY;
    e.preventDefault();

    const onPanMove = (moveEvent) => {
        if(!isPanning) return;
        const dx = moveEvent.clientX - panStartX;
        const dy = moveEvent.clientY - panStartY;
        window.scrollTo(scrollStartX - dx, scrollStartY - dy);
    };

    const onPanEnd = () => {
        isPanning = false;
        document.body.classList.remove("alt-dragging");
        document.removeEventListener("mousemove", onPanMove);
        document.removeEventListener("mouseup", onPanEnd);
    };

    document.addEventListener("mousemove", onPanMove);
    document.addEventListener("mouseup", onPanEnd);
});

// SUBIR IMÁGENES
document.getElementById("imageUpload").parentElement.onclick = (e) => {
    e.preventDefault();
    openImageBank((imageId) => {
        const dataUrl = getImgData(imageId);
        if (!dataUrl) return;

        const img = new Image();
        img.onload = function() {
            const b = getCurrentBoard();
            if (!b) return;

            b.map.image = imageId; 
            
            imageWidth = img.width;
            imageHeight = img.height;
            
            b.map.width = img.width * (b.map.scale || 1);
            b.map.height = img.height * (b.map.scale || 1);
            
            mapImage.src = dataUrl; 
            board.style.width = `${b.map.width}px`;
            board.style.height = `${b.map.height}px`;
            
            syncGrid();
            renderCurrentBoard();
        };
        img.onerror = () => showToast("Error al procesar la imagen seleccionada");
        img.src = dataUrl;
    });
};

document.getElementById("editEntityImageInput").parentElement.onclick = (e) => {
    e.preventDefault();
    openImageBank((imageId) => {
        if (!pendingEntity) pendingEntity = {}; 
        pendingEntity.image = imageId;
    });
};

// MENÚ DE ACCIONES & DOCUMENT CLICK
entityMenu.addEventListener("click", (e) => e.stopPropagation());

document.addEventListener("click", () => entityMenu.classList.add("hidden"));

document.getElementById("deleteBtn").addEventListener("click", () => {
    if(!selectedEntity) return;

    logEvent("entity", `Entidad eliminada: ${selectedEntity.entityData.name} (${selectedEntity.entityData.type})`, {
        id: selectedEntity.entityData.id,
        name: selectedEntity.entityData.name,
        type: selectedEntity.entityData.type,
        stats: selectedEntity.entityData.stats
    });

    selectedEntity.remove();
    getCurrentBoard().entities = getCurrentBoard().entities.filter(e => e.id !== selectedEntity.entityData.id);
    entityMenu.classList.add("hidden");
    invalidateLighting();
    invalidateFog();
});

document.getElementById("duplicateBtn").addEventListener("click", () => {
    if(!selectedEntity) return;

    const data = structuredClone(selectedEntity.entityData);
    data.id = crypto.randomUUID();

    const baseName = data.name ? data.name.replace(/\s+\d+$/, "").trim() : "Entidad";
    const count = getCurrentBoard().entities.filter(e => {
        const existingBaseName = e.name ? e.name.replace(/\s+\d+$/, "").trim() : "";
        return existingBaseName === baseName;
    }).length;

    data.name = count + 1 === 1 ? `${baseName}` : `${baseName} ${count + 1}`;
    data.x += GRID_SIZE * data.size;
    data.y += GRID_SIZE * data.size;

    getCurrentBoard().entities.push(data);
    logEvent("entity", `Entidad duplicada: ${data.name} (${data.type})`, {
        id: data.id, name: data.name, type: data.type, stats: data.stats
    });

    getCurrentBoard().undoEntities.push({ type: "entity", entityId: data.id });
    createEntityToken(data);
    entityMenu.classList.add("hidden");
});

document.getElementById("editBtn").addEventListener("click", () => {
    if(!selectedEntity) return;
    editingEntity = selectedEntity;
    loadEntityIntoModal(selectedEntity.entityData);
    openEntityModal();
    entityMenu.classList.add("hidden");
    invalidateLighting();
    invalidateFog();
});

document.getElementById("moveBoardBtn").addEventListener("click", () => {
    if(!selectedEntity) return;
    openMoveBoardModal();
});

document.getElementById("attackBtn").addEventListener("click", () => {
    if(!selectedEntity) return;
    openAttackModal();
    entityMenu.classList.add("hidden");
});

// BOTONES Y CONTROLES DE HERRAMIENTAS
measureToolBtn.addEventListener("click", () => {
    const newState = !measureMode;
    disableEditors();
    measureMode = newState;

    if(measureMode){
        board.classList.add("measure-mode");
        measureToolBtn.classList.add("active");
    }
});

drawToolBtn.addEventListener("click", () => {
    const newState = !drawMode;
    disableEditors();
    drawMode = newState;

    if(drawMode){
        board.classList.add("draw-mode");
        drawCanvas.style.pointerEvents = "auto";
        drawToolBtn.classList.add("active");
    }
});

eraserDrawToolBtn.addEventListener("click", () => {
    const newState = !eraseMode;
    disableEditors();
    eraseMode = newState;

    if(eraseMode){
        board.classList.add("draw-mode");
        drawCanvas.style.pointerEvents = "auto";
        eraserDrawToolBtn.classList.add("active");
    }
});

document.getElementById("drawColor").addEventListener("input", e => { drawColor = e.target.value; });
document.getElementById("drawSize").addEventListener("input", e => { drawSize = Number(e.target.value); });
document.getElementById("eraseDrawBtn").addEventListener("click", () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
});

// HERRAMIENTAS DE ILUMINACIÓN
toggleLightingEditor.addEventListener("click", () => {
    const newState = !lightingEditor;
    disableEditors();
    lightingEditor = newState;

    if(lightingEditor){
        board.classList.add("lighting-editor");
        toggleLightingEditor.classList.add("active");
    }
    updateLightingUI();
    invalidateLighting();
});

lightToolBtn.onclick = () => { lightingTool = "light"; selectLightingTool("light", lightToolBtn); };
wallToolBtn.onclick = () => { lightingTool = "wall"; selectLightingTool("wall", wallToolBtn); };
doorToolBtn.onclick = () => { lightingTool = "door"; selectLightingTool("door", doorToolBtn); };
moveToolBtn.onclick = () => { lightingTool = "move"; selectLightingTool("move", moveToolBtn); };
eraseToolBtn.onclick = () => { lightingTool = "erase"; selectLightingTool("erase", eraseToolBtn); };

document.getElementById("clearLightsBtn").onclick = () => {
    getCurrentBoard().lighting.lights = [];
    invalidateLighting();
};

document.getElementById("clearWallsBtn").onclick = () => {
    getCurrentBoard().lighting.walls = [];
    invalidateLighting();
};

document.getElementById("toggleLightingBtn").onclick = () => {
    const lighting = getCurrentBoard().lighting;
    lighting.enabled = !lighting.enabled;
    invalidateLighting();
    updateTokenVisibility();
};

document.getElementById("characterLightRadius").addEventListener("change", e => {
    if (e.target.value > 1000) e.target.value = 1000;
    characterLightRadius = parseInt(e.target.value) || 250;
    invalidateLighting();
});

document.getElementById("newLightRadius").addEventListener("change", e => {
    if (e.target.value > 1000) e.target.value = 1000;
    currentLightRadius = parseInt(e.target.value) || 350;
});

document.getElementById("darkPercentage").addEventListener("change", e => {
    if (e.target.value > 100) e.target.value = 100;
    currentDarkLevel = Number(e.target.value) / 100 || 0.55;
    invalidateLighting();
});

document.getElementById("lightPercentage").addEventListener("change", e => {
    if (e.target.value > 100) e.target.value = 100;
    currentLightIntensity = Number(e.target.value) / 100 || 0.35;
    invalidateLighting();
});

document.getElementById("newLightColor").addEventListener("input", e => {
    currentLightColor = e.target.value;
});

// NIEBLA CONTROLES
document.getElementById("toggleFogBtn").onclick = () => {
    const fog = getCurrentBoard().fog;
    fog.enabled = !fog.enabled;
    invalidateFog();
    updateTokenVisibility();
};

document.getElementById("characterFogRadius").addEventListener("change", e => {
    if (e.target.value > 1000) e.target.value = 1000;
    characterFogRadius = parseInt(e.target.value) || 250;
    invalidateFog();
});

// DELEGACIÓN CENTRAL EN TABLERO (#BOARD) PARA EVENTOS MOUSE/CLICK
board.addEventListener("mousedown", e => {
    if (e.altKey) return;

    if (drawMode || eraseMode) {
        startDrawing(e);
        return;
    }

    if (!lightingEditor || isPanning || isDraggingToken) return;
    if (e.target.closest(".token")) return;

    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const lighting = getCurrentBoard().lighting;

    if (lightingTool === "move") {
        const lightIndex = findLightAt(x, y);
        if (lightIndex !== -1) {
            movingLight = lighting.lights[lightIndex];
            dragOffsetX = x - movingLight.x;
            dragOffsetY = y - movingLight.y;
        } else {
            const wallIndex = findWallAt(x, y);
            if (wallIndex !== -1) {
                movingWall = lighting.walls[wallIndex];
                lastMouseX = x;
                lastMouseY = y;
            }
        }

        if (movingLight || movingWall) {
            const onLightDrag = (moveEvent) => {
                const r = board.getBoundingClientRect();
                const mx = moveEvent.clientX - r.left;
                const my = moveEvent.clientY - r.top;

                if (movingLight) {
                    movingLight.x = mx - dragOffsetX;
                    movingLight.y = my - dragOffsetY;
                } else if (movingWall) {
                    const dx = mx - lastMouseX;
                    const dy = my - lastMouseY;
                    movingWall.x1 += dx; movingWall.y1 += dy;
                    movingWall.x2 += dx; movingWall.y2 += dy;
                    lastMouseX = mx; lastMouseY = my;
                }
                invalidateLighting();
            };

            const onLightDragEnd = () => {
                movingLight = null;
                movingWall = null;
                document.removeEventListener("mousemove", onLightDrag);
                document.removeEventListener("mouseup", onLightDragEnd);
            };

            document.addEventListener("mousemove", onLightDrag);
            document.addEventListener("mouseup", onLightDragEnd);
        }
        return;
    }

    if (lightingTool === "erase") {
        const lightIndex = findLightAt(x, y);
        if (lightIndex !== -1) {
            lighting.lights.splice(lightIndex, 1);
            invalidateLighting();
            return;
        }
        const wallIndex = findWallAt(x, y);
        if (wallIndex !== -1) {
            lighting.walls.splice(wallIndex, 1);
            invalidateLighting();
            return;
        }
    }

    if (lightingTool === "light") {
        const light = { id: crypto.randomUUID(), x, y, radius: currentLightRadius, color: currentLightColor };
        lighting.lights.push(light);
        getCurrentBoard().undoLights.push({ type: "light", lightId: light.id });
        invalidateLighting();
        return;
    }

    if (lightingTool === "wall" || lightingTool === "door") {
        drawingWall = true;
        wallStartX = x;
        wallStartY = y;

        const onWallUp = (upEvent) => {
            if (!drawingWall) return;
            const r = board.getBoundingClientRect();
            const wx = upEvent.clientX - r.left;
            const wy = upEvent.clientY - r.top;

            const wall = {
                id: crypto.randomUUID(),
                type: lightingTool === "door" ? "door" : "wall",
                opened: lightingTool === "door",
                x1: wallStartX, y1: wallStartY,
                x2: wx, y2: wy
            };

            getCurrentBoard().lighting.walls.push(wall);
            getCurrentBoard().undoWalls.push({ type: "wall", wallId: wall.id });
            drawingWall = false;
            invalidateLighting();
            document.removeEventListener("mouseup", onWallUp);
        };

        document.addEventListener("mouseup", onWallUp);
    }
});

board.addEventListener("click", e => {
    if (e.altKey || isPanning) return;

    const token = e.target.closest(".token");
    if (token) {
        if (token.wasDragged) {
            token.wasDragged = false;
            return;
        }

        if (selectingTarget) {
            if (pendingAttack) {
                executeAttackOnTarget(token);
            } else if (pendingSkill) {
                applySkillToTarget(token);
            }
            return;
        }

        e.stopPropagation();
        openEntityMenu(token, e);
        return;
    }

    const rect = board.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (measureMode) {
        if (!measureStart) {
            measureStart = { x, y };
        } else {
            drawMeasurement(measureStart, { x, y });
            measureStart = null;
            measurePreview = null;
        }
        return;
    }

    if (!lightingEditor) {
        const door = findDoorAt(x, y);
        if (door) {
            door.opened = !door.opened;
            invalidateLighting();
        }
    }
});

board.addEventListener("mousemove", e => {
    if (e.altKey || isDraggingToken || isPanning) return;

    if (measureMode && measureStart) {
        const rect = board.getBoundingClientRect();
        measurePreview = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        drawMeasurement(measureStart, measurePreview);
        return;
    }

    const token = e.target.closest(".token");
    if (token) {
        moveTooltip(e);
        if (tooltip.classList.contains("hidden")) {
            showTooltip(token.entityData, e);
        }
    } else {
        hideTooltip();
    }
});

board.addEventListener("mouseleave", () => {
    hideTooltip();
});

board.addEventListener("contextmenu", e => {
    if (e.altKey) return;
    if (measureMode) {
        e.preventDefault();
        clearMeasurement();
    }
});

// ATAJOS DE TECLADO (CTRL + Z / UNDO)
document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;

    event.preventDefault();
    const currentBoard = getCurrentBoard();

    if (!lightingEditor) {
        const undoItem = currentBoard.undoEntities.pop();
        if (!undoItem) return;
        currentBoard.entities = currentBoard.entities.filter(e => e.id !== undoItem.entityId);
        renderCurrentBoard();
        return;
    }

    if (lightingTool === "light") {
        const undoItem = currentBoard.undoLights.pop();
        if (!undoItem) return;
        currentBoard.lighting.lights = currentBoard.lighting.lights.filter(l => l.id !== undoItem.lightId);
        invalidateLighting();
        return;
    }

    if (lightingTool === "wall" || lightingTool === "door") {
        const undoItem = currentBoard.undoWalls.pop();
        if (!undoItem) return;
        currentBoard.lighting.walls = currentBoard.lighting.walls.filter(w => w.id !== undoItem.wallId);
        invalidateLighting();
    }
});

initApp();