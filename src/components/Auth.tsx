import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Leaf, Mail, Lock, User, Sparkles, ShieldCheck, Chrome, AlertCircle } from 'lucide-react';

interface AuthProps {
  onLoginSuccess: () => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('Please enter your name');
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Initialize user profile in Firestore
        const profileRef = doc(db, 'users', user.uid);
        await setDoc(profileRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: displayName,
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          carbonGoal: 450, // Default 450kg CO2 per month
          badges: ['first_step']
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication method is disabled under your Firebase project. Go to your Firebase Console -> Authentication -> Sign-in method, click "Add new provider", and select/enable "Email/Password".');
      } else if (err.code === 'auth/admin-restricted-operation') {
        setError('User creation is disabled or restricted in your Firebase project. Go to your Firebase Console under Authentication -> Settings (tab) -> User Actions and make sure "Enable create (sign-up)" is enabled.');
      } else {
        setError(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInGuest = async () => {
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      // Check if profile already exists
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          email: 'guest@carbofree.local',
          displayName: 'Guest Eco-Tracker',
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          carbonGoal: 450,
          badges: ['first_step']
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Anonymous guest login is disabled in your Firebase project. Go to your Firebase Console -> Authentication -> Sign-in method, click "Add new provider", and select/enable "Anonymous".');
      } else if (err.code === 'auth/admin-restricted-operation') {
        setError('User creation is disabled or restricted in your Firebase project. Go to your Firebase Console under Authentication -> Settings (tab) -> User Actions and make sure "Enable create (sign-up)" is enabled.');
      } else {
        setError('Guest login failed. Please connect to the internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if profile already exists
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Eco-Warrior',
          createdAt: new Date().toISOString(),
          xp: 0,
          level: 1,
          carbonGoal: 450,
          badges: ['first_step']
        });
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is disabled under your Firebase project. Go to your Firebase Console -> Authentication -> Sign-in method, click "Add new provider", and select/enable "Google".');
      } else if (err.code === 'auth/admin-restricted-operation') {
        setError('User creation is disabled or restricted in your Firebase project. Go to your Firebase Console under Authentication -> Settings (tab) -> User Actions and make sure "Enable create (sign-up)" is enabled.');
      } else {
        setError(err.message || 'Google account sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FBF8] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative Natural Blob Accents */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-[#4A6741] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
      <div className="absolute bottom-0 -right-4 w-72 h-72 bg-[#D4A373] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-75" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="p-2.5 bg-[#4A6741]/10 rounded-xl border border-[#4A6741]/20 text-[#4A6741]">
            <Leaf className="w-7 h-7" />
          </div>
          <span className="text-3xl font-serif font-bold text-[#4A6741]">Carbofree</span>
        </div>
        <h2 className="text-center text-xl font-serif font-semibold text-[#2D332C]">
          {isSignUp ? 'Begin your sustainability journey' : 'Understand, Track, and Reduce Your Carbon'}
        </h2>
        <p className="text-center text-xs text-[#5A6359] mt-2 max-w-sm mx-auto leading-relaxed px-4">
          {isSignUp ? 'Create your profile and start saving emissions' : 'Log daily actions, follow curated challenges, and view organic analytics'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-[#E0E7DE] sm:px-10">
          <form className="space-y-5" onSubmit={handleAuth}>
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-2.5">
                <div className="flex gap-2 text-xs font-semibold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>Authentication Setup Action Required</span>
                </div>
                {error.includes('admin-restricted-operation') || error.includes('locked') ? (
                  <div className="space-y-2 text-[11px] text-rose-950 font-sans leading-relaxed">
                    <p className="font-semibold text-rose-900 text-xs">
                      User creation is disabled (restricted by admin) in your Firebase settings:
                    </p>
                    <p className="font-normal text-rose-950">
                      To allow users/guests to create accounts or enter for the first time, follow these steps to enable user creation in your Firebase Console:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-rose-900 font-medium">
                      <li>Go to your <a href={`https://console.firebase.google.com/project/${auth.app.options.projectId || 'your-project-id'}/authentication/settings`} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[#4A6741]">Firebase Console Authentication Settings</a>.</li>
                      <li>Click on the <strong>Settings</strong> tab at the top.</li>
                      <li>Find and click the <strong>User actions</strong> section.</li>
                      <li>Check/enable the box that says <strong>Enable create (sign-up)</strong> (or "Allow users to sign up using email/password or other providers").</li>
                      <li>Click <strong>Save</strong> at the bottom.</li>
                    </ol>
                    <p className="mt-2 text-[10px] text-rose-700/80 font-mono italic">
                      Error details: {error}
                    </p>
                  </div>
                ) : error.includes('disabled') || error.includes('not-allowed') || error.includes('operation-not-allowed') ? (
                  <div className="space-y-2 text-[11px] text-rose-950 font-sans leading-relaxed">
                    <p className="font-semibold">
                      This entry option is currently disabled in your Firebase console. Follow these 3 easy steps to activate it:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-rose-900">
                      <li>Open your <a href={`https://console.firebase.google.com/project/${auth.app.options.projectId || 'your-project-id'}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-[#4A6741]">Firebase Console Authentication Settings</a>.</li>
                      <li>Click the <strong>Sign-in method</strong> tab.</li>
                      <li>Click <strong>Add new provider</strong>, then turn on:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          <li><strong>Email/Password</strong> (for account sign-ups)</li>
                          <li><strong>Anonymous</strong> (for guest sessions)</li>
                          <li><strong>Google</strong> (optional, for easy Google authentication)</li>
                        </ul>
                      </li>
                    </ol>
                    <p className="mt-2 text-[10px] text-rose-700/80 font-mono italic">
                      Error details: {error}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-750 font-mono leading-relaxed">{error}</p>
                )}
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6359]">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all sm:text-sm"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6359]">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all sm:text-sm"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D332C] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5A6359]">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-white border border-[#E0E7DE] rounded-xl text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-2 focus:ring-[#4A6741]/40 focus:border-transparent transition-all sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 flex justify-center items-center px-4 py-2 bg-[#4A6741] hover:bg-[#3F5737] text-white text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A6741]/40 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isSignUp ? (
                  'Create Hero Profile'
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#E0E7DE]"></div>
              <span className="flex-shrink mx-4 text-[#5A6359] text-[10px] uppercase font-bold tracking-widest">Or login instantly</span>
              <div className="flex-grow border-t border-[#E0E7DE]"></div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-white border border-[#E0E7DE] hover:bg-[#F9FBF8] text-[#2D332C] text-sm font-medium rounded-xl focus:outline-none transition-all cursor-pointer hover:border-[#4A6741]/40 gap-2 shadow-2xs"
              >
                <Chrome className="w-4 h-4 text-[#4A6741]" />
                <span>Sign in with Google (Recommended)</span>
              </button>

              <button
                type="button"
                onClick={signInGuest}
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-[#FDF6F0] border border-[#E0E7DE] hover:bg-[#F9FBF8] text-[#2D332C] text-sm font-medium rounded-xl focus:outline-none transition-all cursor-pointer hover:border-[#4A6741]/40 gap-2 shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-[#D4A373]" />
                <span>Explore as Guest (No signup required)</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-semibold text-[#4A6741] hover:text-[#3F5737] transition-colors cursor-pointer hover:underline"
            >
              {isSignUp ? 'Already on a quest? Sign in here' : "First time? Join the Quest — Sign up"}
            </button>
          </div>
        </div>
        
        <div className="mt-6 flex justify-center items-center gap-1.5 text-center text-[11px] text-[#5A6359] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#4A6741]/60" />
          <span>Secured state replication powered by Google Firebase Auth & Firestore</span>
        </div>
      </div>
    </div>
  );
}
