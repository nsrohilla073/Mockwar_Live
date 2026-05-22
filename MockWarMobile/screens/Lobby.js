import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Wallet, Zap, Swords, User, Search, Gift, Crown, ArrowUpRight, Sparkles, HelpCircle, Hourglass, Users, Activity, IndianRupee, ShieldCheck, LogOut } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = "https://mockwar-backend.onrender.com";

export default function Lobby({ navigation }) {
  const [currentView, setCurrentView] = useState('lobby'); // lobby, wallet, profile
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");

  // Real Data States
  const [walletBalance, setWalletBalance] = useState(0.0);
  const [winningBalance, setWinningBalance] = useState(0.0);
  const [liveTables, setLiveTables] = useState([]);
  
  const [profileData, setProfileData] = useState({});
  const [historyData, setHistoryData] = useState({ matches: [], transactions: [] });
  const [loading, setLoading] = useState(true);

  // 🔴 Fetch All Data (Arena, Profile, History)
  const fetchDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Auth');
        return;
      }

      // 1. Balance & Tables
      const balanceRes = await axios.get(`${API_BASE}/api/payment/wallet-balance/`, { headers: { Authorization: `Bearer ${token}` } });
      setWalletBalance(balanceRes.data.total_balance);
      setWinningBalance(balanceRes.data.winning_balance);
      
      const tablesRes = await axios.get(`${API_BASE}/api/game/live-tables/`, { headers: { Authorization: `Bearer ${token}` } });
      setLiveTables(tablesRes.data.tables);

      // 2. Profile Details
      const profileRes = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
      setProfileData(profileRes.data);

      // 3. Match & Transaction History
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
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePlayGame = (entryFee, tableId) => {
    if (walletBalance >= entryFee) {
       navigation.navigate('Arena', { tableId: tableId });
    } else {
       Alert.alert("Low Balance", `You need ₹${entryFee} to play. Please add cash.`);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <View style={styles.container}>
      {/* 🟢 HEADER NAVBAR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Trophy size={24} color="#facc15" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.logoText}>MOCKWAR</Text>
            <Text style={styles.subLogoText}>Speed & Skill Arena</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}><Crown size={16} color="#facc15" /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Gift size={16} color="#fbbf24" /></TouchableOpacity>
          <TouchableOpacity style={styles.walletBtn} onPress={() => setCurrentView('wallet')}>
            <Wallet size={14} color="#facc15" />
            <Text style={styles.walletText}>₹{parseFloat(walletBalance).toFixed(0)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 🟢 MAIN CONTENT */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{color: '#94a3b8', marginTop: 10, fontWeight: 'bold'}}>Syncing Secure Ledger...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ===================== LOBBY / ARENA TAB ===================== */}
          {currentView === 'lobby' && (
            <View>
              <View style={styles.tickerBox}>
                <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
                <Text style={styles.tickerText}>🏆 {profileData.gamer_tag} just entered the Arena!</Text>
              </View>

              <LinearGradient colors={['#2563eb', '#4f46e5']} style={styles.promoBanner}>
                <Text style={styles.promoTag}>FEATURED</Text>
                <Text style={styles.promoTitle}>WELCOME {profileData.gamer_tag}</Text>
                <Text style={styles.promoDesc}>India's Premium Esports Speed & Skill Arena.</Text>
                <Swords size={40} color="rgba(255,255,255,0.2)" style={{position: 'absolute', right: -5, bottom: -5}} />
              </LinearGradient>

              {/* 🔍 Search Bar */}
              <View style={styles.searchBox}>
                <Search size={18} color="#64748b" style={{marginLeft: 15}} />
                <TextInput style={styles.searchInput} placeholder="Search subjects..." placeholderTextColor="#64748b" value={searchQuery} onChangeText={setSearchQuery}/>
              </View>

              {/* 🎛️ Dynamic Swipe Categories */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15, paddingBottom: 5}}>
                <TouchableOpacity onPress={() => setActiveCategory("All")} style={[styles.filterBtn, activeCategory === "All" ? styles.filterActive : styles.filterInactive]}>
                  <Sparkles size={14} color={activeCategory === "All" ? "#fff" : "#94a3b8"} />
                  <Text style={[styles.filterText, activeCategory === "All" && {color: "#fff"}]}> ALL GAMES</Text>
                </TouchableOpacity>

                {[...new Set(liveTables.map(t => t.category_name))].map(topic => (
                  <TouchableOpacity key={topic} onPress={() => setActiveCategory(topic)} style={[styles.filterBtn, activeCategory === topic ? styles.filterActive : styles.filterInactive]}>
                    <HelpCircle size={14} color={activeCategory === topic ? "#fff" : "#94a3b8"} />
                    <Text style={[styles.filterText, activeCategory === topic && {color: "#fff"}]}> {topic}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* 🃏 SMART LISTING */}
              {liveTables.filter(t => t.category_name.toLowerCase().includes(searchQuery.toLowerCase()) && (activeCategory === "All" || t.category_name === activeCategory)).map((table) => (
                <LinearGradient key={table.id} colors={['#0f172a', '#020617']} style={styles.tableCard}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableTitle}>{table.category_name}</Text>
                  </View>
                  <View style={styles.tableInfoRow}>
                    <View style={styles.tag}><Users size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.max_players} P</Text></View>
                    <View style={styles.tag}><HelpCircle size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.questions_count} Qs</Text></View>
                    <View style={styles.tag}><Hourglass size={10} color="#60a5fa"/><Text style={styles.tagText}> {table.total_time}</Text></View>
                  </View>
                  <View style={styles.tableFooter}>
                    <View>
                      <Text style={styles.prizeLabel}>Prize Pool</Text>
                      <Text style={styles.prizeAmount}>₹{table.prize_pool}</Text>
                    </View>
                    <TouchableOpacity style={styles.playBtn} onPress={() => handlePlayGame(table.entry_fee, table.id)}>
                      <Text style={styles.playBtnText}>Play ₹{table.entry_fee}</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ))}
            </View>
          )}

          {/* ===================== WALLET & HISTORY TAB ===================== */}
          {currentView === 'wallet' && (
            <View style={{ animation: 'fadeIn' }}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
                 <Activity size={20} color="#3b82f6" />
                 <Text style={{color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>ACCOUNT DASHBOARD</Text>
              </View>

              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, {marginBottom: 20}]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                  <View>
                    <Text style={{color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Total Balance</Text>
                    <Text style={{color: '#fff', fontSize: 24, fontWeight: '900'}}>₹{walletBalance}</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={{color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Winnings</Text>
                    <Text style={{color: '#34d399', fontSize: 24, fontWeight: '900'}}>₹{winningBalance}</Text>
                  </View>
                </View>
                
                <View style={{flexDirection: 'row', gap: 10}}>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#2563eb'}]} onPress={() => Alert.alert("Coming Soon", "Native Razorpay Integration pending.")}>
                     <Zap size={16} color="#fff" /><Text style={styles.actionBtnText}>ADD CASH</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={() => Alert.alert("Coming Soon", "Native Withdrawal pending.")}>
                     <IndianRupee size={16} color="#fff" /><Text style={styles.actionBtnText}>WITHDRAW</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Transactions Ledger */}
              <Text style={styles.sectionTitle}> <IndianRupee size={14} color="#facc15"/> PASSBOOK LEDGER</Text>
              <View style={styles.ledgerBox}>
                {historyData.transactions.length === 0 ? (
                  <Text style={{color: '#64748b', textAlign: 'center', padding: 20}}>Zero statements recorded.</Text>
                ) : (
                  historyData.transactions.map((tx, idx) => {
                    const isPlus = ["GAME_WIN", "DEPOSIT", "REFUND", "BONUS"].includes(tx.type);
                    return (
                      <View key={idx} style={styles.ledgerRow}>
                         <View>
                           <Text style={{color: '#e2e8f0', fontSize: 12, fontWeight: 'bold'}}>{tx.type.replace("_", " ")}</Text>
                           <Text style={{color: '#64748b', fontSize: 10, marginTop: 4}}>{tx.date} | {tx.status}</Text>
                         </View>
                         <Text style={{color: isPlus ? '#34d399' : '#ef4444', fontSize: 14, fontWeight: '900', fontFamily: 'monospace'}}>
                           {isPlus ? "+" : "-"}₹{tx.amount}
                         </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ===================== PROFILE TAB ===================== */}
          {currentView === 'profile' && (
            <View>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
                 <ShieldCheck size={20} color="#3b82f6" />
                 <Text style={{color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>GAMER IDENTITY</Text>
              </View>

              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, {alignItems: 'center', marginBottom: 20}]}>
                 {profileData.live_photo ? (
                    <Image source={{ uri: profileData.live_photo }} style={styles.profilePicLrg} />
                 ) : (
                    <View style={[styles.profilePicLrg, {backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center'}]}>
                       <User size={40} color="#64748b" />
                    </View>
                 )}
                 <Text style={{color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 15, textTransform: 'uppercase'}}>{profileData.gamer_tag}</Text>
                 <Text style={{color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase'}}>{profileData.full_name || "PRO PLAYER"}</Text>
                 <View style={{backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: '#34d399', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 10}}>
                    <Text style={{color: '#34d399', fontSize: 10, fontWeight: '900'}}>VERIFIED ELITE</Text>
                 </View>
              </LinearGradient>

              <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                 <View style={styles.statBox}>
                    <Text style={{color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Battles Fought</Text>
                    <Text style={{color: '#e2e8f0', fontSize: 24, fontWeight: '900'}}>{profileData.matches_played}</Text>
                 </View>
                 <View style={styles.statBox}>
                    <Text style={{color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase'}}>Victories</Text>
                    <Text style={{color: '#34d399', fontSize: 24, fontWeight: '900'}}>{profileData.matches_won}</Text>
                 </View>
              </View>

              <View style={styles.ledgerBox}>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoVal}>+91 {profileData.phone}</Text></View>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoVal}>{profileData.email || "Not Linked"}</Text></View>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>DOB</Text><Text style={styles.infoVal}>{profileData.dob || "Not Provided"}</Text></View>
                 <View style={styles.infoRow}><Text style={styles.infoLabel}>State</Text><Text style={styles.infoVal}>{profileData.state || "Not Provided"}</Text></View>
                 <View style={[styles.infoRow, {borderBottomWidth: 0}]}><Text style={styles.infoLabel}>District</Text><Text style={styles.infoVal}>{profileData.district || "Not Provided"}</Text></View>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                 <LogOut size={16} color="#ef4444" />
                 <Text style={{color: '#ef4444', fontSize: 14, fontWeight: '900', marginLeft: 8, letterSpacing: 1}}>SIGN OUT</Text>
              </TouchableOpacity>

            </View>
          )}

        </ScrollView>
      )}

      {/* 🟢 CUSTOM BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('lobby')}>
          <Swords size={22} color={currentView === 'lobby' ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'lobby' && {color: '#3b82f6'}]}>ARENA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('wallet')}>
          <Wallet size={22} color={currentView === 'wallet' ? '#eab308' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'wallet' && {color: '#eab308'}]}>WALLET</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('profile')}>
          <User size={22} color={currentView === 'profile' ? '#10b981' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'profile' && {color: '#10b981'}]}>PROFILE</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// 🎨 STYLESHEET
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: 'rgba(2, 6, 23, 0.9)', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
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
  ledgerBox: { backgroundColor: '#0f172a', borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  
  profilePicLrg: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#3b82f6' },
  statBox: { flex: 1, backgroundColor: '#0f172a', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', alignItems: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  infoLabel: { color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  infoVal: { color: '#e2e8f0', fontSize: 14, fontWeight: '900' },
  logoutBtn: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center', marginTop: 20 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(2, 6, 23, 0.95)', borderTopWidth: 1, borderTopColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' },
  navText: { fontSize: 10, fontWeight: '900', marginTop: 5, letterSpacing: 1 }
});