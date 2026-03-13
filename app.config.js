import 'dotenv/config';

export default {
    "expo": {
        "name": "Smart Parking",
        "platforms": [
            "ios",
            "android"
        ],
        "slug": "smart-parking",
        "version": "1.0.0",
        "orientation": "portrait",
        "icon": "./assets/icon.png",
        "userInterfaceStyle": "light",
        "updates": {
        },
        "runtimeVersion": {
            "policy": "appVersion"
        },
        "newArchEnabled": true,
        "jsEngine": "hermes",
        "splash": {
            "image": "./assets/splash-icon.png",
            "resizeMode": "contain",
            "backgroundColor": "#ffffff"
        },
        "ios": {
            "supportsTablet": true,
            "bundleIdentifier": "com.smartparking.app",
            "config": {
                "usesNonExemptEncryption": false
            }
        },
        "android": {
            "package": "com.smartparking.app",
            "adaptiveIcon": {
                "foregroundImage": "./assets/adaptive-icon.png",
                "backgroundColor": "#ffffff"
            },
            "config": {
                "googleMaps": {
                    "apiKey": process.env.FIREBASE_API_KEY
                }
            }
        },
        "web": {
            "favicon": "./assets/favicon.png"
        },
        "extra": {
            "eas": {
                "projectId": "1ce69022-8b2a-4050-96ce-e23c9dc3a0bf"
            },

            "FIREBASE_API_KEY": process.env.FIREBASE_API_KEY,
            "FIREBASE_AUTH_DOMAIN": process.env.FIREBASE_AUTH_DOMAIN,
            "FIREBASE_PROJECT_ID": process.env.FIREBASE_PROJECT_ID,
            "FIREBASE_STORAGE_BUCKET": process.env.FIREBASE_STORAGE_BUCKET,
            "FIREBASE_MESSAGING_SENDER_ID": process.env.FIREBASE_MESSAGING_SENDER_ID,
            "FIREBASE_APP_ID": process.env.FIREBASE_APP_ID,
            "FIREBASE_MEASUREMENT_ID": process.env.FIREBASE_MEASUREMENT_ID,
            "API_BASE_URL": process.env.API_BASE_URL,
            "GOOGLE_WEB_CLIENT_ID": process.env.GOOGLE_WEB_CLIENT_ID,
            "MAPBOX_ACCESS_TOKEN": process.env.MAPBOX_ACCESS_TOKEN
        },
        "plugins": [
            [
                "expo-location",
                {
                    "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location to detect when you are inside a parking zone.",
                    "locationAlwaysPermission": "Allow $(PRODUCT_NAME) to use your location to detect when you are inside a parking zone.",
                    "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location to detect when you are inside a parking zone.",
                    "isAndroidBackgroundLocationEnabled": false,
                    "isAndroidForegroundServiceEnabled": true
                }
            ],
            "@react-native-community/datetimepicker",
            [
                "@rnmapbox/maps",
                {
                    "rnmapbox": {
                        "useV11": true
                    },
                    "downloadToken": process.env.MAPBOX_ACCESS_TOKEN
                }
            ]
        ]
    }
};
