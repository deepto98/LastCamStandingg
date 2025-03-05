class Gallery {
    constructor() {
        this.galleryContainer = document.getElementById('galleryGrid');
        this.storageBar = document.getElementById('storageBar');
        this.mediaIds = this.getStoredMediaIds();
        this.loadMedia();
        this.setupRefresh();
    }

    setupRefresh() {
        setInterval(() => this.loadMedia(), 30000); // Refresh every 30 seconds
    }

    getStoredMediaIds() {
        try {
            return JSON.parse(localStorage.getItem('lastCamMedia') || '[]');
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return [];
        }
    }

    storeMediaId(id) {
        try {
            const ids = this.getStoredMediaIds();
            if (!ids.includes(id)) {
                ids.push(id);
                localStorage.setItem('lastCamMedia', JSON.stringify(ids));
            }
        } catch (e) {
            console.error('Error storing in localStorage:', e);
        }
    }

    async loadMedia() {
        try {
            const params = new URLSearchParams();
            this.mediaIds.forEach(id => params.append('ids[]', id));

            const response = await fetch(`/api/media?${params.toString()}`);
            const data = await response.json();

            // Update UI with media files and storage info
            this.renderGallery(data.files);
            this.updateStorageBar(data.storage);

            // Clean up expired media from localStorage
            this.cleanupExpiredMedia(data.files);
        } catch (error) {
            console.error('Error loading media:', error);
        }
    }

    cleanupExpiredMedia(activeFiles) {
        const activeIds = activeFiles.map(file => file.id);
        this.mediaIds = this.mediaIds.filter(id => activeIds.includes(id));
        localStorage.setItem('lastCamMedia', JSON.stringify(this.mediaIds));
    }

    renderGallery(mediaFiles) {
        this.galleryContainer.innerHTML = '';

        mediaFiles.forEach(media => {
            const expirationTime = new Date(media.expiration_time);
            const timeLeft = this.getTimeLeft(expirationTime);

            const card = document.createElement('div');
            card.className = 'media-card';
            card.innerHTML = `
                <div class="media-preview-container">
                    ${media.type === 'video' 
                        ? `<video class="media-preview" src="${media.url}" controls></video>`
                        : `<img class="media-preview" src="${media.url}" alt="Captured media">`
                    }
                </div>
                <div class="media-info">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-primary">${media.type}</span>
                        <span class="expiration-badge">${timeLeft}</span>
                    </div>
                    <div class="mt-2">
                        <a href="${media.url}" class="btn btn-sm btn-primary" download>
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>
            `;

            this.galleryContainer.appendChild(card);
        });

        if (mediaFiles.length === 0) {
            this.galleryContainer.innerHTML = `
                <div class="text-center text-muted p-5">
                    <i class="fas fa-camera fa-3x mb-3"></i>
                    <h5>No media files yet</h5>
                    <p>Capture some photos or videos to see them here!</p>
                </div>
            `;
        }
    }

    getTimeLeft(expirationTime) {
        const now = new Date();
        const diff = expirationTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours <= 0 && minutes <= 0) return 'Expired';
        return `${hours}h ${minutes}m left`;
    }

    updateStorageBar(storage) {
        const percentage = Math.min(storage.percentage, 100);
        this.storageBar.style.width = `${percentage}%`;
        this.storageBar.setAttribute('aria-valuenow', percentage);

        // Update the storage text
        const usedMB = (storage.used / (1024 * 1024)).toFixed(1);
        const totalMB = (storage.total / (1024 * 1024)).toFixed(1);
        document.querySelector('.storage-meter small').textContent = 
            `${usedMB}MB used of ${totalMB}MB limit`;
    }
}

// Add this to camera.js success handler
window.storeMediaId = function(id) {
    try {
        const ids = JSON.parse(localStorage.getItem('lastCamMedia') || '[]');
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem('lastCamMedia', JSON.stringify(ids));
        }
    } catch (e) {
        console.error('Error storing media ID:', e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});