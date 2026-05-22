import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, Alert, BackHandler, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { Clock, Trophy, User, Swords, Users, Zap, Crosshair, Volume2, VolumeX } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Audio } from 'expo-av';

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

  const [soundEnabled, setSoundEnabled] = useState(true);

  const [myPoints, setMyPoints] = useState(0);
  const myPointsRef = useRef(0);
  const myGamerTagRef = useRef("Live_Player"); 
  const ws = useRef(null); 

  const [opponents, setOpponents] = useState([]); 
  const opponentsRef = useRef([]); 
  
  const [matchStandings, setMatchStandings] = useState([]);
  const [matchReward, setMatchReward] = useState(0); 
  const [matchStatus, setMatchStatus] = useState(''); 

  const [userAnswers, setUserAnswers] = useState([]);
  const matchRoomIdRef = useRef(""); 

  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [targetParagraph, setTargetParagraph] = useState("");
  const [typedText, setTypedText] = useState("");
  const [wpm, setWpm] = useState(0);
  const wpmRef = useRef(0);
  const [accuracy, setAccuracy] = useState(100);
  const accuracyRef = useRef(100);
  const typingStartTime = useRef(null);

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

  const soundRefs = useRef({}); 

  useEffect(() => {
    const setupAndPreloadSounds = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        const tick = await Audio.Sound.createAsync(require('../assets/sounds/tick.mp3'));
        const correct = await Audio.Sound.createAsync(require('../assets/sounds/correct.mp3'));
        const wrong = await Audio.Sound.createAsync(require('../assets/sounds/wrong.mp3'));
        const win = await Audio.Sound.createAsync(require('../assets/sounds/win.mp3'));
        const lose = await Audio.Sound.createAsync(require('../assets/sounds/lose.mp3'));
        const matchFound = await Audio.Sound.createAsync(require('../assets/sounds/match-found.mp3'));

        soundRefs.current = { 'tick.mp3': tick.sound, 'correct.mp3': correct.sound, 'wrong.mp3': wrong.sound, 'win.mp3': win.sound, 'lose.mp3': lose.sound, 'match-found.mp3': matchFound.sound };
      } catch (error) { console.log("Audio Preload Error:", error); }
    };
    setupAndPreloadSounds();
    return () => {
      Object.values(soundRefs.current).forEach(async (soundObj) => {
        try { await soundObj.unloadAsync(); } catch (e) {}
      });
    };
  }, []);

  const playSound = async (soundFileName) => {
    if (!soundEnabled) return;
    try {
      const soundObj = soundRefs.current[soundFileName];
      if (soundObj) await soundObj.replayAsync(); 
    } catch (error) { console.log("Play Error", error); }
  };

  useEffect(() => {
    const backAction = () => {
      if (gameStateRef.current === 'playing' || gameStateRef.current === 'searching' || gameStateRef.current === 'found') {
        Alert.alert("🚨 Match in Progress!", "If you leave now, you will lose your entry fee. Are you sure?", [
          { text: "Resume Game", onPress: () => null, style: "cancel" },
          { text: "Surrender", onPress: () => navigation.navigate('Lobby'), style: "destructive" }
        ]);
        return true; 
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if ((nextAppState === 'background' || nextAppState === 'inactive') && gameStateRef.current === 'playing') {
        console.log("App Minimized during Live Match!");
      }
    });
    return () => { backHandler.remove(); appStateSubscription.remove(); };
  }, [navigation]);

  const sendMyScore = (newScore) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ action: 'score_update', score: newScore, player_name: myGamerTagRef.current }));
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
        setMaxPlayers(res.data.max_players || 2);
        maxPlayersRef.current = res.data.max_players || 2;
        setIsTypingMode(res.data.is_typing_test);

        const matchRoomId = res.data.room_id || `room_${Date.now()}`;
        matchRoomIdRef.current = matchRoomId; 

        ws.current = new WebSocket(`${WS_BASE}/ws/arena/${tableId}/${matchRoomId}/`);
        ws.current.onopen = () => { sendMyScore(0); };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const myTag = myGamerTagRef.current;

            // 🔴 BUG FIX 1: Instant Handshake to Sync Names
            if (data.action === 'player_joined' && data.player !== myTag && data.player !== "Live_Player") {
                sendMyScore(myPointsRef.current); 
            }

            if (data.action === 'questions_ready') {
                if (data.content.is_typing_test) {
                    setIsTypingMode(true); setTargetParagraph(data.content.paragraph); setTimeLeft(data.content.time_limit);
                } else {
                    setIsTypingMode(false); setQuestions(data.content.questions); setTimePerQ(data.content.time_per_question); setTimeLeft(data.content.time_per_question);
                }
                setTimeout(() => { setGameState("playing"); typingStartTime.current = Date.now(); }, 1500); 
            }

            if (data.action === 'score_update' && data.player && data.player !== myTag && data.player !== "Live_Player") {
                updateOpponents(prev => {
                    const existing = prev.find(o => o.name === data.player);
                    if (existing) {
                        return prev.map(o => o.name === data.player ? { ...o, score: data.score } : o);
                    } else {
                        return [...prev, { name: data.player, score: data.score, isBot: false }];
                    }
                });
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
            if (prev <= 1) { clearInterval(searchIntervalRef.current); fillWithBotsAndStart(); return 0; }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(searchIntervalRef.current);
  }, [gameState]);

  useEffect(() => {
      // 🔴 BUG FIX 2: 1.5 Second delay before match starts so players can see names
      if (gameState === "searching" && opponents.length === maxPlayers - 1 && maxPlayers > 1) {
          clearInterval(searchIntervalRef.current); 
          setTimeout(() => { triggerMatchFound(); }, 1500);
      }
  }, [opponents.length, gameState, maxPlayers]);

  const generateBotName = () => {
      const firstNames = ["Rahul", "Neha", "Vikas", "Priya", "Aman", "Rohit", "Pooja", "Sonu", "Monu", "Jaat", "Desi", "Gamer", "Pro", "Ninja", "King", "Queen", "Ankit", "Komal"];
      const suffixes = ["OP", "Pro", "Kill", "Sniper", "Don", "Hry", "Boy", "Girl", "Boss", "007", "X", "Max", "YT"];
      const type = Math.floor(Math.random() * 3); 
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      if (type === 0) return `${fName}${Math.floor(100 + Math.random() * 9000)}`; 
      else if (type === 1) return `${fName}_${suffixes[Math.floor(Math.random() * suffixes.length)]}`; 
      else return `${fName}${Math.floor(10 + Math.random() * 90)}`; 
  };

  const fillWithBotsAndStart = () => {
      updateOpponents(prev => {
          let newOpp = [...prev];
          while (newOpp.length < maxPlayersRef.current - 1) {
              let newName = generateBotName();
              while(newOpp.some(o => o.name === newName) || newName === myGamerTagRef.current) newName = generateBotName();
              newOpp.push({ name: newName, score: 0, isBot: true });
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
      playSound('match-found.mp3'); 
  };

  useEffect(() => {
    if (gameState !== "playing") return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        if (timeLeft <= 5 && timeLeft > 0) playSound('tick.mp3'); 
        
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
    const selectedIndex = currentQ.options.indexOf(selectedOption);
    const selectedLetter = ["A", "B", "C", "D"][selectedIndex];
    const isCorrect = selectedLetter === dbAnswer;
    
    if (isCorrect) playSound('correct.mp3'); else playSound('wrong.mp3');

    const earnedPoints = isCorrect ? (10 + timeLeft) : 0; 
    setUserAnswers(prev => [...prev, { question: currentQ.question, userAnswer: selectedOption, correctAnswer: currentQ.options[["A", "B", "C", "D"].indexOf(dbAnswer)], isCorrect: isCorrect }]);

    const updatedMyPoints = myPoints + earnedPoints;
    setMyPoints(updatedMyPoints); sendMyScore(updatedMyPoints); 
    handleNextQuestion(updatedMyPoints, selectedOption);
  };

  const handleNextQuestion = (finalMyPoints, selectedOption = null) => {
    if (!selectedOption && !isTypingMode && questions.length > 0) {
        playSound('wrong.mp3'); 
        const currentQ = questions[currentQIndex];
        setUserAnswers(prev => [...prev, { question: currentQ.question, userAnswer: "Time Out", correctAnswer: currentQ.options[["A", "B", "C", "D"].indexOf(currentQ.answer)], isCorrect: false }]);
    }
    if (currentQIndex + 1 < questions.length) {
      setCurrentQIndex(currentQIndex + 1); setTimeLeft(timePerQ); 
    } else { triggerRefereeSubmit(finalMyPoints); }
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
    for (let i = 0; i < cleanTyped.length; i++) { if (i < cleanTarget.length && cleanTyped[i] === cleanTarget[i]) correctChars++; }
    const currentAccuracy = cleanTyped.length > 0 ? Math.round((correctChars / cleanTyped.length) * 100) : 100;
    setAccuracy(currentAccuracy);
    const currentPoints = val.length > 0 ? currentWpm + currentAccuracy : 0;
    setMyPoints(currentPoints); sendMyScore(currentPoints); 
    if (cleanTyped === cleanTarget && cleanTarget.length > 0) triggerRefereeSubmit(currentPoints);
  };

  const triggerRefereeSubmit = (finalMyPts) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true; 
    setGameState("waiting_result"); 
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ action: 'game_finished', player_name: myGamerTagRef.current, score: finalMyPts, wpm: wpmRef.current }));
        opponentsRef.current.forEach(opp => { if (opp.isBot) ws.current.send(JSON.stringify({ action: 'game_finished', player_name: opp.name, score: opp.score, wpm: 0 })); });
    }
  };

  const handleMatchResult = async (data) => {
      if (apiCalled.current) return;
      apiCalled.current = true;
      setGameState("waiting_result"); setApiLoading(true);

      const myTag = myGamerTagRef.current;
      const finalStandings = Object.entries(data.final_scores).map(([name, stats]) => ({ name, score: stats.score, isMe: name === myTag })).sort((a, b) => b.score - a.score);
      let currentRank = 1;
      finalStandings.forEach((p, idx) => { if (idx > 0 && p.score < finalStandings[idx-1].score) currentRank = idx + 1; p.rank = currentRank; });
      setMatchStandings(finalStandings);

      try {
          const token = await AsyncStorage.getItem('access_token');
          const res = await axios.post(`${API_BASE}/api/game/submit-result/`, { table_id: tableId, room_id: matchRoomIdRef.current }, { headers: { Authorization: `Bearer ${token}` } });
          const actualStatus = res.data.match_status;
          setMatchStatus(actualStatus); setMatchReward(res.data.prize_won || 0); 
          if (actualStatus === 'WIN') playSound('win.mp3'); else playSound('lose.mp3'); 
          setGameState("finished");
      } catch (error) {
          console.error("Submission Error:", error.response?.data?.error || error.message);
          setMatchStatus('LOSS'); setMatchReward(0); setGameState("finished");
      } finally { setApiLoading(false); }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setSoundEnabled(!soundEnabled)} style={styles.soundBtn}>
        {soundEnabled ? <Volume2 size={20} color="#94a3b8" /> : <VolumeX size={20} color="#ef4444" />}
      </TouchableOpacity>

      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {gameState === 'searching' && (
        <View style={styles.centerContent}>
          <Text style={styles.arenaTitle}>SECURING ARENA</Text>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.loadingText}> MATCHMAKING ACTIVE</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Users size={16} color="#94a3b8" />
              <Text style={styles.cardHeaderText}> Players in Lobby ({opponents.length + 1}/{maxPlayers})</Text>
            </View>
            <View style={styles.playerRowMe}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}><User size={16} color="#60a5fa" /><Text style={styles.playerNameMe}> YOU</Text></View>
              <View style={styles.joinedBadge}><Text style={styles.joinedText}>JOINED</Text></View>
            </View>
            {opponents.map((opp, idx) => (
              <View key={idx} style={styles.playerRowOpp}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>{opp.name}</Text>
                <View style={[styles.joinedBadge, {backgroundColor: '#10b981'}]}><Text style={styles.joinedText}>JOINED</Text></View>
              </View>
            ))}
            {Array.from({ length: Math.max(0, maxPlayers - 1 - opponents.length) }).map((_, idx) => (
               <View key={'w'+idx} style={styles.playerRowWaiting}>
                 <Text style={styles.playerWaitingText}>Waiting for opponent...</Text>
                 <ActivityIndicator size="small" color="#475569" />
               </View>
            ))}
          </View>

          {/* 🔴 BUG FIX 3: Timer UI Added in APK */}
          <View style={{ marginTop: 30, alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(250, 204, 21, 0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(250, 204, 21, 0.3)', flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={16} color="#facc15" />
              <Text style={{ color: '#facc15', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginLeft: 8 }}>
                MATCH STARTS IN: {searchTime}S
              </Text>
            </View>
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
            <View style={styles.timerBadge}>
              <Clock size={16} color={timeLeft <= 5 ? "#ef4444" : "#facc15"} />
              <Text style={[styles.timerText, timeLeft <= 5 && { color: "#ef4444" }]}> {timeLeft}s</Text>
            </View>
            <View style={styles.scoreCards}>
              <LinearGradient colors={['#1e3a8a', '#0f172a']} style={styles.scoreCardMe}>
                <Text style={styles.scoreLabelMe}>YOU</Text><Text style={styles.scoreValueMe}>{myPoints}</Text>
              </LinearGradient>
              {opponents.map((opp, idx) => (
                <View key={idx} style={styles.scoreCardOpp}>
                  <Text style={styles.scoreLabelOpp} numberOfLines={1}>{opp.name}</Text>
                  <Text style={styles.scoreValueOpp}>{opp.score}</Text>
                </View>
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
              <View style={styles.typingHeader}>
                 <Text style={{color: '#c084fc', fontWeight: 'bold'}}><Zap size={14}/> {wpm} WPM</Text>
                 <Text style={{color: '#34d399', fontWeight: 'bold'}}><Crosshair size={14}/> {accuracy}%</Text>
              </View>
              <View style={styles.typingBox}>
                <Text style={styles.targetParagraph}>{targetParagraph}</Text>
                <TextInput style={styles.typingInput} multiline autoFocus autoCorrect={false} spellCheck={false} autoComplete="off" autoCapitalize="none" keyboardType="visible-password" placeholder="Start typing here..." placeholderTextColor="#475569" value={typedText} onChangeText={handleTypingChange} />
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {gameState === 'waiting_result' && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.arenaTitle}>Awaiting Referee</Text>
          <Text style={styles.playerWaitingText}>Waiting for opponent to finish...</Text>
        </View>
      )}

      {gameState === 'finished' && (
        <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingVertical: 40}} showsVerticalScrollIndicator={false}>
          <View style={styles.resultCard}>
            <Trophy size={60} color={matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"} style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={[styles.resultTitleWin, {color: matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"}]}>{matchStatus === 'WIN' ? "PRIZE SECURED!" : matchStatus === 'DRAW' ? "MATCH TIED" : "DEFEATED!"}</Text>
            
            <View style={[styles.winningsBox, {borderColor: matchStatus === 'WIN' ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)", backgroundColor: matchStatus === 'WIN' ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"}]}>
              <Text style={[styles.winningsLabel, {color: matchStatus === 'WIN' ? "#34d399" : "#ef4444"}]}>{matchStatus === 'WIN' ? "Winnings Added to Wallet" : matchStatus === 'DRAW' ? "Entry Fee Refunded" : "Better Luck Next Time"}</Text>
              <Text style={[styles.winningsAmount, {color: matchStatus === 'WIN' ? "#34d399" : matchStatus === 'DRAW' ? "#facc15" : "#ef4444"}]}>+₹{matchReward}</Text>
            </View>

            <View style={styles.leaderboardBox}>
              <Text style={styles.lbHeader}>LIVE MATCH RESULTS</Text>
              {apiLoading ? (
                 <ActivityIndicator size="small" color="#3b82f6" style={{padding: 20}}/>
              ) : (
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

            {!isTypingMode && userAnswers.length > 0 && (
              <View style={styles.reviewContainer}>
                <Text style={styles.reviewHeader}>🎯 QUIZ ACCURACY REVIEW</Text>
                {userAnswers.map((ans, idx) => (
                  <View key={idx} style={[styles.reviewBox, ans.isCorrect ? styles.reviewBoxCorrect : styles.reviewBoxWrong]}>
                    <Text style={styles.reviewQuestion}>{idx + 1}. {ans.question}</Text>
                    <Text style={styles.reviewAnswer}>Your Answer: <Text style={ans.isCorrect ? styles.correctText : styles.wrongText}>{ans.userAnswer}</Text></Text>
                    {!ans.isCorrect && <Text style={styles.reviewCorrectAnswer}>Correct Answer: {ans.correctAnswer}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 15 },
  soundBtn: { position: 'absolute', top: 50, right: 20, zIndex: 100, backgroundColor: 'rgba(15,23,42,0.8)', padding: 10, borderRadius: 50, borderWidth: 1, borderColor: '#1e293b' },
  glowTop: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, backgroundColor: 'rgba(37, 99, 235, 0.15)', borderRadius: 125 },
  glowBottom: { position: 'absolute', bottom: -50, right: -50, width: 250, height: 250, backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 125 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  arenaTitle: { fontSize: 24, fontWeight: '900', color: '#e2e8f0', letterSpacing: 2, marginBottom: 5 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40 },
  loadingText: { color: '#60a5fa', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 15, marginBottom: 15 },
  cardHeaderText: { color: '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
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
  gameContainer: { flex: 1, paddingTop: 40 },
  scoreBoard: { backgroundColor: 'rgba(15,23,42,0.8)', padding: 15, borderRadius: 24, borderWidth: 1, borderColor: '#1e293b', marginBottom: 20 },
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
  resultCard: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#1e293b', width: '100%' },
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
  returnBtnText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  reviewContainer: { marginTop: 25, width: '100%' },
  reviewHeader: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, letterSpacing: 1 },
  reviewBox: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  reviewBoxCorrect: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' },
  reviewBoxWrong: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  reviewQuestion: { color: '#f1f5f9', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  reviewAnswer: { color: '#94a3b8', fontSize: 12 },
  correctText: { color: '#34d399', fontWeight: 'bold' },
  wrongText: { color: '#ef4444', fontWeight: 'bold' },
  reviewCorrectAnswer: { color: '#34d399', fontSize: 12, fontWeight: 'bold', marginTop: 4 }
});