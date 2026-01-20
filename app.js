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
    // Size control elements
    widthInput: document.getElementById('widthInput'),
    heightInput: document.getElementById('heightInput'),
    sizeNodeId: document.getElementById('sizeNodeId'),
    presetBtns: document.querySelectorAll('.preset-btn'),
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
    applyNodesBtn: document.getElementById('applyNodesBtn')
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
        workflowId: elements.workflowInput.value,
        promptNodeId: elements.promptNodeId.value,
        seedNodeId: elements.seedNodeId.value,
        imageNodeId: elements.imageNodeId.value,
        sizeNodeId: elements.sizeNodeId.value,
        width: elements.widthInput.value,
        height: elements.heightInput.value
    };
}

function applyProfile(settings) {
    if (!settings) return;

    elements.workflowInput.value = settings.workflowId || '';
    elements.promptNodeId.value = settings.promptNodeId || '5';
    elements.seedNodeId.value = settings.seedNodeId || '4';
    elements.imageNodeId.value = settings.imageNodeId || '1';
    elements.sizeNodeId.value = settings.sizeNodeId || '7';
    elements.widthInput.value = settings.width || '1920';
    elements.heightInput.value = settings.height || '1080';
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

// ===== Workflow JSON Auto-Detect =====

let detectedSettings = {};

// Node type mapping for auto-detection
const NODE_TYPE_MAP = {
    // Prompt nodes - contain text input
    'CLIPTextEncode': { role: 'prompt', field: 'text' },
    'CLIPTextEncodeSDXL': { role: 'prompt', field: 'text' },
    'PromptExpansion': { role: 'prompt', field: 'text' },

    // Sampler nodes - contain seed
    'KSampler': { role: 'seed', field: 'seed' },
    'KSamplerAdvanced': { role: 'seed', field: 'noise_seed' },
    'SamplerCustom': { role: 'seed', field: 'seed' },

    // Size nodes - contain width/height
    'EmptyLatentImage': { role: 'size', fields: ['width', 'height'] },
    'EmptyImage': { role: 'size', fields: ['width', 'height'] },
    'LatentFromBatch': { role: 'size', fields: ['width', 'height'] },

    // Image input nodes
    'LoadImage': { role: 'image', field: 'image' },
    'LoadImageMask': { role: 'image', field: 'image' }
};

function parseWorkflowJson(jsonText) {
    try {
        const workflow = JSON.parse(jsonText);
        const detected = {
            prompt: null,
            seed: null,
            size: null,
            image: null,
            allNodes: []
        };

        // Iterate through all nodes
        for (const [nodeId, node] of Object.entries(workflow)) {
            const classType = node.class_type;

            // Store all nodes for reference
            detected.allNodes.push({
                id: nodeId,
                type: classType,
                inputs: node.inputs
            });

            // Check if this is a known node type
            const mapping = NODE_TYPE_MAP[classType];
            if (mapping) {
                if (mapping.role === 'prompt' && !detected.prompt) {
                    detected.prompt = { nodeId, type: classType, field: mapping.field };
                }
                if (mapping.role === 'seed' && !detected.seed) {
                    detected.seed = { nodeId, type: classType, field: mapping.field };
                }
                if (mapping.role === 'size' && !detected.size) {
                    detected.size = {
                        nodeId,
                        type: classType,
                        width: node.inputs?.width,
                        height: node.inputs?.height
                    };
                }
                if (mapping.role === 'image' && !detected.image) {
                    detected.image = { nodeId, type: classType, field: mapping.field };
                }
            }
        }

        return { success: true, detected };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function displayDetectedNodes(detected) {
    const container = document.getElementById('detectedList');
    container.innerHTML = '';

    const items = [
        { label: 'Prompt', data: detected.prompt },
        { label: 'Seed/Sampler', data: detected.seed },
        { label: 'Size', data: detected.size },
        { label: 'Image Input', data: detected.image }
    ];

    items.forEach(item => {
        if (item.data) {
            const div = document.createElement('div');
            div.className = 'detected-item';
            div.innerHTML = `
                <span class="node-type">${item.label}: ${item.data.type}</span>
                <span class="node-id">Node ID: ${item.data.nodeId}</span>
            `;
            container.appendChild(div);
        }
    });

    document.getElementById('detectedNodes').classList.remove('hidden');

    // Store for later apply
    detectedSettings = detected;
}

function applyDetectedNodes() {
    if (!detectedSettings.prompt && !detectedSettings.seed && !detectedSettings.size) {
        alert('No nodes detected. Please analyze workflow first.');
        return;
    }

    if (detectedSettings.prompt) {
        elements.promptNodeId.value = detectedSettings.prompt.nodeId;
    }
    if (detectedSettings.seed) {
        elements.seedNodeId.value = detectedSettings.seed.nodeId;
    }
    if (detectedSettings.size) {
        elements.sizeNodeId.value = detectedSettings.size.nodeId;
        if (detectedSettings.size.width) {
            elements.widthInput.value = detectedSettings.size.width;
        }
        if (detectedSettings.size.height) {
            elements.heightInput.value = detectedSettings.size.height;
        }
    }
    if (detectedSettings.image) {
        elements.imageNodeId.value = detectedSettings.image.nodeId;
    }

    // Close modal
    document.getElementById('importJsonModal').classList.add('hidden');

    // Open config to show applied values
    elements.configToggle.classList.add('open');
    elements.configFields.classList.remove('hidden');

    console.log('✅ Node IDs applied from workflow');
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

        // Build nodeInfoList
        const nodeInfoList = [];

        // Get configured node IDs
        const promptNodeId = elements.promptNodeId.value.trim() || '6';
        const seedNodeId = elements.seedNodeId.value.trim() || '3';
        const imageNodeId = elements.imageNodeId.value.trim() || '1';

        // Upload image if provided
        if (state.uploadedFile) {
            updateStatus(10, 'Uploading image...');
            const uploadResult = await uploadFile(state.uploadedFile);
            state.uploadedFileName = uploadResult.fileName;

            nodeInfoList.push({
                nodeId: imageNodeId,
                fieldName: 'image',
                fieldValue: uploadResult.fileName
            });
        }

        // Add prompt if provided
        const prompt = elements.promptInput.value.trim();
        if (prompt) {
            nodeInfoList.push({
                nodeId: promptNodeId,
                fieldName: 'text',
                fieldValue: prompt
            });
        }

        // Add seed
        let seed = elements.seedInput.value.trim();
        if (!seed) {
            seed = randomSeed().toString();
        }
        nodeInfoList.push({
            nodeId: seedNodeId,
            fieldName: 'seed',
            fieldValue: seed
        });

        // Add size (width/height) if size node is configured
        const sizeNodeId = elements.sizeNodeId.value.trim();
        if (sizeNodeId) {
            const width = parseInt(elements.widthInput.value) || 1920;
            const height = parseInt(elements.heightInput.value) || 1080;

            nodeInfoList.push({
                nodeId: sizeNodeId,
                fieldName: 'width',
                fieldValue: width.toString()
            });
            nodeInfoList.push({
                nodeId: sizeNodeId,
                fieldName: 'height',
                fieldValue: height.toString()
            });
        }

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

    const promptNodeId = elements.promptNodeId.value.trim() || '5';
    const seedNodeId = elements.seedNodeId.value.trim() || '4';

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

// Size preset buttons
elements.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        elements.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update width/height inputs
        const width = btn.dataset.width;
        const height = btn.dataset.height;
        elements.widthInput.value = width;
        elements.heightInput.value = height;
    });
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

// Randomize seed
elements.randomizeBtn.addEventListener('click', () => {
    elements.seedInput.value = randomSeed();
});

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

// Config toggle
elements.configToggle.addEventListener('click', () => {
    elements.configToggle.classList.toggle('open');
    elements.configFields.classList.toggle('hidden');
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

    const result = parseWorkflowJson(jsonText);
    if (result.success) {
        displayDetectedNodes(result.detected);
    } else {
        alert('Invalid JSON: ' + result.error);
    }
});

elements.applyNodesBtn.addEventListener('click', applyDetectedNodes);

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
