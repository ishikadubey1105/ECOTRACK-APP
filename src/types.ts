export type ActivityCategory = 'transport' | 'energy' | 'food' | 'waste';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  xp: number;
  level: number;
  carbonGoal: number; // monthly target in kg of CO2 equivalent
  badges: string[]; // Badge IDs
}

export interface CarbonLog {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  category: ActivityCategory;
  subCategory: string; // e.g., 'gasoline car', 'electricity', 'beef meals', 'recycling'
  value: number; // e.g., miles driven, kWh used, servings, kg of waste
  unit: string;
  co2Equivalent: number; // calculated emissions in kg of CO2e
  notes?: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  xpReward: number;
  co2Saved: number; // Estimated savings in kg CO2
  difficulty: 'easy' | 'medium' | 'hard';
  period: 'daily' | 'weekly';
  requirement: string; // Textual requirement
}

export interface UserChallenge {
  id: string;
  uid: string;
  challengeId: string;
  status: 'active' | 'completed';
  enrolledAt: string;
  completedAt?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface AiInsight {
  title: string;
  summary: string;
  co2ReductionTip: string;
  scoreExplanation: string;
  suggestedAction: string;
  dynamicFeedback?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  description: string;
  category: 'transport' | 'food' | 'energy' | 'shopping';
  co2eKg: number;
  source: 'manual' | 'quickadd' | 'choice';
  range?: string;
  reasoning?: string;
  avoidedKg?: number;
}

export interface AiTip {
  title: string;
  tip: string;
  whyMatters: string;
  estimatedSavings: number;
}

export interface ActiveChallenge {
  id: string;
  title: string;
  tip: string;
  targetCount: number;
  currentCount: number;
  savingsPerAction: number;
  xpReward: number;
  category: string;
}

export interface CountryBenchmark {
  country: string;
  dailyAverageKg: number;
  contextText: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanations: string[];
  topic: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'tip' | 'challenge' | 'general';
  timestamp: number;
  read: boolean;
}

