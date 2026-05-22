import React, { useState, useRef, useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, Mail, ShieldCheck, User, CalendarDays, Zap, Camera, Gift, CheckSquare, Square } from 'lucide-react-native'; // 🔴 NAYA: CheckSquare
import axios from 'axios';
import { Picker } from '@react-native-picker/picker'; 

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const API_BASE = "https://mockwar-backend.onrender.com";

// 🔴 NAYA: Legal Banned States List
const BANNED_STATES = ["Andhra Pradesh", "Assam", "Nagaland", "Odisha", "Sikkim", "Telangana"];

const INDIA_STATES = {
  "Andhra Pradesh": ["Anantapur", "Chittoor", "Visakhapatnam"], // Restricted
  "Assam": ["Guwahati", "Dibrugarh"], // Restricted
  "Bihar": ["Patna", "Gaya", "Bhagalpur"],
  "Delhi": ["Central Delhi", "New Delhi"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat"],
  "Karnataka": ["Bengaluru", "Mysuru"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
  "Nagaland": ["Dimapur", "Kohima"], // Restricted
  "Odisha": ["Bhubaneswar", "Cuttack"], // Restricted
  "Punjab": ["Ludhiana", "Amritsar"],
  "Rajasthan": ["Jaipur", "Jodhpur"],
  "Sikkim": ["Gangtok"], // Restricted
  "Telangana": ["Hyderabad", "Warangal"], // Restricted
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida"],
  "West Bengal": ["Kolkata", "Howrah"]
};

export default function Auth({ navigation }) {
  const [loginMethod, setLoginMethod] = useState('phone'); 
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  
  // 🔴 NAYA: OTP Timer State & 18+ Check
  const [timer, setTimer] = useState(0);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  
  const [confirm, setConfirm] = useState(null);
  const [regData, setRegData] = useState({ name: '', dob: '', state: '', district: '', uid: '', phone: '', email: '', live_photo: '', referred_by: '' });

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: '922632746056-liktmi41674s9i41jh0rokdeqiioemh9.apps.googleusercontent.com' });
  }, []);

  // 🔴 NAYA: OTP Timer Logic
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const openCamera = async () => { /* Same as before */
    if (!permission) return;
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) { Alert.alert("Permission Denied", "Camera required."); return; }
    }
    setIsCameraOpen(true);
  };

  const capturePhoto = async () => { /* Same as before */
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      setRegData({ ...regData, live_photo: `data:image/jpeg;base64,${photo.base64}` });
      setIsCameraOpen(false);
    }
  };

  const handleGoogleLogin = async () => { /* Same as before */
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const result = await auth().signInWithCredential(googleCredential);
      const firebaseIdToken = await result.user.getIdToken();
      await verifyTokenWithDjango(firebaseIdToken);
    } catch (error) { Alert.alert("Google Login Failed", "Check config."); } 
    finally { setLoading(false); }
  };

  const sendOTP = async () => {
    if (phone.length !== 10) return Alert.alert("Error", "Enter valid 10-digit number");
    if (timer > 0) return; // Wait for timer

    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber('+91' + phone);
      setConfirm(confirmation);
      setOtpSent(true);
      setTimer(60); // 🔴 Start 60s cooldown
    } catch (error) { Alert.alert("OTP Error", error.message); } 
    finally { setLoading(false); }
  };

  const verifyOTP = async () => { /* Same as before */
    if (otp.length !== 6) return Alert.alert("Error", "Enter 6-digit OTP");
    setLoading(true);
    try {
      const result = await confirm.confirm(otp);
      const token = await result.user.getIdToken();
      await verifyTokenWithDjango(token);
    } catch (error) { Alert.alert("Error", "Incorrect OTP!"); setLoading(false); }
  };

  const verifyTokenWithDjango = async (idToken) => { /* Same as before */
    try {
      const response = await axios.post(`${API_BASE}/api/auth/firebase-login/`, { id_token: idToken });
      if (response.data.is_new_user) {
        setIsNewUser(true);
        setRegData({ ...regData, uid: response.data.uid, phone: response.data.phone || phone, email: response.data.email || '' });
      } else {
        await AsyncStorage.setItem('access_token', response.data.access);
        await AsyncStorage.setItem('refresh_token', response.data.refresh);
        navigation.navigate('Lobby'); 
      }
    } catch (error) { Alert.alert("Login Failed", "Could not verify."); } 
    finally { setLoading(false); }
  };

  const handleRegistrationSubmit = async () => {
    // 🔴 NAYA: Legal Validations
    if (!isAgeVerified) return Alert.alert("Hold On!", "You must confirm you are 18+ years old.");
    if (!regData.state || !regData.district) return Alert.alert("Hold On!", "Select your State and District.");
    if (BANNED_STATES.includes(regData.state)) {
      return Alert.alert("Restricted Region", "Real-money gaming is legally restricted in your state as per government guidelines.");
    }
    if (!regData.live_photo) return Alert.alert("Hold On!", "Please capture KYC Live Photo.");
    if (loginMethod === 'google' && !regData.phone) return Alert.alert("Hold On!", "Phone number is mandatory.");
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/complete-registration/`, regData);
      await AsyncStorage.setItem('access_token', response.data.access);
      await AsyncStorage.setItem('refresh_token', response.data.refresh);
      Alert.alert("Success", `Gamer Tag: ${response.data.username}`);
      navigation.navigate('Lobby'); 
    } catch (error) { Alert.alert("Error", error.response?.data?.error || "Registration Failed."); } 
    finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
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
              
              {loginMethod === 'google' && (
                <View style={styles.inputWrapper}><Smartphone size={20} color="#64748b" style={styles.icon} /><TextInput style={styles.input} placeholder="Mobile Number" placeholderTextColor="#64748b" keyboardType="numeric" maxLength={10} onChangeText={(val) => setRegData({...regData, phone: val})} /></View>
              )}

              {loginMethod === 'phone' && (
                <View style={styles.inputWrapper}><Mail size={20} color="#64748b" style={styles.icon} /><TextInput style={styles.input} placeholder="Email Address" placeholderTextColor="#64748b" keyboardType="email-address" onChangeText={(val) => setRegData({...regData, email: val})} /></View>
              )}

              <View style={styles.inputWrapper}><CalendarDays size={20} color="#64748b" style={styles.icon} /><TextInput style={styles.input} placeholder="DOB (YYYY-MM-DD)" placeholderTextColor="#64748b" onChangeText={(val) => setRegData({...regData, dob: val})} /></View>
            
              <View style={{ marginBottom: 15, gap: 10 }}>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={regData.state} style={styles.picker} dropdownIconColor="#64748b" onValueChange={(itemValue) => setRegData({...regData, state: itemValue, district: ''})}>
                    <Picker.Item label="Select State" value="" color="#64748b" />
                    {Object.keys(INDIA_STATES).map(state => <Picker.Item key={state} label={state} value={state} color="#fff" />)}
                  </Picker>
                </View>

                <View style={[styles.pickerWrapper, !regData.state && { opacity: 0.5 }]}>
                  <Picker selectedValue={regData.district} style={styles.picker} dropdownIconColor="#64748b" enabled={!!regData.state} onValueChange={(itemValue) => setRegData({...regData, district: itemValue})}>
                    <Picker.Item label="Select District" value="" color="#64748b" />
                    {regData.state && INDIA_STATES[regData.state].map(dist => <Picker.Item key={dist} label={dist} value={dist} color="#fff" />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Gift size={20} color="#f59e0b" style={styles.icon} />
                <TextInput style={styles.input} placeholder="Referral Code (Optional)" placeholderTextColor="#64748b" autoCapitalize="characters" onChangeText={(val) => setRegData({...regData, referred_by: val.toUpperCase()})} />
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

              {/* 🔴 NAYA: Age Checkbox */}
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsAgeVerified(!isAgeVerified)}>
                {isAgeVerified ? <CheckSquare size={20} color="#10b981" /> : <Square size={20} color="#64748b" />}
                <Text style={styles.checkboxText}>I certify that I am 18+ years old and not playing from restricted states.</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={handleRegistrationSubmit} disabled={loading}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.submitBtn}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>INITIALIZE ACCOUNT</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setLoginMethod('phone')} style={[styles.tab, loginMethod === 'phone' && styles.activeTab]}>
                  <Smartphone size={14} color={loginMethod === 'phone' ? '#fff' : '#64748b'} />
                  <Text style={[styles.tabText, loginMethod === 'phone' && styles.activeTabText]}> SMS OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLoginMethod('google')} style={[styles.tab, loginMethod === 'google' && styles.activeTab]}>
                  <Mail size={14} color={loginMethod === 'google' ? '#fff' : '#64748b'} />
                  <Text style={[styles.tabText, loginMethod === 'google' && styles.activeTabText]}> G-MAIL</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 20 }}>
                {loginMethod === 'phone' ? (
                  !otpSent ? (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={styles.prefixBox}><Text style={styles.prefixText}>+91</Text></View>
                        <TextInput style={[styles.input, { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 15, borderRadius: 12 }]} placeholder="Mobile Number" placeholderTextColor="#64748b" keyboardType="numeric" maxLength={10} value={phone} onChangeText={setPhone} />
                      </View>
                      <TouchableOpacity activeOpacity={0.8} onPress={sendOTP} disabled={loading || timer > 0} style={{ marginTop: 20 }}>
                        {/* 🔴 NAYA: OTP Timer UI */}
                        <LinearGradient colors={timer > 0 ? ['#475569', '#334155'] : ['#2563eb', '#4f46e5']} style={styles.submitBtn}>
                          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{timer > 0 ? `RESEND IN ${timer}S` : "SECURE OTP LOGIN"}</Text>}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>Sent to +91 {phone}</Text>
                        <TouchableOpacity onPress={() => { setOtpSent(false); setTimer(0); }}><Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: 'bold' }}>EDIT</Text></TouchableOpacity>
                      </View>
                      <TextInput style={styles.otpInput} placeholder="------" placeholderTextColor="#334155" keyboardType="numeric" maxLength={6} value={otp} onChangeText={setOtp} secureTextEntry />
                      <TouchableOpacity activeOpacity={0.8} onPress={verifyOTP} disabled={loading} style={{ marginTop: 20 }}>
                        <LinearGradient colors={['#10b981', '#059669']} style={styles.submitBtn}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CONFIRM & ENTER</Text>}</LinearGradient>
                      </TouchableOpacity>
                    </>
                  )
                ) : (
                  <TouchableOpacity activeOpacity={0.8} onPress={handleGoogleLogin} disabled={loading} style={{ marginTop: 10 }}>
                    <View style={styles.googleBtn}>
                      <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={{width: 20, height: 20, marginRight: 10}} />
                      {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.googleBtnText}>AUTHORIZE WITH GOOGLE</Text>}
                    </View>
                  </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#020617', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
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
  pickerWrapper: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, height: 55, justifyContent: 'center' },
  picker: { color: '#fff' },
  otpInput: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 10, paddingVertical: 15 },
  submitBtn: { paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 10 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  googleBtn: { backgroundColor: '#fff', flexDirection: 'row', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  googleBtnText: { color: '#0f172a', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
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
  
  // 🔴 NAYA: Checkbox Styles
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingRight: 15 },
  checkboxText: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold', marginLeft: 10, lineHeight: 16 },
  
  footerText: { color: '#475569', fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 30, letterSpacing: 1, textTransform: 'uppercase' }
});