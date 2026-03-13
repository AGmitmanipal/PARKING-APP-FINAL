import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Keyboard,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { login, signup, validateForm } from '../services/auth';
import api from '../services/api';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [isSignup, setIsSignup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleAuth = async () => {
        setErrorMsg('');
        if (typeof Keyboard !== 'undefined') Keyboard?.dismiss?.();

        // Local Validation
        const validation = validateForm(email, password, confirmPassword, isSignup);
        if (!validation.valid) {
            setErrorMsg(validation.error);
            return;
        }

        if (isSignup && !vehiclePlate.trim()) {
            setErrorMsg('Please enter your vehicle number plate.');
            return;
        }

        setLoading(true);
        try {
            let result;
            if (isSignup) {
                result = await signup(email, password);
            } else {
                result = await login(email, password);
            }

            if (result.error) {
                setErrorMsg(result.error);
                Alert.alert('Authentication Failed', result.error);
            } else {
                // Success
                console.log('Auth successful for:', result.user.email);

                if (isSignup) {
                    try {
                        // Create profile / update vehicle plate
                        // Note: Interceptor adds token automatically
                        await api.post('/api/auth/update-profile', {
                            vehiclePlate: vehiclePlate.trim()
                        });
                        console.log('Vehicle plate saved.');
                    } catch (profileErr) {
                        console.error('Failed to save vehicle plate:', profileErr);
                        Alert.alert('Warning', 'Account created but failed to save vehicle details.');
                    }
                }
            }
        } catch (err) {
            setErrorMsg('An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary, theme.colors.accent]}
            style={styles.container}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.card}>
                        <Text style={styles.title}>
                            {isSignup ? 'Create Account' : 'Welcome Back'}
                        </Text>

                        {errorMsg ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{errorMsg}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setErrorMsg(''); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password (min 6 chars)"
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                value={password}
                                onChangeText={(text) => { setPassword(text); setErrorMsg(''); }}
                                secureTextEntry
                            />
                        </View>

                        {isSignup && (
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Confirm Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Re-enter your password"
                                    placeholderTextColor="rgba(255,255,255,0.6)"
                                    value={confirmPassword}
                                    onChangeText={(text) => { setConfirmPassword(text); setErrorMsg(''); }}
                                    secureTextEntry
                                />
                            </View>
                        )}

                        {isSignup && (
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Vehicle Number Plate</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. KA-01-AB-1234"
                                    placeholderTextColor="rgba(255,255,255,0.6)"
                                    value={vehiclePlate}
                                    onChangeText={(text) => { setVehiclePlate(text); setErrorMsg(''); }}
                                    autoCapitalize="characters"
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={theme.colors.primary} />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSignup ? 'Sign Up' : 'Log In'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                {isSignup ? 'Already have an account?' : 'Don’t have an account?'}
                            </Text>
                            <TouchableOpacity onPress={() => { setIsSignup(!isSignup); setErrorMsg(''); setVehiclePlate(''); }}>
                                <Text style={styles.footerLink}>
                                    {isSignup ? ' Log In' : ' Sign Up'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
        padding: 25,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        // backdropFilter: 'blur(10px)', // Note: backdropFilter doesn't work in standard RN
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 30,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '500',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    button: {
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 15,
        marginTop: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        height: 50,
        justifyContent: 'center',
    },
    buttonText: {
        color: theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    footerText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    footerLink: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        padding: 10,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    errorText: {
        color: '#ffffff',
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '500'
    }
});

export default LoginScreen;
