import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Maps Firebase error codes to user-friendly messages.
 * @param {Object} error - The error object from Firebase.
 * @returns {string} - A user-friendly error message.
 */
const getErrorMessage = (error) => {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email is already in use. Please log in instead.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        default:
            return error.message || 'An unexpected error occurred.';
    }
};

/**
 * data validation helper
 */
export const validateForm = (email, password, contentPassword = null, isSignup = false) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long.' };
    }
    if (isSignup && password !== contentPassword) {
        return { valid: false, error: 'Passwords do not match.' };
    }
    return { valid: true, error: null };
};

export const login = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: getErrorMessage(error) };
    }
};

export const signup = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { user: userCredential.user, error: null };
    } catch (error) {
        return { user: null, error: getErrorMessage(error) };
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
        return { error: null };
    } catch (error) {
        return { error: getErrorMessage(error) };
    }
};
