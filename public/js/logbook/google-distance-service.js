/**
 * Google Distance Service
 * 
 * Calculates distances between addresses using Google Maps Geocoding and Distance Matrix APIs.
 * Implements caching to minimize API calls.
 * 
 * @module google-distance-service
 */

/**
 * Google Distance Service Class
 * 
 * Handles geocoding and distance calculations with caching support.
 */
class GoogleDistanceService {
    /**
     * Creates a new GoogleDistanceService instance
     * 
     * @param {string} apiKey - Google Maps API key
     * @param {Object} options - Configuration options
     * @param {boolean} options.useLocalStorageCache - Whether to persist cache to localStorage (default: false)
     * @param {number} options.cacheExpiryHours - Cache expiry in hours (default: 24)
     * @param {number} options.maxRetries - Maximum retry attempts for API calls (default: 3)
     */
    constructor(apiKey, options = {}) {
        // Get API key from parameter, global config, or window variable
        this.apiKey = apiKey || window.GOOGLE_MAPS_API_KEY || (window.googleMapsConfig && window.googleMapsConfig.apiKey);
        
        if (!this.apiKey) {
            throw new Error('Google Maps API key is required. Provide via constructor, window.GOOGLE_MAPS_API_KEY, or window.googleMapsConfig.apiKey');
        }

        this.useLocalStorageCache = options.useLocalStorageCache || false;
        this.cacheExpiryHours = options.cacheExpiryHours || 24;
        this.maxRetries = options.maxRetries || 3;

        // In-memory cache: Map<address, { distanceKm, timestamp }>
        this.distanceCache = new Map();
        
        // Geocoding cache: Map<address, { lat, lng }>
        this.geocodeCache = new Map();
    }

    /**
     * Gets cache key for distance lookup
     * @param {string} homeAddress - Home address
     * @param {string} clientAddress - Client address
     * @returns {string} Cache key
     */
    _getCacheKey(homeAddress, clientAddress) {
        return `gmaps_distance_${homeAddress}_${clientAddress}`;
    }

    /**
     * Gets cached distance from localStorage
     * @param {string} key - Cache key
     * @returns {number|null} Cached distance in km, or null if not found/expired
     */
    _getCachedDistance(key) {
        if (!this.useLocalStorageCache) {
            return null;
        }

        try {
            const cached = localStorage.getItem(key);
            if (!cached) {
                return null;
            }

            const { distanceKm, timestamp } = JSON.parse(cached);
            const expiryTime = timestamp + (this.cacheExpiryHours * 60 * 60 * 1000);
            
            if (Date.now() > expiryTime) {
                localStorage.removeItem(key);
                return null;
            }

            return distanceKm;
        } catch (error) {
            console.warn('Error reading distance cache:', error);
            return null;
        }
    }

