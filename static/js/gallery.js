class Gallery {
    constructor() {
        this.galleryContainer = document.getElementById('galleryGrid');
        this.mediaIds = [];
        this.storageManager = new StorageManager();
        this.initializeFromLocalStorage();
        this.loadMedia();
        this.setupRefresh();
    }

    setupRefresh() {
        // Refresh media and storage info every 30 seconds
        setInterval(() => {
            this.loadMedia();
            this.storageManager.updateStorageInfo();
        }, 30000);
    }

    initializeFromLocalStorage() {
        try {
            const storedIds = localStorage.getItem('lastCamMedia');
            this.mediaIds = storedIds ? JSON.parse(storedIds) : [];
            if (!Array.isArray(this.mediaIds)) {
                console.error('Invalid media IDs in localStorage');
                this.mediaIds = [];
                localStorage.setItem('lastCamMedia', '[]');
            }
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            this.mediaIds = [];
            localStorage.setItem('lastCamMedia', '[]');
        }
    }

    async loadMedia() {
        try {
            // Only fetch media if we have IDs stored
            if (this.mediaIds.length === 0) {
                this.renderEmptyGallery();
                return;
            }

            const params = new URLSearchParams();
            this.mediaIds.forEach(id => params.append('ids[]', id));

            const response = await fetch(`/api/media?${params}`);
            const data = await response.json();

            // Update UI with media files
            this.renderGallery(data.files);

            // Clean up expired media from localStorage
            this.cleanupExpiredMedia(data.files);
        } catch (error) {
            console.error('Error loading media:', error);
            this.renderEmptyGallery();
        }
    }

    cleanupExpiredMedia(activeFiles) {
        const activeIds = activeFiles.map(file => file.id.toString());
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
            // Add click handler to navigate to media view page
            card.onclick = () => window.location.href = `/view/${media.id}`;

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