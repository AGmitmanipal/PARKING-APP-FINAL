import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export const useGeofencing = (zone, options = {}) => {
    // 1. Unified Sourced of Truth
    // We use a ref to hold everything mutable to prevent closure staleness in the watcher
    const stateRef = useRef({
        isInside: options.initialInside || false,
        bbox: null, // { minLat, maxLat, minLng, maxLng }
        zoneId: null
    });

    // 2. React State for UI
    const [isInside, setIsInside] = useState(options.initialInside || false);
    const [userLocation, setUserLocation] = useState(options.initialLocation?.coords || options.initialLocation || null);
    const [debugStatus, setDebugStatus] = useState('Init...');

    // 3. Calculate Bounding Box (Pure Math)
    // Runs whenever the zone changes.
    useEffect(() => {
        if (!zone?.polygon || zone.polygon.length < 3) {
            stateRef.current.bbox = null;
            return;
        }

        try {
            const lats = zone.polygon.map(p => Number(p.lat));
            const lngs = zone.polygon.map(p => Number(p.lng));

            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            stateRef.current.bbox = { minLat, maxLat, minLng, maxLng };
            stateRef.current.zoneId = zone._id;

            // console.log(`[Geofence] BBox: [${minLat}, ${minLng}] -> [${maxLat}, ${maxLng}]`);
        } catch (err) {
            console.error("[Geofence] Math Error:", err);
            stateRef.current.bbox = null;
        }
    }, [zone]);

    // 4. Pure Logic Function (No Side Effects inside)
    // Returns true/false based purely on coordinates
    const checkIsInside = (lat, lng, bbox) => {
        if (!bbox) return false;
        return (
            lat >= bbox.minLat &&
            lat <= bbox.maxLat &&
            lng >= bbox.minLng &&
            lng <= bbox.maxLng
        );
    };

    // 5. The Stable Location Processor
    // Defined once. Uses Refs. Never Re-renders.
    const processLocation = (location) => {
        if (!location?.coords) return;

        const { latitude, longitude } = location.coords;
        const { bbox, isInside: currentInside } = stateRef.current;

        // UI Update (Keep it snappy)
        setUserLocation(location.coords);

        if (!bbox) {
            setDebugStatus('No Zone');
            return;
        }

        // --- THE CORE LOGIC ---
        const nowInside = checkIsInside(latitude, longitude, bbox);

        if (nowInside !== currentInside) {
            console.log(`[Geofence] State Change: ${currentInside} -> ${nowInside}`);

            // 1. Update Ref (Immediate Source of Truth)
            stateRef.current.isInside = nowInside;

            // 2. Update React State (UI)
            setIsInside(nowInside);
        }

        // Debug text
        setDebugStatus(nowInside ? 'INSIDE' : 'OUTSIDE');
    };

    // 6. Watcher Lifecycle
    useEffect(() => {
        let subscription = null;

        const start = async () => {
            // If we have manual location (dashboard list view), do NOT subscribe to GPS
            // This saves massive resources when rendering the list of zones
            if (options.manualLocation) return;

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setDebugStatus('Perm Denied');
                return;
            }

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced, // Reduced from BestForNavigation
                    distanceInterval: 5, // Update every 5 meters (was 1)
                    timeInterval: 2000    // Update every 2 seconds (was 500ms)
                },
                (loc) => processLocation(loc)
            );
        };

        if (options.manualLocation) {
            processLocation(options.manualLocation);
        } else {
            start();
        }

        return () => {
            if (subscription) subscription.remove();
        };
    }, []); // Dependency Array is EMPTY -> Stable Listener

    // Manual Override Effect
    useEffect(() => {
        if (options.manualLocation) {
            processLocation(options.manualLocation);
        }
    }, [options.manualLocation]);

    return {
        isInside,
        userLocation,
        debugStatus
    };
};
