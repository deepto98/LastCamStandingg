class CameraApp {
    constructor() {
        this.videoElement = document.getElementById('videoElement');
        this.captureBtn = document.getElementById('captureBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.stream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.currentFacingMode = 'environment'; // Start with rear camera
        this.storageManager = new StorageManager();

        // Disable buttons until camera is initialized
        this.captureBtn.disabled = true;
        this.recordBtn.disabled = true;

        this.init();
    }

    async init() {
        try {
            // Check for secure context
            if (!window.isSecureContext) {
                throw new Error('Camera access requires HTTPS or localhost');
            }

            // Check for media devices support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support camera access');
            }

            // Check camera permission status
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            console.log('Camera permission status:', permissionStatus.state);

            if (permissionStatus.state === 'denied') {
                throw new Error('Camera access denied. Please grant camera permissions in your browser settings and reload the page.');
            }

            // Log all available devices
            console.log('Enumerating all media devices...');
            const devices = await navigator.mediaDevices.enumerateDevices();
            console.log('All available devices:', devices);

            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Available video devices:', videoDevices);

            if (videoDevices.length === 0) {
                this.showCameraPlaceholder('No camera detected. Please connect a camera or check your browser settings.');
                return;
            }

            // Add camera switch button if multiple cameras are available
            if (videoDevices.length > 1) {
                this.addCameraSwitchButton();
            }

            await this.initializeCamera();
            this.setupEventListeners();

        } catch (error) {
            console.error('Camera initialization error:', error);
            this.showCameraPlaceholder(error.message);
        }
    }

    addCameraSwitchButton() {
        const controlsDiv = document.querySelector('.camera-controls');
        const switchBtn = document.createElement('button');
        switchBtn.id = 'switchCameraBtn';
        switchBtn.className = 'control-btn';
        switchBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        switchBtn.onclick = () => this.switchCamera();
        controlsDiv.appendChild(switchBtn);
    }

    async switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';

        // Update video element classes for mirroring
        this.videoElement.classList.remove('front-camera', 'rear-camera');
        this.videoElement.classList.add(this.currentFacingMode === 'user' ? 'front-camera' : 'rear-camera');

        // Stop current stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // Reinitialize with new facing mode
        await this.initializeCamera();
    }

    showCameraPlaceholder(message) {
        this.videoElement.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'camera-placeholder';
        placeholder.innerHTML = `
            <div class="text-center p-5 bg-dark text-white rounded">
                <i class="fas fa-camera-slash fa-3x mb-3"></i>
                <h4>Camera Not Available</h4>
                <p class="mb-3">${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
        this.videoElement.parentNode.appendChild(placeholder);
    }

    async initializeCamera() {
        try {
            // Show loading state
            this.videoElement.style.backgroundColor = '#333';
            this.videoElement.insertAdjacentHTML('afterend',
                '<div id="cameraLoader" class="camera-loader">Accessing camera...</div>');

            // Calculate aspect ratio based on screen orientation
            const isPortrait = window.innerHeight > window.innerWidth;
            const aspectRatio = isPortrait ? 3/4 : 16/9;

            const constraints = {
                video: {
                    facingMode: this.currentFacingMode,
                    aspectRatio: aspectRatio,
                    width: { ideal: isPortrait ? 1080 : 1920 },
                    height: { ideal: isPortrait ? 1440 : 1080 }
                },
                audio: true
            };

            console.log('Requesting media with constraints:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Camera stream obtained successfully');

            this.videoElement.srcObject = this.stream;
            this.videoElement.muted = true; // Prevent audio feedback

            // Set initial camera orientation class
            this.videoElement.classList.remove('front-camera', 'rear-camera');
            this.videoElement.classList.add(this.currentFacingMode === 'user' ? 'front-camera' : 'rear-camera');

            // Remove loader and enable buttons on success
            const loader = document.getElementById('cameraLoader');
            if (loader) loader.remove();

            this.captureBtn.disabled = false;
            this.recordBtn.disabled = false;

            // Handle stream ready state
            this.videoElement.onloadedmetadata = () => {
                console.log('Video element metadata loaded');
                this.videoElement.play();
            };

        } catch (error) {
            let errorMessage = 'Unable to access camera.';

            switch (error.name) {
                case 'NotAllowedError':
                    errorMessage = 'Camera access denied. Please grant camera permissions and reload the page.';
                    break;
                case 'NotFoundError':
                    errorMessage = 'No camera device found. Please check your camera connection.';
                    break;
                case 'NotReadableError':
                    errorMessage = 'Camera is in use by another application.';
                    break;
                case 'OverconstrainedError':
                    // Try fallback with lower constraints
                    console.log('Camera constraints not met, trying fallback options...');
                    await this.initializeWithFallback();
                    return;
            }
            this.showError(errorMessage);
        }
    }

    async initializeWithFallback() {
        try {
            // Basic constraints as fallback
            const fallbackConstraints = {
                video: {
                    facingMode: this.currentFacingMode
                },
                audio: true
            };
            this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            this.videoElement.srcObject = this.stream;
            this.videoElement.muted = true;

            this.captureBtn.disabled = false;
            this.recordBtn.disabled = false;
        } catch (error) {
            console.error('Fallback camera access failed:', error);
            this.showError('Could not access camera with fallback options.');
        }
    }

    showError(errorMessage){
        this.showCameraPlaceholder(errorMessage);
    }

    setupEventListeners() {
        this.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.recordBtn.addEventListener('click', () => this.toggleRecording());

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRecording) {
                this.stopRecording();
            }
        });

        // Handle stream ended
        if (this.stream) {
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.showCameraPlaceholder('Camera disconnected');
                this.captureBtn.disabled = true;
                this.recordBtn.disabled = true;
            });
        }
    }

    async capturePhoto() {
        if (!this.stream) {
            this.showError('Camera not initialized');
            return;
        }

        try {
            // Add capturing animation
            this.captureBtn.classList.add('capturing');
            setTimeout(() => this.captureBtn.classList.remove('capturing'), 300);

            const canvas = document.createElement('canvas');
            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;

            const ctx = canvas.getContext('2d');

            // If using front camera, flip the image horizontally before saving
            if (this.currentFacingMode === 'user') {
                ctx.scale(-1, 1);
                ctx.translate(-canvas.width, 0);
            }

            ctx.drawImage(this.videoElement, 0, 0);

            canvas.toBlob(async (blob) => {
                await this.uploadMedia(blob, 'image');
            }, 'image/jpeg', 0.95);
        } catch (error) {
            console.error('Error capturing photo:', error);
            this.showError('Failed to capture photo');
        }
    }

    toggleRecording() {
        if (!this.stream) {
            this.showCameraPlaceholder('Camera not initialized');
            return;
        }

        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        try {
            this.recordedChunks = [];
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus'
            };

            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                await this.uploadMedia(blob, 'video');
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordBtn.classList.add('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-stop"></i>';

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showCameraPlaceholder('Failed to start recording');
        }
    }

    stopRecording() {
        try {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
                this.isRecording = false;
                this.recordBtn.classList.remove('recording');
                this.recordBtn.innerHTML = '<i class="fas fa-video"></i>';
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showCameraPlaceholder('Failed to stop recording');
        }
    }

    async uploadMedia(blob, type) {
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('type', type);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Store the media ID in localStorage
                const mediaId = data.url.split('/').pop();
                try {
                    const ids = JSON.parse(localStorage.getItem('lastCamMedia') || '[]');
                    if (!ids.includes(mediaId)) {
                        ids.push(mediaId);
                        localStorage.setItem('lastCamMedia', JSON.stringify(ids));
                    }
                } catch (e) {
                    console.error('Error storing media ID:', e);
                }

                // Update storage info
                await this.storageManager.updateStorageInfo();

                // Show success toast
                this.showSuccess(data.url);
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showError('Failed to upload media: ' + error.message);
        }
    }

    showSuccess(url) {
        const mediaId = url.split('/').pop();
        try {
            const ids = JSON.parse(localStorage.getItem('lastCamMedia') || '[]');
            if (!ids.includes(mediaId)) {
                ids.push(mediaId);
                localStorage.setItem('lastCamMedia', JSON.stringify(ids));
            }
        } catch (e) {
            console.error('Error storing media ID:', e);
        }

        const toast = document.createElement('div');
        toast.className = 'toast show position-fixed bottom-0 end-0 m-3 bg-success text-white';
        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <strong class="me-auto">Success!</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                Media uploaded successfully!
                <a href="/view/${mediaId}" class="btn btn-light btn-sm mt-2">
                    <i class="fas fa-eye"></i> View Media
                </a>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CameraApp();
});