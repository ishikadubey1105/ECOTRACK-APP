import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Leaf, Car, Zap, Utensils, ShoppingBag, 
  Sparkles, Flame, TreePine, Smartphone, 
  Trash2, Plus, AlertCircle, RefreshCw, Globe, HelpCircle, 
  Target, TrendingDown, ArrowRight, CheckCircle2, XCircle, Search, Info, MapPin,
  Award, Trophy, HelpCircle as QuestionIcon, ShieldCheck, Sun, Moon,
  Lightbulb, Sparkle, AlertTriangle, ZapOff, Check, AlertOctagon, FlameKindling,
  BookOpen, Bell, Clock, Share2, Copy, X, Heart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
  LineChart, Line, ReferenceLine
} from 'recharts';
import { playGamificationSound } from './utils/audio';
import {
  ActivityLog,
  AiTip,
  ActiveChallenge,
  Badge,
  CountryBenchmark,
  QuizQuestion,
  NotificationItem
} from './types';
import {
  INITIAL_LOGS_SEED,
  DEFAULT_AI_TIPS,
  COUNTRIES_BENCHMARKS,
  DEFAULT_NOTIFICATIONS,
  getRelativeTimeString,
  calculateEquivalenceImpact,
  INDIAN_STATES_CENTROIDS
} from './utils/carbonHelpers';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import Auth from './components/Auth';
import HealthSync from './components/HealthSync';

// Sparkly local particle confetti structure
interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  scale: number;
}

