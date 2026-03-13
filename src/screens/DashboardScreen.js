import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Platform,
    Animated,
    Dimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { theme } from '../theme';
import { MapPin, Car, BookOpen, RefreshCw, Menu } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useGeofencing } from '../hooks/useGeofencing';

const ZoneCard = React.memo(({ item, userLocation, navigation }) => {
    const { isInside } = useGeofencing(item, { manualLocation: userLocation });

    const available = item.available !== undefined ? item.available : (item.capacity - item.reserved - item.prebooked);
    const isFull = available <= 0;

    // Status Logic
    const isLocating = !userLocation;
    const canPark = isInside && !isFull && !isLocating;

    // Button Text Logic
    let buttonText = 'Park Now';
    if (isLocating) buttonText = 'Locating...';
    else if (isFull) buttonText = 'Full';
    else if (!isInside) buttonText = 'Too Far';

    return (
        <View style={styles.zoneCard}>
            <View style={styles.zoneHeader}>
                <Text style={styles.zoneName}>{item.name || 'Unnamed Zone'}</Text>
                <MapPin size={20} color={theme.colors.primary} />
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Car size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.statLabel}>Parked: {item.reserved || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <BookOpen size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.statLabel}>Booked: {item.prebooked || 0}</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.availableText}>
                    Available:{' '}
                    <Text style={[styles.availableValue, { color: isFull ? theme.colors.error : theme.colors.success }]}>
                        {isFull ? 'Full' : available}
                    </Text>
                </Text>
                <TouchableOpacity
                    style={[styles.parkButton, isFull && styles.disabledButton]}
                    disabled={isFull}
                    onPress={() => {
                        console.log("Park Now clicked for:", item.name);
                        navigation.navigate('Map', { zone: item, initialLocation: userLocation });
                    }}
                >
                    <Text style={styles.parkButtonText}>
                        {isFull ? 'Full' : 'Park Now'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for performance
    // Only re-render if:
    // 1. Zone ID changed (different item)
    // 2. Zone availability stats changed
    // 3. User location status changed (located vs not located) - specific coords don't matter as much for the card text unless threshold crossed
    // 4. Inside/Outside status changed (handled by hook, but prop change triggers)

    const itemChanged =
        prevProps.item._id !== nextProps.item._id ||
        prevProps.item.available !== nextProps.item.available ||
        prevProps.item.reserved !== nextProps.item.reserved ||
        prevProps.item.prebooked !== nextProps.item.prebooked;

    const locChanged =
        (!!prevProps.userLocation) !== (!!nextProps.userLocation);

    return !itemChanged && !locChanged;
});

const SkeletonCard = () => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.zoneCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                <Animated.View style={{ width: 150, height: 24, backgroundColor: '#e5e7eb', borderRadius: 4, opacity }} />
                <Animated.View style={{ width: 24, height: 24, backgroundColor: '#e5e7eb', borderRadius: 12, opacity }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, paddingVertical: 10, backgroundColor: '#f9fafb', borderRadius: 10 }}>
                <Animated.View style={{ width: 80, height: 20, backgroundColor: '#e5e7eb', borderRadius: 4, opacity }} />
                <Animated.View style={{ width: 80, height: 20, backgroundColor: '#e5e7eb', borderRadius: 4, opacity }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                <Animated.View style={{ width: 100, height: 20, backgroundColor: '#e5e7eb', borderRadius: 4, opacity }} />
                <Animated.View style={{ width: 100, height: 40, backgroundColor: '#e5e7eb', borderRadius: 8, opacity }} />
            </View>
        </View>
    );
};

const DashboardScreen = ({ navigation }) => {
    const { logout } = useAuth();
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);

    const fetchZones = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            // API service already handles base URL and Auth token
            const res = await api.get('/');

            if (Array.isArray(res.data)) {
                setZones(res.data);
                AsyncStorage.setItem('cached_zones', JSON.stringify(res.data));
            } else {
                setZones([]);
            }
            setError(null);
        } catch (err) {
            console.error('Fetch zones error:', err);
            const message = err.response?.data?.message || err.message || 'Unknown error';
            // Show the URL to help debugging if needed (can be removed in prod)
            const baseUrl = api.defaults.baseURL;
            setError(`Connection Failed \nError: ${message}`);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        let subscription;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    distanceInterval: 10, // Update every 10 meters for better performance
                    interval: 5000       // Update every 5 seconds
                },
                (loc) => setUserLocation(loc)
            );
        })();
        return () => subscription?.remove();
    }, []);

    const isFocused = useIsFocused();

    useEffect(() => {
        if (!isFocused) return;

        // Poll every 5 seconds while focused
        const interval = setInterval(() => {
            fetchZones(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [isFocused]);



    const loadCache = async () => {
        try {
            const cached = await AsyncStorage.getItem('cached_zones');
            if (cached) {
                setZones(JSON.parse(cached));
                setLoading(false); // Show UI immediately
            }
        } catch (e) {
            console.error('Cache load error:', e);
        }
    };

    useEffect(() => {
        loadCache().then(() => fetchZones(true));
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchZones();
    };

    const renderZone = React.useCallback(({ item }) => (
        <ZoneCard item={item} userLocation={userLocation} navigation={navigation} />
    ), [userLocation, navigation]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.toggleDrawer?.()}
                    >
                        <Menu size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Parking Zones</Text>
                    <View style={{ width: 28 }} /> {/* Spacer to center the title */}
                </View>
            </LinearGradient>

            {loading && !refreshing ? (
                <View style={styles.listContent}>
                    {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>Unable to Connect</Text>
                    <Text style={styles.errorDetails}>{error}</Text>
                    <Text style={styles.debugText}>Target: {api.defaults.baseURL}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchZones}>
                        <Text style={styles.retryText}>Retry Connection</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={zones}
                    renderItem={renderZone}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No zones found.</Text>
                    }
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={5}
                    removeClippedSubviews={true}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    logoutButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    listContent: {
        padding: 20,
    },
    zoneCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    zoneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    zoneName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        paddingVertical: 10,
        backgroundColor: '#f9fafb',
        borderRadius: 10,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 15,
    },
    availableText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    availableValue: {
        fontWeight: 'bold',
    },
    parkButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    parkButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#a0a0a0',
        opacity: 0.8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        color: theme.colors.textSecondary,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    errorDetails: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
        paddingHorizontal: 20,
    },
    debugText: {
        color: '#9ca3af',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 10,
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        color: theme.colors.textSecondary,
        fontSize: 16,
    },
});

export default DashboardScreen;
