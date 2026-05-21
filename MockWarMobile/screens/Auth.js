import React, { useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, Mail, ShieldCheck, User, CalendarDays, Zap, Camera } from 'lucide-react-native';
import axios from 'axios';
import { auth } from './firebase';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';

const API_BASE = "https://mockwar-backend.onrender.com";

const firebaseConfig = {
  apiKey: "AIzaSyDPZs2ME5T8o3ZcWw56nsU2PcWLK7F8KB0",
  authDomain: "growthpro-4a4b7.firebaseapp.com",
  projectId: "growthpro-4a4b7",
  storageBucket: "growthpro-4a4b7.firebasestorage.app",
  messagingSenderId: "922632746056",
  appId: "1:922632746056:web:4fc210d49d118748b0947d"
};

export default function Auth({ navigation }) {
  const [loginMethod, setLoginMethod] = useState('phone');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  const recaptchaVerifier = useRef(null);
  const [verificationId, setVerificationId] = useState(null);

  const [regData, setRegData] = useState({ name: '', dob: '', state: '', district: '', uid: '', phone: '', email: '', live_photo: '', referred_by: '' });

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const cameraRef = useRef(null);

  const openCamera = async () => {
    if (!permission) return;
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert("Permission Denied", "Camera access is required for KYC."); return; }
    }
    setIsCameraOpen(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      setRegData({ ...regData, live_photo: `data:image/jpeg;base64,${photo.base64}` });
      setIsCameraOpen(false);
    }
  };

  const sendOTP = async () => {
    if (phone.length !== 10) return Alert.alert("Error", "Enter valid 10-digit number");
    setLoading(true);
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const verifyId = await phoneProvider.verifyPhoneNumber("+91" + phone, recaptchaVerifier.current);
      setVerificationId(verifyId);
      setOtpSent(true);
    } catch (error) {
      Alert.alert("OTP Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) return Alert.alert("Error", "Enter 6-digit OTP");
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const token = await result.user.getIdToken();
      await verifyTokenWithDjango(token);
    } catch (error) {
      Alert.alert("Error", "Incorrect OTP!");
      setLoading(false);
    }
  };

  const verifyTokenWithDjango = async (idToken) => {
    try {
      const response = await axios.post(`${API_BASE}/api/auth/firebase-login/`, { id_token: idToken });
      if (response.data.is_new_user) {
        setIsNewUser(true);
        setRegData({ ...regData, uid: response.data.uid, phone: response.data.phone || phone });
        setLoading(false);
      } else {
        await AsyncStorage.setItem('access_token', response.data.access);
        await AsyncStorage.setItem('refresh_token', response.data.refresh);
        Alert.alert("Welcome Back!", "Login Successful");
        navigation.navigate('Lobby'); 
      }
    } catch (error) {
      Alert.alert("Login Failed", "Could not verify with server.");
      setLoading(false);
    }
  };

  const handleRegistrationSubmit = async () => {
    if (!regData.live_photo) return Alert.alert("Hold On!", "Please capture KYC Live Photo.");
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/complete-registration/`, regData);
      await AsyncStorage.setItem('access_token', response.data.access);
      await AsyncStorage.setItem('refresh_token', response.data.refresh);
      Alert.alert("Success", `Gamer Tag: ${response.data.username}`);
      navigation.navigate('Lobby'); 
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Registration Failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FirebaseRecaptchaVerifierModal ref={recaptchaVerifier} firebaseConfig={firebaseConfig} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.badge}><Zap size={12} color="#60a5fa" /><Text style={styles.badgeText}> ELITE ACCESS</Text></View>
          <Text style={styles.title}>MOCKWAR</Text>
        </View>

        <View style={styles.card}>
          {isNewUser ? (
            <View style={styles.formContainer}>
              <View style={styles.kycBanner}><ShieldCheck size={20} color="#34d399" /><Text style={styles.kycText}> VERIFIED. SETUP PROFILE.</Text></View>
              <View style={styles.inputWrapper}><User size={20} color="#64748b" style={styles.icon} /><TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#64748b" onChangeText={(val) => setRegData({...regData, name: val})} /></View>
              <View style={styles.inputWrapper}><CalendarDays size={20} color="#64748b" style={styles.icon} /><TextInput style={styles.input} placeholder="DOB (YYYY-MM-DD)" placeholderTextColor="#64748b" onChangeText={(val) => setRegData({...regData, dob: val})} /></View>
            
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}><TextInput style={styles.input} placeholder="State" placeholderTextColor="#64748b" onChangeText={(val) => setRegData({...regData, state: val})} /></View>
                <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}><TextInput style={styles.input} placeholder="District" placeholderTextColor="#64748b" onChangeText={(val) => setRegData({...regData, district: val})} /></View>
              </View>

              <View style={styles.cameraBox}>
                <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10}}><Camera size={16} color="#94a3b8" /><Text style={{color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginLeft: 5}}> LIVE KYC PHOTO</Text></View>
                {isCameraOpen ? (
                  <View style={styles.cameraPreview}>
                    <CameraView style={{ flex: 1 }} facing="front" ref={cameraRef} />
                    <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}><Text style={styles.btnText}>CAPTURE</Text></TouchableOpacity>
                  </View>
                ) : regData.live_photo ? (
                  <View style={{ alignItems: 'center' }}><Image source={{ uri: regData.live_photo }} style={styles.profilePic} /><TouchableOpacity onPress={openCamera}><Text style={styles.retakeText}>Retake Photo</Text></TouchableOpacity></View>
                ) : (
                  <TouchableOpacity style={styles.openCameraBtn} onPress={openCamera}><Camera size={20} color="#cbd5e1" /><Text style={{ color: '#cbd5e1', fontWeight: 'bold', marginLeft: 8 }}>Open Camera</Text></TouchableOpacity>
                )}
              </View>

              <TouchableOpacity activeOpacity={0.8} onPress={handleRegistrationSubmit} disabled={loading}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.submitBtn}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>INITIALIZE ACCOUNT</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, styles.activeTab]}><Smartphone size={14} color="#fff" /><Text style={[styles.tabText, styles.activeTabText]}> SMS OTP</Text></TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => Alert.alert("Wait", "Use Phone Login for now.")}><Mail size={14} color="#64748b" /><Text style={styles.tabText}> G-MAIL</Text></TouchableOpacity>
              </View>

              <View style={{ marginTop: 20 }}>
                {!otpSent ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={styles.prefixBox}><Text style={styles.prefixText}>+91</Text></View>
                      <TextInput style={[styles.input, { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 15, borderRadius: 12 }]} placeholder="Mobile Number" placeholderTextColor="#64748b" keyboardType="numeric" maxLength={10} value={phone} onChangeText={setPhone} />
                    </View>
                    <TouchableOpacity activeOpacity={0.8} onPress={sendOTP} disabled={loading} style={{ marginTop: 20 }}>
                      <LinearGradient colors={['#2563eb', '#4f46e5']} style={styles.submitBtn}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SECURE OTP LOGIN</Text>}</LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>Sent to +91 {phone}</Text>
                      <TouchableOpacity onPress={() => setOtpSent(false)}><Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: 'bold' }}>EDIT</Text></TouchableOpacity>
                    </View>
                    <TextInput style={styles.otpInput} placeholder="------" placeholderTextColor="#334155" keyboardType="numeric" maxLength={6} value={otp} onChangeText={setOtp} secureTextEntry />
                    <TouchableOpacity activeOpacity={0.8} onPress={verifyOTP} disabled={loading} style={{ marginTop: 20 }}>
                      <LinearGradient colors={['#10b981', '#059669']} style={styles.submitBtn}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CONFIRM & ENTER</Text>}</LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
        <Text style={styles.footerText}>Secure Encryption • MockWar Gaming</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  glowTop: { position: 'absolute', top: 50, left: -50, width: 200, height: 200, backgroundColor: 'rgba(37, 99, 235, 0.15)', borderRadius: 100 },
  glowBottom: { position: 'absolute', bottom: 50, right: -50, width: 200, height: 200, backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 100 },
  header: { alignItems: 'center', marginBottom: 30 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', marginBottom: 15 },
  badgeText: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 48, fontWeight: '900', fontStyle: 'italic', color: '#fff', letterSpacing: -1 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#1e293b' },
  formContainer: { width: '100%' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#020617', padding: 5, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' },
  tab: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: '#1e293b' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 1 },
  activeTabText: { color: '#fff' },
  prefixBox: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  prefixText: { color: '#64748b', fontWeight: '900', fontSize: 16 },
  input: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1 },
  otpInput: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 10, paddingVertical: 15 },
  submitBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 10 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  kycBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', padding: 12, borderRadius: 12, marginBottom: 20 },
  kycText: { color: '#34d399', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15 },
  icon: { marginRight: 10 },
  cameraBox: { borderWidth: 1, borderColor: '#1e293b', borderRadius: 16, padding: 15, backgroundColor: 'rgba(2, 6, 23, 0.5)', marginBottom: 20 },
  openCameraBtn: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cameraPreview: { height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  captureBtn: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  profilePic: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10b981' },
  retakeText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', marginTop: 10, textDecorationLine: 'underline' },
  footerText: { color: '#475569', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 30, letterSpacing: 1, textTransform: 'uppercase' }
});