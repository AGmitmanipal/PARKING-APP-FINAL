import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { theme } from '../theme';
import { Calendar, Clock, MapPin, Trash2, LogOut as LogoutIcon, History, Menu } from 'lucide-react-native';

const MyReservationsScreen = ({ navigation }) => {
    const { logout } = useAuth();
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchReservations = async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            const user = auth.currentUser;
            if (!user) return;
            // api handles token
            const res = await api.get(`/reserve/book?userId=${user.uid}`);
            const data = Array.isArray(res.data) ? res.data : [];
            setReservations(data);
            AsyncStorage.setItem('cached_reservations', JSON.stringify(data));
            setError(null);
        } catch (err) {
            console.error('Error fetching parkings and bookings', err);
            setError('Failed to load parkings and bookings');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadCache = async () => {
        try {
            const cached = await AsyncStorage.getItem('cached_reservations');
            if (cached) {
                setReservations(JSON.parse(cached));
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const isFocused = useIsFocused();

    useEffect(() => {
        if (isFocused) {
            fetchReservations(true);
            const interval = setInterval(() => {
                fetchReservations(true);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isFocused]);

    useEffect(() => {
        loadCache().then(() => fetchReservations());
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchReservations();
    };

    const handleCancel = (reservationId, status) => {
        const isParking = status === 'reserved';
        const action = isParking ? 'Check Out' : 'Cancel';
        const noun = isParking ? 'Parking' : 'Booking';

        Alert.alert(
            `${action} ${noun}`,
            `Are you sure you want to ${action.toLowerCase()} this ${noun.toLowerCase()}?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(reservationId);
                            await api.delete(`/reserve/${reservationId}`);

                            // Optimistic update
                            setReservations(prev =>
                                prev.map(r => r._id === reservationId ? { ...r, status: 'cancelled' } : r)
                            );
                            Alert.alert('Success', `${action} successful`);
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'Failed to update parking');
                        } finally {
                            setActionLoading(null);
                        }
                    }
                }
            ]
        );
    };

    const handleViewMap = async (reservation) => {
        try {
            const res = await api.get('/');
            const zones = res.data;
            const zone = zones.find(z => z._id === reservation.zoneId);
            if (zone) {
                navigation.navigate('Map', { zone });
            } else {
                Alert.alert('Error', 'Zone not found');
            }
        } catch (err) {
            console.error(err);
        }
    };


    const renderItem = useCallback(({ item }) => (
        <ReservationCard
            item={item}
            onCancel={handleCancel}
            onViewMap={handleViewMap}
            actionLoading={actionLoading}
        />
    ), [handleCancel, handleViewMap, actionLoading]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.toggleDrawer?.()}
                    >
                        <Menu size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Parkings</Text>
                    <View style={{ width: 24 }} />
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchReservations}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={reservations}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <History size={48} color="#d1d5db" />
                            <Text style={styles.emptyText}>No parkings or bookings found</Text>
                        </View>
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

const ReservationCard = React.memo(({ item, onCancel, onViewMap, actionLoading }) => {
    const start = new Date(item.fromTime || item.startTime);
    const end = new Date(item.toTime || item.endTime);
    const now = new Date();
    const isExpired = now > end;

    const isActive = item.status === 'reserved' && !isExpired;
    const isBooked = item.status === 'booked' && !isExpired;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.zoneName}>{item.zoneName || 'Parking Zone'}</Text>
                <View style={[styles.statusBadge, {
                    backgroundColor: isActive ? theme.colors.success + '20' :
                        isBooked ? theme.colors.primary + '20' :
                            '#f3f4f6'
                }]}>
                    <Text style={[styles.statusText, {
                        color: isActive ? theme.colors.success :
                            isBooked ? theme.colors.primary :
                                '#9ca3af'
                    }]}>
                        {isActive ? 'PARKED' : isBooked ? 'BOOKED' : isExpired ? 'EXPIRED' : item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.timeInfo}>
                <View style={styles.timeRow}>
                    <Calendar size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.timeText}>{start.toLocaleDateString()}</Text>
                </View>
                <View style={styles.timeRow}>
                    <Clock size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.timeText}>
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                {(isActive || isBooked) && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => onCancel(item._id, item.status)}
                        disabled={actionLoading === item._id}
                    >
                        {isActive ? <LogoutIcon size={16} color={theme.colors.error} /> : <Trash2 size={16} color={theme.colors.error} />}
                        <Text style={styles.cancelButtonText}>
                            {actionLoading === item._id ? '...' : isActive ? 'Check Out' : 'Cancel'}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.actionButton, styles.viewButton]}
                    onPress={() => onViewMap(item)}
                >
                    <MapPin size={16} color={theme.colors.primary} />
                    <Text style={styles.viewButtonText}>View Map</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuButton: {
        padding: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
    },
    listContent: {
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    zoneName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    timeInfo: {
        gap: 6,
        marginBottom: 16,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timeText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 8,
    },
    cancelButton: {
        backgroundColor: theme.colors.error + '10',
    },
    cancelButtonText: {
        color: theme.colors.error,
        fontWeight: 'bold',
        fontSize: 13,
    },
    viewButton: {
        backgroundColor: theme.colors.primary + '10',
    },
    viewButtonText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 13,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: theme.colors.error,
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
        gap: 15,
    },
    emptyText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
    }
});

export default MyReservationsScreen;
