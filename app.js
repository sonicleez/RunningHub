/**
 * RunningHub AI Studio - Main Application
 * Features: Image Generation, Timing, Stress Test
 */

// DOM Elements
const elements = {
    uploadZone: document.getElementById('uploadZone'),
    uploadPlaceholder: document.getElementById('uploadPlaceholder'),
    previewImage: document.getElementById('previewImage'),
    clearBtn: document.getElementById('clearBtn'),
    fileInput: document.getElementById('fileInput'),
    promptInput: document.getElementById('promptInput'),
    workflowInput: document.getElementById('workflowInput'),
    seedInput: document.getElementById('seedInput'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    generateBtn: document.getElementById('generateBtn'),
    statusContainer: document.getElementById('statusContainer'),
    statusProgress: document.getElementById('statusProgress'),
    statusText: document.getElementById('statusText'),
    statusTimer: document.getElementById('statusTimer'),
    resultsGrid: document.getElementById('resultsGrid'),
    emptyState: document.getElementById('emptyState'),
    totalResults: document.getElementById('totalResults'),
    totalTime: document.getElementById('totalTime'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    // Stress test elements
    batchPrompts: document.getElementById('batchPrompts'),
    concurrencyInput: document.getElementById('concurrencyInput'),
    stressTestBtn: document.getElementById('stressTestBtn'),
    stressStats: document.getElementById('stressStats'),
    statTotal: document.getElementById('statTotal'),
    statCompleted: document.getElementById('statCompleted'),
    statFailed: document.getElementById('statFailed'),
    statAvgTime: document.getElementById('statAvgTime'),
    // Node ID config elements
    configToggle: document.getElementById('configToggle'),
    configFields: document.getElementById('configFields'),
    promptNodeId: document.getElementById('promptNodeId'),
    seedNodeId: document.getElementById('seedNodeId'),
    imageNodeId: document.getElementById('imageNodeId'),
    // Prompt counter elements
    charCount: document.getElementById('charCount'),
    wordCount: document.getElementById('wordCount'),
    // Job queue elements
    jobQueue: document.getElementById('jobQueue'),
    jobQueueCount: document.getElementById('jobQueueCount'),
    jobList: document.getElementById('jobList'),
    // Import elements
    importToggle: document.getElementById('importToggle'),
    importFields: document.getElementById('importFields'),
    taskIds: document.getElementById('taskIds'),
    importBtn: document.getElementById('importBtn'),
    importStatus: document.getElementById('importStatus'),
    importProgress: document.getElementById('importProgress'),
    // Profile elements
    profileSelect: document.getElementById('profileSelect'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    deleteProfileBtn: document.getElementById('deleteProfileBtn'),
    // Import JSON elements
    importJsonBtn: document.getElementById('importJsonBtn'),
    importJsonModal: document.getElementById('importJsonModal'),
    closeImportBtn: document.getElementById('closeImportBtn'),
    workflowJson: document.getElementById('workflowJson'),
    analyzeJsonBtn: document.getElementById('analyzeJsonBtn'),
    applyNodesBtn: document.getElementById('applyNodesBtn'),
    // Workflow params panel
    workflowParamsPanel: document.getElementById('workflowParamsPanel'),
    mainParamsContainer: document.getElementById('mainParamsContainer'),
    clearParamsBtn: document.getElementById('clearParamsBtn')
};

// State
let state = {
    uploadedFile: null,
    uploadedFileName: null,
    isGenerating: false,
    isStressTesting: false,
    results: [],
    totalGenerationTime: 0,
    timerInterval: null,
    startTime: null
};

// ===== Profile Management =====

const PROFILES_KEY = 'runninghub_profiles';

function getProfiles() {
    const stored = localStorage.getItem(PROFILES_KEY);
    return stored ? JSON.parse(stored) : {};
}

function saveProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getCurrentSettings() {
    return {
        workflowId: elements.workflowInput.value
    };
}

function applyProfile(settings) {
    if (!settings) return;
    elements.workflowInput.value = settings.workflowId || '';
}

function updateProfileDropdown() {
    const profiles = getProfiles();
    const currentValue = elements.profileSelect.value;

    // Clear and rebuild options
    elements.profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';

    Object.keys(profiles).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        elements.profileSelect.appendChild(option);
    });

    // Restore selection if it still exists
    if (profiles[currentValue]) {
        elements.profileSelect.value = currentValue;
    }
}

function saveCurrentProfile() {
    const name = prompt('Enter profile name:');
    if (!name || !name.trim()) return;

    const profiles = getProfiles();
    profiles[name.trim()] = getCurrentSettings();
    saveProfiles(profiles);

    updateProfileDropdown();
    elements.profileSelect.value = name.trim();

    console.log(`✅ Profile "${name}" saved`);
}

function loadSelectedProfile() {
    const name = elements.profileSelect.value;
    if (!name) return;

    const profiles = getProfiles();
    if (profiles[name]) {
        applyProfile(profiles[name]);
        console.log(`📂 Profile "${name}" loaded`);
    }
}

function deleteSelectedProfile() {
    const name = elements.profileSelect.value;
    if (!name) {
        alert('Please select a profile to delete');
        return;
    }

    if (!confirm(`Delete profile "${name}"?`)) return;

    const profiles = getProfiles();
    delete profiles[name];
    saveProfiles(profiles);

    updateProfileDropdown();
    console.log(`🗑️ Profile "${name}" deleted`);
}

// ===== Dynamic Parameter Editor =====

let detectedSettings = {};
let editableParameters = [];
let workflowData = null;
let uploadedImages = {}; // Store uploaded images by nodeId-fieldName

// Nodes to skip (system/loader nodes - but NOT LoadImage)
const SKIP_NODE_TYPES = [
    'UNETLoader', 'CLIPLoader', 'VAELoader', 'CheckpointLoaderSimple',
    'LoraLoader', 'LoraLoaderModelOnly', 'ControlNetLoader',
    'SaveImage', 'PreviewImage', 'PreviewAny', 'VAEDecode', 'VAEEncode',
    'ConditioningZeroOut', 'ImageConcanate', 'SeedVR2BlockSwap', 'SeedVR2ExtraArgs',
    'LayerUtility: PurgeVRAM V2', 'ImageScaleToTotalPixels'
    // LoadImage is NOT skipped - we want to detect it for file uploads
];

// Parameter configurations
const PARAM_CONFIG = {
    // Seed parameters
    seed: { type: 'number', random: true, label: 'Seed' },
    noise_seed: { type: 'number', random: true, label: 'Noise Seed' },

    // Sampler parameters
    steps: { type: 'slider', min: 1, max: 100, step: 1, label: 'Steps' },
    cfg: { type: 'slider', min: 1, max: 20, step: 0.5, label: 'CFG Scale' },
    denoise: { type: 'slider', min: 0, max: 1, step: 0.01, label: 'Denoise' },
    sampler_name: { type: 'select', options: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_sde', 'dpmpp_2m', 'dpmpp_3m_sde', 'ddim', 'uni_pc'], label: 'Sampler' },
    scheduler: { type: 'select', options: ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'], label: 'Scheduler' },

    // Size parameters
    width: { type: 'number', min: 64, max: 4096, step: 64, label: 'Width' },
    height: { type: 'number', min: 64, max: 4096, step: 64, label: 'Height' },
    new_resolution: { type: 'number', min: 256, max: 4096, step: 16, label: 'Resolution' },
    batch_size: { type: 'number', min: 1, max: 16, step: 1, label: 'Batch Size' },

    // Angle/Camera parameters
    horizontal_angle: { type: 'slider', min: -180, max: 180, step: 1, label: 'Horizontal Angle' },
    vertical_angle: { type: 'slider', min: -90, max: 90, step: 1, label: 'Vertical Angle' },
    zoom: { type: 'slider', min: 0.1, max: 10, step: 0.1, label: 'Zoom' },

    // Text parameters
    text: { type: 'textarea', label: 'Text/Prompt' },
    prompt: { type: 'textarea', label: 'Prompt' },

    // Image parameters - now with file upload
    image: { type: 'image', label: 'Image' },
    image1: { type: 'image', label: 'Image 1' },
    image2: { type: 'image', label: 'Image 2' },
    image3: { type: 'image', label: 'Image 3' },
    image4: { type: 'image', label: 'Image 4' },
    image5: { type: 'image', label: 'Image 5' },

    // Boolean parameters
    default_prompts: { type: 'checkbox', label: 'Default Prompts' },
    camera_view: { type: 'checkbox', label: 'Camera View' }
};

function parseWorkflowForParameters(jsonText) {
    try {
        const workflow = JSON.parse(jsonText);
        workflowData = workflow;
        editableParameters = [];

        for (const [nodeId, node] of Object.entries(workflow)) {
            const classType = node.class_type;

            // Skip system nodes
            if (SKIP_NODE_TYPES.includes(classType)) continue;

            const nodeParams = [];

            // Check each input
            for (const [inputName, inputValue] of Object.entries(node.inputs || {})) {
                // Skip connections (arrays like [nodeId, outputIndex])
                if (Array.isArray(inputValue)) continue;

                // Skip string paths for models/files (contain .safetensors, .png etc)
                if (typeof inputValue === 'string' &&
                    (inputValue.includes('.safetensors') ||
                        inputValue.includes('.ckpt') ||
                        inputValue.includes('.pt'))) continue;

                // This is an editable primitive input
                const config = PARAM_CONFIG[inputName] || { type: 'text', label: inputName };

                nodeParams.push({
                    nodeId,
                    fieldName: inputName,
                    currentValue: inputValue,
                    config: { ...config, label: config.label || inputName }
                });
            }

            if (nodeParams.length > 0) {
                editableParameters.push({
                    nodeId,
                    classType,
                    title: node._meta?.title || classType,
                    params: nodeParams
                });
            }
        }

        return { success: true, parameters: editableParameters };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function renderDynamicParameters() {
    const container = document.getElementById('detectedList');
    container.innerHTML = '';

    if (editableParameters.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No editable parameters found</p>';
        return;
    }

    editableParameters.forEach(nodeGroup => {
        const nodeCard = document.createElement('div');
        nodeCard.className = 'param-node-card';

        let paramsHtml = '';
        nodeGroup.params.forEach(param => {
            paramsHtml += renderParamInput(param);
        });

        nodeCard.innerHTML = `
            <div class="param-node-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <span class="param-node-title">Node ${nodeGroup.nodeId}: ${nodeGroup.title}</span>
                <span class="param-toggle">▼</span>
            </div>
            <div class="param-node-body">
                ${paramsHtml}
            </div>
        `;

        container.appendChild(nodeCard);
    });

    document.getElementById('detectedNodes').classList.remove('hidden');
}

function renderParamInput(param) {
    const { nodeId, fieldName, currentValue, config } = param;
    const inputId = `param-${nodeId}-${fieldName}`;

    let inputHtml = '';

    switch (config.type) {
        case 'slider':
            inputHtml = `
                <input type="range" id="${inputId}" 
                    min="${config.min}" max="${config.max}" step="${config.step || 1}"
                    value="${currentValue}"
                    oninput="document.getElementById('${inputId}-val').textContent = this.value">
                <span id="${inputId}-val" class="param-value">${currentValue}</span>
            `;
            break;

        case 'number':
            inputHtml = `
                <input type="number" id="${inputId}" value="${currentValue}"
                    ${config.min !== undefined ? `min="${config.min}"` : ''}
                    ${config.max !== undefined ? `max="${config.max}"` : ''}
                    ${config.step !== undefined ? `step="${config.step}"` : ''}>
                ${config.random ? `<button class="param-random-btn" onclick="document.getElementById('${inputId}').value = Math.floor(Math.random() * 999999999)">🎲</button>` : ''}
            `;
            break;

        case 'select':
            const options = config.options.map(opt =>
                `<option value="${opt}" ${opt === currentValue ? 'selected' : ''}>${opt}</option>`
            ).join('');
            inputHtml = `<select id="${inputId}">${options}</select>`;
            break;

        case 'textarea':
            inputHtml = `<textarea id="${inputId}" rows="2">${currentValue || ''}</textarea>`;
            break;

        case 'checkbox':
            inputHtml = `<input type="checkbox" id="${inputId}" ${currentValue ? 'checked' : ''}>`;
            break;

        case 'image':
            inputHtml = `
                <div class="image-upload-field" id="${inputId}-container">
                    <input type="file" id="${inputId}" accept="image/*" style="display:none" 
                           onchange="handleImageUpload('${nodeId}', '${fieldName}', this)">
                    <div class="image-upload-area" onclick="document.getElementById('${inputId}').click()">
                        <div class="upload-placeholder" id="${inputId}-placeholder">
                            <span class="upload-icon">📁</span>
                            <span class="upload-text">Click to upload</span>
                        </div>
                        <img id="${inputId}-preview" class="upload-preview hidden" />
                    </div>
                    <span class="image-filename" id="${inputId}-name">${currentValue || 'No file'}</span>
                </div>
            `;
            break;

        case 'file':
            inputHtml = `<input type="text" id="${inputId}" value="${currentValue || ''}" placeholder="File path">`;
            break;

        default:
            inputHtml = `<input type="text" id="${inputId}" value="${currentValue || ''}">`;
    }

    return `
        <div class="param-row ${config.type === 'image' ? 'param-row-image' : ''}">
            <label for="${inputId}">${config.label}</label>
            <div class="param-input">${inputHtml}</div>
        </div>
    `;
}

function collectParameterValues() {
    const nodeInfoList = [];

    editableParameters.forEach(nodeGroup => {
        nodeGroup.params.forEach(param => {
            const inputId = `param-${param.nodeId}-${param.fieldName}`;
            const config = PARAM_CONFIG[param.fieldName] || { type: 'text' };

            // Skip image fields - they are handled separately
            if (config.type === 'image') {
                return;
            }

            const element = document.getElementById(inputId);

            if (element) {
                let value = element.type === 'checkbox' ? element.checked : element.value;

                // Only add if value changed from original
                if (String(value) !== String(param.currentValue)) {
                    nodeInfoList.push({
                        nodeId: param.nodeId,
                        fieldName: param.fieldName,
                        fieldValue: String(value)
                    });
                }
            }
        });
    });

    return nodeInfoList;
}

// Upload all images and get their filenames
async function uploadDynamicImages() {
    const imageParams = [];

    for (const [key, file] of Object.entries(uploadedImages)) {
        const [nodeId, fieldName] = key.split('-');
        try {
            console.log(`📤 Uploading image for Node ${nodeId}.${fieldName}...`);
            const result = await uploadFile(file);
            imageParams.push({
                nodeId: nodeId,
                fieldName: fieldName,
                fieldValue: result.fileName
            });
            console.log(`✅ Uploaded: ${result.fileName}`);
        } catch (error) {
            console.error(`❌ Failed to upload image for Node ${nodeId}:`, error);
            throw new Error(`Image upload failed for Node ${nodeId}: ${error.message}`);
        }
    }

    return imageParams;
}

function applyDetectedNodes() {
    // Close modal
    document.getElementById('importJsonModal').classList.add('hidden');

    if (editableParameters.length === 0) {
        alert('No editable parameters found');
        return;
    }

    // Render parameters to main panel
    const container = document.getElementById('mainParamsContainer');
    container.innerHTML = '';

    editableParameters.forEach(nodeGroup => {
        const nodeCard = document.createElement('div');
        nodeCard.className = 'param-node-card';

        let paramsHtml = '';
        nodeGroup.params.forEach(param => {
            paramsHtml += renderParamInput(param);
        });

        nodeCard.innerHTML = `
            <div class="param-node-header" onclick="this.parentElement.classList.toggle('collapsed')">
                <span class="param-node-title">Node ${nodeGroup.nodeId}: ${nodeGroup.title}</span>
                <span class="param-toggle">▼</span>
            </div>
            <div class="param-node-body">
                ${paramsHtml}
            </div>
        `;

        container.appendChild(nodeCard);
    });

    // Show the panel
    document.getElementById('workflowParamsPanel').classList.remove('hidden');

    console.log(`✅ Loaded ${editableParameters.length} nodes with editable parameters`);
}

function clearWorkflowParams() {
    editableParameters = [];
    workflowData = null;
    uploadedImages = {};
    document.getElementById('mainParamsContainer').innerHTML = '';
    document.getElementById('workflowParamsPanel').classList.add('hidden');
    console.log('🗑️ Workflow parameters cleared');
}

// Handle image upload for dynamic parameters
function handleImageUpload(nodeId, fieldName, input) {
    const file = input.files[0];
    if (!file) return;

    const inputId = `param-${nodeId}-${fieldName}`;
    const preview = document.getElementById(`${inputId}-preview`);
    const placeholder = document.getElementById(`${inputId}-placeholder`);
    const filename = document.getElementById(`${inputId}-name`);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);

    // Store file for upload
    uploadedImages[`${nodeId}-${fieldName}`] = file;
    filename.textContent = file.name;

    console.log(`📁 Image uploaded for Node ${nodeId}.${fieldName}: ${file.name}`);
}

// ===== Timer Functions =====

function startTimer() {
    state.startTime = Date.now();
    elements.statusTimer.textContent = '0.0s';

    state.timerInterval = setInterval(() => {
        const elapsed = (Date.now() - state.startTime) / 1000;
        elements.statusTimer.textContent = `${elapsed.toFixed(1)}s`;
    }, 100);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    return state.startTime ? (Date.now() - state.startTime) / 1000 : 0;
}

function updateResultsStats() {
    const count = state.results.length;
    elements.totalResults.textContent = `${count} image${count !== 1 ? 's' : ''}`;
    elements.totalTime.textContent = `${state.totalGenerationTime.toFixed(1)}s total`;
}

function updatePromptCounter() {
    const text = elements.promptInput.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    elements.charCount.textContent = chars;
    elements.wordCount.textContent = words;
}

// ===== API Functions =====

async function uploadFile(file) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key is required');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('apiKey', apiKey);

    const response = await fetch(`${CONFIG.BASE_URL}/task/openapi/upload`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result.code !== 0) {
        throw new Error(result.msg || 'Upload failed');
    }
    return result.data;
}

async function createTask(workflowId, nodeInfoList) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key is required');

    const response = await fetch(`${CONFIG.BASE_URL}/task/openapi/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey,
            workflowId,
            nodeInfoList,
            addMetadata: true
        })
    });

    const result = await response.json();
    if (result.code !== 0) {
        throw new Error(result.msg || 'Task creation failed');
    }
    return result.data;
}

async function getTaskOutputs(taskId) {
    const apiKey = getApiKey();

    const response = await fetch(`${CONFIG.BASE_URL}/task/openapi/outputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, taskId })
    });

    const result = await response.json();
    // Return result as-is, let pollForCompletion handle different statuses
    return result;
}