export default function App() {
  // Active Tab navigation state
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('ecotrack_active_tab') || 'dashboard';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('ecotrack_active_tab', tab);
  };

  // Dark mode setup
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('ecotrack_dark_mode') === 'true';
  });

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('ecotrack_notifications');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_NOTIFICATIONS;
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Basic Game States
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('ecotrack_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return INITIAL_LOGS_SEED; }
    }
    return INITIAL_LOGS_SEED;
  });

  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    return Number(localStorage.getItem('ecotrack_goal') || '25');
  });

  const [xp, setXp] = useState<number>(() => {
    return Number(localStorage.getItem('ecotrack_xp') || '45'); // start close to level up to make gameplay interactive
  });

  const [selectedCountry, setSelectedCountry] = useState<string>('India');

  const [selectedIndiaRegion, setSelectedIndiaRegion] = useState<string>(() => {
    return localStorage.getItem('ecotrack_india_region') || 'Delhi NCR / Northern Grid';
  });

  const [hoveredIndiaRegion, setHoveredIndiaRegion] = useState<string | null>(null);

  // India Regional Map Zoom and Pan coordinates system states
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);

  const [countryBenchmark, setCountryBenchmark] = useState<CountryBenchmark>(() => {
    return COUNTRIES_BENCHMARKS['India'];
  });

  const [aiTips, setAiTips] = useState<AiTip[]>(() => {
    const saved = localStorage.getItem('ecotrack_tips');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_AI_TIPS;
  });

  // Active Challenges Accepted by User
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>(() => {
    const saved = localStorage.getItem('ecotrack_active_challenges');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return [
      {
        id: 'challenge-meatless',
        title: 'Meat-Free Days Pledge',
        tip: 'Opt for vegetarian or meal options instead of red meet to keep land usage light.',
        targetCount: 3,
        currentCount: 1,
        savingsPerAction: 5.4,
        xpReward: 35,
        category: 'food'
      }
    ];
  });

  // Interactive Badges tracking
  const [badges, setBadges] = useState<Badge[]>([
    { id: 'badge-1', title: 'Carbon Pioneer', description: 'Log your primary footprint activity.', icon: '🌱', unlocked: true, requirement: 'Log any activity' },
    { id: 'badge-2', title: 'Savvy Decision Maker', description: 'Choose a low-impact alternative card over solo driving/beef.', icon: '⚡', unlocked: false, requirement: 'Use alternative choice cards' },
    { id: 'badge-3', title: 'Challenge Warrior', description: 'Accept and complete your first Eco Pledge challenge.', icon: '🏆', unlocked: false, requirement: 'Complete a challenge' },
    { id: 'badge-4', title: 'Conservationist', description: 'Complete a 3-day consecutive carbon logging streak.', icon: '🔥', unlocked: false, requirement: '3-day streak minimum' },
    { id: 'badge-5', title: 'Climate Strategist', description: 'Scale to level 3 (Green Strategist) by gathering active XP.', icon: '👑', unlocked: false, requirement: 'Hit Level 3' },
    { id: 'badge-6', title: 'Net-Zero Guardian', description: 'Maintain this weeks carbon output under 50% of the active budget.', icon: '🌎', unlocked: false, requirement: 'Keep budget under 50%' }
  ]);

  // Choice comparison card UI status
  const [selectedTransportChoice, setSelectedTransportChoice] = useState<string | null>(null);
  const [selectedFoodChoice, setSelectedFoodChoice] = useState<string | null>(null);

  // Sparkly animation feedback
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [lastAvoidedFlash, setLastAvoidedFlash] = useState<number | null>(null);
  const [lastCarbonLoggedAmount, setLastCarbonLoggedAmount] = useState<number | null>(null);
  const [lastLogCategory, setLastLogCategory] = useState<string>('');
  
  // Real-world equivalence hover trigger modal/tooltip state
  const [hoveredEmission, setHoveredEmission] = useState<{ value: number; x: number; y: number; text: string } | null>(null);

  // What-If Simulator Sliders (interactive live calculation)
  const [simulatorCarTrips, setSimulatorCarTrips] = useState<number>(3); // trips replaced
  const [simulatorRedMeat, setSimulatorRedMeat] = useState<number>(2); // beef meals avoided
  const [simulatorEcoEnergy, setSimulatorEcoEnergy] = useState<number>(8); // hours of vampire devices unplugged

  // Share Weekly Progress state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [previewPlatform, setPreviewPlatform] = useState<'x' | 'linkedin'>('x');

  // Regular input states
  const [freeInput, setFreeInput] = useState('');
  const [carbonStory, setCarbonStory] = useState<{
    storyText: string;
    bestDay: string;
    worstDay: string;
    highlightStat: string;
    totalSavedKg: number;
    forwardNudge: string;
  } | null>(() => {
    const saved = localStorage.getItem('ecotrack_carbon_story');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  const [isFetchingBenchmark, setIsFetchingBenchmark] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'transport' | 'food' | 'energy' | 'shopping'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isSyncLoading, setIsSyncLoading] = useState<boolean>(false);
  const [isCloudDropdownOpen, setIsCloudDropdownOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'levelUp' | 'badge' } | null>(null);

  // Daily Eco-Quiz State variables
  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(() => {
    const saved = localStorage.getItem('ecotrack_quiz_question');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });
  const [quizSelectedIndex, setQuizSelectedIndex] = useState<number | null>(() => {
    const saved = localStorage.getItem('ecotrack_quiz_selected_index');
    return saved !== null ? Number(saved) : null;
  });
  const [quizIsSubmitted, setQuizIsSubmitted] = useState<boolean>(() => {
    return localStorage.getItem('ecotrack_quiz_submitted') === 'true';
  });
  const [quizIsLoading, setQuizIsLoading] = useState<boolean>(false);
  const [quizLastAnsweredDate, setQuizLastAnsweredDate] = useState<string | null>(() => {
    return localStorage.getItem('ecotrack_quiz_last_answered_date');
  });

  // Daily Eco-Quiz synchronized storage effects
  useEffect(() => {
    if (quizQuestion) {
      localStorage.setItem('ecotrack_quiz_question', JSON.stringify(quizQuestion));
    } else {
      localStorage.removeItem('ecotrack_quiz_question');
    }
  }, [quizQuestion]);

  useEffect(() => {
    if (quizSelectedIndex !== null) {
      localStorage.setItem('ecotrack_quiz_selected_index', String(quizSelectedIndex));
    } else {
      localStorage.removeItem('ecotrack_quiz_selected_index');
    }
  }, [quizSelectedIndex]);

  useEffect(() => {
    localStorage.setItem('ecotrack_quiz_submitted', String(quizIsSubmitted));
  }, [quizIsSubmitted]);

  useEffect(() => {
    if (quizLastAnsweredDate) {
      localStorage.setItem('ecotrack_quiz_last_answered_date', quizLastAnsweredDate);
    } else {
      localStorage.removeItem('ecotrack_quiz_last_answered_date');
    }
  }, [quizLastAnsweredDate]);

  // Loading first quiz if empty
  useEffect(() => {
    if (!quizQuestion) {
      fetchNewQuizQuestion();
    }
  }, []);

  const fetchNewQuizQuestion = async (forceReset = false) => {
    setQuizIsLoading(true);
    try {
      const response = await fetch('/api/quiz-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) throw new Error("Failed to fetch question");
      const questionData = await response.json();
      setQuizQuestion(questionData);
      if (forceReset) {
        setQuizSelectedIndex(null);
        setQuizIsSubmitted(false);
      }
    } catch (err) {
      console.error("Error loading quiz question:", err);
      // Fallback local quiz
      const fallbackQuiz: QuizQuestion = {
        question: "Which of these food categories generally releases the highest carbon footprint per kilogram of food produced?",
        options: [
          "Sustainably farmed salmon",
          "Pork and standard poultry",
          "Local greenhouse tomatoes",
          "Industrial pasture beef"
        ],
        correctIndex: 3,
        explanations: [
          "Sustainably farmed salmon produces around 5.4 kg CO2e per kg. While significant, it is far lower than beef.",
          "Pork and poultry produce about 6-7 kg CO2e per kg, mainly due to animal feed cultivation and transport fuels.",
          "Local greenhouse tomatoes can range from 1 to 2 kg CO2e, mostly driven by heating, but have minimal impact compared to livestock.",
          "Correct! Pastured beef generates a massive 60 kg CO2e per kilogram of meat, driven primarily by bovine enteric methane release and pasture deforesting."
        ],
        topic: "Livestock Emissions"
      };
      setQuizQuestion(fallbackQuiz);
      if (forceReset) {
        setQuizSelectedIndex(null);
        setQuizIsSubmitted(false);
      }
    } finally {
      setQuizIsLoading(false);
    }
  };

  // Submit hander for the Daily Eco-Quiz
  const handleQuizSubmit = () => {
    if (quizQuestion === null || quizSelectedIndex === null || quizIsSubmitted) return;
    
    setQuizIsSubmitted(true);
    const isCorrect = quizSelectedIndex === quizQuestion.correctIndex;
    const todayStr = new Date().toISOString().split('T')[0];
    const alreadyDoneToday = quizLastAnsweredDate === todayStr;

    if (isCorrect) {
      playGamificationSound('challenge');
      triggerConfettiExplosion();
      
      let gotXp = false;
      if (!alreadyDoneToday) {
        addXp(10);
        setQuizLastAnsweredDate(todayStr);
        gotXp = true;
        showNotification("🍀 Correct! +10 XP awarded to your eco score!", "success");
        addNotificationItem(
          "🧠 Eco-Quiz Solved!",
          `You answered "${quizQuestion.options[quizSelectedIndex]}" and earned +10 XP for today! Learn more in the detailed quiz tab.`,
          "general"
        );
      } else {
        showNotification("🍀 Correct! (Bonus training topic: no duplicate daily XP)", "success");
      }
    } else {
      // Play a small sound or notify
      showNotification("❌ Incorrect answer. Explore explanations below to learn!", "error");
    }
  };

  // Level computation logic

  // Level 1: "Eco Rookie" (0 - 49 XP)
  // Level 2: "Sage Trailblazer" (50 - 149 XP)
  // Level 3: "Carbon Tactician" (150 - 299 XP)
  // Level 4: "Green Strategist" (300 - 499 XP)
  // Level 5: "Earth Champion" (500+ XP)
  const levelInfo = useMemo(() => {
    let level = 1;
    let name = "Eco Rookie";
    let nextXp = 50;
    let prevXp = 0;

    if (xp >= 500) {
      level = 5;
      name = "Global Earth Champion";
      nextXp = 1000;
      prevXp = 500;
    } else if (xp >= 300) {
      level = 4;
      name = "Green Strategist";
      nextXp = 500;
      prevXp = 300;
    } else if (xp >= 150) {
      level = 3;
      name = "Carbon Tactician";
      nextXp = 300;
      prevXp = 150;
    } else if (xp >= 50) {
      level = 2;
      name = "Sage Trailblazer";
      nextXp = 150;
      prevXp = 50;
    }

    const percentage = Math.min(100, Math.max(0, ((xp - prevXp) / (nextXp - prevXp)) * 100));

    return { level, name, nextXp, prevXp, percentage };
  }, [xp]);

  // Synchronise state with local storage
  useEffect(() => {
    localStorage.setItem('ecotrack_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('ecotrack_goal', String(weeklyGoal));
  }, [weeklyGoal]);

  useEffect(() => {
    localStorage.setItem('ecotrack_xp', String(xp));
  }, [xp]);

  useEffect(() => {
    localStorage.setItem('ecotrack_country', selectedCountry);
  }, [selectedCountry]);

  useEffect(() => {
    localStorage.setItem('ecotrack_india_region', selectedIndiaRegion);
  }, [selectedIndiaRegion]);

  useEffect(() => {
    localStorage.setItem('ecotrack_country_benchmark', JSON.stringify(countryBenchmark));
  }, [countryBenchmark]);

  useEffect(() => {
    localStorage.setItem('ecotrack_tips', JSON.stringify(aiTips));
  }, [aiTips]);

  useEffect(() => {
    localStorage.setItem('ecotrack_active_challenges', JSON.stringify(activeChallenges));
  }, [activeChallenges]);

  useEffect(() => {
    localStorage.setItem('ecotrack_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('ecotrack_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (carbonStory) {
      localStorage.setItem('ecotrack_carbon_story', JSON.stringify(carbonStory));
    } else {
      localStorage.removeItem('ecotrack_carbon_story');
    }
  }, [carbonStory]);

  // Firebase auth state observer & cross-device logs merger
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsSyncLoading(true);
        try {
          // 1. Synchronize or create gamification profile stats
          const profileRef = doc(db, 'users', user.uid);
          const profileSnap = await getDoc(profileRef);
          
          let cloudXp = xp;
          let cloudGoal = weeklyGoal;
          
          if (profileSnap.exists()) {
            const pData = profileSnap.data();
            cloudXp = typeof pData.xp === 'number' ? pData.xp : xp;
            cloudGoal = typeof pData.carbonGoal === 'number' ? pData.carbonGoal : weeklyGoal;
            setXp(cloudXp);
            setWeeklyGoal(cloudGoal);
            if (pData.selectedCountry) {
              setSelectedCountry(pData.selectedCountry);
            }
          } else {
            await setDoc(profileRef, {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Eco Hero',
              createdAt: new Date().toISOString(),
              xp,
              level: levelInfo.level,
              carbonGoal: weeklyGoal,
              selectedCountry,
              badges: ['first_step']
            });
          }

          // 2. Fetch remote activity logs
          const q = query(
            collection(db, 'carbonLogs'),
            where('uid', '==', user.uid)
          );
          const logsSnap = await getDocs(q);
          const cloudLogsMap = new Map<string, ActivityLog>();
          logsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            cloudLogsMap.set(docSnap.id, {
              id: docSnap.id,
              timestamp: data.timestamp || Date.now(),
              description: data.description || '',
              category: data.category || 'transport',
              co2eKg: data.co2eKg || 0,
              source: data.source || 'manual',
              range: data.range,
              reasoning: data.reasoning,
              avoidedKg: data.avoidedKg
            });
          });

          // Upload local-only logs created during guest sessions
          const mergedLogs = [...logs];
          for (const localLog of logs) {
            if (!cloudLogsMap.has(localLog.id)) {
              await setDoc(doc(db, 'carbonLogs', localLog.id), {
                ...localLog,
                uid: user.uid
              });
            }
          }

          // Fetch newly unified remote entries
          for (const [cloudId, cloudLog] of cloudLogsMap.entries()) {
            if (!logs.some(l => l.id === cloudId)) {
              mergedLogs.push(cloudLog);
            }
          }

          mergedLogs.sort((a, b) => b.timestamp - a.timestamp);
          setLogs(mergedLogs);
          localStorage.setItem('ecotrack_logs', JSON.stringify(mergedLogs));

          showNotification("☁️ Cloud synchronized status: Secured & Synced!", "success");
        } catch (err) {
          console.error("Replication engine error:", err);
          showNotification("Cloud Sync active: loaded safe client-side copy cache.", "success");
        } finally {
          setIsSyncLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync user profile properties when they change in real-time
  useEffect(() => {
    if (currentUser && !isSyncLoading) {
      const ref = doc(db, 'users', currentUser.uid);
      setDoc(ref, {
        xp,
        level: levelInfo.level,
        carbonGoal: weeklyGoal,
        selectedCountry,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error("Profile sync exception:", err);
      });
    }
  }, [xp, weeklyGoal, selectedCountry, isSyncLoading, levelInfo.level, currentUser]);

  const syncAddLogToCloud = async (logItem: ActivityLog) => {
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'carbonLogs', logItem.id), {
          ...logItem,
          uid: auth.currentUser.uid
        });
      } catch (e) {
        console.error("Cloud insert error:", e);
      }
    }
  };

  const syncDeleteLogFromCloud = async (id: string) => {
    if (auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'carbonLogs', id));
      } catch (e) {
        console.error("Cloud delete error:", e);
      }
    }
  };

  // Persistent system notifications generator
  const addNotificationItem = (title: string, content: string, type: 'tip' | 'challenge' | 'general') => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      content,
      type,
      timestamp: Date.now(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Toast / gameplay notifications helper
  const showNotification = (text: string, type: 'success' | 'error' | 'levelUp' | 'badge' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Sparkly level up / challenge completion animation
  const triggerConfettiExplosion = () => {
    const particles = Array.from({ length: 45 }).map((_, i) => ({
      id: Date.now() + i,
      x: 30 + Math.random() * 40, // percentage x values
      y: 80, 
      color: ['#10b981', '#34d399', '#f59e0b', '#3b82f6', '#ec4899', '#a7f3d0'][Math.floor(Math.random() * 6)],
      scale: 0.5 + Math.random() * 1
    }));
    setConfetti(particles);
    setTimeout(() => setConfetti([]), 3500);
  };

  // Calculate Badge progression dynamically based on state
  useEffect(() => {
    setBadges(prev => {
      let changed = false;
      const updated = prev.map(badge => {
        let isUnlocked = badge.unlocked;
        if (badge.id === 'badge-1' && logs.length > 0) isUnlocked = true;
        if (badge.id === 'badge-2' && logs.some(l => l.source === 'choice')) isUnlocked = true;
        if (badge.id === 'badge-3' && xp >= 110) isUnlocked = true; // challenge completed threshold
        if (badge.id === 'badge-4' && computedMetrics.streakCount >= 3) isUnlocked = true;
        if (badge.id === 'badge-5' && levelInfo.level >= 3) isUnlocked = true;
        if (badge.id === 'badge-6' && computedMetrics.thisWeekTotal < (weeklyGoal * 0.5) && logs.length > 2) isUnlocked = true;

        if (isUnlocked !== badge.unlocked) {
          changed = true;
          if (isUnlocked) {
            // Trigger beautiful notification
            setTimeout(() => {
              showNotification(`🏆 Badged Unlocked: "${badge.title}"! (+15 XP)`, 'badge');
              setXp(x => x + 15);
              triggerConfettiExplosion();
            }, 300);
          }
        }
        return { ...badge, unlocked: isUnlocked };
      });
      return changed ? updated : prev;
    });
  }, [logs, xp, weeklyGoal]);

  // Handle XP progression with level notification alerts
  const addXp = (amount: number) => {
    const oldLevel = levelInfo.level;
    setXp(prev => {
      const nextVal = prev + amount;
      // level boundaries checked inline
      return nextVal;
    });
    // Trigger notification
    const newLevelCheck = (xp + amount);
    let potentialLevel = 1;
    if (newLevelCheck >= 500) potentialLevel = 5;
    else if (newLevelCheck >= 300) potentialLevel = 4;
    else if (newLevelCheck >= 150) potentialLevel = 3;
    else if (newLevelCheck >= 50) potentialLevel = 2;

    if (potentialLevel > oldLevel) {
      setTimeout(() => {
        showNotification(`🎉 LEVEL UP! You became a Level ${potentialLevel} "${
          potentialLevel === 2 ? 'Sage Trailblazer' : potentialLevel === 3 ? 'Carbon Tactician' : potentialLevel === 4 ? 'Green Strategist' : 'Global Earth Champion'
        }"!`, 'levelUp');
        triggerConfettiExplosion();
        playGamificationSound('levelUp');
      }, 200);
    }
  };

  // Choice comparison interactive click logging
  const handleRecordChoice = (
    category: 'transport' | 'food',
    actionLabel: string,
    carbonKg: number,
    avoidedKg: number,
    reasonText: string
  ) => {
    // Flash carbon logged visualization
    setLastCarbonLoggedAmount(carbonKg);
    setLastLogCategory(category);
    if (avoidedKg > 0) {
      setLastAvoidedFlash(avoidedKg);
      setTimeout(() => setLastAvoidedFlash(null), 3000);
    }
    setTimeout(() => setLastCarbonLoggedAmount(null), 3000);

    const logItem: ActivityLog = {
      id: `choice-${Date.now()}`,
      timestamp: Date.now(),
      description: actionLabel,
      category,
      co2eKg: carbonKg,
      source: 'choice',
      range: 'Direct option emission factor',
      reasoning: reasonText,
      avoidedKg: avoidedKg > 0 ? avoidedKg : undefined
    };

    setLogs(prev => [logItem, ...prev]);
    syncAddLogToCloud(logItem);
    showNotification(`Activity chosen! Carbon recorded: ${carbonKg} kg CO2e.`);
    
    // Add XP rewards
    addXp(15); // +15 XP for conscious choice picking!

    // Check if any active challenges benefit from this choice
    setActiveChallenges(prev => {
      let challengeTriggered = false;
      const updated = prev.map(ch => {
        if (ch.category === category && ch.currentCount < ch.targetCount) {
          const nextCount = ch.currentCount + 1;
          const isComplete = nextCount >= ch.targetCount;
          challengeTriggered = true;
          
          if (isComplete) {
            addNotificationItem('🌟 Challenge Completed!', `Spectacular job! You completed "${ch.title}" and earned ${ch.xpReward} XP. Your ecological momentum is soaring!`, 'challenge');
            setTimeout(() => {
              showNotification(`🌟 Commitment Met! Completed "${ch.title}"! (+${ch.xpReward} XP)`, 'success');
              addXp(ch.xpReward);
              triggerConfettiExplosion();
              playGamificationSound('challenge');
            }, 400);
            return { ...ch, currentCount: nextCount, completed: true };
          } else {
            addNotificationItem('📈 Challenge Progress', `Your challenge "${ch.title}" progressed to ${nextCount}/${ch.targetCount}. Almost there!`, 'challenge');
            setTimeout(() => {
              showNotification(`📈 Progress updated for "${ch.title}": ${nextCount}/${ch.targetCount}`);
              addXp(5);
            }, 100);
          }
          return { ...ch, currentCount: nextCount };
        }
        return ch;
      });
      return challengeTriggered ? updated : prev;
    });

    if (category === 'transport') {
      setSelectedTransportChoice(actionLabel);
      setTimeout(() => setSelectedTransportChoice(null), 2000);
    } else {
      setSelectedFoodChoice(actionLabel);
      setTimeout(() => setSelectedFoodChoice(null), 2000);
    }
  };

  // Add standard free text or general activity logs
  const handleAddNewLog = (newLog: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const fullLog: ActivityLog = {
      ...newLog,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now()
    };
    
    setLastCarbonLoggedAmount(fullLog.co2eKg);
    setLastLogCategory(fullLog.category);
    setTimeout(() => setLastCarbonLoggedAmount(null), 3000);

    setLogs(prev => [fullLog, ...prev]);
    syncAddLogToCloud(fullLog);
    addXp(10); // Standard +10 XP for logging footprint items
    showNotification(`Added! +${Number(fullLog.co2eKg.toFixed(2))} kg CO2e recorded.`);
  };

  // Delete log item
  const handleDeleteLogItem = (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    syncDeleteLogFromCloud(id);
    showNotification("Emission log deleted", "error");
  };

  // Gemini parser connection
  const handleAiParseText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeInput.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/parse-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: freeInput,
          country: selectedCountry,
          region: selectedCountry === 'India' ? selectedIndiaRegion : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Fallback called');
      }

      const result = await response.json();
      
      const newLogItem: ActivityLog = {
        id: `gemini-${Date.now()}`,
        timestamp: Date.now(),
        description: result.description || freeInput,
        category: (result.category || 'transport').toLowerCase() as any,
        co2eKg: Number(result.co2eKg ?? 2.5),
        source: 'manual',
        range: result.range || 'approximate rating',
        reasoning: result.reasoning || 'Gemini dynamic formula evaluation.'
      };

      setLogs(prev => [newLogItem, ...prev]);
      syncAddLogToCloud(newLogItem);
      addXp(12); // Bonus XP for AI-integrated logging
      
      setLastCarbonLoggedAmount(newLogItem.co2eKg);
      setLastLogCategory(newLogItem.category);
      setTimeout(() => setLastCarbonLoggedAmount(null), 3000);

      setFreeInput('');
      showNotification("Gemini calculated & categorized emissions successfully!");

    } catch (err) {
      console.error(err);
      // Beautiful smart local fallback if server cannot reach
      const containsBurger = freeInput.toLowerCase().includes('burger') || freeInput.toLowerCase().includes('beef') || freeInput.toLowerCase().includes('meat');
      const containsCar = freeInput.toLowerCase().includes('car') || freeInput.toLowerCase().includes('drive') || freeInput.toLowerCase().includes('mile');
      
      const category = containsBurger ? 'food' : containsCar ? 'transport' : 'energy';
      const fallbackKg = containsBurger ? 5.8 : containsCar ? 3.6 : 1.2;

      const fallbackLog: ActivityLog = {
        id: `fallback-${Date.now()}`,
        timestamp: Date.now(),
        description: freeInput,
        category,
        co2eKg: fallbackKg,
        source: 'manual',
        range: 'Estimated local average model',
        reasoning: 'Calculated locally based on general carbon statistics.'
      };

      setLogs(prev => [fallbackLog, ...prev]);
      syncAddLogToCloud(fallbackLog);
      addXp(5);
      setFreeInput('');
      showNotification("Calculated using standard local factors.", "success");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Turn tips into commit challenge goals
  const handleAcceptChallenge = (tip: AiTip) => {
    // Check if limit of active challenges is reached or already active
    if (activeChallenges.some(ch => ch.title === tip.title)) {
      showNotification("You correspondently accepted this commitments challenge already!", "error");
      return;
    }

    const newChallenge: ActiveChallenge = {
      id: `pledge-${Date.now()}`,
      title: tip.title,
      tip: tip.tip,
      targetCount: tip.title.toLowerCase().includes('meat') ? 3 : 2,
      currentCount: 0,
      savingsPerAction: tip.estimatedSavings,
      xpReward: Math.round(tip.estimatedSavings * 5) + 15,
      category: tip.title.toLowerCase().includes('drive') || tip.title.toLowerCase().includes('commute') ? 'transport' : 'food'
    };

    setActiveChallenges(prev => [newChallenge, ...prev]);
    addNotificationItem('🌱 Challenge Accepted', `You committed to "${newChallenge.title}". Log ${newChallenge.category.toUpperCase()} activities to complete the challenge and earn +${newChallenge.xpReward} XP!`, 'challenge');
    showNotification(`Challenge Accepted: "${tip.title}"! Tracking counts live.`, 'success');
    addXp(10); // +10 XP for starting a green challenge
  };

  // Bulk raw calculations for the Carbon budget engine and status dials
  const computedMetrics = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    const todayStart = new Date().setHours(0, 0, 0, 0);

    const todayLogs = logs.filter(l => l.timestamp >= todayStart);
    const thisWeekLogs = logs.filter(l => l.timestamp >= now - sevenDaysMs);

    const todayTotal = todayLogs.reduce((sum, current) => sum + current.co2eKg, 0);
    const thisWeekTotal = thisWeekLogs.reduce((sum, current) => sum + current.co2eKg, 0);

    const avoidedTotal = logs
      .filter(l => l.timestamp >= now - sevenDaysMs)
      .reduce((sum, item) => sum + (item.avoidedKg || 0), 0);

    // Weekly unique days calculated cleanly
    const weeklyMappedDates = thisWeekLogs.map(log => new Date(log.timestamp).toISOString().split('T')[0]);
    const weeklyUniqueDaysCount = new Set(weeklyMappedDates).size;

    // Calculate streak
    const mappedDates = logs.map(log => new Date(log.timestamp).toISOString().split('T')[0]);
    const uniqueLoggedDays: string[] = Array.from(new Set<string>(mappedDates)).sort((a: string, b: string) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(now - oneDayMs).toISOString().split('T')[0];

    let streak = 0;
    if (uniqueLoggedDays.length > 0) {
      if (uniqueLoggedDays[0] === todayStr || uniqueLoggedDays[0] === yesterdayStr) {
        streak = 1;
        for (let i = 0; i < uniqueLoggedDays.length - 1; i++) {
          const current = new Date(uniqueLoggedDays[i] as string);
          const next = new Date(uniqueLoggedDays[i + 1] as string);
          const diffDays = Math.ceil(Math.abs(current.getTime() - next.getTime()) / oneDayMs);
          if (diffDays === 1) {
            streak++;
          } else if (diffDays > 1) {
            break;
          }
        }
      }
    }

    // Budget game parameters:
    // Daily pace: budget allocated for the week is split into daily parts
    const dailyTarget = (weeklyGoal / 7);
    const hoursElapsedToday = new Date().getHours() || 1;
    const todayPaceAllocated = (hoursElapsedToday / 24) * dailyTarget;
    
    // Live Pace calculation: are we ahead/behind?
    // Let's assume on average for the current days transited:
    const dayOfWeekIndexByNow = Math.max(1, new Date().getDay() || 7); // 1-7
    const currentWeekAllowedSpent = (weeklyGoal / 7) * dayOfWeekIndexByNow;

    let paceStatus: 'ahead' | 'perfect' | 'behind' = 'perfect';
    let paceDetailText = 'Aligned with Budget Pace 👍';
    let paceColor = 'text-[#16ca49] dark:text-[#34d399]';
    let paceBg = 'bg-[#defbe3] dark:bg-emerald-950/40 border-[#bbf7d0]';

    if (thisWeekTotal < currentWeekAllowedSpent * 0.85) {
      paceStatus = 'ahead';
      paceDetailText = 'Ahead of Budget Goal (Under footprint!) 🌟';
      paceColor = 'text-green-600 dark:text-[#34d399]';
      paceBg = 'bg-green-50 dark:bg-emerald-950/30 border-green-200';
    } else if (thisWeekTotal > currentWeekAllowedSpent * 1.1) {
      paceStatus = 'behind';
      paceDetailText = 'Exceeding footprint safe budget pace ⚠️';
      paceColor = 'text-amber-600 dark:text-amber-400';
      paceBg = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200';
    }

    return {
      todayTotal: Number(todayTotal.toFixed(1)),
      thisWeekTotal: Number(thisWeekTotal.toFixed(1)),
      avoidedTotal: Number(avoidedTotal.toFixed(1)),
      streakCount: streak,
      dailyTarget: Math.round(dailyTarget),
      paceStatus,
      paceDetailText,
      paceColor,
      paceBg,
      currentWeekAllowedSpent,
      weeklyUniqueDaysCount
    };
  }, [logs, weeklyGoal]);

  // Real world equivalent factors
  const equivalences = useMemo(() => {
    const totalWeeklyCo2e = computedMetrics.thisWeekTotal;
    
    // Emissions calculations:
    const carKm = Math.round(totalWeeklyCo2e / 0.24); // avg petroleum car per km
    const phoneCharges = Math.round(totalWeeklyCo2e / 0.005); // full phone charges
    const treeAbsorptionDays = Math.round(totalWeeklyCo2e / 0.06); // Pine tree absorbs ~60g CO2 daily

    return { carKm, phoneCharges, treeAbsorptionDays };
  }, [computedMetrics.thisWeekTotal]);

  // Interactive Real-world tooltip solver on hover or tap
  const getDynamicEquivalenceTooltip = (value: number) => {
    const car = Math.round(value / 0.24);
    const phone = Math.round(value / 0.005);
    const tree = Math.round(value / 0.06);
    return `Equivalent to driving a gasoline car ${car} km, charging a smartphone ${phone} times, or ${tree} days of carbon absorption by a mature green tree.`;
  };

  // Recharts Day transformation
  const barchartData = useMemo(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const list = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = `${dayLabels[d.getDay()]} ${d.getDate()}`;
      
      const dayLogs = logs.filter(log => new Date(log.timestamp).toISOString().split('T')[0] === dateStr);
      
      const totalsObj = {
        name: label,
        Transport: 0,
        Food: 0,
        Energy: 0,
        Shopping: 0,
      };
      
      dayLogs.forEach(l => {
        const cat = l.category.toLowerCase();
        if (cat === 'transport') totalsObj.Transport += Number(l.co2eKg.toFixed(1));
        if (cat === 'food') totalsObj.Food += Number(l.co2eKg.toFixed(1));
        if (cat === 'energy') totalsObj.Energy += Number(l.co2eKg.toFixed(1));
        if (cat === 'shopping') totalsObj.Shopping += Number(l.co2eKg.toFixed(1));
      });

      totalsObj.Transport = Number(totalsObj.Transport.toFixed(1));
      totalsObj.Food = Number(totalsObj.Food.toFixed(1));
      totalsObj.Energy = Number(totalsObj.Energy.toFixed(1));
      totalsObj.Shopping = Number(totalsObj.Shopping.toFixed(1));

      list.push(totalsObj);
    }
    return list;
  }, [logs]);

  // Carbon Trend Analysis dataset calculation
  const trendChartData = useMemo(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const list = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Previous Week's average daily footprint (days 8 to 14 ago)
    const previousWeekLogs = logs.filter(
      l => l.timestamp >= now - 14 * oneDayMs && l.timestamp < now - 7 * oneDayMs
    );
    const previousWeekTotal = previousWeekLogs.reduce((sum, l) => sum + l.co2eKg, 0);
    const prevWeekDailyAverage = Number((previousWeekTotal / 7).toFixed(2));

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = `${dayLabels[d.getDay()]} ${d.getDate()}`;
      
      const dayLogs = logs.filter(log => new Date(log.timestamp).toISOString().split('T')[0] === dateStr);
      const currentDayTotal = Number(dayLogs.reduce((sum, log) => sum + log.co2eKg, 0).toFixed(2));
      
      list.push({
        name: label,
        'Current Week': currentDayTotal,
        'Prev Week Avg': prevWeekDailyAverage,
      });
    }
    
    const currentWeekLogs = logs.filter(l => l.timestamp >= now - 7 * oneDayMs);
    const currentWeekTotal = Number(currentWeekLogs.reduce((sum, l) => sum + l.co2eKg, 0).toFixed(2));
    const currentWeekDailyAverage = Number((currentWeekTotal / 7).toFixed(2));
    
    return {
      list,
      prevWeekDailyAverage,
      currentWeekTotal,
      currentWeekDailyAverage,
    };
  }, [logs]);

  // Interactive What-if slider estimation calculations
  // Car trip replacement saves approx 2.4kg per trip
  // Diet beef meal swap saves approx 5.4kg per meal
  // Energy thermostat swap saves approx 0.85kg per hour saved
  const whatIfSavings = useMemo(() => {
    const weeklySavings = (simulatorCarTrips * 2.4) + (simulatorRedMeat * 5.4) + (simulatorEcoEnergy * 0.85);
    const monthlySavings = weeklySavings * 4.3;
    const yearlySavings = weeklySavings * 52;

    const equivalentTreesPlantedYear = Math.round(yearlySavings / 22); // average mature tree absorbs ~22kg yearly
    const equivalentPetrolCarKmsSaved = Math.round(yearlySavings / 0.24);

    return {
      weekly: Number(weeklySavings.toFixed(1)),
      monthly: Number(monthlySavings.toFixed(1)),
      yearly: Number(yearlySavings.toFixed(1)),
      equivalentTreesPlantedYear,
      equivalentPetrolCarKmsSaved
    };
  }, [simulatorCarTrips, simulatorRedMeat, simulatorEcoEnergy]);

  // Handle active country benchmark change
  const handleCountryChoiceChange = async (countryName: string) => {
    setSelectedCountry(countryName);
    setIsFetchingBenchmark(true);
    let resolvedAverage = 12.0;
    try {
      const response = await fetch('/api/country-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName })
      });
      if (response.ok) {
        const result = await response.json();
        resolvedAverage = Number(result.dailyAverageKg ?? 12.0);
        setCountryBenchmark({
          country: result.country || countryName,
          dailyAverageKg: resolvedAverage,
          contextText: result.contextText || 'National consumer footprint matrix metrics.'
        });
        showNotification(`Benchmark set: ${countryName}`);
      } else {
        throw new Error();
      }
    } catch (e) {
      // Fallback
      if (COUNTRIES_BENCHMARKS[countryName]) {
        resolvedAverage = COUNTRIES_BENCHMARKS[countryName].dailyAverageKg;
        setCountryBenchmark(COUNTRIES_BENCHMARKS[countryName]);
      } else {
        resolvedAverage = 10.5;
        setCountryBenchmark({
          country: countryName,
          dailyAverageKg: 10.5,
          contextText: `${countryName} uses local public travel patterns. Benchmark average is estimative.`
        });
      }
    } finally {
      setIsFetchingBenchmark(false);
      // Automatically scale the weekly goal dynamically to match the country's average per-capita daily budget weekly counterpart!
      const calibratedWeeklyGoal = Math.round(resolvedAverage * 7);
      setWeeklyGoal(calibratedWeeklyGoal);
      showNotification(`Weekly objective adjusted to ${calibratedWeeklyGoal} kg CO₂e to match local ${countryName} emission profile!`, "success");
    }
  };

  // Gemini insights re-request trigger
  const handleRefreshAiInsights = async () => {
    setIsGeneratingTips(true);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          logs, 
          weeklyGoal,
          country: selectedCountry,
          region: selectedCountry === 'India' ? selectedIndiaRegion : undefined
        })
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();
      if (data && data.tips && Array.isArray(data.tips)) {
        setAiTips(data.tips);
        addNotificationItem('💡 New Gemini Eco-Tips', `Gemini generated ${data.tips.length} fresh customized carbon cutting strategies. Open the tip advice section to accept commits!`, 'tip');
        showNotification("Dynamic reduction plans updated by Gemini!");
      }
    } catch (e) {
      // Provide healthy local alternate tips
      const alternateLocalChallenges = [
        {
          title: "Vampire Power Shutdown",
          tip: "Unplug standby electronics, power stations, and TVs. Restricting active idle grids saves massive carbon over continuous log periods.",
          whyMatters: "Standby currents compile up to 8% of all residential carbon footprints over a typical season.",
          estimatedSavings: 1.8
        },
        ...DEFAULT_AI_TIPS.slice(0, 2)
      ];
      setAiTips(alternateLocalChallenges);
      addNotificationItem('💡 Local Eco-Tips Loaded', 'Loaded offline-ready alternative carbon reduction recommendations.', 'tip');
      showNotification("Could not reach server API. Displaying localized offline strategies.", "error");
    } finally {
      setIsGeneratingTips(false);
    }
  };

  // Generate carbon story narrative utilizing server Gemini route
  const generateCarbonStory = async () => {
    setIsGeneratingStory(true);
    try {
      const response = await fetch('/api/carbon-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          logs, 
          activeChallenges, 
          weeklyGoal,
          country: selectedCountry,
          region: selectedCountry === 'India' ? selectedIndiaRegion : undefined
        })
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = await response.json();
      setCarbonStory(data);
      showNotification("Your Weekly Carbon Story recap generated successfully!", "success");
      triggerConfettiExplosion();
    } catch (e) {
      console.error("Story generation error, using fallback logic", e);
      const hasBike = logs.some(l => l.description.toLowerCase().includes('bike') || l.description.toLowerCase().includes('bicycle'));
      const hasSalad = logs.some(l => l.description.toLowerCase().includes('salad') || l.description.toLowerCase().includes('vegan') || l.description.toLowerCase().includes('veg'));
      const hasFastFashion = logs.some(l => l.description.toLowerCase().includes('fashion') || l.description.toLowerCase().includes('polyester') || l.description.toLowerCase().includes('shopping'));

      let bestSnippet = "Monday started with incredible positive momentum as you logged carbon-friendly choices.";
      if (hasBike) {
        bestSnippet = "Monday started strong — you skipped high-emission car travel for a breezy bike ride and saved 1.8kg carbon right out of the gate.";
      } else if (hasSalad) {
        bestSnippet = "Your week started beautifully! You substituted a heavy red beef burger with a fresh organic salad bowl, instantly avoiding 5.45kg CO2e emissions.";
      }

      let worstSnippet = "Some mid-week fast-paced shopping purchases added slightly to your carbon footprint.";
      if (hasFastFashion) {
        worstSnippet = "But mid-week synthetic clothing acquisitions undid some of that brilliant progress, stacking up 14.5kg of carbon overheads in one catalog order.";
      }

      const fallbackText = `${bestSnippet} You maintained high active tracking, logging a variety of alternate transit, food, and home power decisions. ${worstSnippet} Remember that every alternative choice is a victory. Keep leveraging clean transit commutes and plant-based protein dishes next week!`;

      const offlineStory = {
        storyText: fallbackText,
        bestDay: hasBike ? "Monday" : "Tuesday",
        worstDay: hasFastFashion ? "Thursday" : "Friday",
        highlightStat: hasBike ? "Best day: -1.8kg on Monday" : "Best day: -5.45kg on Monday",
        totalSavedKg: computedMetrics.avoidedTotal > 0 ? computedMetrics.avoidedTotal : 6.8,
        forwardNudge: "Commit to replacing just one more petrol car commute or beef meal next week!"
      };
      setCarbonStory(offlineStory);
      showNotification("Could not contact server. Generated localized offline story recap.", "success");
      triggerConfettiExplosion();
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Log filter
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesCategory = historyFilter === 'all' || log.category === historyFilter;
      const query = historySearch.toLowerCase().trim();
      const matchesSearch = !query || 
        log.description.toLowerCase().includes(query) ||
        (log.reasoning && log.reasoning.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [logs, historyFilter, historySearch]);

  // Reset ledger page on filter/search change
  useEffect(() => {
    setLedgerPage(1);
  }, [historyFilter, historySearch, logs.length]);

  const ledgerPageSize = 6;
  const totalLedgerPages = useMemo(() => {
    return Math.ceil(filteredLogs.length / ledgerPageSize) || 1;
  }, [filteredLogs.length, ledgerPageSize]);

  const currentPage = Math.min(ledgerPage, totalLedgerPages);
  
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ledgerPageSize;
    return filteredLogs.slice(start, start + ledgerPageSize);
  }, [filteredLogs, currentPage, ledgerPageSize]);

  return (
    <div className={isDarkMode ? 'dark min-h-screen bg-zinc-950 text-zinc-100 transition-colors duration-200' : 'min-h-screen bg-[#F3F8F3] text-[#1c321d] transition-colors duration-200'}>
      
      {/* Dynamic Sparkle Local Particle Confetti Elements */}
      {confetti.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: '50vh', x: `${p.x}vw`, rotate: 0 }}
          animate={{ opacity: 0, y: '-10vh', rotate: 360 }}
          transition={{ duration: 2.2, ease: 'easeOut' }}
          className="fixed z-50 pointer-events-none rounded-full"
          style={{
            backgroundColor: p.color,
            width: `${12 * p.scale}px`,
            height: `${12 * p.scale}px`,
          }}
        />
      ))}

      {/* Floating real-world equivalent tooltip popup */}
      {hoveredEmission && (
        <div 
          className="fixed z-50 pointer-events-none bg-zinc-900 text-white rounded-xl p-3 shadow-xl max-w-xs text-xs border border-zinc-700/50"
          style={{ top: `${Math.min(window.innerHeight - 120, hoveredEmission.y + 15)}px`, left: `${Math.min(window.innerWidth - 300, hoveredEmission.x + 10)}px` }}
        >
          <div className="flex items-center gap-1.5 font-bold text-green-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Real-World Equivalency</span>
          </div>
          <p className="leading-relaxed opacity-95">{hoveredEmission.text}</p>
        </div>
      )}

      {/* Top Warning/Progress Badge Overlay Flasher */}
      <AnimatePresence>
        {lastAvoidedFlash !== null && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 100 }}
            animate={{ scale: 1.1, opacity: 1, y: 150 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed left-1/2 transform -translate-x-1/2 z-40 bg-green-600 text-white font-extrabold px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border-2 border-green-300"
          >
            <Trophy className="w-5 h-5 text-yellow-300 animate-bounce" />
            <span className="uppercase tracking-wider text-xs sm:text-sm">+{lastAvoidedFlash} kg CO₂e Avoided!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastCarbonLoggedAmount !== null && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 80 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`fixed left-1/2 transform -translate-x-1/2 z-40 font-bold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-xs border ${
              lastCarbonLoggedAmount > computedMetrics.dailyTarget 
                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200' 
                : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
            }`}
          >
            <span>
              Spent {lastCarbonLoggedAmount} kg CO₂e ({Math.round((lastCarbonLoggedAmount / computedMetrics.dailyTarget) * 100)}% of typical daily pace)
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cloud Profile Authentication Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div 
            id="auth-modal-overlay" 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAuthModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto"
          >
            <motion.div
              id="auth-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
            >
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute right-4 top-4 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-rose-500 rounded-lg transition-all cursor-pointer z-50"
                title="Close Auth Dialog"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-4 sm:p-6">
                <Auth onLoginSuccess={() => setShowAuthModal(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Progress Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div 
            id="share-progress-modal-overlay" 
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsShareModalOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          >
            <motion.div
              id="share-progress-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden relative"
            >
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 rounded-2xl shadow-2xs">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold font-serif text-emerald-950 dark:text-zinc-50">Eco-Progress Snapshot</h3>
                      <p className="text-[11px] text-zinc-500 font-medium">Broadcast your green journey to inspire others!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsShareModalOpen(false)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Styled Preview Snapshot Card */}
                <div className="p-5 bg-gradient-to-br from-emerald-950 via-[#0b2b1d] to-[#041d13] border border-emerald-500/20 text-white rounded-2xl space-y-4 relative overflow-hidden shadow-md">
                  <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                    <div className="flex items-center gap-1.5">
                      <Leaf className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono tracking-wider font-extrabold text-emerald-400 uppercase">My EcoTrack Weekly Report</span>
                    </div>
                    <span className="text-[9px] font-mono tracking-widest uppercase bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300">Level {levelInfo.level}</span>
                  </div>

                  {/* Primary Grid Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-900/20 border border-emerald-500/10 p-3 rounded-xl">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-0.5">Carbon Spent</span>
                      <span className="text-xl font-black text-white">{computedMetrics.thisWeekTotal} kg</span>
                      <span className="text-[9px] text-zinc-400 block mt-0.5">Goal Limit: {weeklyGoal} kg</span>
                    </div>

                    <div className="bg-emerald-900/20 border border-emerald-500/10 p-3 rounded-xl">
                      <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-0.5">Carbon Avoided</span>
                      <span className="text-xl font-black text-emerald-300">+{computedMetrics.avoidedTotal} kg</span>
                      <span className="text-[9px] text-zinc-400 block mt-0.5">Spent Budget: {Math.round((computedMetrics.thisWeekTotal / weeklyGoal) * 100)}%</span>
                    </div>
                  </div>

                  {/* Secondary Details */}
                  <div className="space-y-2 text-xs border-t border-emerald-500/10 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-350">Weekly Habit Streak:</span>
                      <span className="font-extrabold text-amber-350">{computedMetrics.streakCount} days active 🔥</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-350">Environmental Title:</span>
                      <span className="font-extrabold text-[#34d399] uppercase tracking-wide">{levelInfo.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-350">Eco Equivalency Status:</span>
                      <span className="font-bold text-zinc-100">{equivalences.treeAbsorptionDays} Pine-Tree Days 🌲</span>
                    </div>
                  </div>
                </div>

                {/* Social Media Sharing Preview Tab Trigger & Feed Mockup */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black uppercase text-zinc-400 dark:text-zinc-500">Social Media Post Preview</span>
                    <div className="flex items-center gap-1 bg-zinc-150 dark:bg-zinc-950 p-1 rounded-xl">
                      <button
                        onClick={() => setPreviewPlatform('x')}
                        className={`px-3 py-1 text-[11px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                          previewPlatform === 'x' 
                            ? 'bg-zinc-900 text-white dark:bg-zinc-800' 
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350 shadow-none'
                        }`}
                      >
                        X (Twitter)
                      </button>
                      <button
                        onClick={() => setPreviewPlatform('linkedin')}
                        className={`px-3 py-1 text-[11px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                          previewPlatform === 'linkedin' 
                            ? 'bg-zinc-900 text-white dark:bg-zinc-800' 
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350 shadow-none'
                        }`}
                      >
                        LinkedIn
                      </button>
                    </div>
                  </div>

                  {previewPlatform === 'x' ? (
                    /* X Twitter Feed Post Structure */
                    <div className="bg-white dark:bg-black border border-zinc-250 dark:border-zinc-850 p-4 rounded-2xl space-y-3 shadow-xs font-sans text-left text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-start gap-2.5">
                        {/* Fake user avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-[12px] shrink-0 uppercase tracking-tight">
                          ID
                        </div>
                        {/* Feed info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-[13px] leading-tight flex-wrap">
                            <span className="font-extrabold hover:underline cursor-pointer">Ishika Dubey</span>
                            <span className="text-zinc-500 text-[11px]">@ishikadubey1105 · 1m</span>
                          </div>
                          
                          <p className="text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-250 mt-1.5 whitespace-pre-wrap font-sans">
                            🍀 My @EcoTrack Weekly Performance Report 🍀{"\n"}
                            📊 Budget Limit: <span className="text-emerald-500 font-bold">{weeklyGoal} kg</span> CO₂e{"\n"}
                            📉 Carbon Spent: <span className="text-[#34d399] font-bold">{computedMetrics.thisWeekTotal} kg</span>{"\n"}
                            ✅ Saved: <span className="text-[#34d399] font-bold">+{computedMetrics.avoidedTotal} kg</span>{"\n"}
                            👑 Status: Level {levelInfo.level} ({levelInfo.name}){"\n"}
                            🌲 pine tree absorption: {equivalences.treeAbsorptionDays} days!{"\n"}{"\n"}
                            #EcoTrack #GoGreen #ClimateAction
                          </p>

                          {/* Post attachment image preview */}
                          <div className="mt-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative bg-gradient-to-r from-emerald-950 to-zinc-950 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-350">EcoTrack Performance</span>
                              </div>
                              <div className="text-[9px] font-mono uppercase bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-300">Level {levelInfo.level} Completed</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-white py-2">
                              <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                                <div className="text-[9px] text-zinc-400 uppercase font-mono font-bold">Carbon Saved</div>
                                <div className="text-sm font-black text-emerald-400">+{computedMetrics.avoidedTotal} kg</div>
                              </div>
                              <div className="bg-white/5 border border-white/5 p-2 rounded-lg">
                                <div className="text-[9px] text-zinc-400 uppercase font-mono font-bold">Weekly Streak</div>
                                <div className="text-sm font-black text-amber-350">{computedMetrics.streakCount} Days</div>
                              </div>
                            </div>
                          </div>

                          {/* Tweet action buttons */}
                          <div className="flex items-center justify-between text-zinc-500 max-w-xs mt-3.5 ml-2">
                            <div className="flex items-center gap-1 cursor-pointer hover:text-sky-500 transition-colors">
                              <span className="text-xs">💬</span>
                              <span className="text-[10px]">2</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer hover:text-emerald-500 transition-colors">
                              <span className="text-xs">🔁</span>
                              <span className="text-[10px]">14</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer hover:text-rose-500 transition-colors">
                              <span className="text-xs">❤️</span>
                              <span className="text-[10px] font-bold">45</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                              <span className="text-xs">📤</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  ) : (
                    /* LinkedIn Post Structure */
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-850 p-4 rounded-2xl space-y-3.5 shadow-xs font-sans text-left text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-start gap-2.5">
                        {/* Fake user avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-505 to-emerald-600 outline-2 outline-offset-1 outline-emerald-500 text-white flex items-center justify-center font-black text-sm shrink-0 uppercase">
                          ID
                        </div>
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[13px] font-bold hover:underline cursor-pointer">Ishika Dubey</span>
                            <span className="text-zinc-400 text-[10px]">· 1st</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-none">Sustainability Catalyst • EcoTrack Active Contributor</p>
                          <p className="text-[9px] text-zinc-400 leading-none mt-1">1h · Edited · 🌐</p>
                        </div>
                      </div>

                      <p className="text-[11.5px] leading-relaxed text-zinc-800 dark:text-zinc-250 whitespace-pre-wrap font-sans">
                        🌱 Sharing my weekly progress from EcoTrack! Proud to have saved <span className="font-extrabold text-[#10b981]">{computedMetrics.avoidedTotal} kg CO₂e</span> this week while keeping my footprint under budget. Let's make every small habit count.{"\n"}{"\n"}
                        💼 Weekly Budget Limit: <span className="font-bold">{weeklyGoal} kg</span>{"\n"}
                        📊 Carbon Level: Level {levelInfo.level} ({levelInfo.name})
                      </p>

                      {/* LinkedIn attached visual summary card */}
                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative bg-[#041d13] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 mb-2">
                          <div className="text-[11px] font-bold text-center text-emerald-400 font-mono tracking-widest uppercase">Weekly Eco Report</div>
                          <span className="text-[9px] text-zinc-400 font-mono">ECOTRACK.PROMPTWARS</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-350">Streak Days active:</span>
                            <span className="font-bold text-amber-350">{computedMetrics.streakCount} Days 🔥</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-350">Environmental Title:</span>
                            <span className="font-bold text-emerald-350">{levelInfo.name}</span>
                          </div>
                        </div>
                      </div>

                      {/* LinkedIn visual Likes/Interactions counts */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 border-b border-zinc-150 dark:border-zinc-800 pb-2">
                        <div className="flex items-center gap-1">
                          <span className="flex items-center justify-center w-4 h-4 bg-blue-500 text-white rounded-full text-[8.5px]">👍</span>
                          <span className="flex items-center justify-center w-4 h-4 bg-emerald-500 text-white rounded-full text-[8.5px] -ml-2">👏</span>
                          <span>You and 12 others</span>
                        </div>
                        <span className="hover:underline cursor-pointer">2 comments · 1 repost</span>
                      </div>

                      {/* LinkedIn Bottom Control toolbar */}
                      <div className="flex items-center justify-between text-zinc-500 text-[11px] font-semibold pt-1">
                        <span className="flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">👍 Like</span>
                        <span className="flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">💬 Comment</span>
                        <span className="flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">🔄 Repost</span>
                        <span className="flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">📤 Send</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Raw Text Summary Box */}
                <div className="space-y-2">
                  <span className="text-xs font-mono font-black uppercase text-zinc-400 dark:text-zinc-500">Copy Text Summary</span>
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={5}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl text-xs font-mono leading-relaxed text-zinc-650 dark:text-zinc-300 outline-none resize-none"
                      value={`🍀 My EcoTrack Weekly Performance Report 🍀
------------------------------
📊 Weekly Goal Limit: ${weeklyGoal} kg CO₂e
📉 Actual Carbon Spent: ${computedMetrics.thisWeekTotal} kg CO₂e
✅ Saved/Avoided Carbon: ${computedMetrics.avoidedTotal} kg CO₂e
🔥 Active Logging Streak: ${computedMetrics.streakCount} days
👑 Title: Level ${levelInfo.level} (${levelInfo.name})
🌳 Equivalence Impact: Avoided emissions are equal to a young pine tree absorbing CO₂ for ${equivalences.treeAbsorptionDays} days!

Join me on EcoTrack & reduce your daily carbon footprints!`}
                    />
                  </div>
                </div>

                {/* Dialog Interactive Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      const text = `🍀 My EcoTrack Weekly Performance Report 🍀
------------------------------
📊 Weekly Goal Limit: ${weeklyGoal} kg CO₂e
📉 Actual Carbon Spent: ${computedMetrics.thisWeekTotal} kg CO₂e
✅ Saved/Avoided Carbon: ${computedMetrics.avoidedTotal} kg CO₂e
🔥 Active Logging Streak: ${computedMetrics.streakCount} days
👑 Title: Level ${levelInfo.level} (${levelInfo.name})
🌳 Equivalence Impact: Avoided emissions are equal to a young pine tree absorbing CO₂ for ${equivalences.treeAbsorptionDays} days!

Join me on EcoTrack & reduce your daily carbon footprints!`;
                      navigator.clipboard.writeText(text);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                      playGamificationSound('challenge');
                    }}
                    className="flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const text = `🍀 My EcoTrack Weekly Performance Report 🍀
------------------------------
📊 Weekly Goal Limit: ${weeklyGoal} kg CO₂e
📉 Actual Carbon Spent: ${computedMetrics.thisWeekTotal} kg CO₂e
✅ Saved/Avoided Carbon: ${computedMetrics.avoidedTotal} kg CO₂e
🔥 Active Logging Streak: ${computedMetrics.streakCount} days
👑 Title: Level ${levelInfo.level} (${levelInfo.name})
🌳 Equivalence Impact: Avoided emissions are equal to a young pine tree absorbing CO₂ for ${equivalences.treeAbsorptionDays} days!

Join me on EcoTrack & reduce your daily carbon footprints!`;
                      const element = document.createElement("a");
                      const file = new Blob([text], { type: 'text/plain' });
                      element.href = URL.createObjectURL(file);
                      element.download = "ecotrack_progress_report.txt";
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                      playGamificationSound('challenge');
                    }}
                    className="py-3 px-5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 dark:hover:bg-zinc-750 text-zinc-850 dark:text-zinc-100 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  >
                    <span>Download TXT</span>
                  </button>

                  <button
                    onClick={() => setIsShareModalOpen(false)}
                    className="py-3 px-5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 rounded-2xl font-extrabold text-xs uppercase tracking-widest cursor-pointer transition-all active:scale-98"
                  >
                    Close
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Alert Panels */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -45, scale: 0.9 }}
            animate={{ opacity: 1, y: 20, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold max-w-md ${
              notification.type === 'levelUp' 
                ? 'bg-amber-500 text-white border-amber-300' 
                : notification.type === 'badge'
                  ? 'bg-blue-600 text-white border-blue-400'
                  : notification.type === 'success'
                    ? 'bg-emerald-500 text-white border-emerald-300'
                    : 'bg-rose-600 text-white border-rose-400'
            }`}
          >
            {notification.type === 'levelUp' && <Trophy className="w-5 h-5 animate-bounce" />}
            {notification.type === 'badge' && <Award className="w-5 h-5 animate-spin" />}
            {notification.type === 'success' && <Check className="w-5 h-5" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Game Profile Metrics */}
      <header className="bg-white/90 dark:bg-zinc-900/90 border-b border-emerald-100 dark:border-zinc-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="bg-[#10b981]/10 p-2.5 rounded-2xl text-[#10b981] animate-pulse">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-emerald-800 dark:text-emerald-400 font-serif">EcoTrack</span>
              <span className="hidden sm:inline-block ml-2 text-[9px] font-mono font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/30">GAME EDITION</span>
            </div>
          </div>

          {/* XP & Level Status HUD Bar */}
          <div className="flex items-center gap-4 flex-1 max-w-md justify-end sm:justify-start">
            <div className="bg-emerald-50/80 dark:bg-zinc-950/40 p-2 sm:px-4 rounded-2xl border border-emerald-100/50 dark:border-zinc-800 w-full max-w-[280px] hidden md:block">
              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-400 mb-1">
                <span>LV.{levelInfo.level} - {levelInfo.name}</span>
                <span>{xp} / {levelInfo.nextXp} XP</span>
              </div>
              <div className="w-full bg-emerald-200/50 dark:bg-zinc-800 rounded-full h-2 overflow-hidden border border-emerald-300/20">
                <motion.div 
                  className="bg-emerald-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo.percentage}%` }}
                />
              </div>
            </div>

            {/* Mobile simplified HUD badge */}
            <div className="md:hidden bg-emerald-500 text-white rounded-xl py-1.5 px-3 flex items-center gap-1.5 text-xs font-bold shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-yellow-300" />
              <span>LV {levelInfo.level} • {xp} XP</span>
            </div>
          </div>

          {/* Quick theme action buttons & Country selections */}
          <div className="flex items-center gap-3">
            
            {/* Eco Notifications Bell with persistent display panel */}
            <div className="relative" id="header-notifications-wrapper">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-sm cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-zinc-800 flex items-center justify-center"
                title="Eco Notifications"
                id="header-notification-bell-btn"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span 
                    id="notification-badge-dot"
                    className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-pulse" 
                  />
                )}
              </motion.button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    {/* Dark backing overlay for clean click-outside closure */}
                    <div 
                      id="notifications-backdrop-overlay"
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />

                    {/* Dropdown Card */}
                    <motion.div
                      id="notifications-dropdown-panel"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                      {/* Header bar */}
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-emerald-50/40 dark:bg-zinc-900/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-sm text-zinc-800 dark:text-zinc-150">Eco Board Notifications</span>
                          {notifications.filter(n => !n.read).length > 0 && (
                            <span 
                              id="unread-count-pill"
                              className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce"
                            >
                              {notifications.filter(n => !n.read).length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {notifications.length > 0 && (
                            <button
                              id="clear-all-notifs-btn"
                              onClick={() => {
                                setNotifications([]);
                                showNotification("Cleared all notifications", "success");
                              }}
                              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold transition-all cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notifications List scroll space */}
                      <div className="max-h-[350px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full text-zinc-400 dark:text-zinc-600">
                              <Bell className="w-6 h-6 opacity-30" />
                            </div>
                            <span className="text-xs text-zinc-400 font-medium">All caught up! No recent eco notifications.</span>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id}
                              onClick={() => {
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                              }}
                              className={`p-4 transition-all text-left flex gap-3 cursor-pointer relative items-start ${
                                notif.read 
                                  ? 'bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30' 
                                  : 'bg-emerald-500/5 dark:bg-emerald-500/10 hover:bg-emerald-500/10 text-zinc-850 dark:text-zinc-100 font-semibold border-l-2 border-emerald-500'
                              }`}
                            >
                              {/* Left Unread dot indicator */}
                              {!notif.read && (
                                <span className="absolute top-5 left-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              )}

                              {/* Categorized icon container */}
                              <div className={`p-2 rounded-xl shrink-0 ${
                                notif.type === 'tip' 
                                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/45 dark:text-amber-400' 
                                  : notif.type === 'challenge' 
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-400' 
                                    : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-400'
                              }`}>
                                {notif.type === 'tip' ? (
                                  <Lightbulb className="w-4 h-4" />
                                ) : notif.type === 'challenge' ? (
                                  <Trophy className="w-4 h-4" />
                                ) : (
                                  <Leaf className="w-4 h-4" />
                                )}
                              </div>

                              {/* Details text area */}
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-xs font-bold leading-tight truncate">{notif.title}</span>
                                  <span className="text-[9px] font-mono opacity-65 flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                                    <Clock className="w-2.5 h-2.5" />
                                    {getRelativeTimeString(notif.timestamp)}
                                  </span>
                                </div>
                                <p className="text-[11px] leading-relaxed select-none opacity-90 line-clamp-2">
                                  {notif.content}
                                </p>

                                {/* Action Buttons matching notif type to quickly navigate */}
                                {notif.type === 'tip' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Scroll to tips section
                                      document.getElementById('gai-tips-section')?.scrollIntoView({ behavior: 'smooth' });
                                      setIsNotificationsOpen(false);
                                      // Also mark as read
                                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                    }}
                                    className="pt-1.5 text-[9.5px] font-extrabold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    View Gemini Tips <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {notif.type === 'challenge' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Scroll to challenges section
                                      document.getElementById('choices-challenges-section')?.scrollIntoView({ behavior: 'smooth' });
                                      setIsNotificationsOpen(false);
                                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                    }}
                                    className="pt-1.5 text-[9.5px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                                  >
                                    Review Challenges <ArrowRight className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Dropdown footer bar */}
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-150 dark:border-zinc-800 text-center flex justify-between items-center px-4">
                        <button
                          id="mark-all-read-btn"
                          onClick={() => {
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            showNotification("Marked all eco notifications as read", "success");
                          }}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 font-extrabold cursor-pointer transition-all uppercase tracking-wider"
                        >
                          Mark All Read
                        </button>
                        <span className="text-[9px] text-[#22c55e]/90 font-bold bg-[#22c55e]/10 py-0.5 px-2 rounded-full font-mono">
                          ECO ACTIVE
                        </span>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Secure Cloud Profile Sync Hub */}
            <div className="relative font-sans" id="header-cloud-profile-sync-wrapper">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (currentUser) {
                    setIsCloudDropdownOpen(!isCloudDropdownOpen);
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className={`p-2.5 rounded-xl border text-[10px] font-extrabold flex items-center gap-2 shadow-sm cursor-pointer transition-all ${
                  currentUser 
                    ? 'border-emerald-200 dark:border-emerald-950/65 bg-emerald-50/45 dark:bg-emerald-950/20 text-[#10b981]' 
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800'
                }`}
                title="Secure Cloud Profile Sync"
                id="header-cloud-sync-btn"
              >
                {isSyncLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                ) : currentUser ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span className="hidden leading-none md:inline font-mono tracking-wider">
                  {currentUser ? 'SECURED & SYNCED' : 'CLOUD CONNECT'}
                </span>
              </motion.button>

              {/* Cloud Account Profile Dropdown */}
              <AnimatePresence>
                {isCloudDropdownOpen && currentUser && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsCloudDropdownOpen(false)} />
                    <motion.div
                      id="cloud-profile-dropdown-panel"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4 space-y-3.5 text-left"
                    >
                      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xs uppercase shrink-0">
                            {currentUser.email ? currentUser.email.charAt(0) : '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block truncate leading-tight">
                              {currentUser.displayName || 'Eco Hero Active'}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 block truncate leading-none mt-0.5">
                              {currentUser.email || 'Anonymous Guest'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-[10.5px]">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[8px] font-mono">Cloud UID</span>
                          <span className="font-mono text-zinc-500 font-bold text-[9px] truncate max-w-[120px]">{currentUser.uid}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[8px] font-mono">Synced Logs</span>
                          <span className="font-bold text-emerald-500 font-mono text-xs">{logs.length} entries</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[8px] font-mono">Experience</span>
                          <span className="font-bold text-emerald-500 font-mono text-xs">{xp} XP (LV {levelInfo.level})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[8px] font-mono">Weekly Limit</span>
                          <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono text-xs">{weeklyGoal} kg</span>
                        </div>
                      </div>

                      <button
                        id="cloud-signout-btn"
                        onClick={async () => {
                          setIsCloudDropdownOpen(false);
                          try {
                            await signOut(auth);
                            showNotification("Signed out safely. Reverted to cached local copy.", "success");
                          } catch (err) {
                            showNotification("Signout failed.", "error");
                          }
                        }}
                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-150 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-[10px] uppercase tracking-wider font-extrabold rounded-xl transition-all cursor-pointer"
                      >
                        Sign Out / Disconnect
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {/* Dark mode switcher toggle with high tactile scale feedback */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl border border-emerald-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 shadow-sm cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-zinc-800"
              title="Toggle Contrast Mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-600" />}
            </motion.button>

            {/* Select Benchmarks (Locked to India Only) */}
            <div className="hidden sm:flex items-center gap-2 bg-[#f0fdf4] dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/40 py-1.5 px-4 rounded-full text-xs font-black shadow-xs">
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <span className="text-emerald-900 dark:text-emerald-300 font-sans tracking-wide">Region: 🇮🇳 India</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* Responsive Premium Navigation Tab Switcher */}
        <div id="navigation-tabs" className="bg-white/80 dark:bg-zinc-900/50 backdrop-blur-md p-2 rounded-3xl border border-emerald-100/60 dark:border-zinc-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xs sticky top-[84px] z-20">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full md:w-auto pb-1.5 md:pb-0">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Leaf },
              { id: 'activities', label: 'Log Activity', icon: CheckCircle2 },
              { id: 'healthSync', label: 'Health Sync', icon: Heart },
              { id: 'simulation', label: 'Simulator & Quiz', icon: TrendingDown },
              { id: 'intelligence', label: 'AI Advice', icon: Lightbulb },
              { id: 'ledger', label: 'Footprint Ledger', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4.5 py-3 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2.5 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-md'
                      : 'text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-850/60'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'scale-110 animate-pulse' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/5 px-4 py-2.5 rounded-2xl border border-emerald-500/10 shrink-0">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span>Interactive Space</span>
          </div>
        </div>

        {/* PAGE VIEWS SECTION WRAPPERS */}
        {activeTab === 'dashboard' && (
          <motion.div 
            key="dashboard-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* 1. CARBON BUDGET GAME MECHANIC (Upper dynamic level banner) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Live Action Carbon Budget Circle Meter dial (takes 8 grid columns) */}
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800/80 p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
            
            {/* Visual background carbon footprint indicators */}
            <div className="absolute top-0 right-0 p-8 w-60 h-60 opacity-5 pointer-events-none">
              <Leaf className="w-full h-full text-emerald-600" />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              
              <div className="space-y-3 max-w-md text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-zinc-950 border border-emerald-100 dark:border-zinc-800 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  <FlameKindling className="w-3.5 h-3.5 text-orange-500" />
                  <span>Interactive Carbon Budget Engine</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-serif text-emerald-950 dark:text-zinc-50">
                  Your Weekly Allowable Carbon Credits
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Every activity logs emissions and draws down your budget space. Log alternate low-carbon choices below to build avoided credits status and unlock rare level title badges.
                </p>

                {/* Pace alert panel */}
                <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${computedMetrics.paceBg}`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-extrabold block text-zinc-900 dark:text-white">{computedMetrics.paceDetailText}</span>
                    <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Your current pace limit sits close to <span className="font-extrabold">{computedMetrics.thisWeekTotal} kg</span> of the custom weekly target budget. Adjust limits on target options.
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly Budget Circle depletion SVG meter */}
              <div className="relative shrink-0 flex flex-col items-center">
                
                {/* SVG circular gauge */}
                <div id="carbon-budget-meter-container" className="relative w-40 h-40">
                  <svg id="carbon-budget-gauge" className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background trail */}
                    <circle 
                      id="carbon-budget-bg-circle"
                      cx="50" cy="50" r="42" 
                      className="stroke-zinc-100 dark:stroke-zinc-800" 
                      strokeWidth="8" fill="transparent" 
                    />
                    {/* Actual dynamic level meter line */}
                    <motion.circle 
                      id="carbon-budget-meter-animated-circle"
                      cx="50" cy="50" r="42" 
                      strokeWidth="8" fill="transparent" 
                      strokeDasharray={264}
                      initial={{ strokeDashoffset: 264, stroke: '#10b981' }}
                      animate={{ 
                        strokeDashoffset: 264 - (264 * Math.min(1.0, computedMetrics.thisWeekTotal / weeklyGoal)),
                        stroke: computedMetrics.thisWeekTotal > weeklyGoal 
                          ? '#f43f5e' 
                          : computedMetrics.thisWeekTotal > weeklyGoal * 0.8 
                            ? '#f59e0b' 
                            : '#10b981'
                      }}
                      transition={{ 
                        strokeDashoffset: { type: 'spring', damping: 22, stiffness: 70, mass: 1 },
                        stroke: { duration: 0.8, ease: 'easeInOut' }
                      }}
                    />
                  </svg>

                  {/* Absolute concentric metrics text block */}
                  <div id="carbon-budget-text-display" className="absolute inset-0 flex flex-col justify-center items-center text-center">
                    <span className="text-3xl font-black tracking-tight text-emerald-950 dark:text-zinc-100">
                      {Math.round((computedMetrics.thisWeekTotal / weeklyGoal) * 100)}%
                    </span>
                    <span className="text-[9px] font-mono tracking-widest uppercase font-black text-zinc-400">Consumed</span>
                  </div>
                </div>

                <div className="mt-3 text-center flex flex-col items-center gap-2">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">{computedMetrics.thisWeekTotal} kg</span> logged this week / {weeklyGoal} kg CO₂e budget limit
                  </div>
                  
                  <button
                    id="share-progress-button"
                    onClick={() => {
                      playGamificationSound('challenge');
                      setIsShareModalOpen(true);
                      setIsCopied(false);
                    }}
                    className="mt-1 px-4 py-1.5 bg-emerald-100 dark:bg-zinc-800 hover:bg-emerald-200 dark:hover:bg-zinc-750 text-emerald-800 dark:text-emerald-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 border border-emerald-200/40 dark:border-zinc-700/50 shadow-2xs hover:scale-[1.03] active:scale-[0.97]"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Share Progress Report</span>
                  </button>
                </div>
              </div>

            </div>

          </div>

          {/* Quick HUD Metrics (takes 4 columns) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Daily Streak score tracker card */}
            <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800/80 p-5 rounded-3xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 font-black shrink-0 relative">
                  <Flame className="w-6 h-6 fill-amber-500 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-widest block">Daily Streak Tracker</span>
                  <span className="text-lg font-black block text-emerald-950 dark:text-zinc-50">{computedMetrics.streakCount} Logged Days</span>
                </div>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold py-1 px-2.5 rounded-full">
                {computedMetrics.streakCount > 0 ? '+15 XP Bonus' : 'Active log today'}
              </span>
            </div>

            {/* Total Avoided carbon score card */}
            <div className="bg-emerald-950 text-white p-5 rounded-3xl shadow-md relative overflow-hidden flex-1 flex flex-col justify-between">
              <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] tracking-wider uppercase font-extrabold text-emerald-400 font-mono">AVOIDED CARBON SCORE</span>
                  <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight text-white">{computedMetrics.avoidedTotal}</span>
                  <span className="text-xs font-bold text-emerald-400">kg CO₂e Saved</span>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-emerald-800/80 flex items-center justify-between text-xs text-emerald-300">
                <span className="font-semibold block leading-tight">Total alternative choices made instead of petrol/beef:</span>
                <span className="font-black text-emerald-400 text-base">{logs.filter(l => l.source === 'choice').length} choices</span>
              </div>
            </div>

          </div>

        </div>

        {/* Adjust Weekly Budget target widget overlay drawer */}
        <div className="bg-emerald-50/50 dark:bg-zinc-900/40 border border-emerald-100/60 dark:border-zinc-800 p-4.5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-zinc-800 text-emerald-800 dark:text-emerald-400 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-semibold block text-zinc-800 dark:text-zinc-200">Adjust Custom Allowable Carbon Budget Goal</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Default is 80 kg. Low goals demand heavier cycling commute choices.</span>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto max-w-xs">
            <input 
              type="range" 
              min="30" 
              max="200" 
              value={weeklyGoal} 
              onChange={(e) => setWeeklyGoal(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full border-none"
            />
            <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-400 shrink-0">{weeklyGoal} kg/week</span>
          </div>
        </div>

        {/* INDIAN SUB-REGION & SURROUNDING ADVISOR */}
        {selectedCountry === 'India' && (
          <div className="bg-gradient-to-br from-[#fbfcfa] to-[#f4fbf6] dark:from-zinc-900/60 dark:to-zinc-950/80 border border-emerald-100 dark:border-zinc-800/80 p-6 sm:p-8 rounded-3xl shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-850 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-zinc-950 border border-orange-100 dark:border-zinc-800/80 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider text-orange-850 dark:text-orange-400 mb-2">
                  <Globe className="w-3.5 h-3.5 text-orange-500 animate-spin-slow" />
                  <span>Interactive Localized Advisor</span>
                </div>
                <h3 className="text-xl font-black font-serif text-emerald-950 dark:text-zinc-50 flex items-center gap-2">
                  <span>🇮🇳 Indian Regional Carbon Planner</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Adapt calculations to your specific state's power grids, mass transit availability, and surrounding emission profiles.
                </p>
              </div>

              {/* Geo Detect Button and Manual Selection dropdown */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button
                  onClick={async () => {
                    if (!navigator.geolocation) {
                      showNotification("Geolocation is not supported by your browser.", "error");
                      return;
                    }
                    setDetectingLocation(true);
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        const { latitude, longitude } = position.coords;
                        let minDistance = Infinity;
                        let closest = INDIAN_STATES_CENTROIDS[0];
                        
                        INDIAN_STATES_CENTROIDS.forEach((state) => {
                          const dist = Math.sqrt(Math.pow(state.lat - latitude, 2) + Math.pow(state.lng - longitude, 2));
                          if (dist < minDistance) {
                            minDistance = dist;
                            closest = state;
                          }
                        });
                        
                        setSelectedIndiaRegion(closest.name);
                        setDetectingLocation(false);
                        showNotification(`Located closest state! Switched to: ${closest.name}`, "success");
                      },
                      (error) => {
                        console.error(error);
                        setDetectingLocation(false);
                        showNotification("Location permission denied. Please select your state manually from the list.", "error");
                      },
                      { enableHighAccuracy: true, timeout: 6000 }
                    );
                  }}
                  disabled={detectingLocation}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <MapPin className={`w-3.5 h-3.5 ${detectingLocation ? 'animate-bounce' : ''}`} />
                  <span>{detectingLocation ? 'Auto-detecting state...' : 'Detect My Sub-Region'}</span>
                </button>

                <div className="relative w-full sm:w-auto">
                  <select
                    value={selectedIndiaRegion}
                    onChange={(e) => {
                      setSelectedIndiaRegion(e.target.value);
                      showNotification(`Switched sub-region to ${e.target.value}`, "success");
                    }}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs py-2 px-3.5 pr-8 rounded-2xl outline-none font-extrabold text-emerald-800 dark:text-emerald-400 cursor-pointer appearance-none"
                  >
                    {INDIAN_STATES_CENTROIDS.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-zinc-400">
                    ▼
                  </div>
                </div>
              </div>
            </div>

            {/* Split layout: Interactive Geo Heatmap (Left/Top) & Config Metrics Details (Right/Bottom) */}
            {(() => {
              const activeConfig = INDIAN_STATES_CENTROIDS.find(c => c.name === selectedIndiaRegion) || INDIAN_STATES_CENTROIDS[0];
              
              // Helper to resolve coordinates
              const getHotspotCoords = (name: string) => {
                switch (name) {
                  case 'Maharashtra / Western Grid': return { x: 77, y: 162 };
                  case 'Delhi NCR / Northern Grid': return { x: 92, y: 74 };
                  case 'Karnataka / Southern Grid': return { x: 96, y: 230 };
                  case 'Tamil Nadu / Southern Grid': return { x: 106, y: 249 };
                  case 'Kerala / Southern Grid': return { x: 83, y: 252 };
                  case 'West Bengal / Eastern Grid': return { x: 198, y: 130 };
                  case 'Uttar Pradesh / Northern Grid': return { x: 129, y: 92 };
                  default: return { x: 150, y: 150 };
                }
              };

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-fade-in">
                  {/* LEFT COLUMN: SVG-based Geographic Heat Map of India */}
                  <div className="lg:col-span-5 bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-150 dark:border-zinc-800/80 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-zinc-850 dark:text-zinc-150 flex items-center gap-2">
                        <span>🌍 Interactive National Grid Map</span>
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Select carbon-heavy hotspot regions (Red) or greener territories (Green/Orange) directly on the interactive layout to review and plan region-specific offsets.
                      </p>
                    </div>

                    {/* SVG map of India with floating zoom/pan controls */}
                    <div className="relative flex justify-center items-center bg-zinc-50/50 dark:bg-zinc-900/30 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-900 overflow-hidden group select-none">
                      {/* Floating Zoom & Pan Control Deck */}
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setMapZoom(z => Math.min(3.5, z + 0.25))}
                          className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-zinc-900 hover:bg-emerald-100 dark:hover:bg-zinc-850 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm transition-all active:scale-90 cursor-pointer"
                          title="Zoom In"
                        >
                          ＋
                        </button>
                        <button
                          type="button"
                          onClick={() => setMapZoom(z => Math.max(0.8, z - 0.25))}
                          className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-zinc-900 hover:bg-emerald-100 dark:hover:bg-zinc-850 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm transition-all active:scale-90 cursor-pointer"
                          title="Zoom Out"
                        >
                          －
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMapZoom(1);
                            setMapPan({ x: 0, y: 0 });
                          }}
                          className="px-1.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-600 dark:text-zinc-350 flex items-center justify-center font-extrabold text-[8px] uppercase tracking-wider transition-all active:scale-90 cursor-pointer mt-0.5"
                          title="Reset View"
                        >
                          Reset
                        </button>
                      </div>

                      {/* Info hint overlay */}
                      <div className="absolute bottom-3 right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-zinc-900/80 dark:bg-zinc-950/90 backdrop-blur-xs text-[9px] text-zinc-200 py-1 px-2 rounded-lg font-mono">
                        🖱️ Drag to Pan
                      </div>

                      <svg
                        viewBox="0 0 300 310"
                        className={`w-full max-w-[270px] h-auto drop-shadow-xs overflow-visible cursor-grab ${isDraggingMap ? 'cursor-grabbing' : ''}`}
                        onMouseDown={(e) => {
                          setIsDraggingMap(true);
                          setDragStart({ x: e.clientX - mapPan.x, y: e.clientY - mapPan.y });
                        }}
                        onMouseMove={(e) => {
                          if (!isDraggingMap) return;
                          setMapPan({
                            x: e.clientX - dragStart.x,
                            y: e.clientY - dragStart.y
                          });
                        }}
                        onMouseUp={() => setIsDraggingMap(false)}
                        onMouseLeave={() => setIsDraggingMap(false)}
                        onTouchStart={(e) => {
                          if (e.touches.length === 1) {
                            setIsDraggingMap(true);
                            setDragStart({
                              x: e.touches[0].clientX - mapPan.x,
                              y: e.touches[0].clientY - mapPan.y
                            });
                          }
                        }}
                        onTouchMove={(e) => {
                          if (!isDraggingMap || e.touches.length !== 1) return;
                          setMapPan({
                            x: e.touches[0].clientX - dragStart.x,
                            y: e.touches[0].clientY - dragStart.y
                          });
                        }}
                        onTouchEnd={() => setIsDraggingMap(false)}
                      >
                        {/* Interactive Scale and Translation group */}
                        <g 
                          transform={`translate(${mapPan.x}, ${mapPan.y}) scale(${mapZoom})`}
                          style={{ 
                            transformOrigin: '150px 155px', 
                            transition: isDraggingMap ? 'none' : 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)' 
                          }}
                        >
                          {/* India Geographic Outline Path */}
                          <path
                            d="M 68 5 L 110 18 L 105 45 L 122 60 L 180 82 L 205 79 L 235 80 L 282 78 L 253 140 L 235 130 L 205 143 L 180 162 L 122 205 L 123 229 L 95 279 L 78 250 L 59 210 L 48 170 L 45 150 L 15 137 L 5 122 L 20 95 L 60 50 Z"
                            fill="currentColor"
                            className="text-emerald-500/5 dark:text-emerald-500/2 stroke-zinc-200 dark:stroke-zinc-800"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          
                          {/* Soft map latitude/longitude grid lines for high-tech style */}
                          <line x1="10" y1="100" x2="290" y2="100" stroke="currentColor" className="text-zinc-150 dark:text-zinc-800/20" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="10" y1="200" x2="290" y2="200" stroke="currentColor" className="text-zinc-150 dark:text-zinc-800/20" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="100" y1="10" x2="100" y2="300" stroke="currentColor" className="text-zinc-150 dark:text-zinc-800/20" strokeWidth="1" strokeDasharray="3 3" />
                          <line x1="200" y1="10" x2="200" y2="300" stroke="currentColor" className="text-zinc-150 dark:text-zinc-800/20" strokeWidth="1" strokeDasharray="3 3" />

                          {/* Rendering region bubbles/circles */}
                          {INDIAN_STATES_CENTROIDS.map((r) => {
                            const coords = getHotspotCoords(r.name);
                            const isSelected = r.name === selectedIndiaRegion;
                            const isHovered = r.name === hoveredIndiaRegion;
                            
                            // Determine heat colors based on carbon grid factor limit
                            let circleColor = "text-rose-500";
                            let ringColor = "text-rose-400";
                            if (r.gridFactor <= 0.5) {
                              circleColor = "text-emerald-500";
                              ringColor = "text-emerald-400";
                            } else if (r.gridFactor <= 0.65) {
                              circleColor = "text-amber-500";
                              ringColor = "text-amber-400";
                            }

                            // Factor size scaling (radius ranges from 8 to 14)
                            const radius = 6 + (r.gridFactor * 8);

                            return (
                              <g 
                                key={r.name}
                                className="cursor-pointer transition-all duration-300"
                                onClick={(e) => {
                                  // Prevent event parent conflicts
                                  e.stopPropagation();
                                  setSelectedIndiaRegion(r.name);
                                  showNotification(`Switched grid reference to ${r.name}`, "success");
                                }}
                                onMouseEnter={() => setHoveredIndiaRegion(r.name)}
                                onMouseLeave={() => setHoveredIndiaRegion(null)}
                              >
                                {/* Glowing pulsator indicator for selected state */}
                                {isSelected && (
                                  <circle
                                    cx={coords.x}
                                    cy={coords.y}
                                    r={radius + 8}
                                    fill="none"
                                    stroke="currentColor"
                                    className={`${ringColor} opacity-75 animate-ping`}
                                    strokeWidth="1.5"
                                    style={{ transformOrigin: `${coords.x}px ${coords.y}px` }}
                                  />
                                )}

                                {/* Target point circle */}
                                <circle
                                  cx={coords.x}
                                  cy={coords.y}
                                  r={radius}
                                  fill="currentColor"
                                  className={`${circleColor} transition-transform duration-300 hover:scale-125`}
                                  opacity={isSelected || isHovered ? "1.0" : "0.7"}
                                  stroke={isSelected ? "#ffffff" : "currentColor"}
                                  strokeWidth={isSelected ? "2" : "0.5"}
                                />

                                {/* Simple mini-label for critical hotspots or selected region */}
                                {(isSelected || isHovered) && (
                                  <g className="pointer-events-none">
                                    {/* Tooltip backing */}
                                    <rect
                                      x={Math.max(10, coords.x - 70)}
                                      y={coords.y - 38}
                                      width="140"
                                      height="24"
                                      rx="6"
                                      fill="#18181b"
                                      stroke="#3f3f46"
                                      strokeWidth="0.5"
                                    />
                                    <text
                                      x={coords.x}
                                      y={coords.y - 22}
                                      fontFamily="monospace"
                                      fontSize="8"
                                      fontWeight="bold"
                                      fill="white"
                                      textAnchor="middle"
                                    >
                                      {r.name.split(" / ")[0]}: {r.gridFactor} kg/kWh
                                    </text>
                                  </g>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      </svg>

                      {/* Map Hotspot Legend overlay */}
                      <div className="absolute bottom-2 left-2 bg-black/75 dark:bg-black/90 backdrop-blur-xs py-1 px-2.5 rounded-lg text-[9px] font-mono text-zinc-300 flex items-center gap-2 border border-zinc-800">
                        <span className="font-extrabold text-white">Grid Intensity:</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Clean</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Med</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Heavy</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Selected Sub-Region Information parameters */}
                  <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                    {/* Selected state card header display */}
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/2 border border-emerald-100/30 dark:border-zinc-800 p-5 rounded-3xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-650 dark:text-emerald-400 font-extrabold block">
                          Reporting Coordinate System
                        </span>
                        <h4 className="text-xl font-black text-emerald-950 dark:text-zinc-50 font-serif">
                          {activeConfig.name}
                        </h4>
                      </div>
                      <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-100 dark:border-zinc-800 text-xl shadow-xs">
                        🇮🇳
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                      {/* Left Parameter: Grid Emission Intensity bar */}
                      <div className="bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-850/60 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-400 font-extrabold block mb-1">
                            Grid Intensity Index
                          </span>
                          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-baseline gap-1">
                            {activeConfig.gridFactor} <span className="text-[10px] font-bold text-zinc-500">kg CO₂/kWh</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                            {activeConfig.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-850">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Carbon Level:</span>
                            <span className={activeConfig.gridFactor > 0.75 ? "text-rose-500 font-black animate-pulse" : activeConfig.gridFactor > 0.6 ? "text-amber-500 font-black" : "text-emerald-500 font-black"}>
                              {activeConfig.gridFactor > 0.75 ? "Industrial Hotspot" : activeConfig.gridFactor > 0.6 ? "Medium Grid" : "Renewable Clean"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle Parameter: Surrounding Infrastructure Facts */}
                      <div className="bg-zinc-50 dark:bg-zinc-950/60 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-850/60 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono tracking-wider text-[#10b981] font-extrabold block mb-1">
                            Surroundings & Cities
                          </span>
                          <h4 className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 mt-1">
                            Geographical Scope:
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed font-sans">
                            {activeConfig.surroundings}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-850">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Public Travel:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">High Connectivity</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Parameter: How to Reduce Emissions in State */}
                      <div className="bg-emerald-500/5 dark:bg-zinc-950/80 p-5 rounded-2xl border border-emerald-500/10 dark:border-zinc-800 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono tracking-widest text-[#10b981] font-bold block mb-1">
                            🎯 Local Abatement Plan
                          </span>
                          <h4 className="text-[11px] font-bold text-emerald-950 dark:text-zinc-100 mt-1">
                            Low Carbon Swap Target:
                          </h4>
                          <p className="text-[11px] text-emerald-800 dark:text-zinc-300 mt-2 leading-relaxed italic font-medium">
                            "{activeConfig.tip}"
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-emerald-500/10 dark:border-zinc-850">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-400">Reduction Lever:</span>
                            <span className="text-orange-600 dark:text-orange-400 font-black">Dynamic Shift</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Educational disclaimer on how coordinate/location input is utilized */}
            <div className="p-4 bg-emerald-50/20 dark:bg-zinc-950/40 border border-emerald-100/30 dark:border-zinc-800/80 rounded-2xl text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-2">
              <p className="font-extrabold text-emerald-950 dark:text-zinc-200 flex items-center gap-1">
                ℹ️ How the EcoTrack AI utilizes your location inputs:
              </p>
              <p>
                When you auto-locate or manually switch to a region in India, the application immediately starts using customized local factors. 
                Instead of general US passenger car averages, we customize your logs for localized travel (CNG auto-rickshaws, highly optimized trains, or lightweight gasoline scooters). 
                Furthermore, we adjust your home energy log calculations to reflect your selected state's reliance on either coal-heavy grids or solar/hydro reserves. 
                Your weekly goal decreases to <strong>25 kg/week</strong> to reflect India's low-carbon per-capita daily budget averages and help you compete in a fair, realistic regional playground!
              </p>
            </div>
          </div>
        )}

        {/* CARBON TREND ANALYSIS CHART */}
        <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-zinc-950 border border-emerald-100/50 dark:border-zinc-800 py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                <span>Performance Indicator</span>
              </div>
              <h3 className="text-xl font-black font-serif text-emerald-950 dark:text-zinc-50">
                Carbon Trend Analysis
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Daily carbon footprint progress for the current week compared to your previous week's average daily baseline.
              </p>
            </div>

            {/* Quick trend indicator badge */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 text-center">
                <span className="block text-[9px] font-mono tracking-widest text-zinc-400 uppercase font-black">PREV WEEK DAILY AVG</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-400">
                  {trendChartData.prevWeekDailyAverage} kg
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 text-center">
                <span className="block text-[9px] font-mono tracking-widest text-zinc-400 uppercase font-black">THIS WEEK DAILY AVG</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {trendChartData.currentWeekDailyAverage} kg
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 text-center flex flex-col justify-center min-w-[100px]">
                <span className="block text-[9px] font-mono tracking-widest text-zinc-400 uppercase font-black">TREND RATIO</span>
                <span className="text-sm font-black flex items-center justify-center gap-1">
                  {trendChartData.prevWeekDailyAverage === 0 ? (
                    <span className="text-zinc-500">N/A</span>
                  ) : (
                    (() => {
                      const percentChange = ((trendChartData.currentWeekDailyAverage - trendChartData.prevWeekDailyAverage) / trendChartData.prevWeekDailyAverage) * 100;
                      const isReduction = percentChange <= 0;
                      return (
                        <span className={`flex items-center gap-0.5 ${isReduction ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {isReduction ? '↓' : '↑'} {Math.abs(Math.round(percentChange))}%
                        </span>
                      );
                    })()
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData.list} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#27272a' : '#f4fbf7'} />
                  <XAxis dataKey="name" stroke="#889b89" fontSize={10} tickLine={false} />
                  <YAxis stroke="#889b89" fontSize={10} tickLine={false} unit="kg" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
                      borderRadius: '16px',
                      border: isDarkMode ? '1px solid #27272a' : '1px solid #d6e4d6',
                      fontSize: '11px',
                    }}
                  />
                  <Legend verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', paddingBottom: '15px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="Current Week" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ fill: '#10b981', r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Prev Week Avg" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    dot={false} 
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest text-[#10b981] font-black uppercase">Trend Insights</span>
                <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">
                  {trendChartData.prevWeekDailyAverage === 0 ? (
                    "Establish a baseline"
                  ) : trendChartData.currentWeekDailyAverage < trendChartData.prevWeekDailyAverage ? (
                    "Eco Footprint is Shrinking! 🎉"
                  ) : (
                    "Footprint is Expanding ⚠️"
                  )}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {trendChartData.prevWeekDailyAverage === 0 ? (
                    "Keep logging daily to create a multi-week data trend. Once previous week data accumulates, you'll see comparative trend percentages."
                  ) : trendChartData.currentWeekDailyAverage < trendChartData.prevWeekDailyAverage ? (
                    `Amazing work! Your daily emission intensity is lower than last week's average by ${Math.round(((trendChartData.prevWeekDailyAverage - trendChartData.currentWeekDailyAverage) / trendChartData.prevWeekDailyAverage) * 100)}%. Keep choosing active transit and plant-based foods to maintain your standing!`
                  ) : (
                    `Your current footprint rate is higher than last week's average. Consider logging alternative transit or diet choices to reduce your score and rebuild avoided credits!`
                  )}
                </p>
              </div>

              {/* Weekly saving equivalent visual card */}
              <div className="pt-3.5 border-t border-zinc-200/50 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400">
                <div className="flex justify-between py-1">
                  <span>Current Week footprint:</span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">{trendChartData.currentWeekTotal} kg CO₂e</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Equivalent standard days:</span>
                  <span className="font-extrabold text-[#10b981]">
                    {Math.round(trendChartData.currentWeekTotal / 12)} Daily Targets
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. WEEKLY CARBON STORY RECAP */}
        {(computedMetrics.weeklyUniqueDaysCount >= 3 || carbonStory !== null) ? (
          <div className="bg-gradient-to-br from-emerald-700 via-teal-800 to-emerald-900 dark:from-zinc-900 dark:via-emerald-950 dark:to-zinc-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-500/30">
            <div className="absolute top-[-50px] right-[-50px] w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-50px] left-[-50px] w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-stretch gap-6 relative z-10">
              
              {/* Left Dynamic Narrative */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white/10 p-2.5 rounded-2xl text-yellow-300 shadow-sm shrink-0">
                    <BookOpen className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono tracking-widest font-black text-[#a3e635] block uppercase">Weekly Narrative Recap</span>
                    <h3 className="text-xl sm:text-2xl font-black font-serif text-white">Your Weekly Carbon Story</h3>
                  </div>
                </div>

                {carbonStory ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="leading-relaxed text-xs sm:text-sm bg-white/5 border border-white/10 p-5 rounded-2xl text-emerald-50/90 whitespace-pre-line"
                  >
                    <p className="select-text leading-relaxed font-sans">{carbonStory.storyText}</p>
                    {carbonStory.forwardNudge && (
                      <div className="mt-4 pt-3.5 border-t border-white/10 text-xs text-[#a3e635] font-semibold flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                        <span>{carbonStory.forwardNudge}</span>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-emerald-150 text-xs leading-relaxed space-y-3">
                    <p>
                      ✨ **Your Gemini Carbon Story recap is ready!** You have logged activities on **{computedMetrics.weeklyUniqueDaysCount} different days** of the week. 
                    </p>
                    <p className="opacity-90">
                      Tap the button below to allow Gemini to compile your logged transportation, home energy, and foods into a warm, friendly, short story-style writeup with light humor.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={generateCarbonStory}
                    disabled={isGeneratingStory}
                    className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isGeneratingStory ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Recapping...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-zinc-950" />
                        <span>{carbonStory ? "Rewrite Story Recap" : "Unlock My Carbon Story"}</span>
                      </>
                    )}
                  </motion.button>

                  {carbonStory && (
                    <button
                      onClick={() => {
                        setCarbonStory(null);
                        showNotification("Cleared story state", "success");
                      }}
                      className="px-4 py-2 text-xs text-white/85 hover:text-white hover:bg-white/10 border border-white/20 rounded-full transition-all cursor-pointer"
                    >
                      Clear Story
                    </button>
                  )}
                </div>
              </div>

              {/* Right Summary Badge */}
              {carbonStory && (
                <div className="lg:w-72 bg-white/10 dark:bg-zinc-950/40 border border-white/10 rounded-2xl p-5 flex flex-col justify-between shrink-0 space-y-4">
                  <div className="space-y-3">
                    <span className="text-[9px] font-mono tracking-widest font-black uppercase text-emerald-300 block">Highlight Badge</span>
                    
                    <div className="bg-yellow-400/20 text-yellow-300 px-3.5 py-2.5 rounded-xl text-xs font-black border border-yellow-400/30 inline-flex items-center gap-2 w-full">
                      <Trophy className="w-4 h-4 shrink-0 text-yellow-300 animate-bounce" />
                      <span className="truncate leading-none">{carbonStory.highlightStat}</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-white/5 opacity-80">
                        <span className="text-emerald-200">Avoided carbon total:</span>
                        <span className="font-extrabold text-white">-{carbonStory.totalSavedKg || computedMetrics.avoidedTotal} kg</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5 opacity-80">
                        <span className="text-emerald-200">Best weekday moment:</span>
                        <span className="font-extrabold text-emerald-300 uppercase">{carbonStory.bestDay}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5 opacity-80">
                        <span className="text-emerald-200">Worst weekday moment:</span>
                        <span className="font-extrabold text-rose-300 uppercase">{carbonStory.worstDay}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[9px] text-emerald-200 bg-white/5 p-2 rounded-xl leading-normal text-center border border-white/5">
                    <span>📱 Capture a screenshot to share carbon milestones with eco squads!</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          /* Automatic locked state progress meter notice */
          <div className="bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left max-w-2xl">
              <div className="inline-flex items-center gap-1.5 bg-zinc-200 dark:bg-zinc-800 py-1 px-2.5 rounded-full text-[9px] font-black uppercase tracking-wider text-zinc-650 dark:text-zinc-300">
                <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                <span>Locked Milestone Recap</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold font-serif text-zinc-800 dark:text-zinc-150">
                Weekly AI Carbon Story 📖
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Receive an AI-written narrative recap of your week using Gemini! This unlocks automatically when you log habits on **at least 3 different days** in a week.
              </p>
              
              <div className="flex items-center justify-center md:justify-start gap-2.5 mt-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400">
                  Logged {computedMetrics.weeklyUniqueDaysCount} of 3 required days of the week
                </span>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-1.5 rounded-sm ${i < computedMetrics.weeklyUniqueDaysCount ? 'bg-emerald-500' : 'bg-zinc-350 dark:bg-zinc-700'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={generateCarbonStory}
                disabled={isGeneratingStory}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-750 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
              >
                {isGeneratingStory ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                )}
                <span>Generate Story Anyway (On-demand)</span>
              </motion.button>
              <span className="text-[10px] text-zinc-400">Unlock story preview on demand immediately</span>
            </div>
          </div>
        )}

          </motion.div>
        )}

        {/* DAILY ECO-QUIZ CHALLENGE SECTION */}
        {activeTab === 'simulation' && (
          <motion.div 
            key="simulation-quiz-group"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div id="daily-eco-quiz-section" className="bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-zinc-950 dark:to-zinc-900/40 border border-emerald-100/60 dark:border-zinc-800 p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-xs">
          {/* Decorative background orb */}
          <div className="absolute top-[-40px] right-[-40px] w-44 h-44 bg-emerald-400/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative z-10 pb-4 border-b border-zinc-200/40 dark:border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-2xl shadow-xs">
                <Lightbulb className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest font-black text-emerald-800 dark:text-emerald-400 block uppercase mb-0.5">Daily Eco-Quiz Challenge</span>
                <h3 className="text-xl font-bold font-serif text-emerald-950 dark:text-zinc-50">Test Your Green IQ</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {/* Daily completion status */}
              {quizLastAnsweredDate === new Date().toISOString().split('T')[0] ? (
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 py-1.5 px-3.5 rounded-full text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Daily Bonus Claimed (+10 XP)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 py-1.5 px-3.5 rounded-full text-xs font-black text-amber-850 dark:text-amber-400">
                  <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  <span>Solve for +10 XP</span>
                </span>
              )}

              {/* Reset/New Quiz trigger */}
              <button
                onClick={() => fetchNewQuizQuestion(true)}
                disabled={quizIsLoading}
                className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-zinc-150 dark:text-zinc-400 dark:hover:text-emerald-400 dark:hover:bg-zinc-800/80 rounded-full transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Question via Gemini"
              >
                <RefreshCw className={`w-4 h-4 ${quizIsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {quizIsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Consulting Gemini for a new ecological quiz topic...</p>
            </div>
          ) : quizQuestion ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
              
              {/* Question list (takes 7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-2">
                  <span className="inline-block bg-emerald-100 dark:bg-zinc-850 text-emerald-850 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                    Topic: {quizQuestion.topic}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {quizQuestion.question}
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {quizQuestion.options.map((option, idx) => {
                    // Determine styling based on state
                    let btnStyle = "bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-855 hover:border-emerald-300 dark:hover:border-emerald-700";
                    let prefixIcon = null;

                    if (quizSelectedIndex === idx) {
                      if (quizIsSubmitted) {
                        if (idx === quizQuestion.correctIndex) {
                          btnStyle = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-400 text-emerald-900 dark:text-emerald-200";
                          prefixIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
                        } else {
                          btnStyle = "bg-rose-50 dark:bg-rose-950/20 border-rose-500 dark:border-rose-400 text-rose-900 dark:text-rose-250";
                          prefixIcon = <XCircle className="w-5 h-5 text-rose-500" />;
                        }
                      } else {
                        btnStyle = "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500 dark:border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20";
                      }
                    } else if (quizIsSubmitted && idx === quizQuestion.correctIndex) {
                      btnStyle = "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-400 text-emerald-900 dark:text-emerald-200";
                      prefixIcon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                    }

                    return (
                      <button
                        key={idx}
                        disabled={quizIsSubmitted}
                        onClick={() => setQuizSelectedIndex(idx)}
                        className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition-all relative flex items-center justify-between gap-3 ${btnStyle} ${quizIsSubmitted ? '' : 'cursor-pointer active:scale-[0.98]'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center font-bold font-mono text-zinc-500 dark:text-zinc-400 shrink-0 select-none">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="leading-tight">{option}</span>
                        </div>
                        {prefixIcon}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    disabled={quizSelectedIndex === null || quizIsSubmitted}
                    onClick={handleQuizSubmit}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Submit Choice</span>
                  </button>

                  {quizIsSubmitted && (
                    <button
                      onClick={() => fetchNewQuizQuestion(true)}
                      className="px-5 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-350 rounded-full text-xs font-bold transition-all cursor-pointer"
                    >
                      Train Next Question
                    </button>
                  )}
                </div>
              </div>

              {/* Explanations block (takes 5 cols) */}
              <div className="lg:col-span-5 bg-zinc-100/50 dark:bg-zinc-900/60 border border-zinc-200/40 dark:border-zinc-800/50 rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3.5 border-b border-zinc-200/40 dark:border-zinc-800/60 pb-2">
                    <Info className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    <span className="text-xs uppercase font-black tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">Gemini Answer Feedback</span>
                  </div>

                  {quizSelectedIndex === null ? (
                    <div className="text-center py-6">
                      <HelpCircle className="w-10 h-10 text-zinc-400 dark:text-zinc-650 mx-auto mb-2.5" />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                        Tap any option above to read explanations provided by Gemini for each answer before locking in your choice!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 py-1 px-2.5 rounded border border-zinc-200/30">
                          Option {String.fromCharCode(65 + quizSelectedIndex)} explanation
                        </span>
                        {quizIsSubmitted && (
                          quizSelectedIndex === quizQuestion.correctIndex ? (
                            <span className="text-[10px] bg-emerald-150 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 rounded px-1.5 py-0.5 font-bold">CORRECT</span>
                          ) : (
                            <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 rounded px-1.5 py-0.5 font-bold">INCORRECT</span>
                          )
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed font-sans italic">
                        "{quizQuestion.explanations[quizSelectedIndex]}"
                      </p>

                      {quizIsSubmitted && quizSelectedIndex !== quizQuestion.correctIndex && (
                        <div className="mt-4 pt-3.5 border-t border-zinc-200/40 dark:border-zinc-800/60">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Correct Answer Scientific Truth:</span>
                          <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed font-sans bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                            <strong>{String.fromCharCode(65 + quizQuestion.correctIndex)}:</strong> "{quizQuestion.explanations[quizQuestion.correctIndex]}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-[10px] text-zinc-400 leading-normal flex items-start gap-1.5 pt-3 border-t border-zinc-200/40 dark:border-zinc-805/40">
                  <span className="text-emerald-500">✨</span>
                  <span>Keep practicing! Continuous environmental education helps optimize real-life carbon limit reductions.</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-6 text-xs text-zinc-500">Unresolved question status. Tap refresh to fetch the trivia.</div>
          )}
        </div>

          </motion.div>
        )}

        {/* 2. CHOICE-BASED LOGGING Comparisons + 3. ACTIVE CHALLENGES Block */}
        {activeTab === 'activities' && (
          <motion.div 
            key="activities-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div id="choices-challenges-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left: Interactive comparison logging choice-based cards (takes 7 columns) */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800/80 p-6 rounded-3xl shadow-sm space-y-6">
            
            <div className="border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50">Compare & Log Green Alternatives</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Eco-action gameplay: Pick low-impact alternatives over heavy emissions to instantly log savings.
              </p>
            </div>

            {/* Transport comparative options block */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400">
                <span>COMMUTE OPTIONS COMPARATIVE (5 Miles)</span>
                <span className="font-mono text-[10px] text-zinc-400">TAP ONE TO DECIDE & LOG</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option 1: Gasoline Drive */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'transport', 
                    '5-mile solo gasoline car commute', 
                    1.8, 
                    0, 
                    'Driving passenger sedans demands high gasoline oil combustion.'
                  )}
                  className="p-4 rounded-2xl text-left bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-800/60 flex flex-col justify-between hover:border-zinc-300 relative group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 group-hover:text-amber-600">Drive Solo</span>
                    <Car className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 1.8, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(1.8) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-lg font-black text-rose-600">1.8 kg</span>
                    <span className="text-[9px] font-mono font-bold text-zinc-400">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-rose-500 font-extrabold block mt-2">Highest Impact</span>
                </motion.button>

                {/* Option 2: Clean Public Bus */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'transport', 
                    'Eco bus clean commute (5 miles)', 
                    0.45, 
                    1.35, 
                    'Shared electrical municipal transit divides and slashes passenger footprints.'
                  )}
                  className="p-4 rounded-2xl text-left bg-[#edfcf1] dark:bg-emerald-950/20 border border-[#bbf7d0]/60 dark:border-emerald-800/50 flex flex-col justify-between hover:border-emerald-300 cursor-pointer relative group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-400">Take Bus</span>
                    <Globe className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 0.45, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(0.45) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-lg font-black text-[#10b981]">0.45 kg</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-600">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block mt-2">Saves +1.35 kg</span>
                </motion.button>

                {/* Option 3: Ride Bike / Walk */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'transport', 
                    'Pedaled bicycle or walked (5 miles)', 
                    0.0, 
                    1.8, 
                    'Human physical commute produces absolutely zero greenhouse emissions.'
                  )}
                  className="p-4 rounded-2xl text-left bg-emerald-600 dark:bg-emerald-900 border border-emerald-500/50 flex flex-col justify-between hover:scale-101 cursor-pointer transition-all relative group text-white shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black">Ride Bike</span>
                    <TreePine className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 0.05, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(0.0) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-xl font-extrabold text-[#a3e635]">0.0 kg</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-200">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-[#a3e635] font-black uppercase tracking-wider block mt-2">Saves +1.8 kg!</span>
                </motion.button>
              </div>
            </div>

            {/* Food comparative options block */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#f59e0b] dark:text-amber-400">
                <span>MEAL SELECTION COMPARATIVE (1 Serving)</span>
                <span className="font-mono text-[10px] text-zinc-400">TAP ONE TO DECIDE & LOG</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Beef Burger */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'food', 
                    'Eate delicious gourmet Beef Burger meal', 
                    5.8, 
                    0, 
                    'Livestock farming outputs severe carbon footprint per kg.'
                  )}
                  className="p-4 rounded-2xl text-left bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-800/60 flex flex-col justify-between hover:border-zinc-300 relative group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300">Beef Meal</span>
                    <span className="text-xs">🥩</span>
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 5.8, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(5.8) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-lg font-black text-rose-600">5.8 kg</span>
                    <span className="text-[9px] font-mono font-bold text-zinc-400">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-rose-500 font-extrabold block mt-2">Highest Impact</span>
                </motion.button>

                {/* Chicken Sandwich */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'food', 
                    'Chicken Breast Sandwich protein dinner', 
                    1.4, 
                    4.4, 
                    'Poultry emissions represent general safety guidelines relative compared to heavy red meat.'
                  )}
                  className="p-4 rounded-2xl text-left bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 flex flex-col justify-between hover:border-amber-300 cursor-pointer relative group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold text-amber-800 dark:text-amber-400">Poultry</span>
                    <span className="text-xs">🍗</span>
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 1.4, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(1.4) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-lg font-black text-amber-600">1.4 kg</span>
                    <span className="text-[9px] font-mono font-bold text-amber-500">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold block mt-2">Saves +4.4 kg</span>
                </motion.button>

                {/* Vegan Salad */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRecordChoice(
                    'food', 
                    'Organic plant Vegan Salad', 
                    0.35, 
                    5.45, 
                    'Swapping to plant-protein elements shaves 90% livestock methane equivalents.'
                  )}
                  className="p-4 rounded-2xl text-left bg-emerald-600 dark:bg-emerald-900 border border-emerald-500/50 flex flex-col justify-between hover:scale-101 cursor-pointer transition-all relative group text-white shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black text-white">Falafel Salad</span>
                    <span className="text-xs">🥗</span>
                  </div>
                  <div 
                    onMouseEnter={(e) => setHoveredEmission({ value: 0.35, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(0.35) })}
                    onMouseLeave={() => setHoveredEmission(null)}
                    className="mt-4 flex items-baseline gap-1"
                  >
                    <span className="text-xl font-extrabold text-[#a3e635]">0.35 kg</span>
                    <span className="text-[9px] font-mono font-bold text-emerald-200 font-black">CO₂e</span>
                  </div>
                  <span className="text-[9px] text-[#a3e635] font-black uppercase tracking-wider block mt-2">Saves +5.45 kg!</span>
                </motion.button>
              </div>
            </div>

          </div>

          {/* Right: Active Commitments challenges panel list (takes 5 columns) */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800/80 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50">Active Commitments Pledges</h3>
              </div>

              {activeChallenges.length === 0 ? (
                <div className="text-center py-8 px-4 bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <span className="text-xs font-semibold text-zinc-400 block mb-1">No Active Commitments Added</span>
                  <span className="text-[10px] text-zinc-500">Accept challenges from Gemini or suggestions below to track streak milestones.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeChallenges.map((challenge, index) => {
                    const pct = Math.min(100, Math.round((challenge.currentCount / challenge.targetCount) * 100));
                    return (
                      <div 
                        key={`${challenge.id}-${index}`} 
                        className={`p-3.5 rounded-2xl border ${challenge.completed ? 'bg-emerald-50/50 dark:bg-zinc-800/30 border-emerald-200' : 'bg-[#fafbfa] dark:bg-zinc-950/30 border-zinc-200/50 dark:border-zinc-800'}`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 block">{challenge.title}</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block trailing-tight leading-tight mt-0.5">{challenge.tip}</span>
                          </div>
                          <span className="text-[10px] tracking-wider uppercase font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                            +{challenge.xpReward} XP
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-300/10">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono font-bold text-zinc-500">
                              {challenge.currentCount} / {challenge.targetCount} days
                            </span>

                            {/* Self-progress trigger test helper button */}
                            {!challenge.completed && (
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleRecordChoice(
                                  challenge.category as any, 
                                  `Challenged self: ticked off item under ${challenge.title}!`,
                                  challenge.category === 'transport' ? 0.35 : 0.6,
                                  challenge.savingsPerAction,
                                  'User manually logged progress check toward commitments'
                                )}
                                className="p-1 rounded-md bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900 border border-emerald-300/30 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold cursor-pointer"
                                title="Check off one instance"
                              >
                                + Progress Log
                              </motion.button>
                            )}

                            {challenge.completed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Locked vs Unlocked Badge Shelf visual matrix */}
            <div className="mt-4 pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-mono font-black text-zinc-400 tracking-wider block mb-2">Unexplored Environmental Badges Shelf</span>
              
              <div className="grid grid-cols-6 gap-2">
                {badges.map((badge, idx) => (
                  <div
                    key={`${badge.id}-${idx}`}
                    className={`relative p-2 rounded-xl border flex flex-col items-center justify-center text-center cursor-help group transition-all ${
                      badge.unlocked 
                        ? 'bg-zinc-50 dark:bg-zinc-950/50 border-emerald-200/60 dark:border-emerald-800' 
                        : 'bg-zinc-100/50 dark:bg-zinc-950/20 border-zinc-200/20 opacity-40'
                    }`}
                  >
                    <span className="text-xl block filter select-none group-hover:scale-110 transition-transform">{badge.unlocked ? badge.icon : '🔒'}</span>
                    
                    {/* Tooltip detail hover details */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-zinc-900 text-white text-[10px] p-2 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 text-center shadow-md">
                      <span className="font-extrabold block text-green-400">{badge.title}</span>
                      <span className="block opacity-90">{badge.description}</span>
                      <span className="block font-mono text-[8px] text-amber-300 border-t border-zinc-700 mt-1 pt-1">Require: {badge.requirement}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

          </motion.div>
        )}

        {/* 4. INTERACTIVE WHAT-IF CARBON REDUCTION SIMULATOR */}
        {activeTab === 'simulation' && (
          <motion.div 
            key="simulation-simulator-group"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800/80 p-6 sm:p-8 rounded-3xl shadow-sm">
          
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#10b981]" />
              <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50">Interactive "What-If" CO₂ Simulator</h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Drag the sliders to see what hypothetical lifestyle swaps accomplish over a regular year cycle.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Sliders (take 7 columns) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Slider 1: Solo trips saved */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Replace standard car trips with cycling/walking</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{simulatorCarTrips} trips / week</span>
                </div>
                <input 
                  type="range" min="0" max="15" 
                  value={simulatorCarTrips} 
                  onChange={(e) => setSimulatorCarTrips(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-lg cursor-pointer border-none"
                />
                <span className="text-[10px] text-zinc-400 block">Saves ~2.4 kg CO₂ equivalent per trip.</span>
              </div>

              {/* Slider 2: Beef swaps */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Swap red beef meals with plant vegetarian protein meals</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{simulatorRedMeat} meals / week</span>
                </div>
                <input 
                  type="range" min="0" max="14" 
                  value={simulatorRedMeat} 
                  onChange={(e) => setSimulatorRedMeat(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-lg cursor-pointer border-none"
                />
                <span className="text-[10px] text-zinc-400 block">Saves ~5.4 kg CO₂ equivalent per meal.</span>
              </div>

              {/* Slider 3: Termostat energy smart metrics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Unplug vampire systems from wall slots</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{simulatorEcoEnergy} hours / week</span>
                </div>
                <input 
                  type="range" min="0" max="48" 
                  value={simulatorEcoEnergy} 
                  onChange={(e) => setSimulatorEcoEnergy(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-lg cursor-pointer border-none"
                />
                <span className="text-[10px] text-zinc-400 block">Saves ~0.85 kg CO₂ equivalent per active block.</span>
              </div>

            </div>

            {/* Projected Savings display (takes 5 columns) */}
            <div className="lg:col-span-4 bg-[#f2f7f2] dark:bg-zinc-950 border border-emerald-100/50 dark:border-zinc-800 p-6 rounded-3xl text-center space-y-4">
              
              <div>
                <span className="text-[11px] tracking-widest uppercase font-mono font-black text-emerald-600 dark:text-emerald-400 block">PROJECTED SAVINGS LIMIT</span>
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-emerald-950 dark:text-zinc-55 block mt-2">
                  -{whatIfSavings.weekly} kg
                </span>
                <span className="text-xs text-zinc-500 block">saved per week / {whatIfSavings.monthly} kg per month</span>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-emerald-100/50 dark:border-zinc-800/80 p-4 rounded-2xl text-left space-y-2">
                <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-zinc-400 block">Cumulative annual equivalent:</span>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <TreePine className="w-4 h-4 text-[#10b981]" />
                    <span>= Plant <span className="font-bold text-emerald-600 dark:text-emerald-400">{whatIfSavings.equivalentTreesPlantedYear} mature pine trees</span> limits</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Car className="w-4 h-4 text-amber-500" />
                    <span>= Shaving off <span className="font-bold text-amber-600">{whatIfSavings.equivalentPetrolCarKmsSaved} km</span> of car drive</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Dual Input Area: Gemini API Logging Input (Left) & Chart analysis (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left panel: Gemini dynamic query line parser (takes 7 columns) */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#10b981] animate-pulse" />
                <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50">Log Food or Commute with AI</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Write what you did in plain English. Gemini estimates emission equivalents contextually.
              </p>
            </div>

            <form onSubmit={handleAiParseText} className="space-y-3.5">
              <div className="relative">
                <textarea
                  value={freeInput}
                  onChange={(e) => setFreeInput(e.target.value)}
                  placeholder="e.g. 'I rode a bicycle for 12 miles to complete shopping errant errands today'"
                  rows={3}
                  className="w-full text-xs sm:text-sm bg-[#fafbfa] dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-zinc-400 resize-none text-zinc-800 dark:text-zinc-200"
                />
                {freeInput && (
                  <button 
                    type="button" 
                    onClick={() => setFreeInput('')}
                    className="absolute right-3 bottom-3 text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 py-1 px-2.5 rounded-lg border border-zinc-300/30 cursor-pointer"
                  >
                    Clear Input
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                
                {/* Seed trigger words */}
                <div className="text-[10px] text-zinc-400">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Example phrases: </span>
                  <button type="button" onClick={() => setFreeInput("Took local electrical city bus subway for 8 miles commute")} className="hover:underline hover:text-emerald-600 mx-1">"Take transit subway"</button> | 
                  <button type="button" onClick={() => setFreeInput("Opted for chicken Caesar salad over red beef burger")} className="hover:underline hover:text-emerald-600 mx-1">"Option salad"</button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isAnalyzing || !freeInput.trim()}
                  className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                    !freeInput.trim() 
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-450 cursor-not-allowed shadow-none' 
                      : 'bg-[#10b981] hover:bg-emerald-600 text-white shadow-md'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analysing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Evaluate Footprint</span>
                    </>
                  )}
                </motion.button>

              </div>
            </form>

            {/* Custom static inputs matrix if preferred */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
              <span className="text-[10px] uppercase font-mono font-black tracking-widest text-[#244225] dark:text-emerald-400 block mb-3">Quick Preset Log Additions</span>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleAddNewLog({ description: 'Organic vegetable garden shopping outlays', category: 'shopping', co2eKg: 0.5, source: 'quickadd' })}
                  className="p-2 text-center text-[10px] font-extrabold bg-[#f2faf3] dark:bg-zinc-950/60 hover:bg-[#e4f6e6] border border-emerald-300/20 text-emerald-800 dark:text-emerald-300 rounded-xl leading-snug cursor-pointer transition-colors"
                >
                  🥗 Eco Grocery
                  <span className="block font-mono text-[9px] text-zinc-400 font-bold mt-0.5">0.5 kg</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewLog({ description: 'Dishwasher heavy cycle sanitize system run', category: 'energy', co2eKg: 0.85, source: 'quickadd' })}
                  className="p-2 text-center text-[10px] font-extrabold bg-[#fbfbef] dark:bg-zinc-950/60 hover:bg-[#f8f8db] border border-yellow-300/20 text-yellow-800 dark:text-yellow-300 rounded-xl leading-snug cursor-pointer transition-colors"
                >
                  ⚡ Energy cycle
                  <span className="block font-mono text-[9px] text-zinc-400 font-bold mt-0.5">0.85 kg</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewLog({ description: 'Standby trickle device vampire energy offset', category: 'energy', co2eKg: -0.5, source: 'quickadd' })}
                  className="p-2 text-center text-[10px] font-extrabold bg-[#f0f4ff] dark:bg-zinc-950/60 hover:bg-[#e2ebff] border border-blue-300/20 text-blue-800 dark:text-blue-300 rounded-xl leading-snug cursor-pointer transition-colors"
                >
                  🔌 Vampire plug-out
                  <span className="block font-mono text-[9px] text-zinc-400 font-bold mt-0.5">-0.5 kg</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewLog({ description: 'Imported plastic item fast goods outfit', category: 'shopping', co2eKg: 8.5, source: 'quickadd' })}
                  className="p-2 text-center text-[10px] font-extrabold bg-[#fff1f2] dark:bg-zinc-950/60 hover:bg-[#ffe4e6] border border-rose-300/20 text-rose-800 dark:text-rose-300 rounded-xl leading-snug cursor-pointer transition-colors"
                >
                  🛍️ Synthetic Item
                  <span className="block font-mono text-[9px] text-zinc-400 font-bold mt-0.5">8.5 kg</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right panel: BarChart output visuals (takes 5 columns) */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50 mb-1">Carbon Breakdown (Past 7 Days)</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Total emissions categorised by physical activity source.</p>
            </div>

            <div className="h-60 w-full">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <span className="text-xs font-bold text-zinc-500">No Logs Listed Yet</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barchartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f4f0" />
                    <XAxis dataKey="name" stroke="#889b89" fontSize={9} tickLine={false} />
                    <YAxis stroke="#889b89" fontSize={9} tickLine={false} unit="kg" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff', borderRadius: '16px', border: '1px solid #d6e4d6', fontSize: '11px' }}
                      cursor={{ fill: isDarkMode ? '#1e293b' : '#eef5ee', opacity: 0.5 }}
                    />
                    <Legend verticalAlign="top" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '9px', paddingBottom: '10px' }} />
                    <Bar dataKey="Transport" stackId="a" fill="#10b981" />
                    <Bar dataKey="Food" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Energy" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Shopping" stackId="a" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Selected Country benchmark notes box */}
            {countryBenchmark && (
              <div className="mt-4 p-4 bg-emerald-50/50 dark:bg-zinc-950/60 border border-emerald-100/30 dark:border-zinc-800 rounded-2xl text-xs">
                <span className="font-extrabold text-emerald-950 dark:text-emerald-400 block mb-1">
                  🌐 Average citizen daily footprint in {selectedCountry}:
                </span>
                <p className="text-zinc-550 dark:text-zinc-400 leading-normal mb-2">{countryBenchmark.contextText}</p>
                <div className="inline-block px-3 py-1 bg-white dark:bg-zinc-900 border border-emerald-200/40 dark:border-zinc-800/80 rounded-xl font-bold text-[#10b981]">
                  Target Budget Cap Benchmark: {countryBenchmark.dailyAverageKg} kg / person per day
                </div>
              </div>
            )}

          </div>

        </div>

          </motion.div>
        )}

        {/* HEALTH & FITNESS TELEMETRY SYNC ENGINE */}
        {activeTab === 'healthSync' && (
          <motion.div 
            key="health-sync-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <HealthSync 
              logs={logs}
              onAddLog={handleAddNewLog}
              showNotification={showNotification}
              addXp={addXp}
              playGamificationSound={playGamificationSound}
            />
          </motion.div>
        )}

        {/* 5. GAI DECARBONIZE TIP ADVICE & COMMITTMENT ACCEPTER */}
        {activeTab === 'intelligence' && (
          <motion.div 
            key="intelligence-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div id="gai-tips-section" className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          
          <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-800 pb-4 mb-6 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-spin" />
                <h3 className="text-xl font-bold font-serif">Gemini AI Sustainable Action Tactics</h3>
              </div>
              <p className="text-xs text-emerald-300">
                Highly specific strategies mapped continuously from your personal activity footprint data. Accept a challenge to pledge!
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefreshAiInsights}
              disabled={isGeneratingTips}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              {isGeneratingTips ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>Rewrite Strategy Plans</span>
            </motion.button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {aiTips.map((tip, index) => (
              <div 
                key={`${tip.title}-${index}`}
                className="bg-emerald-900/60 border border-emerald-800 rounded-2xl p-5 flex flex-col justify-between hover:bg-emerald-900/80 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-extrabold text-white block">{tip.title}</span>
                    <span className="text-[10px] font-mono font-black text-[#a3e635] uppercase tracking-wider bg-emerald-950 px-2 py-0.5 rounded-md border border-[#a3e635]/20">
                      -{tip.estimatedSavings} kg CO₂
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 leading-relaxed mb-4">{tip.tip}</p>
                </div>

                <div className="space-y-4 pt-3.5 border-t border-emerald-800/80">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-black text-emerald-400 block tracking-wider">WHY THIS MATTERS</span>
                    <p className="text-[10px] text-emerald-200 block leading-tight mt-0.5">{tip.whyMatters}</p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleAcceptChallenge(tip)}
                    className="w-full py-2 bg-emerald-500 hover:bg-[#10b981] text-zinc-950 text-[10px] font-extrabold uppercase tracking-widest rounded-xl text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Accept Challenge</span>
                    <ArrowRight className="w-3 h-3 text-zinc-950" />
                  </motion.button>
                </div>
              </div>
            ))}
          </div>

        </div>

          </motion.div>
        )}

        {/* 6. HISTORY LOGS TRANSACTION LEDGER */}
        {activeTab === 'ledger' && (
          <motion.div 
            key="ledger-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 p-6 rounded-3xl shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold font-serif text-emerald-950 dark:text-zinc-50">Physical Emission History Ledger</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total list of logged carbon transactions recorded inside local storage.</p>
            </div>

            {/* Quick Filter buttons */}
            <div className="flex flex-wrap gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl self-start sm:self-center border border-zinc-200/50">
              {(['all', 'transport', 'food', 'energy', 'shopping'] as const).map(catName => (
                <button
                  key={catName}
                  onClick={() => setHistoryFilter(catName)}
                  className={`text-[10px] uppercase font-mono font-black px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                    historyFilter === catName 
                      ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                      : 'text-zinc-500 hover:text-zinc-800 hover:bg-white/40'
                  }`}
                >
                  {catName}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar helper */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search statements..."
              className="w-full text-xs sm:text-sm pl-10 pr-4 py-2.5 bg-[#fbfcfb] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none text-zinc-800 dark:text-zinc-200 rounded-xl focus:border-emerald-500"
            />
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <span className="text-xs font-semibold text-zinc-400 block">No matching history parameters found</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Change filter parameters or log a new action value above.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-zinc-150 dark:divide-zinc-800 pr-2">
                {paginatedLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="py-3.5 flex items-center justify-between gap-4 first:pt-1 last:pb-1 text-xs group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                        log.category === 'transport' ? 'bg-[#bbf7d0]/50 text-[#166534]' :
                        log.category === 'food' ? 'bg-[#fed7aa]/50 text-orange-700' :
                        log.category === 'energy' ? 'bg-[#fef08a]/50 text-yellow-800' : 'bg-[#e9d5ff]/50 text-purple-700'
                      }`}>
                        {log.category === 'transport' && <Car className="w-4 h-4" />}
                        {log.category === 'food' && <Utensils className="w-4 h-4" />}
                        {log.category === 'energy' && <Zap className="w-4 h-4" />}
                        {log.category === 'shopping' && <ShoppingBag className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-zinc-800 dark:text-zinc-100">{log.description}</span>
                          {log.avoidedKg && (
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md text-[9px] font-mono leading-none">
                              Saved +{log.avoidedKg} kg CO₂
                            </span>
                          )}
                          <span className="text-[8px] uppercase font-mono font-black tracking-widest text-zinc-400">
                            via {log.source}
                          </span>
                        </div>

                        {log.reasoning && (
                          <p className="text-[10px] text-zinc-400 block leading-tight mt-1">{log.reasoning}</p>
                        )}

                        <span className="text-[9px] font-mono font-semibold text-zinc-400 block mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5">
                      {/* Hover tooltip activator */}
                      <div 
                        onMouseEnter={(e) => setHoveredEmission({ value: log.co2eKg, x: e.clientX, y: e.clientY, text: getDynamicEquivalenceTooltip(log.co2eKg) })}
                        onMouseLeave={() => setHoveredEmission(null)}
                        className="text-right shrink-0 cursor-help"
                      >
                        <span className={`text-sm font-black block tracking-tight ${log.co2eKg < 0 ? 'text-[#10b981]' : 'text-zinc-800 dark:text-white'}`}>
                          {log.co2eKg > 0 ? '+' : ''}{log.co2eKg} kg
                        </span>
                        <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">CO₂e View</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteLogItem(log.id)}
                        className="text-zinc-400 hover:text-rose-600 transition-colors p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                        title="Remove Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination indicators and controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-150 dark:border-zinc-800 pt-4 mt-2 gap-4 text-xs">
                <div className="text-zinc-500 dark:text-zinc-400 font-medium text-center sm:text-left">
                  Showing <span className="font-bold text-zinc-800 dark:text-zinc-200">{Math.min(filteredLogs.length, (currentPage - 1) * ledgerPageSize + 1)}</span> to <span className="font-bold text-zinc-800 dark:text-zinc-200">{Math.min(filteredLogs.length, currentPage * ledgerPageSize)}</span> of <span className="font-extrabold text-[#10b981]">{filteredLogs.length}</span> logged actions
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setLedgerPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-150 dark:hover:bg-zinc-850 border border-zinc-250 dark:border-zinc-800 text-[10px] font-extrabold uppercase rounded-xl transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300"
                  >
                    ◀ Prev
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalLedgerPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      if (totalLedgerPages > 5 && Math.abs(pageNum - currentPage) > 1 && pageNum !== 1 && pageNum !== totalLedgerPages) {
                        if (pageNum === 2 || pageNum === totalLedgerPages - 1) {
                          return <span key={`dots-${pageNum}`} className="text-zinc-450 dark:text-zinc-500 font-mono text-[10px] px-1">..</span>;
                        }
                        return null;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setLedgerPage(pageNum)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            pageNum === currentPage
                              ? 'bg-emerald-500 text-zinc-950 font-black'
                              : 'text-zinc-550 dark:text-zinc-405 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={currentPage === totalLedgerPages}
                    onClick={() => setLedgerPage(prev => Math.min(totalLedgerPages, prev + 1))}
                    className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-150 dark:hover:bg-zinc-850 border border-zinc-250 dark:border-zinc-800 text-[10px] font-extrabold uppercase rounded-xl transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Real-World comparison panel summary box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 shrink-0">
              <TreePine className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Equivalent Green Cover</span>
              <p className="text-xs text-zinc-550 dark:text-zinc-300 leading-snug mt-1">
                Your week's footprint demand takes <span className="font-extrabold text-[#10b981]">{equivalences.treeAbsorptionDays} days</span> for a mature pine tree to absorb cleanly.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-zinc-950 flex items-center justify-center text-blue-500 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Phone Energy Cycles</span>
              <p className="text-xs text-zinc-550 dark:text-zinc-300 leading-snug mt-1">
                Equivalent to charging a standard modern smartphone <span className="font-extrabold text-blue-500">{equivalences.phoneCharges.toLocaleString()} times</span> from empty.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-500 shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Sedan Car Commute Range</span>
              <p className="text-xs text-zinc-550 dark:text-zinc-300 leading-snug mt-1">
                Equivalent to driving <span className="font-extrabold text-amber-600">{equivalences.carKm.toLocaleString()} kilometers</span> in a petroleum cylinder passenger sedan.
              </p>
            </div>
          </div>

        </div>

          </motion.div>
        )}

      </main>

      {/* Humble Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-emerald-100/40 dark:border-zinc-800 text-center text-xs text-zinc-400 block">
        <span className="block font-serif font-bold text-emerald-800 dark:text-emerald-400 mb-1">EcoTrack Decarbonisation Game System</span>
        <span>Empowering citizens to trace, challenge, and play their way to a sustainable footprint. Sourced scientifically.</span>
      </footer>

    </div>
  );
}
