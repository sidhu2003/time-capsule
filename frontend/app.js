// Time Capsule App Frontend JavaScript

class TimeCapsuleApp {
    constructor() {
        console.log('TimeCapsuleApp constructor called');
        // Use configuration from config.js
        this.apiUrl = window.CONFIG ? window.CONFIG.apiUrl : 'YOUR_API_GATEWAY_URL';
        this.userPoolId = window.CONFIG ? window.CONFIG.userPoolId : 'YOUR_USER_POOL_ID';
        this.clientId = window.CONFIG ? window.CONFIG.clientId : 'YOUR_CLIENT_ID';
        
        console.log('Configuration:', {
            apiUrl: this.apiUrl,
            userPoolId: this.userPoolId,
            clientId: this.clientId
        });
        
        this.poolData = {
            UserPoolId: this.userPoolId,
            ClientId: this.clientId
        };
        
        this.userPool = new AmazonCognitoIdentity.CognitoUserPool(this.poolData);
        this.currentUser = null;
        this.authToken = null;
        
        this.initializeApp();
    }

    initializeApp() {
        console.log('initializeApp called');
        // Validate configuration
        if (!window.CONFIG || this.apiUrl.includes('YOUR_API_GATEWAY_URL') || 
            this.userPoolId.includes('YOUR_USER_POOL_ID')) {
            this.showToast('Configuration incomplete. Please check the deployment.', 'error');
            return;
        }
        
        this.checkAuthStatus();
        this.bindEvents();
        this.setMinDate();
        this.setupFileUpload();
        console.log('App initialization complete');
    }

    // Authentication Methods
    checkAuthStatus() {
        const cognitoUser = this.userPool.getCurrentUser();
        
        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err || !session.isValid()) {
                    this.showLandingPage();
                    return;
                }
                
                this.authToken = session.getIdToken().getJwtToken();
                this.currentUser = cognitoUser;
                
                cognitoUser.getUserAttributes((err, attributes) => {
                    if (!err) {
                        const email = attributes.find(attr => attr.getName() === 'email');
                        if (email) {
                            document.getElementById('user-email').textContent = email.getValue();
                        }
                    }
                });
                
