class Gallery {
    constructor() {
        this.galleryContainer = document.getElementById('galleryGrid');
        this.storageBar = document.getElementById('storageBar');
        this.mediaIds = [];
        this.initializeFromLocalStorage();
        this.loadMedia();
        this.setupRefresh();
    }

    setupRefresh() {
        setInterval(() => this.loadMedia(), 30000); // Refresh every 30 seconds
    }

    initializeFromLocalStorage() {
        try {
            this.mediaIds = JSON.parse(localStorage.getItem('lastCamMedia') || '[]');
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            this.mediaIds = [];
        }
    }

    async loadMedia() {
        try {
            // Only fetch media if we have IDs stored
            if (this.mediaIds.length === 0) {
                this.renderEmptyGallery();
                await this.updateStorageInfo();
                return;
            }

            const params = new URLSearchParams();
            this.mediaIds.forEach(id => params.append('ids[]', id));

            const response = await fetch(`/api/media?${params}`);
            const data = await response.json();

            this.renderGallery(data.files);
            this.updateStorageBar(data.storage);

            // Clean up expired media from localStorage
            this.cleanupExpiredMedia(data.files);
        } catch (error) {
            console.error('Error loading media:', error);
            this.renderEmptyGallery();
        }
    }

    async updateStorageInfo() {
        try {
            const response = await fetch('/api/media');
            const data = await response.json();
            this.updateStorageBar(data.storage);
        } catch (error) {
            console.error('Error updating storage info:', error);
        }
    }

    cleanupExpiredMedia(activeFiles) {
        const activeIds = activeFiles.map(file => file.id);
        this.mediaIds = this.mediaIds.filter(id => activeIds.includes(id));
        localStorage.setItem('lastCamMedia', JSON.stringify(this.mediaIds));
    }

    renderEmptyGallery() {
        this.galleryContainer.innerHTML = `
            <div class="text-center text-muted p-5">
                <i class="fas fa-camera fa-3x mb-3"></i>
                <h5>No media files yet</h5>
                <p>Capture some photos or videos to see them here!</p>
            </div>
        `;
    }

    renderGallery(mediaFiles) {
        if (!mediaFiles.length) {
            this.renderEmptyGallery();
            return;
        }

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

document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});