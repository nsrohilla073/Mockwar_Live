import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, Image, Modal, Share } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Wallet, Zap, Swords, User, Search, Gift, Crown, Sparkles, HelpCircle, Hourglass, Users, Activity, IndianRupee, ShieldCheck, LogOut, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import RazorpayCheckout from 'react-native-razorpay';

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

  // 💰 Modals & Loading States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [upiInput, setUpiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 🏆 Leaderboard & Bonus States
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardCategory, setLeaderboardCategory] = useState(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // 🌟 NAYA: Web jaisa Ticker aur Slider States
  const [tickerIndex, setTickerIndex] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  const tickerItems = [
    `🏆 ${profileData.gamer_tag || 'Player'} just entered the Arena!`,
    "⚡ Neha_Kill withdrew ₹1,200 instantly via UPI.",
    "🔥 Vikas_OP joined Elite Typing Battle.",
    "💰 Mega Tournament Prize Pool reached ₹1,00,000!"
  ];

  const promoSlides = [
    { title: "WELCOME TO MOCKWAR", desc: "India's Premium Esports Speed & Skill Arena.", color1: '#2563eb', color2: '#4f46e5' },
    { title: "INSTANT WITHDRAWALS", desc: "100% Safe & Secure. Transfer winnings via UPI.", color1: '#059669', color2: '#0f766e' },
    { title: "PROVE YOUR SKILLS", desc: "Dominate Live Quizzes & Typing Battles!", color1: '#9333ea', color2: '#db2777' }
  ];

  const fetchDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.navigate('Auth');
        return;
      }

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
  }, [currentView]);

  // 🌟 NAYA: Slider aur Ticker ka Timer
  useEffect(() => {
    if (currentView !== 'lobby') return;
    const tickerInterval = setInterval(() => setTickerIndex(prev => (prev + 1) % tickerItems.length), 3500);
    const slideInterval = setInterval(() => setCurrentSlide(prev => (prev + 1) % promoSlides.length), 4000);
    
    return () => {
      clearInterval(tickerInterval);
      clearInterval(slideInterval);
    };
  }, [currentView, profileData]);

  // 🔴 SECURE FIX: Frontend se paise deduct nahi honge, server table_id se khud deduct karega
  const handlePlayGame = async (entryFee, tableId) => {
    if (walletBalance >= entryFee) {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const response = await axios.post(`${API_BASE}/api/game/play/`, { table_id: tableId }, { headers: { Authorization: `Bearer ${token}` } });
        
        if (response.data.success) {
          navigation.navigate('Arena', { tableId: tableId });
        }
      } catch (error) {
        Alert.alert("Hold On!", error.response?.data?.error || "Could not process entry fee. Try again.");
      }
    } else {
      Alert.alert("Low Balance", `You need ₹${entryFee} to play. Please add cash.`);
    }
  };

  // 🎁 Daily Bonus Claim Function
  const handleClaimBonus = async () => {
    setIsClaiming(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.post(`${API_BASE}/api/payment/claim-bonus/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchDashboardData();
      Alert.alert("Bonus Claimed! 🎁", response.data.message || "₹5 Bonus Cash added to your wallet!");
    } catch (error) {
      Alert.alert("Hold On!", error.response?.data?.error || "You have already claimed today's bonus.");
    } finally {
      setIsClaiming(false);
    }
  };

  // 👑 Fetch Leaderboard Function
  const fetchLeaderboard = async (tableId) => {
    setLeaderboardCategory(tableId);
    setLeaderboardLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${API_BASE}/api/game/leaderboard/${tableId}/`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaderboardData(res.data.leaderboard || []);
    } catch (error) {
      console.log("Leaderboard error", error);
      setLeaderboardData([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // 💳 Razorpay Add Cash Function
  const handleAddCashSubmit = async () => {
    if (!amountInput || isNaN(amountInput) || Number(amountInput) <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const response = await axios.post(`${API_BASE}/api/payment/create-order/`, { amount: amountInput }, { headers: { Authorization: `Bearer ${token}` } });

      const { order_id, key_id } = response.data;

      const options = {
        description: 'Add cash to MockWar Wallet',
        image: 'https://mockwar.in/logo.png',
        currency: 'INR',
        key: key_id,
        amount: Number(amountInput) * 100,
        name: 'MockWar Gaming',
        order_id: order_id,
        theme: { color: '#3b82f6' }
      };

      RazorpayCheckout.open(options).then(async (data) => {
        await axios.post(`${API_BASE}/api/payment/verify/`, {
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        }, { headers: { Authorization: `Bearer ${token}` } });

        Alert.alert("Success!", `₹${amountInput} successfully added to your wallet.`);
        setShowDepositModal(false);
        setAmountInput('');
        fetchDashboardData();
      }).catch((error) => {
        Alert.alert("Payment Failed", "Transaction was cancelled or failed.");
      });

    } catch (error) {
      Alert.alert("Error", "Could not initiate payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 💸 Withdraw Request Function
  const handleWithdrawSubmit = async () => {
    if (!amountInput || Number(amountInput) < 50) return Alert.alert("Hold On!", "Minimum withdrawal amount is ₹50.");
    if (Number(amountInput) > winningBalance) return Alert.alert("Hold On!", `You only have ₹${winningBalance} in Winnings.`);
    if (!upiInput) return Alert.alert("Missing Info", "Please enter your valid UPI ID.");

    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(`${API_BASE}/api/payment/withdraw/`, {
        amount: amountInput,
        upi_id: upiInput
      }, { headers: { Authorization: `Bearer ${token}` } });

      Alert.alert("Request Placed!", "Withdrawal is PENDING. Admin will process it shortly.");
      setShowWithdrawModal(false);
      setAmountInput('');
      setUpiInput('');
      fetchDashboardData();
    } catch (error) {
      Alert.alert("Withdrawal Failed", error.response?.data?.error || "Server error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  return (
    <View style={styles.container}>

      {/* 💳 DEPOSIT MODAL */}
      <Modal visible={showDepositModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDepositModal(false)}><X size={20} color="#94a3b8" /></TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Zap size={20} color="#3b82f6" /><Text style={styles.modalTitle}> ADD CASH</Text>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Amount (₹)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={amountInput}
              onChangeText={setAmountInput}
            />
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddCashSubmit} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>PROCEED TO PAY</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 💸 WITHDRAW MODAL */}
      <Modal visible={showWithdrawModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowWithdrawModal(false)}><X size={20} color="#94a3b8" /></TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <IndianRupee size={20} color="#10b981" /><Text style={[styles.modalTitle, { color: '#10b981' }]}> WITHDRAW</Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 20, fontWeight: 'bold' }}>Max Withdrawable: <Text style={{ color: '#34d399' }}>₹{winningBalance}</Text></Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Amount (Min ₹50)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={amountInput}
              onChangeText={setAmountInput}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Enter UPI ID (e.g. yourname@upi)"
              placeholderTextColor="#64748b"
              value={upiInput}
              onChangeText={setUpiInput}
            />
            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#10b981' }]} onPress={handleWithdrawSubmit} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>SEND REQUEST</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 👑 HALL OF FAME MODAL */}
      <Modal visible={showLeaderboard} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLeaderboard(false)}><X size={20} color="#94a3b8" /></TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <Crown size={22} color="#facc15" /><Text style={[styles.modalTitle, { color: '#facc15', marginLeft: 8 }]}>HALL OF FAME</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15, maxHeight: 40 }}>
              {liveTables.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => fetchLeaderboard(t.id)}
                  style={{ backgroundColor: leaderboardCategory === t.id ? '#f59e0b' : '#1e293b', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, marginRight: 10, height: 35, justifyContent: 'center' }}
                >
                  <Text style={{ color: leaderboardCategory === t.id ? '#000' : '#94a3b8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                    {t.category_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ backgroundColor: '#020617', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#1e293b', minHeight: 250 }}>
              {leaderboardLoading ? (
                <ActivityIndicator size="large" color="#facc15" style={{ marginTop: 50 }} />
              ) : leaderboardData.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                  <Trophy size={40} color="#334155" />
                  <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold', marginTop: 10 }}>The throne is empty. Play now!</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {leaderboardData.map((player, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: idx === 0 ? 'rgba(250, 204, 21, 0.1)' : idx === 1 ? 'rgba(203, 213, 225, 0.1)' : idx === 2 ? 'rgba(217, 119, 6, 0.1)' : '#0f172a', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: idx === 0 ? 'rgba(250, 204, 21, 0.3)' : 'transparent' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: idx === 0 ? '#facc15' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#d97706' : '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Text style={{ color: idx < 3 ? '#000' : '#fff', fontSize: 10, fontWeight: '900' }}>{idx + 1}</Text>
                        </View>
                        <Text style={{ color: idx === 0 ? '#facc15' : '#fff', fontWeight: 'bold', fontSize: 14 }}>{player.username}</Text>
                      </View>
                      <Text style={{ color: '#34d399', fontWeight: '900', fontFamily: 'monospace', fontSize: 16 }}>{player.score}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

          </View>
        </View>
      </Modal>

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
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setShowLeaderboard(true);
              if (liveTables.length > 0) fetchLeaderboard(liveTables[0].id);
            }}
          >
            <Crown size={16} color="#facc15" />
          </TouchableOpacity>
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
          <Text style={{ color: '#94a3b8', marginTop: 10, fontWeight: 'bold' }}>Syncing Secure Ledger...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ===================== LOBBY / ARENA TAB ===================== */}
          {currentView === 'lobby' && (
            <View>
              {/* 🌟 Web Jaisa Dynamic Ticker */}
              <View style={styles.tickerBox}>
                <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
                <Text style={styles.tickerText}>{tickerItems[tickerIndex]}</Text>
              </View>

              {/* 🌟 Web Jaisa Auto Sliding Banner */}
              <LinearGradient colors={[promoSlides[currentSlide].color1, promoSlides[currentSlide].color2]} style={styles.promoBanner}>
                <Text style={styles.promoTag}>FEATURED</Text>
                <Text style={styles.promoTitle}>{promoSlides[currentSlide].title}</Text>
                <Text style={styles.promoDesc}>{promoSlides[currentSlide].desc}</Text>
                <Swords size={40} color="rgba(255,255,255,0.2)" style={{ position: 'absolute', right: -5, bottom: -5 }} />
              </LinearGradient>

              {/* 🎁 DAILY REWARD BOX */}
              <TouchableOpacity
                onPress={handleClaimBonus}
                disabled={isClaiming}
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: 10, borderRadius: 12, marginRight: 15 }}>
                    <Gift size={24} color="#facc15" />
                  </View>
                  <View>
                    <Text style={{ color: '#facc15', fontWeight: '900', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>Daily Bonus Ready</Text>
                    <Text style={{ color: '#fde68a', fontSize: 10, fontWeight: 'bold' }}>Claim your free ₹5 cash now!</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 }}>
                  {isClaiming ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ color: '#000', fontWeight: '900', fontSize: 10 }}>CLAIM</Text>}
                </View>
              </TouchableOpacity>

              {/* 🔍 Search Bar */}
              <View style={styles.searchBox}>
                <Search size={18} color="#64748b" style={{ marginLeft: 15 }} />
                <TextInput style={styles.searchInput} placeholder="Search subjects..." placeholderTextColor="#64748b" value={searchQuery} onChangeText={setSearchQuery} />
              </View>

              {/* 🎛️ Dynamic Swipe Categories */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15, paddingBottom: 5 }}>
                <TouchableOpacity onPress={() => setActiveCategory("All")} style={[styles.filterBtn, activeCategory === "All" ? styles.filterActive : styles.filterInactive]}>
                  <Sparkles size={14} color={activeCategory === "All" ? "#fff" : "#94a3b8"} />
                  <Text style={[styles.filterText, activeCategory === "All" && { color: "#fff" }]}> ALL GAMES</Text>
                </TouchableOpacity>

                {[...new Set(liveTables.map(t => t.category_name))].map(topic => (
                  <TouchableOpacity key={topic} onPress={() => setActiveCategory(topic)} style={[styles.filterBtn, activeCategory === topic ? styles.filterActive : styles.filterInactive]}>
                    <HelpCircle size={14} color={activeCategory === topic ? "#fff" : "#94a3b8"} />
                    <Text style={[styles.filterText, activeCategory === topic && { color: "#fff" }]}> {topic}</Text>
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
                    <View style={styles.tag}><Users size={10} color="#60a5fa" /><Text style={styles.tagText}> {table.max_players} P</Text></View>
                    <View style={styles.tag}><HelpCircle size={10} color="#60a5fa" /><Text style={styles.tagText}> {table.questions_count} Qs</Text></View>
                    <View style={styles.tag}><Hourglass size={10} color="#60a5fa" /><Text style={styles.tagText}> {table.total_time}</Text></View>
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
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Activity size={20} color="#3b82f6" />
                <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1 }}>ACCOUNT DASHBOARD</Text>
              </View>

              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, { marginBottom: 20 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                  <View>
                    <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Total Balance</Text>
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>₹{walletBalance}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Winnings</Text>
                    <Text style={{ color: '#34d399', fontSize: 24, fontWeight: '900' }}>₹{winningBalance}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2563eb' }]} onPress={() => { setAmountInput(''); setShowDepositModal(true); }}>
                    <Zap size={16} color="#fff" /><Text style={styles.actionBtnText}>ADD CASH</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]} onPress={() => { setAmountInput(''); setUpiInput(''); setShowWithdrawModal(true); }}>
                    <IndianRupee size={16} color="#fff" /><Text style={styles.actionBtnText}>WITHDRAW</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Recent Battles / Played Quizzes */}
              <Text style={styles.sectionTitle}> <Swords size={14} color="#60a5fa" /> RECENT BATTLES</Text>
              <View style={[styles.ledgerBox, { marginBottom: 20 }]}>
                {historyData.matches && historyData.matches.length === 0 ? (
                  <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>No battles fought yet.</Text>
                ) : (
                  historyData.matches && historyData.matches.map((m, idx) => (
                    <View key={idx} style={styles.ledgerRow}>
                      <View>
                        <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 'bold' }}>{m.topic}</Text>
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>{m.date} | SCORE: <Text style={{ color: '#60a5fa' }}>{m.score}</Text></Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: m.is_winner ? '#34d399' : '#ef4444', fontSize: 10, fontWeight: '900' }}>{m.is_winner ? 'VICTORY' : 'DEFEAT'}</Text>
                        <Text style={{ color: m.is_winner ? '#34d399' : '#64748b', fontSize: 14, fontWeight: '900', fontFamily: 'monospace', marginTop: 2 }}>
                          {m.is_winner ? `+₹${m.prize}` : '₹0'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Transactions Ledger */}
              <Text style={styles.sectionTitle}> <IndianRupee size={14} color="#facc15" /> PASSBOOK LEDGER</Text>
              <View style={styles.ledgerBox}>
                {historyData.transactions.length === 0 ? (
                  <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Zero statements recorded.</Text>
                ) : (
                  historyData.transactions.map((tx, idx) => {
                    const isPlus = ["GAME_WIN", "DEPOSIT", "REFUND", "BONUS"].includes(tx.type);
                    return (
                      <View key={idx} style={styles.ledgerRow}>
                        <View>
                          <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 'bold' }}>{tx.type.replace("_", " ")}</Text>
                          <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>{tx.date} | {tx.status}</Text>
                        </View>
                        <Text style={{ color: isPlus ? '#34d399' : '#ef4444', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <ShieldCheck size={20} color="#3b82f6" />
                <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 1 }}>GAMER IDENTITY</Text>
              </View>

              <LinearGradient colors={['#0f172a', '#020617']} style={[styles.tableCard, { alignItems: 'center', marginBottom: 20 }]}>
                {profileData.live_photo ? (
                  <Image source={{ uri: profileData.live_photo }} style={styles.profilePicLrg} />
                ) : (
                  <View style={[styles.profilePicLrg, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
                    <User size={40} color="#64748b" />
                  </View>
                )}
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 15, textTransform: 'uppercase' }}>{profileData.gamer_tag}</Text>
                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>{profileData.full_name || "PRO PLAYER"}</Text>
                <View style={{ backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: '#34d399', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 10 }}>
                  <Text style={{ color: '#34d399', fontSize: 10, fontWeight: '900' }}>VERIFIED ELITE</Text>
                </View>
              </LinearGradient>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={styles.statBox}>
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Battles Fought</Text>
                  <Text style={{ color: '#e2e8f0', fontSize: 24, fontWeight: '900' }}>{profileData.matches_played}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={{ color: '#34d399', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Victories</Text>
                  <Text style={{ color: '#34d399', fontSize: 24, fontWeight: '900' }}>{profileData.matches_won}</Text>
                </View>
              </View>

              {/* 🔥 NATIVE SHARE (REFER & EARN) */}
              <LinearGradient colors={['rgba(245,158,11,0.2)', 'rgba(234,88,12,0.2)']} style={[styles.tableCard, { borderColor: 'rgba(245,158,11,0.4)', marginTop: 10, marginBottom: 20 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Gift size={20} color="#f59e0b" /><Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '900', marginLeft: 8, textTransform: 'uppercase' }}> REFER & WIN ₹50</Text>
                </View>
                <Text style={{ color: '#fde68a', fontSize: 12, fontWeight: 'bold', marginBottom: 15, lineHeight: 18 }}>
                  Invite your squad. When they play their first battle, you both get ₹50 Real Cash instantly!
                </Text>
                <View style={{ backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ color: '#facc15', fontSize: 16, fontWeight: '900', letterSpacing: 2 }}>{profileData.gamer_tag}WIN</Text>
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>Your Elite Code</Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: '#10b981', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `🔥 India's Premium Esports Arena! Join MockWar and we both get ₹50 FREE Real Cash instantly! 💸\n\n🏆 Click here to join: https://mockwar.in/join?ref=${profileData.gamer_tag}WIN`
                      });
                    } catch (error) { Alert.alert("Error", "Could not share link."); }
                  }}
                >
                  <Share2 size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginLeft: 8 }}>SHARE NATIVELY</Text>
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.ledgerBox}>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoVal}>+91 {profileData.phone}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoVal}>{profileData.email || "Not Linked"}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>DOB</Text><Text style={styles.infoVal}>{profileData.dob || "Not Provided"}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>State</Text><Text style={styles.infoVal}>{profileData.state || "Not Provided"}</Text></View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}><Text style={styles.infoLabel}>District</Text><Text style={styles.infoVal}>{profileData.district || "Not Provided"}</Text></View>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <LogOut size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '900', marginLeft: 8, letterSpacing: 1 }}>SIGN OUT</Text>
              </TouchableOpacity>

            </View>
          )}

        </ScrollView>
      )}

      {/* 🟢 CUSTOM BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('lobby')}>
          <Swords size={22} color={currentView === 'lobby' ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'lobby' && { color: '#3b82f6' }]}>ARENA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('wallet')}>
          <Wallet size={22} color={currentView === 'wallet' ? '#eab308' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'wallet' && { color: '#eab308' }]}>WALLET</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentView('profile')}>
          <User size={22} color={currentView === 'profile' ? '#10b981' : '#64748b'} />
          <Text style={[styles.navText, currentView === 'profile' && { color: '#10b981' }]}>PROFILE</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// 🎨 STYLESHEET
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
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
  filterText: { color: '#94a3b8', fontSize: 11, fontWeight: '900', letterSpacing: 1 },  
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
  navText: { fontSize: 10, fontWeight: '900', marginTop: 5, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', backgroundColor: '#0f172a', padding: 25, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  modalInput: { backgroundColor: '#020617', color: '#fff', fontSize: 16, fontWeight: 'bold', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 15 },
  modalSubmitBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  modalSubmitText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  closeBtn: { position: 'absolute', top: 15, right: 15, padding: 5, zIndex: 10 }
});