async function pollForCompletion(taskId, onProgress) {
    let attempts = 0;

    // List of "still processing" messages to continue polling
    const PENDING_MESSAGES = [
        'APIKEY_TASK_IS_QUEUED',
        'APIKEY_TASK_IS_RUNNING',
        'TASK_RUNNING',
        'TASK_QUEUED',
        'PENDING',
        'RUNNING'
    ];

    while (attempts < CONFIG.MAX_POLL_ATTEMPTS) {
        const result = await getTaskOutputs(taskId);

        // Success - task completed with outputs
        if (result.code === 0 && result.data && result.data.length > 0) {
            return result.data;
        }

        // Check if task is still processing (should continue polling)
        const isPending = PENDING_MESSAGES.some(msg =>
            result.msg && result.msg.toUpperCase().includes(msg.toUpperCase())
        ) || result.code === 804; // 804 often means still processing

        // If not pending and not success, it's a real error
        if (!isPending && result.code !== 0 && result.msg) {
            // Check if it's an actual failure vs still processing
            if (result.msg.includes('FAILED') || result.msg.includes('ERROR')) {
                throw new Error(result.msg);
            }
        }

        attempts++;
        const progress = Math.min((attempts / 40) * 100, 90);
        if (onProgress) {
            onProgress(progress, `Processing... (${attempts * 3}s)`);
        }

        await new Promise(r => setTimeout(r, CONFIG.POLL_INTERVAL));
    }

    throw new Error('Task timeout');
}

