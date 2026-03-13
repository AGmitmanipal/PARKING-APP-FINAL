import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from './firebase';

const getBaseUrl = () => {
    // Try to get from Expo config
    let url = Constants.expoConfig?.extra?.API_BASE_URL;

    if (!url) {
        console.whelloarn('API_BASE_URL not found in Expo config. Using fallback URL.');
        url = 'https://backend-1-9tzg.onrender.com';
    }

    // Remove trailing slash if present to avoid double slashes
    return url.replace(/\/$/, '');
};

const API_BASE_URL = getBaseUrl();

console.log(`🔌 API Service Initialized with Base URL: ${API_BASE_URL}`);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // Increased to 60s for slow cold starts (Render free tier)
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request Interceptor: Add Auth Token
api.interceptors.request.use(
    async (config) => {
        try {
            const user = auth.currentUser;
            if (user) {
                const token = await user.getIdToken();
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error getting auth token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Error Handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Server responded with a status code outside 2xx
            console.error('API Error Response:', error.response.status, error.response.data);
            if (error.response.status === 401) {
                // Handle unauthorized (optional: trigger logout)
                console.warn('Unauthorized access. Token might be expired.');
            }
        } else if (error.request) {
            // Request made but no response received
            console.error('API No Response:', error.request);
        } else {
            // Error setting up request
            console.error('API Setup Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