    /**
     * Saves distance to localStorage cache
     * @param {string} key - Cache key
     * @param {number} distanceKm - Distance in kilometers
     */
    _saveCachedDistance(key, distanceKm) {
        if (!this.useLocalStorageCache) {
            return;
        }

        try {
            const cacheData = {
                distanceKm,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Error saving distance cache:', error);
        }
    }

    /**
     * Geocodes an address to coordinates
     * 
     * @param {string} address - Address to geocode
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<{lat: number, lng: number}>} Coordinates
     * @throws {Error} If geocoding fails
     */
    async _geocodeAddress(address, retryCount = 0) {
        // Check cache first
        if (this.geocodeCache.has(address)) {
            return this.geocodeCache.get(address);
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'OK' && data.results && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                const coords = {
                    lat: location.lat,
                    lng: location.lng
                };
                
                // Cache the result
                this.geocodeCache.set(address, coords);
                return coords;
            } else if (data.status === 'ZERO_RESULTS') {
                throw new Error(`Failed to geocode address: ${address}. No results found.`);
            } else if (data.status === 'OVER_QUERY_LIMIT' && retryCount < this.maxRetries) {
                // Rate limited - wait and retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this._geocodeAddress(address, retryCount + 1);
            } else {
                throw new Error(`Failed to geocode address: ${address}. Status: ${data.status}`);
            }
        } catch (error) {
            if (retryCount < this.maxRetries && !error.message.includes('Failed to geocode')) {
                // Retry on network errors
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this._geocodeAddress(address, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Calculates distance using Distance Matrix API
     * 
     * @param {string} origin - Origin address
     * @param {string} destination - Destination address
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<number>} Distance in kilometers
     * @throws {Error} If distance calculation fails
     */
    async _calculateDistance(origin, destination, retryCount = 0) {
        // Check in-memory cache
        const cacheKey = this._getCacheKey(origin, destination);
        if (this.distanceCache.has(cacheKey)) {
            const cached = this.distanceCache.get(cacheKey);
            // Check if cache is still valid (24 hours)
            const expiryTime = cached.timestamp + (this.cacheExpiryHours * 60 * 60 * 1000);
            if (Date.now() <= expiryTime) {
                return cached.distanceKm;
            }
        }

        // Check localStorage cache
        const cachedDistance = this._getCachedDistance(cacheKey);
        if (cachedDistance !== null) {
            // Also store in memory cache
            this.distanceCache.set(cacheKey, {
                distanceKm: cachedDistance,
                timestamp: Date.now()
            });
            return cachedDistance;
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=metric&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'OK' && data.rows && data.rows.length > 0) {
                const element = data.rows[0].elements[0];
                
                if (element.status === 'OK') {
                    // Distance is in meters, convert to kilometers
                    const distanceKm = element.distance.value / 1000;
                    
                    // Cache the result
                    this.distanceCache.set(cacheKey, {
                        distanceKm,
                        timestamp: Date.now()
                    });
                    this._saveCachedDistance(cacheKey, distanceKm);
                    
                    return distanceKm;
                } else {
                    throw new Error(`Distance Matrix API error: ${element.status}`);
                }
            } else if (data.status === 'OVER_QUERY_LIMIT' && retryCount < this.maxRetries) {
                // Rate limited - wait and retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this._calculateDistance(origin, destination, retryCount + 1);
            } else {
                throw new Error(`Distance Matrix API error: ${data.status}`);
            }
        } catch (error) {
            if (retryCount < this.maxRetries && !error.message.includes('Distance Matrix API error')) {
                // Retry on network errors
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this._calculateDistance(origin, destination, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Gets distances from home address to multiple client addresses
     * 
     * @param {string} homeAddress - Home/base address
     * @param {string[]} clientAddresses - Array of client addresses
     * @returns {Promise<Map<string, number>>} Map of address to distance in kilometers
     * @throws {Error} If any distance calculation fails
     * 
     * @example
     * const service = new GoogleDistanceService(apiKey);
     * const distances = await service.getDistances('123 Home St', ['456 Client Ave', '789 Business Rd']);
     * // Returns: Map { '456 Client Ave' => 15.5, '789 Business Rd' => 22.3 }
     */
    async getDistances(homeAddress, clientAddresses) {
        if (!homeAddress || typeof homeAddress !== 'string') {
            throw new Error('Home address is required and must be a string');
        }

        if (!Array.isArray(clientAddresses)) {
            throw new Error('Client addresses must be an array');
        }

        // Remove duplicates
        const uniqueAddresses = [...new Set(clientAddresses)];

        const distanceMap = new Map();

        // Process addresses in batches to avoid overwhelming the API
        // Distance Matrix API allows up to 25 destinations per request
        const batchSize = 25;
        
        for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
            const batch = uniqueAddresses.slice(i, i + batchSize);
            
            // Process batch sequentially to respect rate limits
            for (const address of batch) {
                try {
                    const distance = await this._calculateDistance(homeAddress, address);
                    distanceMap.set(address, distance);
                    
                    // Small delay between requests to avoid rate limiting
                    if (i + batch.length < uniqueAddresses.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (error) {
                    throw new Error(`Failed to calculate distance for address "${address}": ${error.message}`);
                }
            }
        }

        return distanceMap;
    }

    /**
     * Clears all caches (memory and localStorage)
     */
    clearCache() {
        this.distanceCache.clear();
        this.geocodeCache.clear();

        if (this.useLocalStorageCache) {
            try {
                const keys = Object.keys(localStorage);
                for (const key of keys) {
                    if (key.startsWith('gmaps_distance_')) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (error) {
                console.warn('Error clearing localStorage cache:', error);
            }
        }
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleDistanceService;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.GoogleDistanceService = GoogleDistanceService;
}