// ===== UI Functions =====

function updateStatus(progress, text) {
    elements.statusProgress.style.width = `${progress}%`;
    elements.statusText.textContent = text;
}

function showStatus() {
    elements.statusContainer.classList.remove('hidden');
}

function hideStatus() {
    elements.statusContainer.classList.add('hidden');
}

function setGenerating(isGenerating) {
    state.isGenerating = isGenerating;
    elements.generateBtn.disabled = isGenerating || state.isStressTesting;
    elements.generateBtn.classList.toggle('loading', isGenerating);
    elements.stressTestBtn.disabled = isGenerating || state.isStressTesting;

    if (isGenerating) {
        showStatus();
        updateStatus(5, 'Starting...');
        startTimer();
    } else {
        stopTimer();
    }
}

function addResultImage(url, type = 'png', generationTime = null) {
    elements.emptyState.classList.add('hidden');

    const item = document.createElement('div');
    item.className = 'result-item';

    let timeBadge = '';
    if (generationTime !== null) {
        timeBadge = `<span class="time-badge">${generationTime.toFixed(1)}s</span>`;
    }

    item.innerHTML = `
        ${timeBadge}
        <img src="${url}" alt="Generated image" loading="lazy">
        <button class="download-btn" title="Download">⬇️</button>
    `;

    // Download button
    item.querySelector('.download-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadImage(url, `runninghub_${Date.now()}.${type}`);
    });

    // Click to open full size
    item.querySelector('img').addEventListener('click', () => {
        window.open(url, '_blank');
    });

    elements.resultsGrid.insertBefore(item, elements.resultsGrid.firstChild);
    state.results.unshift({ url, time: generationTime });

    if (generationTime) {
        state.totalGenerationTime += generationTime;
    }
    updateResultsStats();
}

