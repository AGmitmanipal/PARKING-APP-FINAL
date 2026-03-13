import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Modal,
    Platform,
    Keyboard,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { theme } from '../theme';
import { Navigation, X, LogOut as LogoutIcon, ArrowLeft, CornerUpRight, Menu } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useGeofencing } from '../hooks/useGeofencing';

// Initialize Mapbox
const MAPBOX_TOKEN = Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN;
Mapbox.setAccessToken(MAPBOX_TOKEN);

const MapScreen = ({ route, navigation }) => {
    const { logout } = useAuth();
    const isFocused = useIsFocused();
    const { zone: initialZone, initialLocation } = route?.params || {};
    const [zone, setZone] = useState(initialZone);

    useEffect(() => {
        if (route?.params?.zone) {
            console.log("MapScreen: received new zone param", route.params.zone._id);
            setZone(route.params.zone);
            setDirectionsRoute(null); // Clear previous directions
            lastFetchLocation.current = null; // Clear last fetch location
        }
    }, [route?.params?.zone]);


    // Use the robust geofencing hook
    // If initialLocation provided (from Dashboard Park Now), start as INSIDE to avoid 3s friction
    const { isInside: isInsideZone, userLocation, debugStatus } = useGeofencing(zone, {
        initialInside: !!initialLocation,
        initialLocation: initialLocation
    });

    useEffect(() => {
        console.log("📍 Geofence Status:", debugStatus);
    }, [debugStatus]);

    const [showModal, setShowModal] = useState(false);
    const [toTime, setToTime] = useState(new Date(Date.now() + 3600000)); // 1 hour later
    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerMode, setPickerMode] = useState('date');
    const [followUser, setFollowUser] = useState(false);
    const [directionsRoute, setDirectionsRoute] = useState(null);

    const lastFetchLocation = useRef(null);

    // Update directions when user moves, if directions are active
    useEffect(() => {
        if (!directionsRoute || !userLocation) return;

        // Calculate distance from last fetch to avoid spamming API
        // If we haven't fetched yet (shouldn't happen if directionsRoute is set), default to max distance
        const dist = lastFetchLocation.current
            ? getDistanceFromLatLonInM(
                userLocation.latitude, userLocation.longitude,
                lastFetchLocation.current.latitude, lastFetchLocation.current.longitude
            )
            : 1000;

        // Only update if moved more than 10 meters
        if (dist > 10) {
            fetchDirections(true);
        }
    }, [userLocation]);

    const cameraRef = useRef(null);
    // API_BASE_URL is handled by api service

    // 1. Polling Zone Data
    useEffect(() => {
        if (!zone?._id || !isFocused) return;

        const fetchZoneData = async () => {
            // ... existing polling logic ...
            try {
                const user = auth.currentUser;
                if (!user) return;
                const res = await api.get('/');
                const updated = res.data.find(z => z._id === zone._id);
                if (updated) setZone(updated);
            } catch (e) {
                console.error("Polling error", e);
            }
        };

        const interval = setInterval(fetchZoneData, 5000);
        return () => clearInterval(interval);
    }, [zone?._id, isFocused]);

    // Force Camera Update when Zone Changes
    useEffect(() => {
        if (cameraRef.current && zone?.polygon?.length > 0) {
            const center = getCenter();
            // Immediate update instead of slow flyTo animation for "snappy" feel
            cameraRef.current.setCamera({
                centerCoordinate: center,
                zoomLevel: 15,
                animationDuration: 0, // Instant
            });
        }
    }, [zone?._id]); // Trigger ONLY when ID changes (new zone selected)

    // 2. User Location & Geofencing handled by useGeofencing hook

    const showLoading = async (setter) => {
        setter(true);
        await new Promise(resolve => setTimeout(resolve, 50));
    };

    const handleReserve = async () => {
        try {
            console.log("👉 handleReserve initiated (v1.0.6)");
            if (typeof Keyboard !== 'undefined') Keyboard?.dismiss?.();

            if (!isInsideZone) return Alert.alert('Error', 'You must be inside the zone to park.');

            if (!toTime) return Alert.alert('Error', 'Select end time');
            if (toTime <= new Date()) return Alert.alert('Error', 'End time must be in the future');

            await showLoading(setLoading);
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'User not authenticated');
                return;
            }

            // api service automatically handles auth token
            const payload = {
                userId: user.uid,
                zoneId: zone._id,
                fromTime: new Date().toISOString(),
                toTime: toTime.toISOString()
            };
            const res = await api.post('/reserve', payload);

            if (res.status === 200 || res.status === 201) {
                Alert.alert('Success', 'Parked Successfully');
                setShowModal(false);
            } else {
                Alert.alert('Error', res.data.message || 'Parking Failed');
            }
        } catch (err) {
            console.error('CRITICAL: handleReserve Error:', err);
            if (err.stack) console.error('Stack:', err.stack);
            Alert.alert('Error', err.response?.data?.message || err.message || 'Server Error');
        } finally {
            setLoading(false);
        }
    };

    const locateMe = () => {
        if (userLocation && cameraRef.current) {
            setFollowUser(true);
            cameraRef.current.setCamera({
                centerCoordinate: [userLocation.longitude, userLocation.latitude],
                zoomLevel: 16,
                animationDuration: 1000,
            });
        }
    };

    const fetchDirections = async (isAutoUpdate = false) => {
        if (!userLocation || !zone) {
            if (!isAutoUpdate) Alert.alert("Location Error", "Waiting for your location...");
            return;
        }

        try {
            const center = getCenter();
            const start = [userLocation.longitude, userLocation.latitude];
            const end = center;

            // Use Mapbox Directions API
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`;

            const response = await fetch(url);
            const json = await response.json();

            if (json.routes && json.routes.length > 0) {
                const routeData = json.routes[0];
                setDirectionsRoute({
                    type: 'Feature',
                    geometry: routeData.geometry
                });

                // Update last fetch location
                lastFetchLocation.current = {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude
                };

                // Fit camera to show full route ONLY on initial fetch
                if (!isAutoUpdate && cameraRef.current) {
                    // Creating a bounding box roughly
                    const allCoords = routeData.geometry.coordinates;
                    const minLng = Math.min(...allCoords.map(c => c[0]));
                    const maxLng = Math.max(...allCoords.map(c => c[0]));
                    const minLat = Math.min(...allCoords.map(c => c[1]));
                    const maxLat = Math.max(...allCoords.map(c => c[1]));

                    cameraRef.current.fitBounds(
                        [maxLng, maxLat], // NorthEast
                        [minLng, minLat], // SouthWest
                        50, // padding
                        1000 // duration
                    );
                }

            } else {
                if (!isAutoUpdate) Alert.alert("Error", "No route found");
            }
        } catch (error) {
            console.error("Error fetching directions:", error);
            if (!isAutoUpdate) Alert.alert("Error", "Could not fetch directions");
        }
    };

    function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d * 1000;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    }

    // Create GeoJSON for the polygon
    const polygonGeoJSON = useMemo(() => {
        if (!zone || !zone.polygon) return null;
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [...zone.polygon.map(p => [Number(p.lng), Number(p.lat)]), [Number(zone.polygon[0].lng), Number(zone.polygon[0].lat)]]
                ]
            }
        };
    }, [zone]);

    // Calculate Center
    const getCenter = () => {
        if (zone && zone.polygon && zone.polygon.length > 0) {
            const lat = zone.polygon[0].lat;
            const lng = zone.polygon[0].lng;
            return [Number(lng), Number(lat)];
        }
        return [0, 0];
    };

    if (!zone) {
        return (
            <View style={styles.center}>
                <Text style={{ fontSize: 18, color: theme.colors.text, marginBottom: 20 }}>No zone selected</Text>
                <TouchableOpacity
                    style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        backgroundColor: theme.colors.primary,
                        borderRadius: 8
                    }}
                    onPress={() => navigation.navigate('Dashboard')}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const available = zone.available !== undefined ? zone.available : Math.max(0, (zone.capacity || 0) - ((zone.reserved || 0) + (zone.prebooked || 0)));
    const isFull = available <= 0;
    const canBook = !isFull && isInsideZone;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <ArrowLeft size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>{zone.name}</Text>
                            <Text style={styles.headerSubtitle}>
                                Available: <Text style={styles.bold}>{available}</Text> / Total: {zone.capacity}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerActions}>
                        <View style={[styles.badge, { backgroundColor: isInsideZone ? theme.colors.success + '20' : theme.colors.error + '20' }]}>
                            <Text style={[styles.badgeText, { color: isInsideZone ? theme.colors.success : theme.colors.error }]}>
                                {isInsideZone ? 'Inside' : 'Outside'}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.toggleDrawer?.()}>
                            <Menu size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.mapContainer}>
                <Mapbox.MapView style={styles.map} logoEnabled={false}>
                    <Mapbox.Camera
                        ref={cameraRef}
                        zoomLevel={15}
                        centerCoordinate={getCenter()}
                        animationMode={'flyTo'}
                        animationDuration={2000}
                        followUserLocation={followUser}
                        onUserTrackingModeChange={(e) => {
                            if (!e.nativeEvent.payload.followUserLocation) {
                                setFollowUser(false);
                            }
                        }}
                    />

                    <Mapbox.UserLocation
                        visible={true}
                        showsUserHeadingIndicator={true}
                    />

                    <Mapbox.ShapeSource id="zoneSource" shape={polygonGeoJSON}>
                        <Mapbox.FillLayer
                            id="zoneFill"
                            style={{
                                fillColor: theme.colors.primary,
                                fillOpacity: 0.2,
                                fillOutlineColor: theme.colors.primary,
                            }}
                        />
                        <Mapbox.LineLayer
                            id="zoneOutline"
                            style={{
                                lineColor: theme.colors.primary,
                                lineWidth: 2,
                            }}
                        />
                    </Mapbox.ShapeSource>

                    {directionsRoute && (
                        <Mapbox.ShapeSource id="routeSource" shape={directionsRoute}>
                            <Mapbox.LineLayer
                                id="routeLine"
                                style={{
                                    lineColor: '#3b82f6', // Bright Blue
                                    lineWidth: 4,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        </Mapbox.ShapeSource>
                    )}
                </Mapbox.MapView>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.fab} onPress={locateMe}>
                    <Navigation size={24} color={theme.colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.fab} onPress={fetchDirections}>
                    <CornerUpRight size={24} color={theme.colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.parkButton, !canBook && styles.disabledButton]}
                    disabled={!canBook}
                    onPress={() => setShowModal(true)}
                >
                    <Text style={styles.parkButtonText}>
                        {isFull ? 'Zone Full' : (!isInsideZone ? 'Outside Zone' : 'Park Here')}
                    </Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={showModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Park Spot</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <X size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Zone</Text>
                            <Text style={styles.modalValue}>{zone.name}</Text>

                            <Text style={[styles.modalLabel, { marginTop: 20 }]}>End Time</Text>
                            <TouchableOpacity
                                style={styles.timePickerButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.timePickerText}>
                                    {toTime.toLocaleString()}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={toTime}
                                    mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, selectedDate) => {
                                        if (event.type === 'dismissed') {
                                            setShowDatePicker(false);
                                            setPickerMode('date');
                                            return;
                                        }

                                        if (Platform.OS === 'android') {
                                            if (pickerMode === 'date') {
                                                const newDate = selectedDate || toTime;
                                                setToTime(newDate);
                                                setPickerMode('time');
                                            } else {
                                                setShowDatePicker(false);
                                                setPickerMode('date');
                                                if (selectedDate) setToTime(selectedDate);
                                            }
                                        } else {
                                            setShowDatePicker(false);
                                            if (selectedDate) setToTime(selectedDate);
                                        }
                                    }}
                                />
                            )}
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowModal(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleReserve}
                                disabled={loading}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {loading ? 'Parking...' : 'Confirm'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    menuButton: {
        padding: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    bold: {
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    mapContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    map: {
        flex: 1,
    },
    controls: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        gap: 15,
        zIndex: 20,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    parkButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    parkButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledButton: {
        backgroundColor: '#cbd5e1',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    modalBody: {
        marginBottom: 30,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    modalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    timePickerButton: {
        backgroundColor: '#f9fafb',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    timePickerText: {
        fontSize: 16,
        color: theme.colors.text,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontWeight: 'bold',
        color: theme.colors.textSecondary,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 12,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default MapScreen;
