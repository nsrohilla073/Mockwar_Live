import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, GoogleAuthProvider } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDPZs2ME5T8o3ZcWw56nsU2PcWLK7F8KB0",
  authDomain: "growthpro-4a4b7.firebaseapp.com",
  projectId: "growthpro-4a4b7",
  storageBucket: "growthpro-4a4b7.firebasestorage.app",
  messagingSenderId: "922632746056",
  appId: "1:922632746056:web:4fc210d49d118748b0947d"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  auth = getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
export { auth, googleProvider };