function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showError(message) {
    updateStatus(0, `❌ Error: ${message}`);
    setTimeout(hideStatus, 5000);
}

function randomSeed() {
    return Math.floor(Math.random() * 2147483647);
}

// ===== Main Generation Flow =====

async function generate() {
    if (state.isGenerating || state.isStressTesting) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        elements.settingsModal.classList.remove('hidden');
        return;
    }

    const workflowId = elements.workflowInput.value.trim();
    if (!workflowId) {
        alert('Please enter a Workflow ID');
        return;
    }

    try {
        setGenerating(true);

        // Build nodeInfoList from dynamic parameters
        const nodeInfoList = collectParameterValues();

        // Upload images and add to nodeInfoList
        if (Object.keys(uploadedImages).length > 0) {
            updateStatus(10, 'Uploading images...');
            const imageParams = await uploadDynamicImages();
            nodeInfoList.push(...imageParams);
        }

        // Add prompt if provided (from main input)
        const prompt = elements.promptInput.value.trim();
        if (prompt && editableParameters.length === 0) {
            // Only use main prompt input if no dynamic workflow is loaded
            nodeInfoList.push({
                nodeId: '6',
                fieldName: 'text',
                fieldValue: prompt
            });
        }

        console.log('📦 NodeInfoList:', nodeInfoList);

        // Create task
        updateStatus(20, 'Creating task...');
        const taskResult = await createTask(workflowId, nodeInfoList);
        const taskId = taskResult.taskId;

        updateStatus(30, 'Task created, processing...');

        // Poll for completion
        const outputs = await pollForCompletion(taskId, updateStatus);

        const elapsedTime = stopTimer();
        updateStatus(100, `✅ Complete in ${elapsedTime.toFixed(1)}s!`);

        // Add results with timing
        for (const output of outputs) {
            addResultImage(output.fileUrl, output.fileType, elapsedTime / outputs.length);
        }

        setTimeout(hideStatus, 3000);

    } catch (error) {
        console.error('Generation error:', error);
        stopTimer();
        showError(error.message);
    } finally {
        setGenerating(false);
    }
}

