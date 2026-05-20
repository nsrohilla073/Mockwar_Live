import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from "react";
import {
  Wallet, User, Trophy, Zap, LogOut, History, ArrowLeft, Activity, IndianRupee,
  Shield, ArrowUpRight, AlertCircle, CheckCircle2, X, Users, HelpCircle, Hourglass,
  Gift, Share2, Copy, Check, Sparkles, Coins, Swords, Award, Crown, Loader2, Receipt
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const API_BASE = "https://mockwar-backend.onrender.com";

function App() {
  const navigate = useNavigate();

  // 🔄 React States
  const [walletBalance, setWalletBalance] = useState(0.0);
  const [winningBalance, setWinningBalance] = useState(0.0);
  const [username, setUsername] = useState("Player");
  const [liveTables, setLiveTables] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  // 🕒 Views
  const [currentView, setCurrentView] = useState("lobby");
  const [historyData, setHistoryData] = useState({ matches: [], transactions: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // 👤 Profile State
  const [profileData, setProfileData] = useState(null);

  // 🌟 SLIDER, REFERRAL & DASHBOARD STATES
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);

  // 🏆 HALL OF FAME STATES
  const [leaderboardModal, setLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardCategory, setLeaderboardCategory] = useState("");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // 🌟 CUSTOM UI MODAL STATES
  const [alertConfig, setAlertConfig] = useState({ show: false, title: "", message: "", type: "success" });
  const [walletModal, setWalletModal] = useState(false); 
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [upiInput, setUpiInput] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) navigate("/auth");
  }, [token, navigate]);

  const showAppAlert = (title, message, type = "success") => {
    setAlertConfig({ show: true, title, message, type });
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const balanceResponse = await axios.get(`${API_BASE}/api/payment/wallet-balance/`, { headers: { Authorization: `Bearer ${token}` } });
      setWalletBalance(balanceResponse.data.total_balance);
      setWinningBalance(balanceResponse.data.winning_balance);
      
      const profileRes = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
      setUsername(profileRes.data.gamer_tag || "Player");

      const tablesRes = await axios.get(`${API_BASE}/api/game/live-tables/`, { headers: { Authorization: `Bearer ${token}` } });
      setLiveTables(tablesRes.data.tables);
    } catch (error) {
      if (error.response?.status === 401) handleLogout();
    }
  };

  useEffect(() => { fetchDashboardData(); }, [token]);

  // 🚀 LIVE WINNERS TICKER LOGIC
  const tickerItems = [
    "🏆 Rahul_99 just won ₹500 in Haryana GK!",
    "⚡ Neha_Kill withdrew ₹1,200 instantly via UPI.",
    "🔥 Vikas_OP joined Elite Typing Battle.",
    "💰 Mega Tournament Prize Pool reached ₹1,00,000!"
  ];

  useEffect(() => {
    const int = setInterval(() => setTickerIndex(prev => (prev + 1) % tickerItems.length), 3500);
    return () => clearInterval(int);
  }, [tickerItems.length]);

  const promoSlides = [
    { title: "WELCOME TO MOCKWAR", desc: "India's Premium Esports Speed & Skill Arena.", color: "from-blue-600 to-indigo-700", icon: <Swords size={40} className="text-white/80 absolute -right-2 -bottom-2 drop-shadow-2xl" /> },
    { title: "INSTANT WITHDRAWALS", desc: "100% Safe & Secure. Transfer your winnings via UPI.", color: "from-emerald-600 to-teal-700", icon: <Zap size={40} className="text-white/80 absolute -right-2 -bottom-2 drop-shadow-2xl" /> },
    { title: "PROVE YOUR SKILLS", desc: "Dominate Live Quizzes & Typing Battles to become Elite!", color: "from-purple-600 to-pink-600", icon: <Award size={40} className="text-white/80 absolute -right-2 -bottom-2 drop-shadow-2xl" /> }
  ];

  useEffect(() => {
    if (currentView !== "lobby") return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % promoSlides.length), 3500);
    return () => clearInterval(timer);
  }, [currentView, promoSlides.length]);


  const handleCopyReferral = () => {
    const safeTag = username ? username.toUpperCase() : "PLAYER";
    const refLink = "https://mockwar.in/join?ref=" + safeTag;
    navigator.clipboard.writeText(refLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const safeTag = username ? username.toUpperCase() : "PLAYER";
    const refLink = "https://mockwar.in/join?ref=" + safeTag;
    const message = "🔥 India's Premium Esports Arena! Join MockWar and we both get ₹50 FREE Real Cash instantly! 💸\n\n🏆 Click here to join: " + refLink;
    const whatsappUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank');
  };

  const handleClaimBonus = async () => {
    setIsClaiming(true);
    try {
      const response = await axios.post(`${API_BASE}/api/payment/claim-bonus/`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchDashboardData();
      showAppAlert("Bonus Claimed!", response.data.message || "₹5 Bonus Cash added to your wallet!", "success");
    } catch (error) {
      showAppAlert("Wait a minute!", error.response?.data?.error || "You have already claimed today's bonus.", "error");
    } finally {
      setIsClaiming(false);
    }
  };

  const fetchGlobalLeaderboard = async (slug) => {
    setLeaderboardCategory(slug);
    setLeaderboardLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/game/leaderboard/${slug}/`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaderboardData(res.data.leaderboard || []);
    } catch (error) {
      console.error("Failed to fetch leaderboard", error);
      setLeaderboardData([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const openLeaderboard = () => {
    setLeaderboardModal(true);
    if (liveTables.length > 0) {
      fetchGlobalLeaderboard(liveTables[0].slug);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    setCurrentView("history");
    try {
      const res = await axios.get(`${API_BASE}/api/user/dashboard-history/`, { headers: { Authorization: `Bearer ${token}` } });
      setHistoryData(res.data);
    } catch (error) {
      showAppAlert("Error", "Could not load history.", "error");
      setCurrentView("lobby");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
      setProfileData(res.data);
    } catch (error) {
      showAppAlert("Error", "Could not load profile.", "error");
      setCurrentView("lobby");
    }
  };

  useEffect(() => { if (currentView === "profile") fetchProfile(); }, [currentView]);

  const handleAddCashSubmit = async () => {
    if (!amountInput || isNaN(amountInput) || amountInput <= 0) return showAppAlert("Invalid Amount", "Please enter a valid amount.", "error");
    setDepositModal(false);
    try {
      const response = await axios.post(`${API_BASE}/api/payment/create-order/`, { amount: amountInput }, { headers: { Authorization: `Bearer ${token}` } });
      const { order_id, key_id } = response.data;
      const options = {
        key: key_id, amount: amountInput * 100, currency: "INR", name: "MockWar Gaming", description: "Add cash to wallet", order_id: order_id,
        handler: async function (response) {
          try {
            await axios.post(`${API_BASE}/api/payment/verify/`, {
              razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature,
            }, { headers: { Authorization: `Bearer ${token}` } });
            fetchDashboardData(); showAppAlert("Success!", `₹${amountInput} successfully added to your wallet.`, "success");
          } catch (error) { showAppAlert("Error", "Payment succeeded but wallet update failed.", "error"); }
        }, theme: { color: "#3b82f6" },
      };
      const rzp = new window.Razorpay(options); rzp.open();
    } catch (error) { showAppAlert("Error", "Could not initiate payment.", "error"); }
    setAmountInput("");
  };

  const handleWithdrawSubmit = async () => {
    if (!amountInput || amountInput < 50) return showAppAlert("Hold On!", "Minimum withdrawal amount is ₹50.", "error");
    if (amountInput > winningBalance) return showAppAlert("Hold On!", `You only have ₹${winningBalance} in Winnings.`, "error");
    if (!upiInput) return showAppAlert("Missing Info", "Please enter your valid UPI ID.", "error");
    try {
      setWithdrawModal(false);
      await axios.post(`${API_BASE}/api/payment/withdraw/`, { amount: amountInput, upi_id: upiInput }, { headers: { Authorization: `Bearer ${token}` } });
      showAppAlert("Request Placed!", "Withdrawal is PENDING. Admin will process it shortly.", "success");
      fetchDashboardData(); setAmountInput(""); setUpiInput("");
    } catch (error) { setWithdrawModal(false); showAppAlert("Withdrawal Failed", error.response?.data?.error || "Server error occurred.", "error"); }
  };
  
  const handlePlayGame = async (entryFee, gameId) => {
    if (isJoining) return; // 🔒 डबल क्लिक लॉक
    
    if (walletBalance >= entryFee) {
      setIsJoining(true); // ताला बंद
      try {
        const response = await axios.post(`${API_BASE}/api/game/play/`, { entry_fee: entryFee }, { headers: { Authorization: `Bearer ${token}` } });
        if (response.data.success) { navigate(`/arena/${gameId}`); }
      } catch (error) { 
        showAppAlert("Error", "Couldn't secure entry fee. Try again.", "error"); 
        setIsJoining(false); // ताला खोल दो
      }
    } else {
      showAppAlert("Low Balance", `You need ₹${entryFee} to play. Please Add Cash.`, "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-blue-500 selection:text-white relative">
      
      {/* ALERT MODAL */}
      {alertConfig.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {alertConfig.type === "success" ? <CheckCircle2 size={50} className="mx-auto text-emerald-400 mb-4 animate-bounce" /> : <AlertCircle size={50} className="mx-auto text-red-500 mb-4 animate-pulse" />}
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-wider">{alertConfig.title}</h3>
            <p className="text-slate-400 text-sm mt-2 font-medium">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ show: false })} className={`mt-6 w-full py-3 rounded-xl font-black tracking-widest uppercase active:scale-95 ${alertConfig.type === "success" ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]"}`}>Understood</button>
          </div>
        </div>
      )}

      {/* LEADERBOARD MODAL */}
      {leaderboardModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <button onClick={() => setLeaderboardModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-full transition-all z-50 cursor-pointer">
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-black text-yellow-400 uppercase tracking-wider mb-5 flex items-center gap-2 relative z-10">
              <Crown size={22} className="text-yellow-400" /> Hall of Fame
            </h3>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide relative z-10">
              {liveTables.map(t => (
                 <button 
                   key={t.slug} 
                   onClick={() => fetchGlobalLeaderboard(t.slug)} 
                   className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-md ${leaderboardCategory === t.slug ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.4)]" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                 >
                    {t.category_name}
                 </button>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-2 min-h-[250px] max-h-[350px] overflow-y-auto relative z-10">
               {leaderboardLoading ? (
                  <div className="flex flex-col items-center justify-center h-40">
                     <Loader2 className="animate-spin text-yellow-400 mb-2" size={30} />
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Summoning Legends...</p>
                  </div>
               ) : leaderboardData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                     <Trophy className="text-slate-700 mb-2" size={40}/>
                     <p className="text-xs font-bold text-slate-500">The throne is empty. Play now to claim rank #1!</p>
                  </div>
               ) : (
                  <div className="space-y-2">
                     {leaderboardData.map((player, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${idx === 0 ? "bg-yellow-500/10 border-yellow-500/30" : idx === 1 ? "bg-slate-300/10 border-slate-300/30" : idx === 2 ? "bg-amber-600/10 border-amber-600/30" : "bg-slate-900 border-slate-800"}`}>
                           <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? "bg-yellow-500 text-slate-900 shadow-[0_0_10px_rgba(234,179,8,0.5)]" : idx === 1 ? "bg-slate-300 text-slate-900" : idx === 2 ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                                 {idx + 1}
                              </div>
                              <div>
                                 <p className={`font-black text-sm uppercase ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-500" : "text-slate-300"}`}>{player.username}</p>
                                 <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">Elite Warrior</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="font-mono font-black text-emerald-400 text-sm">{player.score}</p>
                              <p className="text-[8px] font-black text-slate-500 tracking-widest uppercase">Points</p>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* WALLET MODAL */}
      {walletModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <button onClick={() => setWalletModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-full transition-all z-50 cursor-pointer">
              <X size={24} />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2"><Wallet size={20} className="text-blue-500" /> Wallet Manager</h3>
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 mb-6 shadow-inner flex justify-between items-center relative z-10">
              <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Balance</p><p className="text-2xl font-black text-white">₹{walletBalance.toFixed(2)}</p></div>
              <div className="text-right"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Winnings</p><p className="text-xl font-black text-emerald-400">₹{winningBalance.toFixed(2)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <button onClick={() => { setWalletModal(false); setAmountInput(""); setDepositModal(true); }} className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black py-4 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] active:scale-95 transition-all flex flex-col items-center gap-1.5"><Zap size={22} className="text-blue-200" /><span className="text-xs tracking-widest uppercase">Add Cash</span></button>
              <button onClick={() => { setWalletModal(false); setAmountInput(""); setUpiInput(""); setWithdrawModal(true); }} className="bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black py-4 rounded-xl shadow-[0_10px_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex flex-col items-center gap-1.5"><IndianRupee size={22} className="text-emerald-200" /><span className="text-xs tracking-widest uppercase">Withdraw</span></button>
            </div>
          </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {depositModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setDepositModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-full transition-all z-50 cursor-pointer">
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-black text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-2"><Zap size={18} /> Add Cash</h3>
            <div className="relative mb-6 mt-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">₹</span>
              <input type="number" placeholder="0" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-4 pl-10 pr-4 text-2xl font-black text-white outline-none"/>
            </div>
            <button onClick={handleAddCashSubmit} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95">PROCEED TO PAY</button>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {withdrawModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setWithdrawModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-full transition-all z-50 cursor-pointer">
              <X size={24} />
            </button>
            
            <h3 className="text-xl font-black text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-2"><IndianRupee size={18} /> Withdraw</h3>
            <p className="text-xs text-slate-500 font-bold uppercase mb-4">Max Withdrawable (Winnings): <span className="text-emerald-400 font-black">₹{winningBalance}</span></p>
            <div className="space-y-3 mb-6 mt-4">
              <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black">₹</span><input type="number" placeholder="Enter Amount" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-lg font-bold text-white outline-none"/></div>
              <input type="text" placeholder="Enter UPI ID (e.g. name@okhdfc)" value={upiInput} onChange={(e) => setUpiInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none"/>
            </div>
            <button onClick={handleWithdrawSubmit} className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 text-white font-black py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95">SEND REQUEST</button>
          </div>
        </div>
      )}

      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.6)] w-full">
        <div className="max-w-xl mx-auto px-4 py-3 flex justify-between items-center w-full">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => setCurrentView("lobby")}>
            <div className="relative"><Trophy size={26} className="text-yellow-400 relative z-10 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] group-hover:scale-110 transition-transform" /></div>
            <div className="flex flex-col"><h1 className="text-xl sm:text-2xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 leading-normal py-1">MOCKWAR</h1><p className="text-[7px] sm:text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Speed & Skill Arena</p></div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={openLeaderboard} className="relative p-2 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 hover:from-yellow-500/20 hover:to-amber-600/20 rounded-lg border border-yellow-500/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)] group cursor-pointer">
              <Crown size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500 border border-slate-900"></span>
              </span>
            </button>

            <button onClick={() => setCurrentView("referral")} className="relative flex items-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-2 bg-gradient-to-r from-amber-500/10 to-orange-600/10 hover:from-amber-500/20 hover:to-orange-600/20 rounded-lg border border-amber-500/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)] group cursor-pointer overflow-hidden hidden sm:flex">
               <Gift size={14} className="text-amber-400 group-hover:scale-110 transition-transform" /><span className="font-black text-amber-400 text-[10px] tracking-widest uppercase">Refer & Earn</span>
            </button>

            <div onClick={() => setWalletModal(true)} className="flex items-center bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-inner hover:bg-slate-800 transition-colors cursor-pointer group">
              <Wallet size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" /><span className="font-black text-sm text-yellow-400 ml-1.5">₹{walletBalance.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* LOBBY VIEW */}
      {currentView === "lobby" && (
        <div className="max-w-xl mx-auto p-4 space-y-6 animate-fade-in w-full">
          
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-2.5 flex items-center gap-3 overflow-hidden shadow-inner w-full">
             <div className="bg-blue-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest animate-pulse flex-shrink-0 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-white rounded-full"></div> LIVE</div>
             <p className="text-sm font-bold text-blue-300 truncate transition-all duration-500 tracking-wide">{tickerItems[tickerIndex]}</p>
          </div>

          <div className="relative w-full h-36 sm:h-44 rounded-[2rem] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-slate-800/80 cursor-pointer active:scale-[0.98] transition-transform">
            {promoSlides.map((slide, idx) => (
              <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 bg-gradient-to-br ${slide.color} ${currentSlide === idx ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
                <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
                  <span className="bg-black/30 backdrop-blur-md text-white/90 text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded w-fit mb-2">Featured</span>
                  <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter drop-shadow-xl w-3/4 leading-tight">{slide.title}</h3>
                  <p className="text-xs sm:text-sm font-bold text-white/90 mt-1.5 drop-shadow-md w-3/4 leading-snug">{slide.desc}</p>
                </div>
                {slide.icon}
              </div>
            ))}
          </div>

          <div onClick={isClaiming ? null : handleClaimBonus} className={`bg-gradient-to-r from-amber-500/20 to-orange-600/20 border border-amber-500/30 p-4 rounded-2xl flex justify-between items-center relative overflow-hidden shadow-lg ${isClaiming ? "opacity-70 cursor-not-allowed" : "cursor-pointer group"}`}>
             <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/10 to-amber-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
             <div className="flex items-center gap-3 relative z-10">
                <div className="bg-amber-500/20 p-2 rounded-xl border border-amber-500/40"><Gift size={20} className="text-amber-400 animate-bounce"/></div>
                <div>
                   <h4 className="font-black text-amber-400 uppercase tracking-widest text-sm">Daily Bonus Ready</h4>
                   <p className="text-[10px] font-bold text-amber-200/70 uppercase">Claim your free ₹5 spin now!</p>
                </div>
             </div>
             <button disabled={isClaiming} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95 transition-all relative z-10">
                {isClaiming ? "WAIT..." : "CLAIM"}
             </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-base font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 px-1"><Zap size={18} className="text-yellow-400 fill-yellow-400/20" /> Battle Rooms</h3>
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Swipe <ArrowUpRight size={10} className="inline"/></span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {[
                  { id: "All", label: "All Games", icon: <Sparkles size={14}/> },
                  { id: "Quiz", label: "Live Quizzes", icon: <HelpCircle size={14}/> },
                  { id: "Typing", label: "Typing Battle", icon: <Zap size={14}/> }
                ].map(cat => (
                     <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-all shadow-md ${activeCategory === cat.id ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"}`}>
                         {cat.icon} {cat.label}
                     </button>
                ))}
            </div>
            
            <div className="space-y-4 pt-2">
              {liveTables.length === 0 ? (
                <div className="bg-slate-900/60 p-10 rounded-2xl text-center border border-slate-800 border-dashed"><p className="text-slate-400 font-bold">No Battle Rooms Active</p></div>
              ) : (
                liveTables.filter(table => activeCategory === "All" || (activeCategory === "Typing" && table.category_name.toLowerCase().includes("typing")) || (activeCategory === "Quiz" && !table.category_name.toLowerCase().includes("typing"))).map((table) => (
                  <div key={table.id} className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 rounded-3xl p-6 border border-slate-800 hover:border-blue-500/40 shadow-2xl transition-all relative overflow-hidden group">
                    <div className="absolute -inset-px bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-purple-500/0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div className="flex flex-col space-y-5 relative z-10">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/60 pb-3">
                        <h4 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">{table.category_name}</h4>
                        <div className="flex flex-wrap gap-2">
                          <span className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-md"><Users size={12} /> {table.max_players || 2} Players</span>
                          <span className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-md"><HelpCircle size={12} /> {table.questions_count || 5} Qs</span>
                          <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-md"><Hourglass size={12} /> {table.total_time || "60s"}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <div>
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Est. Prize Pool</p>
                          <p className="text-2xl sm:text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]">₹{table.prize_pool}</p>
                        </div>
                        <div className="text-center flex flex-col items-end">
                          <button onClick={() => handlePlayGame(table.entry_fee, table.slug)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black text-xs sm:text-sm py-3 px-5 sm:px-6 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-[0_4px_20px_rgba(37,99,235,0.4)] cursor-pointer">Play ₹{table.entry_fee} <ArrowUpRight size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-800/60 grid grid-cols-3 gap-4 text-center pb-6">
              <div className="flex flex-col items-center gap-2"><div className="bg-emerald-500/10 p-3 rounded-full border border-emerald-500/20"><Shield size={20} className="text-emerald-400"/></div><p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">100% Secure<br/>& Legal</p></div>
              <div className="flex flex-col items-center gap-2"><div className="bg-blue-500/10 p-3 rounded-full border border-blue-500/20"><Zap size={20} className="text-blue-400"/></div><p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Instant UPI<br/>Withdrawals</p></div>
              <div className="flex flex-col items-center gap-2"><div className="bg-purple-500/10 p-3 rounded-full border border-purple-500/20"><CheckCircle2 size={20} className="text-purple-400"/></div><p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">RNG Certified<br/>Fair Play</p></div>
          </div>
        </div>
      )}

      {/* REFERRAL VIEW */}
      {currentView === "referral" && (
        <div className="max-w-xl mx-auto p-4 space-y-6 animate-fade-in relative z-10 w-full">
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 px-1"><Gift size={20} className="text-amber-500" /> Refer & Win</h2>
          <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 rounded-[2rem] p-8 text-center shadow-[0_20px_50px_rgba(245,158,11,0.4)] border border-amber-400/50 relative overflow-hidden">
             <Coins size={60} className="mx-auto text-amber-200 drop-shadow-2xl mb-4 animate-bounce relative z-10" />
             <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase drop-shadow-lg relative z-10">GET ₹50 CASH!</h1>
             <p className="text-sm font-bold text-amber-100 mt-2 tracking-wide relative z-10">Invite your squad. When they play their first battle, you both get ₹50 Real Cash.</p>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-2xl mt-4">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center mb-3">Your Unique Elite Code</p>
             <div className="flex items-center justify-between bg-slate-950 border border-slate-700/80 p-2 pl-6 rounded-2xl shadow-inner">
                <span className="text-xl font-black tracking-widest text-amber-400 uppercase">{username}WIN</span>
                <button onClick={handleCopyReferral} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isCopied ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-slate-800 text-white hover:bg-slate-700"}`}>
                   {isCopied ? <><Check size={16}/> Copied</> : <><Copy size={16}/> Copy</>}
                </button>
             </div>
             <button onClick={handleWhatsAppShare} className="w-full mt-4 bg-[#25D366] hover:bg-[#128C7E] text-white font-black py-4 rounded-2xl uppercase tracking-widest flex justify-center items-center gap-2 shadow-[0_10px_20px_rgba(37,211,102,0.3)] active:scale-95 transition-transform cursor-pointer">
                <Share2 size={18} /> Share via WhatsApp
             </button>
          </div>
        </div>
      )}

      {/* HISTORY VIEW */}
      {currentView === "history" && (
        <div className="max-w-xl mx-auto p-4 space-y-6 animate-fade-in w-full">
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 px-1"><Activity size={20} className="text-blue-500" /> Account Dashboard</h2>
          {isLoadingHistory ? (
            <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-around text-center shadow-lg">
                <div><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Balance</p><p className="text-lg font-black text-white mt-1">₹{walletBalance}</p></div>
                <div className="w-px bg-slate-800"></div>
                <div><p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Winnings</p><p className="text-lg font-black text-emerald-400 mt-1">₹{winningBalance}</p></div>
              </div>

              {historyData.matches && historyData.matches.length > 0 && (
                <div className="space-y-3 mb-6 animate-fade-in">
                   <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Swords size={14} className="text-indigo-400" /> Recent Battles</h3>
                   <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                     {historyData.matches.map((m, idx) => (
                        <div key={idx} className="p-3.5 flex justify-between items-center border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
                           <div>
                             <p className="font-bold text-xs text-slate-300 tracking-wide uppercase">{m.topic}</p>
                             <p className="text-[9px] text-slate-500 font-medium mt-0.5">{m.date} | SCORE: <span className="text-blue-400 font-black">{m.score}</span></p>
                           </div>
                           <div className="text-right">
                             <p className={`font-black text-[10px] uppercase tracking-widest ${m.is_winner ? 'text-emerald-400' : 'text-red-500'}`}>{m.is_winner ? 'VICTORY' : 'DEFEAT'}</p>
                             <p className={`font-mono text-xs font-bold mt-0.5 ${m.is_winner ? 'text-emerald-400' : 'text-slate-500'}`}>{m.is_winner ? `+₹${m.prize}` : '₹0'}</p>
                           </div>
                        </div>
                     ))}
                   </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><IndianRupee size={14} /> Account Passbook Ledger</h3>
                {historyData.transactions.length === 0 ? (
                  <p className="text-slate-500 text-xs italic bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                    Zero statements recorded.
                  </p>
                ) : (
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 shadow-xl">
                    {historyData.transactions.map((tx, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-slate-800/20">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.type === "GAME_WIN" || tx.type === "DEPOSIT" || tx.type === "REFUND" || tx.type === "BONUS" ? "bg-emerald-400" : tx.type === "WITHDRAW" ? "bg-orange-400" : "bg-red-400"}`}></div>
                          <div>
                            <p className="font-bold text-xs text-slate-300 tracking-wide uppercase">{tx.type.replace("_", " ")}</p>
                            <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                              {tx.date} | STATUS:{" "}
                              <span className={`${tx.status === "PENDING" ? "text-orange-400" : tx.status === "SUCCESS" ? "text-emerald-400" : "text-red-400"} font-bold`}>
                                {tx.status}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono font-black text-sm ${tx.type === "GAME_WIN" || tx.type === "DEPOSIT" || tx.type === "REFUND" || tx.type === "BONUS" ? "text-emerald-400" : tx.type === "WITHDRAW" ? "text-orange-400" : "text-red-400"}`}>
                          {tx.type === "GAME_WIN" || tx.type === "DEPOSIT" || tx.type === "REFUND" || tx.type === "BONUS" ? "+" : "-"}₹{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* PROFILE VIEW */}
      {currentView === "profile" && profileData && (
        <div className="max-w-xl mx-auto p-4 space-y-6 animate-fade-in w-full pb-8">
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-300 flex items-center gap-2 px-1"><Shield size={20} className="text-blue-500" /> Gamer Identity</h2>
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex items-center gap-5 relative z-10">
              <div className="relative">
                {profileData.live_photo ? (
                  <img src={profileData.live_photo} alt="KYC" className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                    <User size={40} className="text-slate-500"/>
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-slate-900 uppercase">Verified</div>
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight text-white uppercase">{profileData.gamer_tag}</p>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-1">{profileData.full_name || "PRO PLAYER"}</p>
                <div className="flex gap-2 mt-3"><span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-md uppercase">Elite Tier</span><span className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase">Since 2026</span></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-center shadow-lg"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Battles Fought</p><p className="text-3xl font-black text-slate-200 mt-1">{profileData.matches_played}</p></div>
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-center shadow-lg"><p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Victories</p><p className="text-3xl font-black text-emerald-400 mt-1">{profileData.matches_won}</p></div>
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60 shadow-lg">
            <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Registered Number</span><span className="text-sm font-black text-slate-300">{profileData.phone ? `+91 ${profileData.phone}` : "------"}</span></div>
            <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Linked Email</span><span className="text-sm font-black text-slate-300">{profileData.email || "Not Linked"}</span></div>
            <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date of Birth</span><span className="text-sm font-black text-slate-300">{profileData.dob || "Not Provided"}</span></div>
            <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">State Region</span><span className="text-sm font-black text-slate-300">{profileData.state || "Not Provided"}</span></div>
            <div className="p-4 flex justify-between items-center"><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">District</span><span className="text-sm font-black text-slate-300">{profileData.district || "Not Provided"}</span></div>
          </div>

          {/* 🚀 NEW: ACTION BUTTONS SECTION (History & Logout) */}
          <div className="mt-8 space-y-3 pt-4 border-t border-slate-800">
            <button 
              onClick={() => fetchHistory()}
              className="w-full bg-slate-900 border border-slate-700 hover:border-yellow-500 text-slate-300 flex items-center justify-between px-5 py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <Receipt className="text-yellow-500" size={20} />
                <span className="font-bold text-sm tracking-wide">Transaction History</span>
              </div>
              <span className="text-slate-500 text-xs font-bold tracking-widest uppercase">View Ledger &rarr;</span>
            </button>

            <button 
              onClick={handleLogout}
              className="w-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-500 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              <LogOut size={20} />
              <span className="font-black text-sm tracking-widest uppercase">Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* 🚀 NATIVE APP BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] z-50">
        <div className="flex justify-around items-center h-16 px-2 max-w-xl mx-auto">
          
          {/* Home Tab */}
          <button 
            onClick={() => setCurrentView("lobby")} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "lobby" ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Swords size={20} className={currentView === "lobby" ? "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : ""} />
            <span className="text-[9px] font-black uppercase tracking-widest">Arena</span>
          </button>

          {/* Wallet / History Tab */}
          <button 
            onClick={() => fetchHistory()} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "history" ? 'text-yellow-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Wallet size={20} className={currentView === "history" ? "drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" : ""} />
            <span className="text-[9px] font-black uppercase tracking-widest">Wallet</span>
          </button>

          {/* Profile Tab */}
          <button 
            onClick={() => setCurrentView("profile")} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "profile" ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User size={20} className={currentView === "profile" ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" : ""} />
            <span className="text-[9px] font-black uppercase tracking-widest">Profile</span>
          </button>

        </div>
      </div>

    </div>
  );
}

export default App;
// 100% COMPLETE FILE - DO NOT DELETE ANY BRACKET