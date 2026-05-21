import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Trophy, User, Swords, Users, Zap, Crosshair } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = "https://mockwar-backend.onrender.com";
const WS_BASE = "wss://mockwar-backend.onrender.com";

export default function Arena({ route, navigation }) {
  const { tableId } = route.params; 
  
  const hasSubmitted = useRef(false); 
  const apiCalled = useRef(false);

  const [maxPlayers, setMaxPlayers] = useState(2); 
  const maxPlayersRef = useRef(2); 
  const [gameState, setGameState] = useState("searching"); 
  const gameStateRef = useRef("searching");
  const [searchTime, setSearchTime] = useState(60); 
  const searchIntervalRef = useRef(null);

  const [isTypingMode, setIsTypingMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(12);
  const [timePerQ, setTimePerQ] = useState(12); 
  const [apiLoading, setApiLoading] = useState(false);

  const [myPoints, setMyPoints] = useState(0);
  const myPointsRef = useRef(0);
  const myGamerTagRef = useRef("Live_Player"); 
  const ws = useRef(null); 

  const [opponents, setOpponents] = useState([]); 
  const opponentsRef = useRef([]); 
  
  const [matchStandings, setMatchStandings] = useState([]);
  const [matchReward, setMatchReward] = useState(0); 
  const [matchStatus, setMatchStatus] = useState(''); 

  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [targetParagraph, setTargetParagraph] = useState("");
  const [typedText, setTypedText] = useState("");
  const [wpm, setWpm] = useState(0);
  const wpmRef = useRef(0);
  const [accuracy, setAccuracy] = useState(100);
  const accuracyRef = useRef(100);
  const typingStartTime = useRef(null);
  
  // 🔴 FIX 2: QA Review Track karne ke liye
  const [userAnswers, setUserAnswers] = useState([]);

  const updateOpponents = (newOppFunc) => {
      setOpponents(prev => {
          const updated = typeof newOppFunc === 'function' ? newOppFunc(prev) : newOppFunc;
          opponentsRef.current = updated;
          return updated;
      });
  };

  useEffect(() => { myPointsRef.current = myPoints; }, [myPoints]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);
  useEffect(() => { accuracyRef.current = accuracy; }, [accuracy]);

  const sendMyScore = (newScore) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
              action: 'score_update',
              score: newScore,
              player_name: myGamerTagRef.current
          }));
      }
  };

  useEffect(() => {
    const initGame = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) { navigation.navigate("Auth"); return; }

        const profRes = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
        myGamerTagRef.current = profRes.data.gamer_tag;

        const res = await axios.get(`${API_BASE}/api/game/content/${tableId}/`, { headers: { Authorization: `Bearer ${token}` } });
        
        const tableLimit = res.data.max_players || 2;
        setMaxPlayers(tableLimit);
        maxPlayersRef.current = tableLimit;
        setIsTypingMode(res.data.is_typing_test);

        const matchRoomId = res.data.room_id || `room_${Date.now()}`;
        
        ws.current = new WebSocket(`${WS_BASE}/ws/arena/${tableId}/${matchRoomId}/`);
        ws.current.onopen = () => { sendMyScore(0); };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const myTag = myGamerTagRef.current;

            if (data.action === 'questions_ready') {
                if (data.content.is_typing_test) {
                    setIsTypingMode(true);
                    setTargetParagraph(data.content.paragraph);
                    setTimeLeft(data.content.time_limit);
                } else {
                    setIsTypingMode(false);
                    setQuestions(data.content.questions);
                    setTimePerQ(data.content.time_per_question);
                    setTimeLeft(data.content.time_per_question);
                }
                setTimeout(() => { setGameState("playing"); typingStartTime.current = Date.now(); }, 1500); 
            }

            if (data.action === 'score_update' && data.player && data.player !== myTag && data.player !== "Live_Player") {
                let isNewPlayer = false;
                updateOpponents(prev => {
                    const existing = prev.find(o => o.name === data.player);
                    if (existing) { return prev.map(o => o.name === data.player ? { ...o, score: data.score } : o); } 
                    else {
                        if (gameStateRef.current === "searching" && prev.length < maxPlayersRef.current - 1) {
                            isNewPlayer = true;
                            return [...prev, { name: data.player, score: data.score, isBot: false }];
                        }
                        return prev;
                    }
                });
                if (isNewPlayer && gameStateRef.current === "searching") {
                    setSearchTime(60); 
                    setTimeout(() => sendMyScore(myPointsRef.current), 500); 
                }
            }

            if (data.action === 'waiting_for_opponent') setGameState("waiting_result");
            if (data.action === 'match_result') handleMatchResult(data);
        };
      } catch (error) {
        Alert.alert("Error", "Could not connect to Arena.");
        navigation.navigate("Lobby");
      }
    };
    initGame();
    return () => { if (ws.current) ws.current.close(); };
  }, []);

  useEffect(() => {
    if (gameState !== "searching") return;
    searchIntervalRef.current = setInterval(() => {
        setSearchTime(prev => {
            if (prev <= 1) {
                clearInterval(searchIntervalRef.current);
                fillWithBotsAndStart();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(searchIntervalRef.current);
  }, [gameState]);

  useEffect(() => {
      if (gameState === "searching" && opponents.length === maxPlayers - 1 && maxPlayers > 1) {
          clearInterval(searchIntervalRef.current);
          triggerMatchFound();
      }
  }, [opponents.length, gameState, maxPlayers]);

  const fillWithBotsAndStart = () => {
      updateOpponents(prev => {
          let newOpp = [...prev];
          while (newOpp.length < maxPlayersRef.current - 1) {
              const names = ["Rahul_OP", "Neha_Pro", "Vikas_Hry", "Priya_Don", "Aman_YT", "Sniper_007"];
              newOpp.push({ name: names[Math.floor(Math.random() * names.length)], score: 0, isBot: true });
          }
          return newOpp;
      });
      triggerMatchFound();
  };

  const triggerMatchFound = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ action: 'request_questions' }));
      }
      setGameState("found");
  };

  useEffect(() => {
    if (gameState !== "playing") return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        updateOpponents(prev => prev.map(opp => {
             if (opp.isBot) {
                 if (Math.random() < 0.20) return opp; 
                 const scoreDiff = myPointsRef.current - opp.score;
                 let pointsToAdd = isTypingMode ? (scoreDiff > 10 ? Math.floor(Math.random() * 8) + 5 : Math.floor(Math.random() * 5)) : (timeLeft % 5 === 0 && Math.random() > 0.3 ? (10 + timeLeft) : 0);
                 return { ...opp, score: opp.score + pointsToAdd };
             }
             return opp;
        }));
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      if (!isTypingMode) handleNextQuestion(myPointsRef.current, null); 
      else triggerRefereeSubmit(myPointsRef.current); 
    }
  }, [gameState, timeLeft, isTypingMode]);

  const handleAnswerClick = (selectedOption) => {
    const currentQ = questions[currentQIndex];
    const dbAnswer = currentQ.answer.toUpperCase().trim();
    const isCorrect = ['A', 'B', 'C', 'D'][currentQ.options.indexOf(selectedOption)] === dbAnswer;
    const earnedPoints = isCorrect ? (10 + timeLeft) : 0; 
    
    // 🔴 FIX 2: Save answer for Review
    setUserAnswers(prev => [...prev, { 
      question: currentQ.question, 
      userAnswer: selectedOption, 
      correctAnswer: currentQ.options[['A', 'B', 'C', 'D'].indexOf(dbAnswer)],
      isCorrect: isCorrect 
    }]);

    const updatedMyPoints = myPoints + earnedPoints;
    setMyPoints(updatedMyPoints);
    sendMyScore(updatedMyPoints); 
    handleNextQuestion(updatedMyPoints);
  };

  const handleNextQuestion = (finalMyPoints) => {
    if (currentQIndex + 1 < questions.length) {
      setCurrentQIndex(currentQIndex + 1);
      setTimeLeft(timePerQ); 
    } else {
      triggerRefereeSubmit(finalMyPoints); 
    }
  };

  const handleTypingChange = (val) => {
    setTypedText(val);
    const timeElapsedMins = (Date.now() - typingStartTime.current) / 60000;
    const words = val.trim().split(/\s+/).length;
    const currentWpm = val.length > 0 ? Math.round(words / (timeElapsedMins || 0.01)) : 0;
    setWpm(currentWpm);

    const cleanTarget = targetParagraph.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTyped = val.replace(/[^a-zA-Z0-9]/g, '');

    let correctChars = 0;
    for (let i = 0; i < cleanTyped.length; i++) {
      if (i < cleanTarget.length && cleanTyped[i] === cleanTarget[i]) correctChars++;
    }
    const currentAccuracy = cleanTyped.length > 0 ? Math.round((correctChars / cleanTyped.length) * 100) : 100;
    setAccuracy(currentAccuracy);

    const currentPoints = val.length > 0 ? currentWpm + currentAccuracy : 0;
    setMyPoints(currentPoints);
    sendMyScore(currentPoints); 

    if (cleanTyped === cleanTarget && cleanTarget.length > 0) {
      triggerRefereeSubmit(currentPoints);
    }
  };

  const triggerRefereeSubmit = (finalMyPts) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true; 
    setGameState("waiting_result"); 

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        // 1. Sabse pehle aapka (Real Player) ka score jayega
        ws.current.send(JSON.stringify({ 
            action: 'game_finished', 
            player_name: myGamerTagRef.current, 
            score: finalMyPts, 
            wpm: wpmRef.current 
        }));

        // 🔴 2. TRAFFIC POLICE FIX: Bots ke scores 300-300 ms ke gap par jayenge
        let delay = 300;
        opponentsRef.current.forEach((opp) => {
            if (opp.isBot) { 
                setTimeout(() => {
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({ 
                            action: 'game_finished', 
                            player_name: opp.name, 
                            score: opp.score, 
                            wpm: 0 
                        }));
                    }
                }, delay);
                delay += 300; // Har bot ko line me thoda aage badhate raho
            }
        });
    }
  };

  const handleMatchResult = async (data) => {
      if (apiCalled.current) return;
      apiCalled.current = true;
      setGameState("finished");
      setApiLoading(true);

      const myTag = myGamerTagRef.current;
      let cStatus = 'LOSS';
      if (data.is_draw) cStatus = 'DRAW';
      else if (data.winners.includes(myTag)) cStatus = 'WIN';
      setMatchStatus(cStatus);

      const finalStandings = Object.entries(data.final_scores).map(([name, stats]) => ({
          name, score: stats.score, isMe: name === myTag
      })).sort((a, b) => b.score - a.score);

      let currentRank = 1;
      finalStandings.forEach((p, idx) => {
          if (idx > 0 && p.score < finalStandings[idx-1].score) currentRank = idx + 1;
          p.rank = currentRank;
      });
      setMatchStandings(finalStandings);

      try {
          const token = await AsyncStorage.getItem('access_token');
          const res = await axios.post(`${API_BASE}/api/game/submit-result/`, { 
              table_id: tableId, score: data.final_scores[myTag].score, wpm: data.final_scores[myTag].wpm, accuracy: accuracyRef.current, status: cStatus
          }, { headers: { Authorization: `Bearer ${token}` } });

          setMatchReward(res.data.prize_won || 0); 
      } catch (error) {
          console.error("Submission Error:", error);
      } finally {
          setApiLoading(false);
      }
  };

  return (
    // 🔴 FIX 3: SafeAreaView for No Overlap
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {gameState === 'searching' && (
        <View style={styles.centerContent}>
          <Text style={styles.arenaTitle}>SECURING ARENA</Text>
          <View style={styles.loadingBox}><ActivityIndicator size="small" color="#3b82f6" /><Text style={styles.loadingText}> MATCHMAKING ACTIVE</Text></View>
          <View style={styles.card}>
            <View style={styles.cardHeader}><Users size={16} color="#94a3b8" /><Text style={styles.cardHeaderText}> Players in Lobby ({opponents.length + 1}/{maxPlayers})</Text></View>
            <View style={styles.playerRowMe}><View style={{flexDirection: 'row', alignItems: 'center'}}><User size={16} color="#60a5fa" /><Text style={styles.playerNameMe}> YOU</Text></View><View style={styles.joinedBadge}><Text style={styles.joinedText}>JOINED</Text></View></View>
            {opponents.map((opp, idx) => (
              <View key={idx} style={styles.playerRowOpp}><Text style={{color: '#fff', fontWeight: 'bold'}}>{opp.name}</Text><View style={[styles.joinedBadge, {backgroundColor: '#10b981'}]}><Text style={styles.joinedText}>JOINED</Text></View></View>
            ))}
            {Array.from({ length: Math.max(0, maxPlayers - 1 - opponents.length) }).map((_, idx) => (
               <View key={'w'+idx} style={styles.playerRowWaiting}><Text style={styles.playerWaitingText}>Waiting for opponent...</Text><ActivityIndicator size="small" color="#475569" /></View>
            ))}
          </View>
          {/* 🔴 FIX 1: Matchmaking Timer added back */}
          <View style={{ marginTop: 20, alignItems: 'center', flexDirection: 'row', gap: 5 }}>
            <Clock size={14} color="#facc15" />
            <Text style={{ color: '#facc15', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>Match starts in: {searchTime}s</Text>
          </View>
        </View>
      )}

      {gameState === 'found' && (
        <View style={styles.centerContent}>
          <View style={styles.matchFoundIcon}><Swords size={60} color="#34d399" /></View>
          <Text style={styles.matchFoundTitle}>MATCH FOUND!</Text>
          <Text style={styles.matchFoundSub}>{maxPlayers} Warriors Ready</Text>
          <Text style={styles.generatingText}>Generating AI Arena...</Text>
        </View>
      )}

      {gameState === 'playing' && (
        <View style={styles.gameContainer}>
          <View style={styles.scoreBoard}>
            <View style={styles.timerBadge}><Clock size={16} color={timeLeft <= 5 ? "#ef4444" : "#facc15"} /><Text style={[styles.timerText, timeLeft <= 5 && { color: "#ef4444" }]}> {timeLeft}s</Text></View>
            <View style={styles.scoreCards}>
              <LinearGradient colors={['#1e3a8a', '#0f172a']} style={styles.scoreCardMe}><Text style={styles.scoreLabelMe}>YOU</Text><Text style={styles.scoreValueMe}>{myPoints}</Text></LinearGradient>
              {opponents.map((opp, idx) => (
                <View key={idx} style={styles.scoreCardOpp}><Text style={styles.scoreLabelOpp} numberOfLines={1}>{opp.name}</Text><Text style={styles.scoreValueOpp}>{opp.score}</Text></View>
              ))}
            </View>
          </View>

          {!isTypingMode && questions.length > 0 && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.questionBox}><Text style={styles.questionText}>{questions[currentQIndex].question}</Text></View>
              <View style={{ gap: 12, marginTop: 20 }}>
                {questions[currentQIndex].options.map((opt, idx) => (
                  <TouchableOpacity key={idx} style={styles.optionBtn} onPress={() => handleAnswerClick(opt)}>
                    <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{['A','B','C','D'][idx]}</Text></View>
                    <Text style={styles.optionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {isTypingMode && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.typingHeader}><Text style={{color: '#c084fc', fontWeight: 'bold'}}><Zap size={14}/> {wpm} WPM</Text><Text style={{color: '#34d399', fontWeight: 'bold'}}><Crosshair size={14}/> {accuracy}%</Text></View>
              <View style={styles.typingBox}>
                <Text style={styles.targetParagraph}>{targetParagraph}</Text>
                <TextInput style={styles.typingInput} multiline autoFocus placeholder="Start typing here..." placeholderTextColor="#475569" value={typedText} onChangeText={handleTypingChange} />
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {gameState === 'waiting_result' && (
        <View style={styles.centerContent}><ActivityIndicator size="large" color="#3b82f6" /><Text style={styles.arenaTitle}>Awaiting Referee</Text><Text style={styles.playerWaitingText}>Waiting for opponent to finish...</Text></View>
      )}

      {gameState === 'finished' && (
        <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingVertical: 20}} showsVerticalScrollIndicator={false}>
          <View style={styles.resultCard}>
            <Trophy size={60} color={matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"} style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={[styles.resultTitleWin, {color: matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"}]}>{matchStatus === 'WIN' ? "PRIZE SECURED!" : matchStatus === 'DRAW' ? "MATCH TIED" : "DEFEATED!"}</Text>
            
            <View style={[styles.winningsBox, {borderColor: matchStatus === 'WIN' ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)", backgroundColor: matchStatus === 'WIN' ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"}]}>
              <Text style={[styles.winningsLabel, {color: matchStatus === 'WIN' ? "#34d399" : "#ef4444"}]}>{matchStatus === 'WIN' ? "Winnings Added to Wallet" : matchStatus === 'DRAW' ? "Entry Fee Refunded" : "Better Luck Next Time"}</Text>
              <Text style={[styles.winningsAmount, {color: matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"}]}>+₹{matchReward}</Text>
            </View>

            <View style={styles.leaderboardBox}>
              <Text style={styles.lbHeader}>LIVE MATCH RESULTS</Text>
              {apiLoading ? ( <ActivityIndicator size="small" color="#3b82f6" style={{padding: 20}}/> ) : (
                matchStandings.map((player, idx) => (
                  <View key={idx} style={styles.lbRow}>
                    <Text style={[styles.lbRank, player.isMe && {color: '#facc15'}]}>#{player.rank}</Text>
                    <Text style={[styles.lbName, player.isMe && {color: '#60a5fa'}]}>{player.name} {player.isMe && <Text style={styles.youTag}> YOU </Text>}</Text>
                    <Text style={styles.lbScore}>{player.score}</Text>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity style={styles.returnBtn} onPress={() => navigation.navigate('Lobby')} disabled={apiLoading}>
              <Text style={styles.returnBtnText}>{apiLoading ? "SAVING..." : "RETURN TO LOBBY"}</Text>
            </TouchableOpacity>
          </View>

          {/* 🔴 FIX 2: QA Accuracy Review Section Added Back */}
          {!isTypingMode && userAnswers.length > 0 && (
            <View style={styles.reviewBox}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15, gap: 5}}>
                <Crosshair size={16} color="#94a3b8" />
                <Text style={styles.reviewHeader}>Quiz Accuracy Review</Text>
              </View>
              {userAnswers.map((ans, idx) => (
                <View key={idx} style={[styles.reviewCard, { borderColor: ans.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', backgroundColor: ans.isCorrect ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }]}>
                  <Text style={styles.reviewQText}>{idx + 1}. {ans.question}</Text>
                  <Text style={styles.reviewAnsText}>Your Answer: <Text style={{color: ans.isCorrect ? '#34d399' : '#ef4444'}}>{ans.userAnswer}</Text></Text>
                  {!ans.isCorrect && <Text style={styles.reviewCorrectText}>Correct: {ans.correctAnswer}</Text>}
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  glowTop: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, backgroundColor: 'rgba(37, 99, 235, 0.15)', borderRadius: 125 },
  glowBottom: { position: 'absolute', bottom: -50, right: -50, width: 250, height: 250, backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 125 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15 },
  arenaTitle: { fontSize: 24, fontWeight: '900', color: '#e2e8f0', letterSpacing: 2, marginBottom: 5 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  loadingText: { color: '#60a5fa', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 15, marginBottom: 15 },
  cardHeaderText: { color: '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 1, flex: 1 },
  playerRowMe: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(59,130,246,0.1)', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', marginBottom: 10 },
  playerRowOpp: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(15,23,42,0.8)', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  playerNameMe: { color: '#60a5fa', fontWeight: '900', fontSize: 14 },
  joinedBadge: { backgroundColor: '#2563eb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  joinedText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  playerRowWaiting: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(15,23,42,0.5)', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', borderStyle: 'dashed', marginBottom: 10 },
  playerWaitingText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  matchFoundIcon: { backgroundColor: 'rgba(16,185,129,0.1)', padding: 30, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', marginBottom: 20 },
  matchFoundTitle: { fontSize: 32, fontWeight: '900', color: '#34d399', letterSpacing: 1, marginBottom: 5 },
  matchFoundSub: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  generatingText: { color: '#facc15', fontSize: 12, fontWeight: '900', marginTop: 30 },
  gameContainer: { flex: 1, paddingTop: 10, paddingHorizontal: 15 },
  scoreBoard: { backgroundColor: 'rgba(15,23,42,0.8)', padding: 15, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 20, marginTop: 15 },
  timerBadge: { position: 'absolute', top: -15, alignSelf: 'center', backgroundColor: '#020617', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  timerText: { color: '#facc15', fontWeight: '900', fontSize: 16 },
  scoreCards: { flexDirection: 'row', gap: 10, marginTop: 10 },
  scoreCardMe: { flex: 1, padding: 10, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.5)' },
  scoreCardOpp: { flex: 1, padding: 10, borderRadius: 16, alignItems: 'center', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  scoreLabelMe: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scoreValueMe: { color: '#60a5fa', fontSize: 24, fontWeight: '900' },
  scoreLabelOpp: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scoreValueOpp: { color: '#cbd5e1', fontSize: 24, fontWeight: '900' },
  questionBox: { backgroundColor: '#1e293b', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#334155', minHeight: 120, justifyContent: 'center' },
  questionText: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold', textAlign: 'center', lineHeight: 24 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.6)', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' },
  optionLetter: { backgroundColor: '#020617', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155', marginRight: 15 },
  optionLetterText: { color: '#3b82f6', fontWeight: '900' },
  optionText: { color: '#cbd5e1', fontSize: 15, fontWeight: 'bold', flex: 1 },
  typingHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: 12, borderRadius: 12, marginBottom: 15 },
  typingBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  targetParagraph: { color: '#94a3b8', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  typingInput: { backgroundColor: '#020617', color: '#fff', fontSize: 16, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#3b82f6', minHeight: 100, textAlignVertical: 'top' },
  
  resultCard: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#1e293b', width: '100%', marginBottom: 20 },
  resultTitleWin: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  winningsBox: { borderWidth: 1, padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 25 },
  winningsLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  winningsAmount: { fontSize: 28, fontWeight: '900', marginTop: 5 },
  leaderboardBox: { backgroundColor: '#020617', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden', marginBottom: 25 },
  lbHeader: { backgroundColor: '#0f172a', padding: 10, color: '#94a3b8', fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  lbRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  lbRank: { color: '#94a3b8', fontWeight: '900', width: 30 },
  lbName: { color: '#f1f5f9', fontWeight: 'bold', flex: 1 },
  youTag: { color: '#60a5fa', fontSize: 8, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 4, overflow: 'hidden', borderRadius: 4 },
  lbScore: { color: '#34d399', fontWeight: '900', fontFamily: 'monospace', fontSize: 16 },
  returnBtn: { backgroundColor: '#2563eb', padding: 18, borderRadius: 16, alignItems: 'center' },
  returnBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1, textAlign: 'center' },

  reviewBox: { backgroundColor: '#0f172a', borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', padding: 20, width: '100%' },
  reviewHeader: { color: '#94a3b8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  reviewCard: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  reviewQText: { color: '#e2e8f0', fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  reviewAnsText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  reviewCorrectText: { color: '#34d399', fontSize: 12, fontWeight: 'bold', marginTop: 3 }
});