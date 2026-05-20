const API_BASE = "https://mockwar-backend.onrender.com";
const WS_BASE = "wss://mockwar-backend.onrender.com";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Trophy, User, Award, Swords, Crosshair, Zap, Users, Loader2, Volume2, VolumeX } from "lucide-react";
import axios from "axios";

function Arena() {
  const { tableId } = useParams(); 
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  
  const hasSubmitted = useRef(false); 

  // 🔊 SOUND SYSTEM SETUP
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const playSound = (soundFile) => {
    if (soundEnabled) {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.volume = 0.5;
      audio.play().catch(e => console.log("Sound play error:", e));
    }
  };
  const apiCalled = useRef(false); // 🔒 नया ताला
  // 🕒 Matchmaking States
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

  // 🏆 Scoreboard & WebSocket States
  const [myPoints, setMyPoints] = useState(0);
  const myPointsRef = useRef(0);
  const myGamerTagRef = useRef("Live_Player"); 
  const ws = useRef(null); 

  const [opponents, setOpponents] = useState([]); 
  const opponentsRef = useRef([]); 
  
  const [matchStandings, setMatchStandings] = useState([]);
  const [matchReward, setMatchReward] = useState(0); 

  // 🔥 Transparency tracking state
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

  // 📚 Content Hooks
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [targetParagraph, setTargetParagraph] = useState("");
  const [typedText, setTypedText] = useState("");
  const [wpm, setWpm] = useState(0);
  const wpmRef = useRef(0);
  const [accuracy, setAccuracy] = useState(100);
  const accuracyRef = useRef(100);
  const typingStartTime = useRef(null);

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

  // 1. Initialize Game
  useEffect(() => {
    if (!token) { navigate("/auth"); return; }

    const initGame = async () => {
      try {
        const profRes = await axios.get(`${API_BASE}/api/user/profile/`, { headers: { Authorization: `Bearer ${token}` } });
        myGamerTagRef.current = profRes.data.gamer_tag;

        const res = await axios.get(`${API_BASE}/api/game/content/${tableId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const tableLimit = res.data.max_players || 2;
        setMaxPlayers(tableLimit);
        maxPlayersRef.current = tableLimit;

        if (res.data.is_typing_test) {
          setIsTypingMode(true);
          setTargetParagraph(res.data.paragraph);
          setTimeLeft(res.data.time_limit || 60); 
        } else {
          setIsTypingMode(false);
          setQuestions(res.data.questions);
          const qTime = res.data.time_per_question || 12;
          setTimePerQ(qTime);
          setTimeLeft(qTime); 
        }

        // NAYA: Backend se aayi hui room_id ko read karo
        const matchRoomId = res.data.room_id || `room_${Date.now()}`;
        
        // NAYA: URL me tableId ke aage matchRoomId laga do
        ws.current = new WebSocket(`${WS_BASE}/ws/arena/${tableId}/${matchRoomId}/`);
        
        ws.current.onopen = () => {
            sendMyScore(0); 
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const myTag = myGamerTagRef.current;

            if (data.action === 'score_update' && data.player && data.player !== myTag && data.player !== "Live_Player") {
                let isNewPlayer = false;
                updateOpponents(prev => {
                    const existing = prev.find(o => o.name === data.player);
                    if (existing) {
                        return prev.map(o => o.name === data.player ? { ...o, score: data.score } : o);
                    } else {
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

            // 🚨 JUDGE SYSTEM: Waiting for opponent
            if (data.action === 'waiting_for_opponent') {
                setGameState("waiting_result");
            }

            // 🚨 JUDGE SYSTEM: Final Result is here!
            if (data.action === 'match_result') {
                handleMatchResult(data);
            }
        };

      } catch (error) {
        console.error("Initialization Error:", error);
        navigate("/");
      }
    };
    
    initGame();
    return () => { if (ws.current) ws.current.close(); };
  }, [tableId, token, navigate]);

  // 2. TIMERS & DYNAMIC BOTS INJECTION
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

  const generateBotName = () => {
      const firstNames = ["Rahul", "Neha", "Vikas", "Priya", "Aman", "Rohit", "Pooja", "Sonu", "Monu", "Jaat", "Desi", "Gamer", "Pro", "Ninja", "King", "Queen", "Ankit", "Komal", "Sahil", "Deepak", "Anjali", "Rajat", "Kuldeep", "Sumit"];
      const suffixes = ["OP", "Pro", "Kill", "Sniper", "Don", "Hry", "Boy", "Girl", "Boss", "007", "X", "Max", "YT"];
      
      const type = Math.floor(Math.random() * 3); 
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      
      if (type === 0) {
          return `${fName}${Math.floor(100 + Math.random() * 9000)}`; 
      } else if (type === 1) {
          const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
          return `${fName}_${suf}`; 
      } else {
          return `${fName}${Math.floor(10 + Math.random() * 90)}`; 
      }
  };

  const fillWithBotsAndStart = () => {
      updateOpponents(prev => {
          let newOpp = [...prev];
          while (newOpp.length < maxPlayersRef.current - 1) {
              let newName = generateBotName();
              while(newOpp.some(o => o.name === newName) || newName === myGamerTagRef.current) {
                  newName = generateBotName();
              }
              newOpp.push({ name: newName, score: 0, isBot: true });
          }
          return newOpp;
      });
      triggerMatchFound();
  };

  const triggerMatchFound = () => {
      setGameState("found");
      playSound('match-found.mp3');
      setTimeout(() => {
          setGameState("playing");
          typingStartTime.current = Date.now();
      }, 2500);
  };

  // 3. GAMEPLAY & AI BOTS LOGIC
  useEffect(() => {
    if (gameState !== "playing") return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        
        if (timeLeft <= 5 && timeLeft > 0) {
            playSound('tick.mp3');
        }
        
        updateOpponents(prev => prev.map(opp => {
             if (opp.isBot) {
                 if (Math.random() < 0.20) return opp; 

                 const myCurrentScore = myPointsRef.current;
                 const scoreDiff = myCurrentScore - opp.score;
                 let pointsToAdd = 0;

                 if (isTypingMode) {
                     if (scoreDiff > 10) {
                         pointsToAdd = Math.floor(Math.random() * 8) + 5; 
                     } else if (scoreDiff >= -5 && scoreDiff <= 10) {
                         pointsToAdd = Math.floor(Math.random() * 5) + 1; 
                     } else {
                         pointsToAdd = Math.floor(Math.random() * 2); 
                     }
                 } else {
                     if (timeLeft % 5 === 0 && Math.random() > 0.3) {
                         pointsToAdd = (Math.random() > 0.4) ? (10 + timeLeft) : 0; 
                     }
                 }

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
    
    if (isCorrect) playSound('correct.mp3');
    else playSound('wrong.mp3');

    const earnedPoints = isCorrect ? (10 + timeLeft) : 0; 
    
    setUserAnswers(prev => [...prev, { 
      question: currentQ.question, 
      userAnswer: selectedOption, 
      correctAnswer: currentQ.options[["A", "B", "C", "D"].indexOf(dbAnswer)],
      isCorrect: isCorrect 
    }]);

    const updatedMyPoints = myPoints + earnedPoints;
    setMyPoints(updatedMyPoints);
    sendMyScore(updatedMyPoints); 

    handleNextQuestion(updatedMyPoints, selectedOption);
  };

  const handleNextQuestion = (finalMyPoints, selectedOption) => {
    if (!selectedOption) {
        playSound('wrong.mp3'); 
        const currentQ = questions[currentQIndex];
        setUserAnswers(prev => [...prev, { 
            question: currentQ.question, 
            userAnswer: "Time Out / छूट गया", 
            correctAnswer: currentQ.options[["A", "B", "C", "D"].indexOf(currentQ.answer)],
            isCorrect: false 
        }]);
    }

    if (currentQIndex + 1 < questions.length) {
      setCurrentQIndex(currentQIndex + 1);
      setTimeLeft(timePerQ); 
    } else {
      triggerRefereeSubmit(finalMyPoints); 
    }
  };

  const handleTypingChange = (e) => {
    const value = e.target.value;
    setTypedText(value);
    const timeElapsedMins = (Date.now() - typingStartTime.current) / 60000;
    const words = value.trim().split(/\s+/).length;
    const currentWpm = value.length > 0 ? Math.round(words / (timeElapsedMins || 0.01)) : 0;
    setWpm(currentWpm);

    const cleanTarget = targetParagraph.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTyped = value.replace(/[^a-zA-Z0-9]/g, '');

    let correctChars = 0;
    for (let i = 0; i < cleanTyped.length; i++) {
      if (i < cleanTarget.length && cleanTyped[i] === cleanTarget[i]) correctChars++;
    }
    const currentAccuracy = cleanTyped.length > 0 ? Math.round((correctChars / cleanTyped.length) * 100) : 100;
    setAccuracy(currentAccuracy);

    const currentPoints = value.length > 0 ? currentWpm + currentAccuracy : 0;
    setMyPoints(currentPoints);
    sendMyScore(currentPoints); 

    if (cleanTyped === cleanTarget && cleanTarget.length > 0) {
      triggerRefereeSubmit(currentPoints);
    }
  };

  const handlePaste = (e) => { e.preventDefault(); };

  // 4. 🚨 SEND SCORE TO REFEREE (WebSocket) - NO API HIT YET!
  const triggerRefereeSubmit = (finalMyPts) => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true; 

    setGameState("waiting_result"); // UI Change to Loading

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        // Send MY final score to Referee
        ws.current.send(JSON.stringify({
            action: 'game_finished',
            player_name: myGamerTagRef.current,
            score: finalMyPts,
            wpm: wpmRef.current
        }));

        // 🤖 BOT FIX: If there are frontend bots, send their scores to referee immediately so game ends!
        opponentsRef.current.forEach(opp => {
            if (opp.isBot) {
                ws.current.send(JSON.stringify({
                    action: 'game_finished',
                    player_name: opp.name,
                    score: opp.score,
                    wpm: 0
                }));
            }
        });
    }
  };

  // 5. 🏆 FINALLY: REFEREE SENDS RESULT -> WE HIT API
  const handleMatchResult = async (data) => {
      if (apiCalled.current) return;
      apiCalled.current = true;
      setGameState("finished");
      setApiLoading(true);

      const myTag = myGamerTagRef.current;
      let matchStatus = 'LOSS';

      if (data.is_draw) {
          matchStatus = 'DRAW';
      } else if (data.winners.includes(myTag)) {
          matchStatus = 'WIN';
      }

      if (matchStatus === 'WIN') playSound('win.mp3');
      else playSound('lose.mp3'); 

      // Format Standings from Referee Data
      const finalStandings = Object.entries(data.final_scores).map(([name, stats]) => ({
          name,
          score: stats.score,
          isMe: name === myTag
      })).sort((a, b) => b.score - a.score);

      let currentRank = 1;
      finalStandings.forEach((p, idx) => {
          if (idx > 0 && p.score < finalStandings[idx-1].score) currentRank = idx + 1;
          p.rank = currentRank;
      });
      setMatchStandings(finalStandings);

      // 💰 Hit Submit API only after result is declared!
      try {
          const res = await axios.post(`${API_BASE}/api/game/submit-result/`, { 
              table_id: tableId,
              score: data.final_scores[myTag].score,
              wpm: data.final_scores[myTag].wpm,
              accuracy: accuracyRef.current,
              status: matchStatus
          }, { headers: { Authorization: `Bearer ${token}` } });

          setMatchReward(res.data.prize_won || 0); 
      } catch (error) {
          console.error("Submission Error:", error);
      } finally {
          setApiLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans p-4 relative overflow-hidden select-none pb-20">
      
      {/* 🔊 SOUND TOGGLE BUTTON */}
      <button onClick={() => setSoundEnabled(!soundEnabled)} className="absolute top-4 right-4 z-50 bg-slate-900 border border-slate-700 p-2 rounded-full text-slate-400 hover:text-blue-400 transition-colors">
        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} className="text-red-400" />}
      </button>

      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* 🔍 THE WAITING ROOM */}
      {gameState === "searching" && (
        <div className="flex flex-col items-center space-y-8 animate-fade-in z-10 w-full max-w-sm">
          {/* ... (Existing code kept unchanged) */}
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-widest text-slate-200 uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Securing Arena</h1>
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1.5 flex items-center justify-center gap-1.5">
              <Loader2 size={14} className="animate-spin"/> Matchmaking Active
            </p>
          </div>

          <div className="w-full bg-slate-900/80 backdrop-blur-md p-5 rounded-3xl border border-slate-700/80 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
             <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={14}/> Players in Lobby</span>
                 <span className="bg-blue-500/10 text-blue-400 font-black text-[10px] px-2 py-1 rounded uppercase border border-blue-500/20">{opponents.length + 1} / {maxPlayers}</span>
             </div>

             <div className="space-y-2.5">
                 <div className="bg-blue-600/10 border border-blue-500/30 p-3 rounded-xl flex justify-between items-center shadow-[inset_0_0_10px_rgba(37,99,235,0.1)]">
                     <span className="font-black text-blue-400 text-sm flex items-center gap-2"><User size={14}/> YOU</span>
                     <span className="text-[9px] bg-blue-600 text-white font-black px-2 py-0.5 rounded uppercase tracking-widest">Joined</span>
                 </div>
                 
                 {opponents.map((opp, idx) => (
                     <div key={idx} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex justify-between items-center animate-fade-in">
                         <span className="font-bold text-slate-300 text-sm">{opp.name}</span>
                         <span className="text-[9px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded uppercase tracking-widest">Joined</span>
                     </div>
                 ))}

                 {Array.from({ length: Math.max(0, maxPlayers - 1 - opponents.length) }).map((_, idx) => (
                     <div key={idx} className="bg-slate-900/50 border border-slate-800 border-dashed p-3 rounded-xl flex justify-between items-center opacity-60">
                         <span className="font-bold text-slate-500 text-sm">Waiting for players...</span>
                         <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                 ))}
             </div>

             <div className="mt-5 text-center">
                 <p className="text-[10px] text-yellow-500 font-black uppercase tracking-widest animate-pulse flex items-center justify-center gap-1.5">
                    <Clock size={12}/> Match starts in: {searchTime}s
                 </p>
             </div>
          </div>
        </div>
      )}

      {/* ⚔️ MATCH FOUND */}
      {gameState === "found" && (
        <div className="flex flex-col items-center text-center space-y-4 animate-scale-up z-10">
          <div className="bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.3)] relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-400/20 animate-pulse"></div>
            <Swords size={55} className="text-emerald-400 relative z-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-600 tracking-wider uppercase drop-shadow-md">MATCH FOUND!</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 flex items-center justify-center gap-1.5">
               <Users size={12}/> {opponents.length + 1} Warriors Ready
            </p>
          </div>
        </div>
      )}

      {/* 🎮 LIVE GAME PLAYING */}
      {gameState === "playing" && (
        <div className="w-full max-w-xl animate-fade-in space-y-5 z-10">
          {/* ... (Existing Playing code kept unchanged) */}
          <div className="space-y-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="flex justify-center -mt-8 mb-2">
                 <div className="bg-slate-950 px-6 py-2 rounded-2xl border border-yellow-500/30 flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
                    <div className={`absolute inset-0 bg-yellow-400/10 ${timeLeft <= 5 ? "animate-ping bg-red-500/20" : ""}`}></div>
                    <Clock size={18} className={`${timeLeft <= 5 ? "text-red-500" : "text-yellow-400"} relative z-10`} />
                    <span className={`font-mono font-black text-xl relative z-10 ${timeLeft <= 5 ? "text-red-500" : "text-yellow-400"}`}>{timeLeft}s</span>
                 </div>
              </div>

              <div className={`grid gap-3 ${maxPlayers <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
                 <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/50 p-3 rounded-2xl text-center shadow-[inset_0_0_15px_rgba(37,99,235,0.1)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center justify-center gap-1"><User size={10}/> YOU</p>
                    <p className="text-2xl font-black text-blue-400 mt-1">{myPoints}</p>
                 </div>
                 
                 {opponents.map((opp, idx) => (
                     <div key={idx} className="bg-slate-900 border border-slate-700/80 p-3 rounded-2xl text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500/50"></div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate px-2">
                           {opp.name}
                        </p>
                        <p className="text-2xl font-black mt-1 text-slate-300">{opp.score}</p>
                     </div>
                 ))}
              </div>
          </div>

          {!isTypingMode && questions.length > 0 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700 text-center min-h-[110px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <h2 className="text-lg font-bold leading-relaxed text-slate-100">{questions[currentQIndex].question}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {questions[currentQIndex].options.map((option, idx) => (
                  <button key={idx} onClick={() => handleAnswerClick(option)}
                    className="group bg-slate-900/60 backdrop-blur-sm border border-slate-800 hover:border-blue-500 hover:bg-slate-800 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] text-slate-300 font-bold py-4 px-5 rounded-xl text-left transition-all active:scale-[0.98] text-base cursor-pointer flex items-center">
                    <span className="bg-slate-950 text-blue-500 border border-slate-800 group-hover:border-blue-500 font-black w-8 h-8 flex items-center justify-center rounded-lg mr-3 transition-colors">
                      {['A','B','C','D'][idx]}
                    </span> 
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isTypingMode && (
            <div className="space-y-4 w-full">
              <div className="flex justify-between px-4 font-black text-xs uppercase tracking-wider bg-slate-900/80 py-3 rounded-xl border border-slate-700 shadow-inner">
                <span className="text-purple-400 flex items-center gap-1.5"><Zap size={16}/> Speed: {wpm} WPM</span>
                <span className="text-emerald-400 flex items-center gap-1.5"><Crosshair size={16}/> Accuracy: {accuracy}%</span>
              </div>

              {/* 🚀 THE PRO TYPING ARENA (MonkeyType Style) */}
              <div 
                className="relative w-full bg-slate-950/80 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-slate-700/80 shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden cursor-text group" 
                onClick={() => document.getElementById('hidden-typer')?.focus()}
              >
                
                {/* Active Focus Glow (जब टाइपिंग कर रहे हों) */}
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>

                {/* Rendered Text with Live Cursor */}
                <div className="text-xl md:text-3xl leading-relaxed md:leading-loose font-mono tracking-wide text-left relative z-10 pointer-events-none flex flex-wrap">
                  {targetParagraph.split("").map((char, index) => {
                    let charStyle = "text-slate-600"; // डिफ़ॉल्ट (जो अभी टाइप नहीं हुआ)
                    let cursorStyle = "";

                    if (index < typedText.length) {
                      // जो अक्षर टाइप हो चुके हैं
                      charStyle = typedText[index] === char 
                        ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" // सही 
                        : "text-red-400 bg-red-500/20 rounded-sm border-b-4 border-red-500"; // गलत
                    } else if (index === typedText.length) {
                      // 🌟 THE CURRENT CHARACTER (जहाँ कर्सर है)
                      charStyle = "text-slate-100 font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]";
                      cursorStyle = "border-l-[3px] border-blue-500 animate-pulse bg-blue-500/20 rounded-r-sm";
                    }

                    // स्पेस (Space) को सही से दिखाने के लिए \u00A0 का इस्तेमाल
                    const displayChar = char === " " ? "\u00A0" : char; 

                    return (
                      <span key={index} className={`relative transition-colors duration-100 ${charStyle} ${cursorStyle}`}>
                        {displayChar}
                      </span>
                    );
                  })}
                </div>
                
                {/* Hidden Textarea (यह दिखेगा नहीं, लेकिन मोबाइल कीबोर्ड इसी से आएगा) */}
                <textarea
                  id="hidden-typer"
                  autoFocus
                  value={typedText}
                  onChange={(e) => {
                      // टेक्स्ट को टारगेट पैराग्राफ से लंबा नहीं होने देगा
                      if (e.target.value.length <= targetParagraph.length) {
                          handleTypingChange(e);
                      }
                  }}
                  onPaste={handlePaste}
                  onCopy={(e) => e.preventDefault()}
                  autoComplete="off"
                  spellCheck="false"
                  className="absolute inset-0 w-full h-full opacity-0 resize-none z-20 cursor-text"
                />
              </div>

              <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 animate-pulse">
                 Tap on the text box to start typing
              </p>
            </div>
          )}
        </div>
      )}

      {/* ⏳ NEW: WAITING FOR OPPONENT SCREEN */}
      {gameState === "waiting_result" && (
        <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in z-10 w-full max-w-sm text-center">
            <Loader2 size={60} className="animate-spin text-blue-500 mb-4" />
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 uppercase tracking-widest">Awaiting Referee</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-900/50 border border-slate-800 py-2 px-4 rounded-xl">Waiting for opponent to finish...</p>
        </div>
      )}

      {/* 🏆 LEADERBOARD & TRANSPARENCY SCREEN */}
      {gameState === "finished" && (
        <div className="w-full max-w-md space-y-6 z-10 animate-scale-up">
          {/* ... (Existing Result Screen kept unchanged) */}
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-700 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
             <Trophy size={60} className={`${matchReward > 0 && myPoints > 0 ? "text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]" : "text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]"} mb-3`} />
             <h1 className={`text-3xl font-black tracking-tight mb-4 uppercase ${matchReward > 0 ? "text-emerald-400" : matchStandings[0]?.score === myPoints ? "text-yellow-400" : "text-red-500"}`}>
                {matchReward > 0 ? "Prize Secured!" : matchStandings[0]?.score === myPoints ? "Match Tied / Draw" : "Defeated!"}
             </h1>

             <div className="mb-6 animate-fade-in w-full px-2">
                {matchReward > 0 ? (
                   <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-3 rounded-2xl text-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">Winnings Added to Wallet</p>
                      <p className="text-3xl font-black text-emerald-400">+₹{matchReward}</p>
                   </div>
                ) : matchStandings[0]?.score === myPoints ? (
                   <div className="bg-yellow-500/10 border border-yellow-500/30 px-6 py-3 rounded-2xl text-center shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                      <p className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1">Entry Fee Refunded</p>
                      <p className="text-2xl font-black text-yellow-500">Fees Refunded</p>
                   </div>
                ) : (
                   <div className="bg-red-500/10 border border-red-500/30 px-6 py-3 rounded-2xl text-center shadow-[0_0_20px_rgba(248,113,113,0.2)]">
                      <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Better Luck Next Time</p>
                      <p className="text-xl font-black text-red-500 mt-1">₹0 Won</p>
                   </div>
                )}
             </div>

             <div className="w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden mb-6 shadow-inner">
               <div className="bg-slate-900/80 text-center py-2.5 border-b border-slate-800">
                   <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5"><Award size={14} className="text-blue-400"/> Live Match Results</span>
               </div>
               
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-950 text-slate-600 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                     <th className="py-3 px-4 text-center w-14">Rank</th>
                     <th className="py-3 px-4">Warrior Tag</th>
                     <th className="py-3 px-4 text-right">Points</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50 text-xs">
                   {apiLoading ? (
                       <tr><td colSpan="3" className="text-center py-8 text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing final ledger...</td></tr>
                   ) : (
                       matchStandings.map((player, idx) => (
                           <tr key={idx} className={player.isMe ? "bg-blue-600/10 font-bold border-l-4 border-blue-500" : "hover:bg-slate-900/50 text-slate-400 transition-colors"}>
                           <td className={`py-3.5 px-4 text-center font-black text-sm ${player.rank === 1 ? 'text-yellow-400' : player.rank === 2 ? 'text-slate-300' : player.rank === 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                               #{player.rank}
                           </td>
                           <td className="py-3.5 px-4 font-bold text-slate-200 flex items-center gap-2">
                               {player.isMe && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div>}
                               <span className="tracking-wide">{player.name}</span> 
                               {player.isMe && <span className="text-[9px] text-blue-400 font-black tracking-widest uppercase bg-blue-500/10 px-1.5 py-0.5 rounded ml-1">You</span>}
                           </td>
                           <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-sm">{player.score}</td>
                           </tr>
                       ))
                   )}
                 </tbody>
               </table>
             </div>
             
             <button onClick={() => navigate("/")} disabled={apiLoading}
               className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-black text-sm py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-95 disabled:opacity-50 tracking-widest uppercase cursor-pointer">
               {apiLoading ? "Saving Ledger..." : "Return to Lobby"}
             </button>
          </div>

          {!isTypingMode && userAnswers.length > 0 && (
              <div className="w-full bg-slate-900 border border-slate-800 rounded-[2rem] p-6 space-y-4 shadow-2xl animate-fade-in">
                  <h3 className="text-center text-xs font-black uppercase text-slate-400 tracking-widest flex items-center justify-center gap-1.5"><Crosshair size={14}/> Quiz Accuracy Review</h3>
                  {userAnswers.map((ans, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${ans.isCorrect ? "bg-emerald-950/20 border-emerald-500/20" : "bg-red-950/20 border-red-500/20"}`}>
                          <p className="text-xs md:text-sm font-bold text-slate-200 mb-2">{idx + 1}. {ans.question}</p>
                          <p className="text-xs text-slate-400">Your Answer / आपका उत्तर: <span className={ans.isCorrect ? "text-emerald-400 font-black" : "text-red-400 font-black"}>{ans.userAnswer}</span></p>
                          {!ans.isCorrect && <p className="text-xs text-emerald-400 font-medium mt-1">Correct Answer / सही उत्तर: {ans.correctAnswer}</p>}
                      </div>
                  ))}
              </div>
          )}
        </div>
      )}

    </div>
  );
}

export default Arena;