                this.showDashboard();
            });
        } else {
            this.showLandingPage();
        }
    }

    register(email, password) {
        return new Promise((resolve, reject) => {
            const attributeList = [
                new AmazonCognitoIdentity.CognitoUserAttribute({
                    Name: 'email',
                    Value: email
                })
            ];

            this.userPool.signUp(email, password, attributeList, null, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Store email for verification
                this.pendingVerificationEmail = email;
                this.pendingCognitoUser = result.user;
                
                // Show verification form
                this.showVerificationForm(email);
                this.showToast('Registration successful! Please check your email for verification.', 'success');
                resolve(result);
            });
        });
    }

    verifyEmail(email, code) {
        return new Promise((resolve, reject) => {
            const userData = {
                Username: email,
                Pool: this.userPool
            };

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

            cognitoUser.confirmRegistration(code, true, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.showToast('Email verified successfully! You can now log in.', 'success');
                this.switchToLogin();
                resolve(result);
            });
        });
    }

    resendVerificationCode(email) {
        return new Promise((resolve, reject) => {
            const userData = {
                Username: email,
                Pool: this.userPool
            };

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

            cognitoUser.resendConfirmationCode((err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.showToast('Verification code resent!', 'success');
                resolve(result);
            });
        });
    }

    login(email, password) {
        return new Promise((resolve, reject) => {
            const authenticationData = {
                Username: email,
                Password: password
            };

            const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
            const userData = {
                Username: email,
                Pool: this.userPool
            };

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    this.authToken = result.getIdToken().getJwtToken();
                    this.currentUser = cognitoUser;
                    document.getElementById('user-email').textContent = email;
                    this.showDashboard();
                    resolve(result);
                },
                onFailure: (err) => {
                    reject(err);
                }
            });
        });
    }

    logout() {
        if (this.currentUser) {
            this.currentUser.signOut();
        }
        this.currentUser = null;
        this.authToken = null;
        this.showLandingPage();
        this.showToast('Logged out successfully', 'success');
    }

    // API Methods
    async makeApiRequest(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
            console.log('Making API request with token:', this.authToken.substring(0, 50) + '...');
        } else {
            console.log('Making API request without authentication token');
        }

        const config = {
            method,
            headers
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        console.log('API Request:', {
            url: `${this.apiUrl}${endpoint}`,
            method,
            headers,
            body: body ? JSON.stringify(body).substring(0, 100) + '...' : null
        });

        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, config);
            
            console.log('API Response status:', response.status);
            console.log('API Response headers:', Object.fromEntries(response.headers.entries()));
            
            const data = await response.json();

            if (!response.ok) {
                console.error('API Error Response:', data);
                throw new Error(data.error || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async createCapsule(capsuleData) {
        return await this.makeApiRequest('/capsules', 'POST', capsuleData);
    }

    async getCapsules() {
        return await this.makeApiRequest('/capsules');
    }

    async updateCapsule(id, capsuleData) {
        return await this.makeApiRequest(`/capsules/${id}`, 'PUT', capsuleData);
    }

    async deleteCapsule(id) {
        return await this.makeApiRequest(`/capsules/${id}`, 'DELETE');
    }

    // UI Methods
    showLandingPage() {
        document.getElementById('landing-page').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('features-section').classList.add('hidden');
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('auth-buttons').classList.remove('hidden');
    }

    showDashboard() {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('features-section').classList.add('hidden');
        document.getElementById('user-menu').classList.remove('hidden');
        document.getElementById('auth-buttons').classList.add('hidden');
        this.loadCapsules();
    }

    showFeatures() {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('features-section').classList.remove('hidden');
    }

    showAuthModal() {
        document.getElementById('auth-modal').classList.remove('hidden');
    }

    hideAuthModal() {
        document.getElementById('auth-modal').classList.add('hidden');
        this.resetAuthForms();
    }

    switchToRegister() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('verify-form').classList.add('hidden');
    }

    showVerificationForm(email) {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('verify-form').classList.remove('hidden');
        document.getElementById('verify-email-display').textContent = email;
    }

    switchToLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('verify-form').classList.add('hidden');
    }

    resetAuthForms() {
        document.getElementById('login-form-element').reset();
        document.getElementById('register-form-element').reset();
        document.getElementById('verify-form-element').reset();
    }

    showCapsuleModal(capsule = null) {
        const modal = document.getElementById('capsule-modal');
        const title = document.getElementById('capsule-modal-title');
        
        if (capsule) {
            title.innerHTML = '<i class="fas fa-edit mr-2"></i>Edit Time Capsule';
            this.populateCapsuleForm(capsule);
        } else {
            title.innerHTML = '<i class="fas fa-envelope mr-2"></i>Create Time Capsule';
            document.getElementById('capsule-form').reset();
        }
        
        modal.classList.remove('hidden');
    }

    hideCapsuleModal() {
        document.getElementById('capsule-modal').classList.add('hidden');
        document.getElementById('capsule-form').reset();
        
        // Reset file uploads
        this.selectedFiles = [];
        document.getElementById('file-preview').classList.add('hidden');
        document.getElementById('file-preview').innerHTML = '';
        document.getElementById('upload-progress').classList.add('hidden');
    }

    populateCapsuleForm(capsule) {
        document.getElementById('capsule-title').value = capsule.title || '';
        document.getElementById('capsule-occasion').value = capsule.occasion || '';
        document.getElementById('capsule-recipient').value = capsule.recipient_email || '';
        document.getElementById('capsule-message').value = capsule.message || '';
        document.getElementById('capsule-tags').value = capsule.tags ? capsule.tags.join(', ') : '';
        
        // Convert scheduled_date to datetime-local format
        if (capsule.scheduled_date) {
            const date = new Date(capsule.scheduled_date);
            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            document.getElementById('capsule-date').value = localDateTime;
        }
    }

    async loadCapsules() {
        this.showLoading();
        
        try {
            const response = await this.getCapsules();
            const capsules = response.data.capsules;
            
            if (capsules.length === 0) {
                document.getElementById('empty-state').classList.remove('hidden');
                document.getElementById('capsules-grid').classList.add('hidden');
            } else {
                document.getElementById('empty-state').classList.add('hidden');
                document.getElementById('capsules-grid').classList.remove('hidden');
                this.renderCapsules(capsules);
            }
        } catch (error) {
            this.showToast('Failed to load capsules: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    renderCapsules(capsules) {
        const grid = document.getElementById('capsules-grid');
        grid.innerHTML = '';

        capsules.forEach(capsule => {
            const capsuleCard = this.createCapsuleCard(capsule);
            grid.appendChild(capsuleCard);
        });
    }

    createCapsuleCard(capsule) {
        const card = document.createElement('div');
        card.className = 'glass-effect p-6 rounded-2xl hover:shadow-lg transition-shadow';
        
        const statusColor = {
            'pending': 'text-yellow-600 bg-yellow-100',
            'delivered': 'text-green-600 bg-green-100',
            'failed': 'text-red-600 bg-red-100'
        };

        const statusIcon = {
            'pending': 'fas fa-clock',
            'delivered': 'fas fa-check-circle',
            'failed': 'fas fa-exclamation-triangle'
        };

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-bold text-gray-800">${capsule.title}</h3>
                <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColor[capsule.status]}">
                    <i class="${statusIcon[capsule.status]} mr-1"></i>${capsule.status}
                </span>
            </div>
            
            <div class="space-y-2 mb-4">
                <p class="text-gray-600">
                    <i class="fas fa-envelope mr-2"></i>
                    To: ${capsule.recipient_email}
                </p>
                <p class="text-gray-600">
                    <i class="fas fa-calendar mr-2"></i>
                    ${new Date(capsule.scheduled_date).toLocaleDateString()}
                </p>
                ${capsule.occasion ? `
                    <p class="text-gray-600">
                        <i class="fas fa-gift mr-2"></i>
                        ${capsule.occasion}
                    </p>
                ` : ''}
            </div>
            
            <div class="bg-gray-50 p-3 rounded-lg mb-4">
                <p class="text-gray-700 text-sm">
                    ${capsule.message_preview || 'No preview available'}
                </p>
            </div>
            
            ${capsule.attachments && capsule.attachments.length > 0 ? `
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">
                        <i class="fas fa-paperclip mr-1"></i>
                        ${capsule.attachments.length} attachment(s)
                    </p>
                    <div class="grid grid-cols-3 gap-2">
                        ${capsule.attachments.slice(0, 3).map(url => `
                            <img src="${url}" class="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80" 
                                 onclick="app.viewImage('${url}')" alt="Attachment">
                        `).join('')}
                        ${capsule.attachments.length > 3 ? `
                            <div class="w-full h-16 bg-gray-200 rounded flex items-center justify-center text-gray-600 text-xs">
                                +${capsule.attachments.length - 3} more
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500">
                    Created: ${new Date(capsule.created_at).toLocaleDateString()}
                </span>
                <div class="space-x-2">
                    ${capsule.status === 'pending' ? `
                        <button onclick="app.showCapsuleModal(${JSON.stringify(capsule).replace(/"/g, '&quot;')})" 
                                class="text-indigo-600 hover:text-indigo-800">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteCapsuleConfirm('${capsule.id}')" 
                                class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        return card;
    }

    async deleteCapsuleConfirm(id) {
        if (confirm('Are you sure you want to delete this time capsule? This action cannot be undone.')) {
            this.showLoading();
            
            try {
                await this.deleteCapsule(id);
                this.showToast('Time capsule deleted successfully', 'success');
                this.loadCapsules();
            } catch (error) {
                this.showToast('Failed to delete capsule: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        }
    }

    setMinDate() {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 1); // Minimum 1 minute in the future
        const minDateTime = now.toISOString().slice(0, 16);
        document.getElementById('capsule-date').setAttribute('min', minDateTime);
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toast-icon');
        const messageEl = document.getElementById('toast-message');

        const icons = {
            success: 'fas fa-check-circle text-green-500',
            error: 'fas fa-exclamation-circle text-red-500',
            info: 'fas fa-info-circle text-blue-500'
        };

        icon.className = icons[type] || icons.info;
        messageEl.textContent = message;
        
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);
    }

    // File Upload Methods
    async uploadFile(file) {
        try {
            // Convert file to base64
            const base64Data = await this.fileToBase64(file);
            
            const requestData = {
                file_data: base64Data,
                file_name: file.name,
                content_type: file.type
            };

            const response = await fetch(`${this.apiUrl}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            // Return the S3 URL for the uploaded file
            const fileKey = result.data.file_key;
            return `https://${window.CONFIG.s3Bucket}.s3.amazonaws.com/${fileKey}`;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    async uploadMultipleFiles(files) {
        const uploadPromises = Array.from(files).map(file => this.uploadFile(file));
        const urls = await Promise.all(uploadPromises);
        return urls;
    }

    setupFileUpload() {
        const fileInput = document.getElementById('capsule-files');
        const dropZone = document.getElementById('file-drop-zone');
        const preview = document.getElementById('file-preview');
        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        const uploadStatus = document.getElementById('upload-status');

        // Click to upload
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(files) {
        const preview = document.getElementById('file-preview');
        const maxFiles = 5;
        const maxSize = 10 * 1024 * 1024; // 10MB

        // Validate files
        const validFiles = Array.from(files).filter(file => {
            if (!file.type.startsWith('image/')) {
                this.showToast(`${file.name} is not an image file`, 'error');
                return false;
            }
            if (file.size > maxSize) {
                this.showToast(`${file.name} is too large (max 10MB)`, 'error');
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        if (validFiles.length > maxFiles) {
            this.showToast(`Maximum ${maxFiles} files allowed`, 'error');
            return;
        }

        // Store files for later upload
        this.selectedFiles = validFiles;

        // Show preview
        preview.innerHTML = '';
        preview.classList.remove('hidden');

        validFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'relative group';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" class="w-full h-24 object-cover rounded-lg border border-gray-300">
                    <button type="button" onclick="app.removeFile(${index})" 
                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        ×
                    </button>
                    <p class="text-xs text-gray-600 mt-1 truncate">${file.name}</p>
                `;
                preview.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });
    }

    removeFile(index) {
        const preview = document.getElementById('file-preview');
        this.selectedFiles.splice(index, 1);
        
        if (this.selectedFiles.length === 0) {
            preview.classList.add('hidden');
            preview.innerHTML = '';
        } else {
            // Re-render preview
            this.handleFiles(this.selectedFiles);
        }
    }

    async uploadSelectedFiles() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            return [];
        }

        const progress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        const uploadStatus = document.getElementById('upload-status');

        progress.classList.remove('hidden');
        progressBar.style.width = '0%';
        uploadStatus.textContent = 'Uploading files...';

        try {
            const uploadedUrls = [];
            const totalFiles = this.selectedFiles.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = this.selectedFiles[i];
                uploadStatus.textContent = `Uploading ${file.name} (${i + 1}/${totalFiles})...`;
                
                const url = await this.uploadFile(file);
                uploadedUrls.push(url);
                
                const percentage = ((i + 1) / totalFiles) * 100;
                progressBar.style.width = `${percentage}%`;
            }

            uploadStatus.textContent = 'Upload complete!';
            setTimeout(() => {
                progress.classList.add('hidden');
            }, 2000);

            return uploadedUrls;
        } catch (error) {
            uploadStatus.textContent = 'Upload failed!';
            setTimeout(() => {
                progress.classList.add('hidden');
            }, 3000);
            throw error;
        }
    }

    viewImage(imageUrl) {
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        
        modalImage.src = imageUrl;
        modal.classList.remove('hidden');
    }

    closeImageModal() {
        const modal = document.getElementById('image-modal');
        modal.classList.add('hidden');
    }

    // Event Bindings
    bindEvents() {
        // Auth events
        document.getElementById('login-btn').addEventListener('click', () => {
            this.showAuthModal();
            this.switchToLogin();
        });

        document.getElementById('register-btn').addEventListener('click', () => {
            this.showAuthModal();
            this.switchToRegister();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('close-auth-modal').addEventListener('click', () => {
            this.hideAuthModal();
        });

        document.getElementById('switch-to-register').addEventListener('click', () => {
            this.switchToRegister();
        });

        document.getElementById('switch-to-login').addEventListener('click', () => {
            this.switchToLogin();
        });

        // Form events
        document.getElementById('login-form-element').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            this.showLoading();
            
            try {
                await this.login(email, password);
                this.hideAuthModal();
                this.showToast('Login successful!', 'success');
            } catch (error) {
                this.showToast('Login failed: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });

        document.getElementById('register-form-element').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            if (password !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }

            this.showLoading();
            
            try {
                await this.register(email, password);
                // Don't hide modal here, show verification form instead
            } catch (error) {
                this.showToast('Registration failed: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });

        // Verification form events
        document.getElementById('verify-form-element').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = document.getElementById('verify-code').value;
            const email = this.pendingVerificationEmail;

            if (!email) {
                this.showToast('No pending verification email found', 'error');
                return;
            }

            this.showLoading();
            
            try {
                await this.verifyEmail(email, code);
                this.hideAuthModal();
            } catch (error) {
                this.showToast('Verification failed: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });

        document.getElementById('resend-code-btn').addEventListener('click', async () => {
            const email = this.pendingVerificationEmail;
            
            if (!email) {
                this.showToast('No pending verification email found', 'error');
                return;
            }

            this.showLoading();
            
            try {
                await this.resendVerificationCode(email);
            } catch (error) {
                this.showToast('Failed to resend code: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });

        document.getElementById('back-to-login').addEventListener('click', () => {
            this.switchToLogin();
        });

        // Navigation events
        document.getElementById('get-started-btn').addEventListener('click', () => {
            if (this.currentUser) {
                this.showDashboard();
            } else {
                this.showAuthModal();
                this.switchToLogin();
            }
        });

        document.getElementById('learn-more-btn').addEventListener('click', () => {
            this.showFeatures();
        });

        // Capsule events
        document.getElementById('create-capsule-btn').addEventListener('click', () => {
            this.showCapsuleModal();
        });

        document.getElementById('close-capsule-modal').addEventListener('click', () => {
            this.hideCapsuleModal();
        });

        document.getElementById('capsule-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            this.showLoading();
            
            try {
                // Upload files first if any are selected
                let attachments = [];
                if (this.selectedFiles && this.selectedFiles.length > 0) {
                    attachments = await this.uploadSelectedFiles();
                }

                const formData = {
                    title: document.getElementById('capsule-title').value,
                    occasion: document.getElementById('capsule-occasion').value,
                    recipient_email: document.getElementById('capsule-recipient').value,
                    scheduled_date: new Date(document.getElementById('capsule-date').value).toISOString(),
                    message: document.getElementById('capsule-message').value,
                    tags: document.getElementById('capsule-tags').value
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0),
                    attachments: attachments
                };

                await this.createCapsule(formData);
                this.hideCapsuleModal();
                this.showToast('Time capsule created successfully!', 'success');
                this.loadCapsules();
                
                // Reset file selection
                this.selectedFiles = [];
                document.getElementById('file-preview').classList.add('hidden');
                document.getElementById('file-preview').innerHTML = '';
            } catch (error) {
                this.showToast('Failed to create capsule: ' + error.message, 'error');
            } finally {
                this.hideLoading();
            }
        });

        // Close modals on outside click
        document.getElementById('auth-modal').addEventListener('click', (e) => {
            if (e.target.id === 'auth-modal') {
                this.hideAuthModal();
            }
        });

        document.getElementById('capsule-modal').addEventListener('click', (e) => {
            if (e.target.id === 'capsule-modal') {
                this.hideCapsuleModal();
            }
        });

        // Image modal events
        document.getElementById('close-image-modal').addEventListener('click', () => {
            this.closeImageModal();
        });

        document.getElementById('image-modal').addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                this.closeImageModal();
            }
        });
    }
} 