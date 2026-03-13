import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Keyboard,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api from '../services/api';
import { theme } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, ChevronRight, LogOut as LogoutIcon, Menu } from 'lucide-react-native';

const PreBookingScreen = ({ navigation }) => {
    const { logout } = useAuth();
    const [zones, setZones] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [fromTime, setFromTime] = useState(new Date(Date.now() + 3600000));
    const [toTime, setToTime] = useState(new Date(Date.now() + 7200000));
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [myReservations, setMyReservations] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [fromPickerMode, setFromPickerMode] = useState('date');
    const [toPickerMode, setToPickerMode] = useState('date');

    const fetchZones = async () => {
        // Only show loading if we have no data
        if (zones.length === 0) setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;
            const res = await api.get('/');
            const data = Array.isArray(res.data) ? res.data : [];
            setZones(data);
            AsyncStorage.setItem('cached_zones', JSON.stringify(data));
        } catch (err) {
            console.error(err);
            if (zones.length === 0) Alert.alert('Error', 'Failed to load zones');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyReservations = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const res = await api.get(`/reserve/book?userId=${user.uid}`);
            const allReservations = Array.isArray(res.data) ? res.data : [];

            // Update cache for other screens
            AsyncStorage.setItem('cached_reservations', JSON.stringify(allReservations));

            const active = allReservations.filter(d => ['booked', 'reserved'].includes(d.status) && new Date(d.toTime || d.endTime) > new Date());
            setMyReservations(active);
        } catch (err) {
            console.error(err);
        }
    };

    const loadCache = async () => {
        try {
            const [cachedZones, cachedReservations] = await Promise.all([
                AsyncStorage.getItem('cached_zones'),
                AsyncStorage.getItem('cached_reservations')
            ]);

            if (cachedZones) {
                setZones(JSON.parse(cachedZones));
            }

            if (cachedReservations) {
                const all = JSON.parse(cachedReservations);
                const active = all.filter(d => ['booked', 'reserved'].includes(d.status) && new Date(d.toTime || d.endTime) > new Date());
                setMyReservations(active);
            }
        } catch (e) {
            console.error("Cache load error", e);
        }
    };

    const handleCancel = async (id, status) => {
        const action = status === 'reserved' ? 'Check Out' : 'Cancel';
        Alert.alert(
            `${action} ${status === 'reserved' ? 'Parking' : 'Booking'}`,
            `Are you sure you want to ${action.toLowerCase()} this ${status === 'reserved' ? 'parking' : 'booking'}?`,
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes',
                    onPress: async () => {
                        try {
                            setActionLoading(id);
                            await api.delete(`/reserve/${id}`);
                            fetchMyReservations();
                            fetchZones();
                            Alert.alert('Success', `${action} successful`);
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'Failed to update');
                        } finally {
                            setActionLoading(null);
                        }
                    }
                }
            ]
        );
    };

    useFocusEffect(
        useCallback(() => {
            loadCache().then(() => {
                fetchZones();
                fetchMyReservations();
            });
        }, [])
    );

    const showLoading = async (setter) => {
        setter(true);
        await new Promise(resolve => setTimeout(resolve, 50));
    };

    const handleBook = async () => {
        console.log("👉 handleBook initiated (v1.0.6)");
        if (typeof Keyboard !== 'undefined') Keyboard?.dismiss?.();

        if (!selectedZoneId) return Alert.alert('Error', 'Please select a zone');
        if (fromTime >= toTime) return Alert.alert('Error', 'To time must be after From time');
        if (fromTime <= new Date()) return Alert.alert('Error', 'Cannot book for past time');

        await showLoading(setProcessing);
        try {
            const user = auth.currentUser;

            const payload = {
                userId: user.uid,
                zoneId: selectedZoneId,
                fromTime: fromTime.toISOString(),
                toTime: toTime.toISOString()
            };

            await api.post('/prebook', payload);

            Alert.alert('Success', 'Booking Successful!');
            fetchMyReservations();
            fetchZones();
            // Reset form
            setFromTime(new Date(Date.now() + 3600000));
            setToTime(new Date(Date.now() + 7200000));
        } catch (err) {
            console.error(err);
            Alert.alert('Error', err.response?.data?.message || 'Booking Failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <LinearGradient
                colors={[theme.colors.secondary, theme.colors.accent]}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => navigation.toggleDrawer?.()}
                    >
                        <Menu size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={styles.headerTitle}>Book Your Spot</Text>
                        <Text style={styles.headerSubtitle}>Plan ahead and secure parking</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Select Zone</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedZoneId}
                            onValueChange={(itemValue) => setSelectedZoneId(itemValue)}
                            style={styles.picker}
                        >
                            <Picker.Item label="Choose a zone" value="" color="#000000" />
                            {zones.map(z => (
                                <Picker.Item
                                    key={z._id}
                                    label={`${z.name} (${z.available || 0} free)`}
                                    value={z._id}
                                    color="#000000"
                                />
                            ))}
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>From</Text>
                    <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowFromPicker(true)}
                    >
                        <Calendar size={20} color={theme.colors.primary} />
                        <Text style={styles.dateTimeText}>{fromTime.toLocaleString()}</Text>
                        <ChevronRight size={20} color="#d1d5db" />
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>To</Text>
                    <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowToPicker(true)}
                    >
                        <Clock size={20} color={theme.colors.primary} />
                        <Text style={styles.dateTimeText}>{toTime.toLocaleString()}</Text>
                        <ChevronRight size={20} color="#d1d5db" />
                    </TouchableOpacity>
                </View>

                {showFromPicker && (
                    <DateTimePicker
                        value={fromTime}
                        mode={Platform.OS === 'ios' ? 'datetime' : fromPickerMode}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            if (event.type === 'dismissed') {
                                setShowFromPicker(false);
                                setFromPickerMode('date');
                                return;
                            }

                            if (Platform.OS === 'android') {
                                if (fromPickerMode === 'date') {
                                    setFromTime(date || fromTime);
                                    setFromPickerMode('time');
                                } else {
                                    setShowFromPicker(false);
                                    setFromPickerMode('date');
                                    if (date) setFromTime(date);
                                }
                            } else {
                                setShowFromPicker(false);
                                if (date) setFromTime(date);
                            }
                        }}
                    />
                )}

                {showToPicker && (
                    <DateTimePicker
                        value={toTime}
                        mode={Platform.OS === 'ios' ? 'datetime' : toPickerMode}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            if (event.type === 'dismissed') {
                                setShowToPicker(false);
                                setToPickerMode('date');
                                return;
                            }

                            if (Platform.OS === 'android') {
                                if (toPickerMode === 'date') {
                                    setToTime(date || toTime);
                                    setToPickerMode('time');
                                } else {
                                    setShowToPicker(false);
                                    setToPickerMode('date');
                                    if (date) setToTime(date);
                                }
                            } else {
                                setShowToPicker(false);
                                if (date) setToTime(date);
                            }
                        }}
                    />
                )}

                <TouchableOpacity
                    style={[styles.bookButton, processing && styles.disabledButton]}
                    onPress={handleBook}
                    disabled={processing}
                >
                    {processing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.bookButtonText}>Confirm Booking</Text>
                    )}
                </TouchableOpacity>

                {/* ACTIVE RESERVATIONS LIST */}
                <View style={styles.reservationsSection}>
                    <Text style={styles.sectionTitle}>My Active Bookings & Parkings</Text>
                    {myReservations.length === 0 ? (
                        <Text style={styles.emptyText}>No active reservations.</Text>
                    ) : (
                        <View style={styles.reservationsList}>
                            {myReservations.map(r => (
                                <View key={r._id} style={styles.reservationCard}>
                                    <View style={styles.resInfo}>
                                        <Text style={styles.resZoneName}>{r.zoneName}</Text>
                                        <Text style={styles.resTime}>
                                            {new Date(r.fromTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            {'\n'}⬇{'\n'}
                                            {new Date(r.toTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </Text>
                                    </View>
                                    <View style={styles.resActions}>
                                        <View style={[styles.statusBadge, { backgroundColor: r.status === 'reserved' ? '#fef3c7' : '#dcfce7' }]}>
                                            <Text style={[styles.statusText, { color: r.status === 'reserved' ? '#b45309' : '#15803d' }]}>
                                                {r.status === 'reserved' ? 'Parked' : 'Booked'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.cancelBtn}
                                            onPress={() => handleCancel(r._id, r.status)}
                                            disabled={actionLoading === r._id}
                                        >
                                            <Text style={styles.cancelBtnText}>
                                                {actionLoading === r._id ? '...' : r.status === 'reserved' ? 'Check Out' : 'Cancel'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    menuButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
        alignSelf: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
    },
    form: {
        padding: 25,
        marginTop: -20,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 4,
    },
    pickerContainer: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
    },
    picker: {
        height: 50,
        width: '100%',
    },
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 15,
        gap: 12,
    },
    dateTimeText: {
        flex: 1,
        fontSize: 16,
        color: theme.colors.text,
    },
    bookButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    bookButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.7,
    },
    reservationsSection: {
        marginTop: 30,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 15,
    },
    emptyText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    reservationsList: {
        gap: 12,
    },
    reservationCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    resInfo: {
        flex: 1,
    },
    resZoneName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 5,
    },
    resTime: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        lineHeight: 16,
    },
    resActions: {
        alignItems: 'flex-end',
        gap: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    cancelBtn: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    cancelBtnText: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: 'bold',
    },
});

export default PreBookingScreen;
