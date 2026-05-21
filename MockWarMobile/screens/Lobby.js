import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, Image, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Wallet, Zap, Swords, User, Search, Gift, Crown, ArrowUpRight, Sparkles, HelpCircle, Hourglass, Users, Activity, IndianRupee, ShieldCheck, LogOut, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = "https://mockwar-backend.onrender.com";

export default function Lobby({ navigation }) {
  const [currentView, setCurrentView] = useState('lobby'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");

  const [walletBalance, setWalletBalance] = useState(0.0);
  const [winningBalance, setWinningBalance] = useState(0.0);
  const [liveTables, setLiveTables] = useState([]);
  
  const [profileData, setProfileData] = useState({});
  const [historyData, setHistoryData] = useState({ matches: [], transactions: [] });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 🔴 NAYA: Pull to Refresh ke liye
  const [isJoining, setIsJoining] = useState(false);

  // Modal States
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [upiInput, setUpiInput] = useState('');

  // 🔴 NAYA FIX: Silent Loading (Agar isSilent true hai, toh poori screen block nahi hogi)
  const fetchDashboardData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) { navigation.navigate('Auth'); return; }

      const balanceRes = await axios.get(`${API_BASE}/api/payment/wallet-balance/`, { headers: { Authorization: `Bearer ${token}` } });
      setWalletBalance(balanceRes.data.total_balance);
      setWinningBalance(balanceRes.data.winning_balance);
      
      const tablesRes = await axios.get(`${API_BASE}/api/game/live-tables/`, { headers: { Authorization: `Bearer ${token}` } });
      setLiveTables(tablesRes.data.tables);

      const profileRes = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
      setProfileData(profileRes.data);

      const historyRes = await axios.get(`${API_BASE}/api/user/dashboard-history/`, { headers: { Authorization: `Bearer ${token}` } });
      setHistoryData(historyRes.data);

    } catch (error) {
      console.log("Error fetching data:", error);
      if (error.response?.status === 401) {
        Alert.alert("Session Expired", "Please login again.");
        handleLogout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🔴 NAYA FIX: Pull to refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(true); // Silent true rakhenge taaki jhatka na lage
  }, []);

  // 🔴 NAYA FIX: Jab game se wapas aao, toh chupke se data update karo bina Loading screen dikhaye
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(true); 
    }, [])
  );

  const handlePlayGame = async (entryFee, tableSlug) => {
    if (isJoining) return;
    if (walletBalance >= entryFee) {
      setIsJoining(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        const response = await axios.post(`${API_BASE}/api/game/play/`, 
          { entry_fee: entryFee }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.data.success) {
          navigation.navigate('Arena', { tableId: tableSlug });
        }
      } catch (error) {
        Alert.alert("Error", error.response?.data?.error || "Couldn't secure entry fee.");
      } finally {
        setIsJoining(false);
      }
    } else {
       Alert.alert("Low Balance", `You need ₹${entryFee} to play. Please add cash.`);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!amountInput || amountInput < 50) return Alert.alert("Hold On!", "Minimum withdrawal is ₹50.");
    if (amountInput > winningBalance) return Alert.alert("Hold On!", `Max withdrawable is ₹${winningBalance}.`);
    if (!upiInput) return Alert.alert("Missing Info", "Please enter a valid UPI ID.");
    
    setWithdrawModal(false);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(`${API_BASE}/api/payment/withdraw/`, { amount: amountInput, upi_id: upiInput }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert("Request Placed!", "Withdrawal is PENDING. Admin will process it shortly.");
      fetchDashboardData(true);
      setAmountInput(''); setUpiInput('');
    } catch (error) {
      Alert.alert("Withdrawal Failed", error.response?.data?.error || "Server error.");
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* DEPOSIT MODAL */}
      <Modal visible={depositModal} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDepositModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            <Text style={styles.modalTitle}><Zap size={18} color="#60a5fa" /> Add Cash</Text>
            <View style={styles.modalInputBox}>
              <Text style={styles.rupeeSign}>₹</Text>
              <TextInput style={styles.modalInput} placeholder="0" placeholderTextColor="#64748b" keyboardType="numeric" value={amountInput} onChangeText={setAmountInput} />
            </View>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={() => Alert.alert("Coming Soon", "Razorpay integration pending.")}>
              <Text style={styles.modalSubmitText}>PROCEED TO PAY</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WITHDRAW MODAL */}
      <Modal visible={withdrawModal} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setWithdrawModal(false)}><X size={20} color="#64748b" /></TouchableOpacity>
            <Text style={[styles.modalTitle, {color: '#34d399'}]}><IndianRupee size={18} color="#34d399" /> Withdraw Winnings</Text>
            <Text style={styles.withdrawLimit}>Max Withdrawable: ₹{winningBalance}</Text>
            <View style={[styles.modalInputBox, {marginBottom: 10}]}>
              <Text style={styles.rupeeSign}>₹</Text>
              <TextInput style={styles.modalInput} placeholder="Enter Amount" placeholderTextColor="#64748b" keyboardType="numeric" value={amountInput} onChangeText={setAmountInput} />
            </View>
            <TextInput style={[styles.modalInputBox, {fontSize: 14}]} placeholder="Enter UPI ID (e.g. name@okhdfc)" placeholderTextColor="#64748b" value={upiInput} onChangeText={setUpiInput} />
            <TouchableOpacity style={[styles.modalSubmitBtn, {backgroundColor: '#10b981'}]} onPress={handleWithdrawRequest}>
              <Text style={styles.modalSubmitText}>SEND REQUEST</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Trophy size={24} color="#facc15" />
          <View style={{ marginLeft: 8 }}><Text style={styles.logoText}>MOCKWAR</Text><Text style={styles.subLogoText}>Speed & Skill Arena</Text></View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}><Crown size={16} color="#facc15" /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Gift size={16} color="#fbbf24" /></TouchableOpacity>
          <TouchableOpacity style={styles.walletBtn} onPress={() => setCurrentView('wallet')}><Wallet size={14} color="#facc15" /><Text style={styles.walletText}>₹{parseFloat(walletBalance).toFixed(0)}</Text></TouchableOpacity>
        </View>
      </View>

      {/* 🔴 FIX: Agar data aa chuka hai, toh Loading nahi dikhayenge, direct screen dikhayenge */}
      {loading && !profileData.gamer_tag ? (
        <View style={styles.centerLoading}><ActivityIndicator size="large" color="#3b82f6" /><Text style={{color: '#94a3b8', marginTop: 10, fontWeight: 'bold'}}>Syncing Secure Ledger...</Text></View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          // 🔴 NAYA FIX: Pull to Refresh yahan lagaya hai
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={["#3b82f6"]} />}
        >
          
          {currentView === 'lobby' && (
            <View>
              <View style={styles.tickerBox}><View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View><Text style={styles.tickerText}>🏆 {profileData.gamer_tag} just entered the Arena!</Text></View>
              <LinearGradient colors={['#2563eb', '#4f46e5']} style={styles.promoBanner}><Text style={styles.promoTag}>FEATURED</Text><Text style={styles.promoTitle}>WELCOME {profileData.gamer_tag}</Text><Text style={styles.promoDesc}>India's Premium Esports Speed & Skill Arena.</Text><Swords size={40} color="rgba(255,255,255,0.2)" style={{position: 'absolute', right: -5, bottom: -5}} /></LinearGradient>
              
              <View style={styles.searchBox}><Search size={18} color="#64748b" style={{marginLeft: 15}} /><TextInput style={styles.searchInput} placeholder="Search subjects..." placeholderTextColor="#64748b" value={searchQuery} onChangeText={setSearchQuery}/></View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15, paddingBottom: 5}}>
                <TouchableOpacity onPress={() => setActiveCategory("All")} style={[styles.filterBtn, activeCategory === "All" ? styles.filterActive : styles.filterInactive]}><Sparkles size={14} color={activeCategory === "All" ? "#fff" : "#94a3b8"} /><Text style={[styles.filterText, activeCategory === "All" && {color: "#fff"}]}> ALL GAMES</Text></TouchableOpacity>
                {[...new Set(liveTables.map(t => t.category_name))].map(topic => (
                  <TouchableOpacity key={topic} onPress={() => setActiveCategory(topic)} style={[styles.filterBtn, activeCategory === topic ? styles.filterActive : styles.filterInactive]}><HelpCircle size={14} color={activeCategory === topic ? "#fff" : "#94a3b8"} /><Text style={[styles.filterText, activeCategory === topic && {color: "#fff"}]}> {topic}</Text></TouchableOpacity>
                ))}
              </ScrollView>

              {liveTables.filter(t => t.category_name.toLowerCase().includes(searchQuery.toLowerCase()) && (activeCategory === "All" || t.category_name === activeCategory)).map((table) => (
                <LinearGradient key={table.id} colors={['#0f172a', '#020617']} style={styles.tableCard}>
                  <View style={styles.tableHeader}><Text style={styles.tableTitle}>{table.category_name}</Text></View>
                  <View style={styles.tableInfoRow}>
                    <View style={styles.tag}><Users size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.max_players} P</Text></View>
                    <View style={styles.tag}><HelpCircle size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.questions_count} Qs</Text></View>
                    <View style={styles.tag}><Hourglass size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.total_time}</Text></View>
                  </View>
                  <View style={styles.tableFooter}>
                    <View><Text style={styles.prizeLabel}>Prize Pool</Text><Text style={styles.prizeAmount}>₹{table.prize_pool}</Text></View>
                    <TouchableOpacity style={styles.playBtn} onPress={() => handlePlayGame(table.entry_fee, table.id)} disabled={isJoining}><Text style={styles.playBtnText}>{isJoining ? "WAIT..." : `Play ₹${table.entry_fee}`}</Text></TouchableOpacity>
                  </View>
                </LinearGradient>
              ))}
            </View>
          )}

          {currentView === 'wallet' && (
            <View>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}><Activity size={20} color="#3b82f6" /><Text style={{color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>ACCOUNT DASHBOARD</Text></View>
              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, {marginBottom: 20}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                  <View><Text style={{color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Total Balance</Text><Text style={{color: '#fff', fontSize: 24, fontWeight: '900'}}>₹{walletBalance}</Text></View>
                  <View style={{alignItems: 'flex-end'}}><Text style={{color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Winnings</Text><Text style={{color: '#34d399', fontSize: 24, fontWeight: '900'}}>₹{winningBalance}</Text></View>
                </View>
                <View style={{flexDirection: 'row', gap: 10}}>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#2563eb'}]} onPress={() => {setAmountInput(''); setDepositModal(true);}}><Zap size={16} color="#fff" /><Text style={styles.actionBtnText}>ADD CASH</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={() => {setAmountInput(''); setUpiInput(''); setWithdrawModal(true);}}><IndianRupee size={16} color="#fff" /><Text style={styles.actionBtnText}>WITHDRAW</Text></TouchableOpacity>
                </View>
              </LinearGradient>

              <Text style={styles.sectionTitle}> <Swords size={14} color="#8b5cf6"/> RECENT BATTLES</Text>
              <View style={[styles.ledgerBox, {marginBottom: 20}]}>
                {historyData.matches.length === 0 ? (
                  <Text style={{color: '#64748b', textAlign: 'center', padding: 20}}>No battles fought yet.</Text>
                ) : (
                  historyData.matches.map((m, idx) => (
                    <View key={idx} style={styles.ledgerRow}>
                       <View>
                         <Text style={{color: '#e2e8f0', fontSize: 12, fontWeight: 'bold'}}>{m.topic}</Text>
                         <Text style={{color: '#64748b', fontSize: 10, marginTop: 4}}>{m.date} | SCORE: <Text style={{color: '#60a5fa', fontWeight: 'bold'}}>{m.score}</Text></Text>
                       </View>
                       <View style={{alignItems: 'flex-end'}}>
                         <Text style={{color: m.is_winner ? '#34d399' : '#ef4444', fontSize: 12, fontWeight: '900', letterSpacing: 1}}>{m.is_winner ? 'VICTORY' : 'DEFEAT'}</Text>
                         <Text style={{color: m.is_winner ? '#34d399' : '#64748b', fontSize: 12, fontWeight: 'bold', marginTop: 2}}>{m.is_winner ? `+₹${m.prize}` : '₹0'}</Text>
                       </View>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.sectionTitle}> <IndianRupee size={14} color="#facc15"/> PASSBOOK LEDGER</Text>
              <View style={styles.ledgerBox}>
                {historyData.transactions.length === 0 ? (
                  <Text style={{color: '#64748b', textAlign: 'center', padding: 20}}>Zero statements recorded.</Text>
                ) : (
                  historyData.transactions.map((tx, idx) => {
                    const isPlus = ["GAME_WIN", "DEPOSIT", "REFUND", "BONUS"].includes(tx.type);
                    return (
                      <View key={idx} style={styles.ledgerRow}>
                         <View><Text style={{color: '#e2e8f0', fontSize: 12, fontWeight: 'bold'}}>{tx.type.replace("_", " ")}</Text><Text style={{color: '#64748b', fontSize: 10, marginTop: 4}}>{tx.date} | {tx.status}</Text></View>
                         <Text style={{color: isPlus ? '#34d399' : '#ef4444', fontSize: 14, fontWeight: '900', fontFamily: 'monospace'}}>{isPlus ? "+" : "-"}₹{tx.amount}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {currentView === 'profile' && (
            <View>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}><ShieldCheck size={20} color="#3b82f6" /><Text style={{color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>GAMER IDENTITY</Text></View>
              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, {alignItems: 'center', marginBottom: 20}]}>
                 {profileData.live_photo ? <Image source={{ uri: profileData.live_photo }} style={styles.profilePicLrg} /> : <View style={[styles.profilePicLrg, {backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center'}]}><User size={40} color="#64748b" /></View>}
                 <Text style={{color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 15, textTransform: 'uppercase'}}>{profileData.gamer_tag}</Text>
                 <Text style={{color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase'}}>{profileData.full_name || "PRO PLAYER"}</Text>
                 <View style={{backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: '#34d399', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 10}}><Text style={{color: '#34d399', fontSize: 10, fontWeight: '900'}}>VERIFIED ELITE</Text></View>
              </LinearGradient>
              <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                 <View style={styles.statBox}><Text style={{color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Battles Fought</Text><Text style={{color: '#e2e8f0', fontSize: 24, fontWeight: '900'}}>{profileData.matches_played}</Text></View>
                 <View style={styles.statBox}><Text style={{color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Victories</Text><Text style={{color: '#34d399', fontSize: 24, fontWeight: '900'}}>{profileData.matches_won}</Text></View>
              </View>
              <View style={styles.ledgerBox}>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoVal}>+91 {profileData.phone}</Text></View>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoVal}>{profileData.email || "Not Linked"}</Text></View>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>State</Text><Text style={styles.infoVal}>{profileData.state || "Not Provided"}</Text></View>
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><LogOut size={16} color="#ef4444" /><Text style={{color: '#ef4444', fontSize: 14, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>SIGN OUT</Text></TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* 🟢 CUSTOM BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('lobby')}><Swords size={22} color={currentView === 'lobby' ? '#3b82f6' : '#64748b'} /><Text style={[styles.navText, currentView === 'lobby' && {color: '#3b82f6'}]}>ARENA</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('wallet')}><Wallet size={22} color={currentView === 'wallet' ? '#eab308' : '#64748b'} /><Text style={[styles.navText, currentView === 'wallet' && {color: '#eab308'}]}>WALLET</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('profile')}><User size={22} color={currentView === 'profile' ? '#10b981' : '#64748b'} /><Text style={[styles.navText, currentView === 'profile' && {color: '#10b981'}]}>PROFILE</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#0f172a', width: '100%', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { color: '#60a5fa', fontSize: 20, fontWeight: '900', textTransform: 'uppercase', marginBottom: 20 },
  closeBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
  modalInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 20 },
  rupeeSign: { color: '#64748b', fontSize: 20, fontWeight: '900', marginRight: 10 },
  modalInput: { flex: 1, color: '#fff', fontSize: 20, fontWeight: 'bold' },
  withdrawLimit: { color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, marginTop: -10 },
  modalSubmitBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 12, alignItems: 'center' },
  modalSubmitText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#020617', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5 },
  subLogoText: { color: '#60a5fa', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 8, backgroundColor: 'rgba(250, 204, 21, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(250, 204, 21, 0.3)' },
  walletBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  walletText: { color: '#facc15', fontWeight: '900', fontSize: 14, marginLeft: 5 },
  scrollContent: { padding: 15, paddingBottom: 100 },
  tickerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', padding: 10, borderRadius: 12, marginBottom: 20 },
  liveBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  tickerText: { color: '#93c5fd', fontSize: 12, fontWeight: 'bold', flex: 1 },
  promoBanner: { padding: 25, borderRadius: 24, marginBottom: 20, overflow: 'hidden' },
  promoTag: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900', borderRadius: 6, marginBottom: 10 },
  promoTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontStyle: 'italic', marginBottom: 5 },
  promoDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 'bold' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 16, height: 50, marginBottom: 20 },
  searchInput: { flex: 1, color: '#fff', paddingHorizontal: 15, fontSize: 14, fontWeight: 'bold' },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1 },
  filterActive: { backgroundColor: '#2563eb', borderColor: '#3b82f6' },
  filterInactive: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  filterText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  tableCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 15 },
  tableHeader: { borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 15, marginBottom: 15 },
  tableTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  tableInfoRow: { flexDirection: 'row', gap: 10, marginBottom: 15, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  tagText: { color: '#60a5fa', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  tableFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prizeLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  prizeAmount: { color: '#34d399', fontSize: 24, fontWeight: '900' },
  playBtn: { flexDirection: 'row', backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  playBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1, marginLeft: 8 },
  ledgerBox: { backgroundColor: '#0f172a', borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden', marginBottom: 20 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  profilePicLrg: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#3b82f6' },
  statBox: { flex: 1, backgroundColor: '#0f172a', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  infoVal: { color: '#e2e8f0', fontSize: 14, fontWeight: '900' },
  logoutBtn: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(2, 6, 23, 0.95)', borderTopWidth: 1, borderTopColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' },
  navText: { fontSize: 10, fontWeight: '900', marginTop: 5, letterSpacing: 1 }
});