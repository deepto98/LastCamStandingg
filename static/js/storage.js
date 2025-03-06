class StorageManager {
    constructor() {
        this.storageBar = document.getElementById('storageBar');
        this.updateStorageInfo();
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

    updateStorageBar(storage) {
        if (!this.storageBar) return;

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
