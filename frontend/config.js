// Auto-generated configuration from deployment
const CONFIG = {
    apiUrl: 'https://ubziqeg10h.execute-api.us-east-1.amazonaws.com/dev',
    userPoolId: 'us-east-1_PXbi3uRDs',
    clientId: '5gk74r28qn7e3vn2s9pm15048r',
    s3Bucket: 'time-capsule-app-dev-storage'
};

// Update the app configuration if app object exists
if (typeof window !== 'undefined' && window.app) {
    window.app.apiUrl = CONFIG.apiUrl;
    window.app.userPoolId = CONFIG.userPoolId;
    window.app.clientId = CONFIG.clientId;
}

// Also expose CONFIG globally for direct access
window.CONFIG = CONFIG; 