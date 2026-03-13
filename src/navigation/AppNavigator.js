import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Map as MapIcon, History, Calendar, LogOut } from 'lucide-react-native';
import { theme } from '../theme';

// HOC for Suspense to prevent full app unmount on tab switch
const withSuspense = (Component) => (props) => (
    <React.Suspense fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
    }>
        <Component {...props} />
    </React.Suspense>
);

// Lazy load screens wrapped in Suspense
const LoginScreen = withSuspense(React.lazy(() => import('../screens/LoginScreen')));
const DashboardScreen = withSuspense(React.lazy(() => import('../screens/DashboardScreen')));
const MapScreen = withSuspense(React.lazy(() => import('../screens/MapScreen')));
const MyReservationsScreen = withSuspense(React.lazy(() => import('../screens/MyReservationsScreen')));
const PreBookingScreen = withSuspense(React.lazy(() => import('../screens/PreBookingScreen')));

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const SidebarContent = (props) => {
    const { state, navigation } = props;
    const insets = useSafeAreaInsets();
    const { logout } = useAuth();

    const menuItems = [
        { name: 'Dashboard', route: 'Dashboard', icon: LayoutDashboard },
        { name: 'Map', route: 'Map', icon: MapIcon },
        { name: 'Book', route: 'PreBooking', icon: Calendar },
        { name: 'Reservations', route: 'MyReservations', icon: History }
    ];

    const currentRouteIndex = state.index;
    const currentRouteName = state.routeNames[currentRouteIndex];

    return (
        <View style={[styles.sidebarContainer, { paddingTop: insets.top }]}>
            <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Park App</Text>
            </View>

            <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerListArea}>
                {menuItems.map((item, index) => {
                    const isFocused = currentRouteName === item.route;
                    const IconComponent = item.icon;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.sidebarItem,
                                isFocused && styles.sidebarItemActive
                            ]}
                            onPress={() => navigation.navigate(item.route)}
                        >
                            <View style={[
                                styles.iconContainer,
                                isFocused && styles.iconContainerActive
                            ]}>
                                <IconComponent
                                    size={22}
                                    color={isFocused ? "#fff" : theme.colors.textSecondary}
                                />
                            </View>
                            <Text style={[
                                styles.sidebarItemText,
                                isFocused && styles.sidebarItemTextActive
                            ]}>
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </DrawerContentScrollView>

            <View style={[styles.sidebarFooter, { paddingBottom: insets.bottom + 20 }]}>
                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <LogOut size={20} color={theme.colors.error} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const DrawerNavigator = () => {
    const dimensions = useWindowDimensions();
    const isLargeScreen = dimensions.width >= 768;

    return (
        <Drawer.Navigator
            drawerContent={(props) => <SidebarContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: isLargeScreen ? 'permanent' : 'front',
                drawerStyle: {
                    width: isLargeScreen ? 250 : 280,
                    backgroundColor: '#fff',
                    borderRightWidth: 1,
                    borderRightColor: '#f1f1f1'
                },
                overlayColor: isLargeScreen ? 'transparent' : 'rgba(0,0,0,0.5)',
                sceneContainerStyle: {
                    backgroundColor: theme.colors.background,
                }
            }}
        >
            <Drawer.Screen name="Dashboard" component={DashboardScreen} />
            <Drawer.Screen name="Map" component={MapScreen} />
            <Drawer.Screen name="PreBooking" component={PreBookingScreen} />
            <Drawer.Screen name="MyReservations" component={MyReservationsScreen} />
        </Drawer.Navigator>
    );
};

const AppNavigator = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <Stack.Screen name="Main" component={DrawerNavigator} />
                ) : (
                    <Stack.Screen name="Auth" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    sidebarContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    sidebarHeader: {
        paddingHorizontal: 25,
        paddingBottom: 20,
        paddingTop: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    sidebarTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.primary,
        letterSpacing: 0.5,
    },
    drawerListArea: {
        paddingTop: 20,
    },
    sidebarItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 25,
        marginHorizontal: 15,
        marginBottom: 8,
        borderRadius: 12,
    },
    sidebarItemActive: {
        backgroundColor: theme.colors.primary + '10', // Light primary background
    },
    iconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
    },
    iconContainerActive: {
        backgroundColor: theme.colors.primary,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    sidebarItemText: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.textSecondary,
    },
    sidebarItemTextActive: {
        color: theme.colors.primary,
        fontWeight: 'bold',
    },
    sidebarFooter: {
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingHorizontal: 25,
        paddingTop: 20,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    logoutText: {
        marginLeft: 15,
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.error,
    }
});

export default AppNavigator;
