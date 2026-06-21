import { useState, useEffect } from 'react';
import { Challenge, UserChallenge, UserProfile, Badge } from '../types';
import { INSTANT_CHALLENGES, BADGES } from '../carbonData';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { playGamificationSound } from '../utils/audio';
import { 
  Trophy, Award, Zap, Compass, CheckCircle2, ShieldCheck,
  ZapOff, Star, Sparkles, Check, Play, Circle
} from 'lucide-react';

interface ChallengesProps {
  profile: UserProfile;
  xp: number;
  level: number;
  badges: string[];
  onXpChange: (newXp: number, newLevel: number, newBadges: string[]) => void;
}

export default function Challenges({ profile, xp, level, badges, onXpChange }: ChallengesProps) {
  const [enrolledChallenges, setEnrolledChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string>('');

  useEffect(() => {
    fetchUserChallenges();
  }, [profile.uid]);

  const fetchUserChallenges = async () => {
    try {
      const q = query(
        collection(db, 'userChallenges'),
        where('uid', '==', profile.uid)
      );
      const querySnap = await getDocs(q);
      const items: UserChallenge[] = [];
      querySnap.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          uid: d.uid,
          challengeId: d.challengeId,
          status: d.status,
          enrolledAt: d.enrolledAt,
          completedAt: d.completedAt
        });
      });
      setEnrolledChallenges(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (challengeId: string) => {
    setProcessingId(challengeId);
    try {
      const { currentUser } = auth;
      if (!currentUser) return;

      const enrollment = {
        uid: currentUser.uid,
        challengeId,
        status: 'active' as const,
        enrolledAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'userChallenges'), enrollment);
      
      setEnrolledChallenges(prev => [...prev, {
        id: docRef.id,
        ...enrollment
      }]);
    } catch (err) {
      console.error(err);
      alert("Failed to enroll in challenge.");
    } finally {
      setProcessingId('');
    }
  };

  const handleComplete = async (userChallengeId: string, challenge: Challenge) => {
    setProcessingId(challenge.id);
    try {
      const { currentUser } = auth;
      if (!currentUser) return;

      const compDate = new Date().toISOString();
      const ucRef = doc(db, 'userChallenges', userChallengeId);
      
      // Update Challenge state in DB
      await updateDoc(ucRef, {
        status: 'completed',
        completedAt: compDate
      });

      // Update Local list
      setEnrolledChallenges(prev => prev.map(uc => uc.id === userChallengeId ? {
        ...uc,
        status: 'completed' as const,
        completedAt: compDate
      } : uc));

      // XP reward calculation
      let newXp = xp + challenge.xpReward;
      let newLevel = level;
      let nextLevelReq = newLevel * 300;

      if (newXp >= nextLevelReq) {
        newXp = newXp - nextLevelReq;
        newLevel += 1;
      }

      // Badge check: "challenge_master" unlocked if completed 3 challenges
      const completedCount = enrolledChallenges.filter(uc => uc.status === 'completed').length + 1;
      const updatedBadges = [...badges];
      
      if (completedCount >= 3 && !updatedBadges.includes('challenge_master')) {
        updatedBadges.push('challenge_master');
      }
      
      if (newLevel >= 5 && !updatedBadges.includes('level_5')) {
        updatedBadges.push('level_5');
      }

      // Update profile
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        xp: newXp,
        level: newLevel,
        badges: updatedBadges
      });

      onXpChange(newXp, newLevel, updatedBadges);
      if (newLevel > level) {
        playGamificationSound('levelUp');
      } else {
        playGamificationSound('challenge');
      }
      alert(`Success! Challenge Completed. You earned +${challenge.xpReward} XP!`);

    } catch (err) {
      console.error(err);
      alert("Failed to complete challenge.");
    } finally {
      setProcessingId('');
    }
  };

  // Maps challenges and links with status
  const renderedChallenges = INSTANT_CHALLENGES.map(ch => {
    const enrollment = enrolledChallenges.find(ec => ec.challengeId === ch.id);
    return {
      challenge: ch,
      enrollment
    };
  });

  return (
    <div className="space-y-8">
      
      {/* Level and Rewards Metrics Card */}
      <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 shadow-xs">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#4A6741]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10">
          <div className="bg-[#FDF6F0] p-3.5 rounded-2xl border border-[#E0E7DE] text-[#D4A373]">
            <Trophy className="w-8 h-8 text-[#D4A373]" />
          </div>
          <div>
            <h3 className="text-base font-bold font-serif text-[#2D332C] flex items-center gap-2">
              Eco-Trophy Room
              <Sparkles className="w-4 h-4 text-[#D4A373]" />
            </h3>
            <p className="text-xs text-[#5A6359] mt-1 max-w-sm leading-relaxed">
              Enlist in weekly actions, lower greenhouse emissions, unlock premium badges, and scale your global climate warrior Level.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 z-10 flex-wrap justify-center">
          <div className="text-center">
            <span className="text-[9px] font-mono font-bold text-[#5A6359] uppercase tracking-wider block">LEVEL</span>
            <span className="text-2xl font-bold text-[#2D332C] font-mono">{level}</span>
          </div>
          <div className="h-8 border-r border-[#E0E7DE]" />
          <div className="text-center">
            <span className="text-[9px] font-mono font-bold text-[#5A6359] uppercase tracking-wider block">XP TOTAL</span>
            <span className="text-2xl font-bold text-[#2D332C] font-mono">{xp}</span>
          </div>
          <div className="h-8 border-r border-[#E0E7DE]" />
          <div className="text-center">
            <span className="text-[9px] font-mono font-bold text-[#5A6359] uppercase tracking-wider block">BADGES</span>
            <span className="text-2xl font-bold text-[#2D332C] font-mono">{badges.length}</span>
          </div>
        </div>
      </div>

      {/* Grid of Challenges */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-[#4A6741] font-mono uppercase tracking-widest px-1">Eco-Challenges Quest board</h3>
        
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-[#4A6741] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderedChallenges.map(({ challenge, enrollment }) => {
              const status = enrollment?.status;
              const isEnrolled = !!enrollment;
              const isCompleted = status === 'completed';

              return (
                <div 
                  key={challenge.id} 
                  className="border border-[#E0E7DE] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden bg-white hover:border-[#4A6741]/40 shadow-xs"
                >
                  {/* Category Accent Indicator */}
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#4A6741]" />
                  
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <span className="text-[9px] font-bold font-mono text-[#4A6741] bg-[#425d39]/10 border border-[#4A6741]/20 px-2 py-0.5 rounded-lg uppercase">
                          {challenge.category} ({challenge.difficulty})
                        </span>
                        <h4 className="text-base font-bold font-serif text-[#2D332C] mt-2.5">{challenge.title}</h4>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-[9px] text-[#5A6359] block font-bold font-mono">REWARD</span>
                        <span className="text-xs font-bold text-[#D4A373] font-mono">+{challenge.xpReward} XP</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#5A6359] leading-relaxed mb-4">{challenge.description}</p>
                    
                    <div className="p-3 bg-[#FDF6F0] rounded-xl border border-[#E0E7DE] mb-5">
                      <span className="text-[9px] font-mono font-bold text-[#5A6359] uppercase tracking-widest block mb-0.5">REQUIREMENT</span>
                      <p className="text-xs text-[#5A6359] leading-relaxed">{challenge.requirement}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#E0E7DE] pt-4 mt-auto">
                    <div className="flex items-center gap-1">
                      <div className="text-[#4A6741] text-xs font-bold font-mono flex items-center gap-1">
                        <span>CO2 Saved:</span>
                        <span>{challenge.co2Saved.toFixed(1)} kg</span>
                      </div>
                    </div>

                    <div>
                      {!isEnrolled ? (
                        <button
                          onClick={() => handleEnroll(challenge.id)}
                          disabled={processingId === challenge.id}
                          className="flex items-center gap-1.5 px-4 h-9 bg-white hover:bg-[#FDF6F0] border border-[#E0E7DE] hover:border-[#4A6741]/40 text-[#2D332C] text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          <Play className="w-3 h-3 text-[#4A6741]" />
                          <span>START QUEST</span>
                        </button>
                      ) : isCompleted ? (
                        <div className="flex items-center gap-1 px-3 py-1 bg-[#4A6741]/10 border border-[#4A6741]/20 text-[#4A6741] rounded-lg text-xs font-bold font-mono">
                          <Check className="w-3.5 h-3.5" />
                          <span>COMPLETED</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleComplete(enrollment.id, challenge)}
                          disabled={processingId === challenge.id}
                          className="flex items-center gap-1 px-4 h-9 bg-[#4A6741] hover:bg-[#3D5535] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-[#4A6741]/10"
                        >
                          {processingId === challenge.id ? (
                            <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>CLAIM COMPLETED</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Achievements Badges Showcase */}
      <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 shadow-xs">
        <h3 className="text-[10px] font-bold text-[#4A6741] font-mono uppercase tracking-widest mb-4">Aesthetic Badge collection</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {BADGES.map(badge => {
            const hasBadge = badges.includes(badge.id);
            
            return (
              <div 
                key={badge.id}
                className={`p-3.5 rounded-xl text-center transition-all duration-300 flex flex-col items-center relative border ${
                  hasBadge 
                    ? 'bg-[#FDF6F0] border-[#E0E7DE] text-[#2D332C] shadow-xs' 
                    : 'bg-white border-dashed border-[#E0E7DE]/80 text-[#5A6359]/70'
                }`}
              >
                {/* Rarity Spot Indicator */}
                {hasBadge && (
                  <span className={`h-1.5 w-1.5 rounded-full absolute top-2.5 right-2.5 ${
                    badge.rarity === 'legendary' ? 'bg-[#D4A373]' :
                    badge.rarity === 'epic' ? 'bg-indigo-400' :
                    badge.rarity === 'rare' ? 'bg-[#8BA888]' : 'bg-[#5A6359]'
                  }`} />
                )}

                <div className={`p-2.5 rounded-full mb-3.5 ${
                  hasBadge 
                    ? 'bg-[#4A6741]/10 border border-[#4A6741]/20 text-[#4A6741]' 
                    : 'bg-[#FDF6F0]/60 border border-[#E0E7DE]/40 text-[#5A6359]/30'
                }`}>
                  <Award className="w-6 h-6" />
                </div>
                
                <span className="text-xs font-semibold block text-[#2D332C]">{badge.name}</span>
                <span className="text-[9px] text-[#5A6359] block mt-1 leading-relaxed">
                  {badge.description}
                </span>

                <span className={`text-[8px] font-mono mt-2 uppercase font-bold tracking-widest ${
                  badge.rarity === 'legendary' ? 'text-[#D4A373]' :
                  badge.rarity === 'epic' ? 'text-indigo-500' :
                  badge.rarity === 'rare' ? 'text-[#8BA888]' : 'text-[#5A6359]'
                }`}>
                  {badge.rarity}
                </span>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
