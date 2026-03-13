# Smart Parking Mobile App

This is the mobile version of the Smart Parking system, built with React Native and Expo.

## Prerequisites

- Node.js (LTS)
- Expo Go app on your phone (for testing)
- A running backend (from the `backend` folder)

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API URL:**
   Open `app.json` and update the `API_BASE_URL` in the `extra` section with your machine's local IP address (e.g., `http://192.168.x.x:5000`). **Do not use localhost**, as physical mobile devices cannot reach it.

3. **Run the app:**
   ```bash
   npx expo start
   ```

4. **Scan the QR code:**
   Open the Expo Go app on Android or the Camera app on iOS and scan the QR code displayed in your terminal.

## Key Changes from Website to Mobile App

- **Navigation:** Replaced `react-router-dom` with `@react-navigation/native`. Used a Bottom Tab bar for primary navigation.
- **Mapping:** Replaced Mapbox GL JS with `react-native-maps`. Mapbox GL JS is not natively compatible with React Native without complex wrappers; `react-native-maps` provides better performance on mobile.
- **Geofencing:** Implemented manual geofencing using `@turf/turf` to check if a user is inside a parking zone, similar to the web implementation but optimized for mobile GPS.
- **UI Components:** Replaced HTML elements (`div`, `h1`, `button`) with React Native components (`View`, `Text`, `TouchableOpacity`).
- **Styling:** Replaced Tailwind CSS classes with React Native `StyleSheet`. Used `expo-linear-gradient` for consistent backgrounds.
- **Authentication:** Used Firebase's standard email/password authentication. 
- **Environment Variables:** Used `expo-constants` to manage API keys and URLs safely.

## Troubleshooting

- **API Connection:** If the app cannot connect to the backend, ensure your phone and computer are on the same Wi-Fi network and that your computer's firewall allows traffic on port 5000.
- **Map Loading:** Ensure you have Google Maps installed on Android or that Apple Maps is available on iOS.