// ===== Stress Test =====

async function runSingleTask(workflowId, prompt, index) {
    const startTime = Date.now();

    // Get configured node IDs
    const promptNodeId = elements.promptNodeId.value.trim() || '6';
    const seedNodeId = elements.seedNodeId.value.trim() || '3';

    try {
        const nodeInfoList = [
            { nodeId: promptNodeId, fieldName: 'text', fieldValue: prompt },
            { nodeId: seedNodeId, fieldName: 'seed', fieldValue: randomSeed().toString() }
        ];

        const taskResult = await createTask(workflowId, nodeInfoList);
        const outputs = await pollForCompletion(taskResult.taskId);

        const elapsedTime = (Date.now() - startTime) / 1000;

        return {
            success: true,
            time: elapsedTime,
            outputs,
            prompt,
            index
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            prompt,
            index
        };
    }
}

async function runStressTest() {
    if (state.isStressTesting || state.isGenerating) return;

    const apiKey = getApiKey();
    if (!apiKey) {
        elements.settingsModal.classList.remove('hidden');
        return;
    }

    const workflowId = elements.workflowInput.value.trim();
    if (!workflowId) {
        alert('Please enter a Workflow ID');
        return;
    }

    const promptsText = elements.batchPrompts.value.trim();
    if (!promptsText) {
        alert('Please enter at least one prompt');
        return;
    }

    const prompts = promptsText.split('\n').filter(p => p.trim());
    if (prompts.length === 0) {
        alert('Please enter at least one valid prompt');
        return;
    }

    state.isStressTesting = true;
    elements.stressTestBtn.disabled = true;
    elements.generateBtn.disabled = true;

    // Show stats
    elements.stressStats.classList.remove('hidden');
    elements.statTotal.textContent = prompts.length;
    elements.statCompleted.textContent = '0';
    elements.statFailed.textContent = '0';
    elements.statAvgTime.textContent = '-';

    // Initialize job queue display
    elements.jobQueue.classList.remove('hidden');
    elements.jobList.innerHTML = '';

    // Create job items for each prompt
    const jobs = prompts.map((prompt, index) => ({
        prompt: prompt.trim(),
        index,
        status: 'pending',
        taskId: null,
        time: null,
        startTime: null
    }));

    // Render initial job list
    jobs.forEach(job => {
        const jobEl = document.createElement('div');
        jobEl.className = 'job-item';
        jobEl.id = `job-${job.index}`;
        jobEl.innerHTML = `
            <span class="job-status pending"></span>
            <span class="job-prompt">${job.prompt.substring(0, 50)}${job.prompt.length > 50 ? '...' : ''}</span>
            <span class="job-time">-</span>
        `;
        elements.jobList.appendChild(jobEl);
    });

    function updateJobStatus(index, status, time = null) {
        const job = jobs[index];
        job.status = status;

        const jobEl = document.getElementById(`job-${index}`);
        if (jobEl) {
            const statusEl = jobEl.querySelector('.job-status');
            statusEl.className = `job-status ${status}`;

            if (time !== null) {
                const timeEl = jobEl.querySelector('.job-time');
                timeEl.textContent = `${time.toFixed(1)}s`;
            }
        }

        // Update running count
        const runningCount = jobs.filter(j => j.status === 'running').length;
        const createdCount = jobs.filter(j => j.taskId !== null).length;
        elements.jobQueueCount.textContent = `${runningCount} running, ${createdCount} created`;
    }

    // Use dynamic parameters from workflow if available
    const dynamicParams = collectParameterValues();

    let created = 0;
    let createFailed = 0;
    let completed = 0;
    let fetchFailed = 0;
    let totalTime = 0;
    const times = [];
    const createdTaskIds = [];

    // PHASE 1: Create all tasks (slow, careful)
    console.log('📝 Phase 1: Creating tasks...');
    elements.jobQueueCount.textContent = 'Creating tasks...';

    const CREATE_BATCH_SIZE = 3; // Small batches to avoid refused streams
    const CREATE_DELAY_MS = 1000; // 1 second between batches

    for (let i = 0; i < jobs.length; i += CREATE_BATCH_SIZE) {
        const batch = jobs.slice(i, i + CREATE_BATCH_SIZE);

        const createPromises = batch.map(async (job) => {
            job.startTime = Date.now();
            updateJobStatus(job.index, 'running');

            try {
                const nodeInfoList = [
                    { nodeId: promptNodeId, fieldName: 'text', fieldValue: job.prompt },
                    { nodeId: seedNodeId, fieldName: 'seed', fieldValue: randomSeed().toString() }
                ];

                // Add size if configured
                const sizeNodeId = elements.sizeNodeId.value.trim();
                if (sizeNodeId) {
                    const width = parseInt(elements.widthInput.value) || 1920;
                    const height = parseInt(elements.heightInput.value) || 1080;
                    nodeInfoList.push({ nodeId: sizeNodeId, fieldName: 'width', fieldValue: width.toString() });
                    nodeInfoList.push({ nodeId: sizeNodeId, fieldName: 'height', fieldValue: height.toString() });
                }

                const taskResult = await createTask(workflowId, nodeInfoList);
                job.taskId = taskResult.taskId;
                createdTaskIds.push(taskResult.taskId);
                created++;
                console.log(`✅ Task ${job.index} created: ${job.taskId}`);
                return { success: true, job };
            } catch (error) {
                console.error(`❌ Task ${job.index} create failed:`, error.message);
                updateJobStatus(job.index, 'failed');
                createFailed++;
                return { success: false, job, error: error.message };
            }
        });

        await Promise.all(createPromises);

        // Update stats after each batch
        elements.statCompleted.textContent = `${created} created`;
        elements.statFailed.textContent = createFailed;

        // Delay between batches
        if (i + CREATE_BATCH_SIZE < jobs.length) {
            await new Promise(r => setTimeout(r, CREATE_DELAY_MS));
        }
    }

    console.log(`📝 Phase 1 complete: ${created} tasks created, ${createFailed} failed`);

    // Auto-fill task IDs for import
    if (createdTaskIds.length > 0) {
        elements.taskIds.value = createdTaskIds.join('\n');
    }

    // PHASE 2: Poll for results
    console.log('🔄 Phase 2: Fetching results...');
    elements.jobQueueCount.textContent = 'Fetching results...';

    const FETCH_BATCH_SIZE = 5;
    const FETCH_DELAY_MS = 500;

    const pendingJobs = jobs.filter(j => j.taskId !== null);
    const failedFetches = []; // Queue for retry

    for (let i = 0; i < pendingJobs.length; i += FETCH_BATCH_SIZE) {
        const batch = pendingJobs.slice(i, i + FETCH_BATCH_SIZE);

        const fetchPromises = batch.map(async (job) => {
            try {
                const outputs = await pollForCompletion(job.taskId);

                const elapsedTime = (Date.now() - job.startTime) / 1000;
                job.time = elapsedTime;
                times.push(elapsedTime);
                totalTime += elapsedTime;

                updateJobStatus(job.index, 'success', elapsedTime);
                completed++;

                // Add result images
                for (const output of outputs) {
                    addResultImage(output.fileUrl, output.fileType, elapsedTime / outputs.length);
                }

                return { success: true };
            } catch (error) {
                console.error(`❌ Task ${job.index} fetch failed:`, error.message);
                // Don't mark as failed yet, queue for retry
                failedFetches.push(job);
                return { success: false };
            }
        });

        await Promise.all(fetchPromises);

        // Update stats
        elements.statCompleted.textContent = completed;
        elements.statFailed.textContent = createFailed + fetchFailed;

        if (times.length > 0) {
            elements.statAvgTime.textContent = `${(totalTime / times.length).toFixed(1)}s`;
        }

        // Delay between batches
        if (i + FETCH_BATCH_SIZE < pendingJobs.length) {
            await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
        }
    }

    // PHASE 3: Retry failed fetches
    if (failedFetches.length > 0) {
        console.log(`🔄 Phase 3: Retrying ${failedFetches.length} failed fetches...`);
        elements.jobQueueCount.textContent = `Retrying ${failedFetches.length}...`;

        // Wait a bit before retrying
        await new Promise(r => setTimeout(r, 3000));

        for (const job of failedFetches) {
            try {
                console.log(`🔄 Retrying task ${job.index}: ${job.taskId}`);
                const outputs = await pollForCompletion(job.taskId);

                const elapsedTime = (Date.now() - job.startTime) / 1000;
                job.time = elapsedTime;
                times.push(elapsedTime);
                totalTime += elapsedTime;

                updateJobStatus(job.index, 'success', elapsedTime);
                completed++;

                for (const output of outputs) {
                    addResultImage(output.fileUrl, output.fileType, elapsedTime / outputs.length);
                }

            } catch (error) {
                console.error(`❌ Retry failed for task ${job.index}:`, error.message);
                updateJobStatus(job.index, 'failed');
                fetchFailed++;
            }

            // Update stats
            elements.statCompleted.textContent = completed;
            elements.statFailed.textContent = createFailed + fetchFailed;

            if (times.length > 0) {
                elements.statAvgTime.textContent = `${(totalTime / times.length).toFixed(1)}s`;
            }

            // Small delay between retries
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Update final count
    console.log(`✅ Complete: ${completed} success, ${createFailed + fetchFailed} failed`);
    elements.jobQueueCount.textContent = 'Done';

    state.isStressTesting = false;
    elements.stressTestBtn.disabled = false;
    elements.generateBtn.disabled = false;
}

// ===== Import Tasks =====

async function importTasks() {
    const apiKey = getApiKey();
    if (!apiKey) {
        elements.settingsModal.classList.remove('hidden');
        return;
    }

    const taskIdsText = elements.taskIds.value.trim();
    if (!taskIdsText) {
        alert('Please enter at least one Task ID');
        return;
    }

    const taskIds = taskIdsText.split('\n').map(id => id.trim()).filter(id => id);
    if (taskIds.length === 0) {
        alert('Please enter valid Task IDs');
        return;
    }

    elements.importBtn.disabled = true;
    elements.importStatus.classList.remove('hidden');

    let fetched = 0;
    let failed = 0;

    for (const taskId of taskIds) {
        try {
            elements.importProgress.textContent = `${fetched + failed + 1}/${taskIds.length}`;

            const result = await getTaskOutputs(taskId);

            if (result.code === 0 && result.data) {
                for (const output of result.data) {
                    addResultImage(output.fileUrl, output.fileType);
                }
                fetched++;
            } else {
                console.warn(`Task ${taskId} not ready or failed:`, result.msg);
                failed++;
            }

            // Small delay between requests
            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.error(`Failed to fetch task ${taskId}:`, error.message);
            failed++;
        }
    }

    elements.importProgress.textContent = `${fetched}/${taskIds.length}`;
    elements.importBtn.disabled = false;

    if (failed > 0) {
        alert(`Fetched ${fetched} tasks. ${failed} failed (may still be processing).`);
    }
}

// ===== Event Handlers =====

// File Upload
elements.uploadZone.addEventListener('click', () => {
    elements.fileInput.click();
});

elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
});

