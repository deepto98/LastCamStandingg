class Gallery {
    constructor() {
        this.galleryContainer = document.getElementById('galleryGrid');
        this.storageBar = document.getElementById('storageBar');
        this.loadMedia();
        this.setupRefresh();
    }

    setupRefresh() {
        setInterval(() => this.loadMedia(), 30000); // Refresh every 30 seconds
    }

    async loadMedia() {
        try {
            const response = await fetch('/api/media');
            const mediaFiles = await response.json();
            this.renderGallery(mediaFiles);
            this.updateStorageBar(mediaFiles);
        } catch (error) {
            console.error('Error loading media:', error);
        }
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

    updateStorageBar(mediaFiles) {
        const totalSize = mediaFiles.reduce((acc, media) => acc + media.size, 0);
        const percentage = (totalSize / (100 * 1024 * 1024)) * 100;
        
        this.storageBar.style.width = `${percentage}%`;
        this.storageBar.setAttribute('aria-valuenow', percentage);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Gallery();
});
