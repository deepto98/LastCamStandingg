class CameraApp {
    constructor() {
        this.videoElement = document.getElementById('videoElement');
        this.captureBtn = document.getElementById('captureBtn');
        this.recordBtn = document.getElementById('recordBtn');
        this.stream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;

        // Check if we're in a secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
            this.showError('Camera access requires HTTPS. Please use a secure connection.');
            return;
        }

        this.checkMediaSupport();
        this.initializeCamera();
        this.setupEventListeners();
    }

    checkMediaSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Your browser does not support camera access.');
            return false;
        }
        return true;
    }

    async initializeCamera() {
        try {
            // Show loading state
            this.videoElement.style.backgroundColor = '#333';
            this.videoElement.style.position = 'relative';
            this.videoElement.insertAdjacentHTML('afterend',
                '<div id="cameraLoader" class="camera-loader">Accessing camera...</div>');

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: true
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            this.videoElement.muted = true; // Mute the video element to prevent audio feedback

            // Remove loader on success
            const loader = document.getElementById('cameraLoader');
            if (loader) loader.remove();

            // Enable buttons
            this.captureBtn.disabled = false;
            this.recordBtn.disabled = false;

        } catch (error) {
            console.error('Camera access error:', error);
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
                    errorMessage = 'Could not find a suitable camera. Trying fallback options...';
                    // Try fallback with lower constraints
                    this.initializeWithFallback();
                    return;
            }
            this.showError(errorMessage);
        }
    }

    async initializeWithFallback() {
        try {
            // Fallback to basic constraints
            const fallbackConstraints = {
                video: true,
                audio: true
            };
            this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            this.videoElement.srcObject = this.stream;
        } catch (error) {
            console.error('Fallback camera access failed:', error);
            this.showError('Could not access camera with fallback options.');
        }
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
    }

    async capturePhoto() {
        if (!this.stream) {
            this.showError('Camera not initialized');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        canvas.getContext('2d').drawImage(this.videoElement, 0, 0);

        try {
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
            this.showError('Camera not initialized');
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
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm;codecs=vp8,opus'
            });

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
            this.showError('Failed to start recording');
        }
    }

    stopRecording() {
        try {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.recordBtn.classList.remove('recording');
            this.recordBtn.innerHTML = '<i class="fas fa-video"></i>';
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showError('Failed to stop recording');
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
                this.showSuccess(data.url);
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showError('Failed to upload media: ' + error.message);
        }
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast show position-fixed bottom-0 end-0 m-3 bg-danger text-white';
        toast.innerHTML = `
            <div class="toast-header bg-danger text-white">
                <strong class="me-auto">Error</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    showSuccess(url) {
        // Store the media ID in localStorage
        const mediaId = url.split('/').pop();
        window.storeMediaId(mediaId);

        const toast = document.createElement('div');
        toast.className = 'toast show position-fixed bottom-0 end-0 m-3 bg-success text-white';
        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <strong class="me-auto">Success!</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                Media uploaded successfully!
                <a href="${url}" target="_blank" class="btn btn-light btn-sm mt-2">View</a>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CameraApp();
});