// Drag and drop
elements.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadZone.classList.add('drag-over');
});

elements.uploadZone.addEventListener('dragleave', () => {
    elements.uploadZone.classList.remove('drag-over');
});

elements.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFileSelect(file);
    }
});

function handleFileSelect(file) {
    state.uploadedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        elements.previewImage.src = e.target.result;
        elements.previewImage.classList.remove('hidden');
        elements.clearBtn.classList.remove('hidden');
        elements.uploadPlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

elements.clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.uploadedFile = null;
    state.uploadedFileName = null;
    elements.previewImage.classList.add('hidden');
    elements.clearBtn.classList.add('hidden');
    elements.uploadPlaceholder.classList.remove('hidden');
    elements.fileInput.value = '';
});

// Generate button
elements.generateBtn.addEventListener('click', generate);

// Stress test button
elements.stressTestBtn.addEventListener('click', runStressTest);

// Import toggle and button
elements.importToggle.addEventListener('click', () => {
    elements.importToggle.classList.toggle('open');
    elements.importFields.classList.toggle('hidden');
});

elements.importBtn.addEventListener('click', importTasks);

// Settings modal
elements.settingsBtn.addEventListener('click', () => {
    elements.apiKeyInput.value = getApiKey();
    elements.settingsModal.classList.remove('hidden');
});

