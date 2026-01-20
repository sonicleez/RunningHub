// Configuration
const CONFIG = {
    BASE_URL: 'https://www.runninghub.ai',
    DEFAULT_WORKFLOW_ID: '2013462841914826753',
    POLL_INTERVAL: 3000, // 3 seconds
    MAX_POLL_ATTEMPTS: 120 // 6 minutes max
};

// Load API key from localStorage
function getApiKey() {
    return localStorage.getItem('runninghub_api_key') || '';
}

function setApiKey(key) {
    localStorage.setItem('runninghub_api_key', key);
}