elements.closeModalBtn.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
});

elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
        elements.settingsModal.classList.add('hidden');
    }
});

elements.saveSettingsBtn.addEventListener('click', () => {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        setApiKey(key);
        elements.settingsModal.classList.add('hidden');
    }
});

// Profile management
elements.profileSelect.addEventListener('change', loadSelectedProfile);
elements.saveProfileBtn.addEventListener('click', saveCurrentProfile);
elements.deleteProfileBtn.addEventListener('click', deleteSelectedProfile);

// Import JSON modal
elements.importJsonBtn.addEventListener('click', () => {
    elements.importJsonModal.classList.remove('hidden');
});

elements.closeImportBtn.addEventListener('click', () => {
    elements.importJsonModal.classList.add('hidden');
});

elements.importJsonModal.addEventListener('click', (e) => {
    if (e.target === elements.importJsonModal.querySelector('.modal-overlay')) {
        elements.importJsonModal.classList.add('hidden');
    }
});

elements.analyzeJsonBtn.addEventListener('click', () => {
    const jsonText = elements.workflowJson.value.trim();
    if (!jsonText) {
        alert('Please paste workflow JSON first');
        return;
    }

    const result = parseWorkflowForParameters(jsonText);
    if (result.success) {
        renderDynamicParameters();
        console.log(`🔍 Found ${result.parameters.length} editable node groups`);
    } else {
        alert('Invalid JSON: ' + result.error);
    }
});

elements.applyNodesBtn.addEventListener('click', applyDetectedNodes);

// Clear workflow params
elements.clearParamsBtn.addEventListener('click', clearWorkflowParams);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generate();
    }
    if (e.key === 'Escape') {
        elements.settingsModal.classList.add('hidden');
    }
});

// Prompt counter
elements.promptInput.addEventListener('input', updatePromptCounter);

// ===== Initialization =====

function init() {
    // Check for API key
    if (!getApiKey()) {
        const envKey = 'caed85ca93fb4f49a354c330edef29f3';
        if (envKey) {
            setApiKey(envKey);
        }
    }

    // Initialize profiles dropdown
    updateProfileDropdown();

    // Initialize prompt counter
    updatePromptCounter();

    console.log('🎨 RunningHub AI Studio initialized');
    console.log('⚡ Stress Test feature enabled');
    console.log('📂 Workflow Profiles enabled');
}

init();
