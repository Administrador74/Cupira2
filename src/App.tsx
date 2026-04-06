/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CupiraApp v1.0.1 - Updated Pets Integration
 */

import React, { useState, useEffect, useRef, memo } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  deleteDoc,
  serverTimestamp,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  limit
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Post, Follow, Comment, Message, Conversation, Pet } from './types';
import { GoogleGenAI } from "@google/genai";
import { 
  LogOut, 
  User as UserIcon, 
  Search, 
  Home, 
  PlusCircle, 
  Camera, 
  Image as ImageIcon,
  Users,
  Trash2,
  ShieldCheck,
  Heart,
  MessageCircle,
  Send,
  X,
  Check,
  ArrowRight,
  MoreVertical,
  MessageSquare,
  ChevronLeft,
  Eye,
  EyeOff,
  Download,
  Bell,
  Gamepad2,
  Sparkles,
  ShoppingBag,
  Plus,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

function SuccessModal({ message, onAccept }: { message: string, onAccept: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center"
      >
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">{message}</h2>
        <p className="text-gray-500 mb-6 font-medium">¡Todo listo para conectar!</p>
        <button 
          onClick={onAccept}
          className="w-full bg-primary text-white py-3 rounded-xl font-black text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all"
        >
          ACEPTAR
        </button>
      </motion.div>
    </div>
  );
}

const Loading = () => (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
);

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Usamos setError si estamos en el componente App, pero como esta es una función externa,
  // al menos evitamos el alert intrusivo. El error se lanzará y podrá ser capturado.
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'register' | 'main' | 'profile' | 'search' | 'other-profile' | 'messages' | 'admin-messages' | 'users-list' | 'shop' | 'admin-users' | 'admin-pets' | 'games'>('login');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pets, setPets] = useState<Pet[]>([]);

  // --- Pets Logic ---
  useEffect(() => {
    const q = query(collection(db, 'pets'));
    const unsub = onSnapshot(q, (snap) => {
      const petsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pet));
      setPets(petsData.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      }));
    }, (error) => {
      // Silently handle or log if needed, but avoid crashing
      if (error.message.includes('permissions')) {
        console.warn("Waiting for permissions to fetch pets...");
      } else {
        console.error("Error fetching pets:", error);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const seedPets = async () => {
      if (user.email !== "yorman.osorio16@gmail.com") return;
      const q = query(collection(db, 'pets'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        console.log("Seeding initial pets...");
        for (const pet of PETS) {
          const { id, ...petData } = pet;
          await addDoc(collection(db, 'pets'), {
            ...petData,
            type: 'pet',
            createdAt: serverTimestamp()
          });
        }
      }
    };
    if (user) seedPets();
  }, [user]);

  // --- Theme Logic ---
  useEffect(() => {
    if (profile?.themeColor) {
      document.documentElement.style.setProperty('--primary-color', profile.themeColor);
    } else {
      document.documentElement.style.setProperty('--primary-color', '#ef4444'); // Default red-500
    }
  }, [profile?.themeColor]);

  const updateCoins = async (uid: string, amount: number) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentCoins = userSnap.data().coins || 0;
        await updateDoc(userRef, { coins: currentCoins + amount });
      }
    } catch (err) {
      console.error("Error updating coins:", err);
    }
  };

  const updateDiamonds = async (uid: string, amount: number) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentDiamonds = userSnap.data().diamonds || 0;
        await updateDoc(userRef, { diamonds: currentDiamonds + amount });
      }
    } catch (err) {
      console.error("Error updating diamonds:", err);
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Para instalar la app, usa el menú de tu navegador (Añadir a pantalla de inicio).");
    }
  };
  const [thanksMessage, setThanksMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingView, setPendingView] = useState<any>(null);

  // --- Notifications Hook ---
  useEffect(() => {
    if (!profile) return;

    // Solicitar permiso de notificaciones
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const startTime = Date.now();

    // 1. Notificaciones de Mensajes
    const qMsgs = query(
      collection(db, 'messages'),
      where('receiverId', '==', profile.uid),
      where('createdAt', '>=', new Date(startTime)),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubMsgs = onSnapshot(qMsgs, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data() as Message;
          // Solo notificar si el mensaje es nuevo (después de cargar la app)
          if (msg.createdAt && msg.createdAt.toMillis() > startTime) {
            if (Notification.permission === "granted") {
              new Notification("Nuevo Mensaje en Cupira", {
                body: msg.content || "📷 Foto",
                icon: "https://picsum.photos/seed/cupiraapp-red/192/192"
              });
            }
          }
        }
      });
    });

    // 2. Notificaciones de Publicaciones (de personas que sigues)
    const qFollows = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    const unsubFollows = onSnapshot(qFollows, (snapFollows) => {
      const followingIds = snapFollows.docs.map(d => d.data().followingId);
      if (followingIds.length === 0) return;

      const qPosts = query(
        collection(db, 'posts'),
        where('authorId', 'in', followingIds),
        where('createdAt', '>=', new Date(startTime)),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubPosts = onSnapshot(qPosts, (snapPosts) => {
        snapPosts.docChanges().forEach((change) => {
          if (change.type === "added") {
            const post = change.doc.data() as Post;
            if (post.createdAt && post.createdAt.toMillis() > startTime) {
              if (Notification.permission === "granted") {
                new Notification("Nueva Publicación", {
                  body: `${post.authorName} ha compartido algo nuevo.`,
                  icon: "https://picsum.photos/seed/cupiraapp-red/192/192"
                });
              }
            }
          }
        });
      });

      return () => unsubPosts();
    });

    return () => {
      unsubMsgs();
      unsubFollows();
    };
  }, [profile?.uid]);

  // Auth Listener
  useEffect(() => {
    console.log("Iniciando listener de autenticación...");
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("Estado de Auth cambiado:", u ? `Usuario: ${u.email}` : "Sin usuario");
      if (u) {
        setUser(u);
        // Listener en tiempo real para el perfil del usuario logueado
        unsubProfile = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as User;
            // Forzar rol de admin si el correo coincide, igual que en las reglas de seguridad
            if (u.email === 'yorman.osorio16@gmail.com') {
              profileData.role = 'admin';
            }
            console.log("Perfil actualizado en tiempo real:", profileData);
            setProfile(profileData);
            if ((view === 'login' || view === 'register') && !successMessage) {
              setView('main');
            }
          } else {
            console.warn("Perfil no encontrado para el UID:", u.uid);
            if (view === 'login' && !successMessage) {
              setError("No se encontró el perfil de usuario.");
              signOut(auth);
            }
          }
        }, (err) => {
          console.error("Error en listener de perfil:", err);
          setError("Error al conectar con el perfil: " + err.message);
        });
      } else {
        console.log("Usuario desconectado");
        if (unsubProfile) unsubProfile();
        setUser(null);
        setProfile(null);
        if (!thanksMessage && !successMessage && view !== 'register') {
          setView('login');
        }
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [thanksMessage, successMessage, view]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      const checkFollow = async () => {
        try {
          const adminQuery = query(collection(db, 'users'), where('email', '==', 'yorman.osorio16@gmail.com'));
          const adminSnap = await getDocs(adminQuery);
          if (!adminSnap.empty) {
            const adminUid = adminSnap.docs[0].id;
            const followQuery = query(
              collection(db, 'follows'), 
              where('followerId', '==', profile.uid),
              where('followingId', '==', adminUid)
            );
            const followSnap = await getDocs(followQuery);
            if (followSnap.empty) {
              await addDoc(collection(db, 'follows'), {
                followerId: profile.uid,
                followingId: adminUid
              });
              console.log("Auto-follow automático para usuario existente completado");
            }
          }
        } catch (err) {
          console.error("Error en auto-follow automático:", err);
        }
      };
      checkFollow();
    }
  }, [profile]);

  const handleLogout = async () => {
    await signOut(auth);
    setThanksMessage(true);
    setTimeout(() => {
      setThanksMessage(false);
      setView('login');
    }, 3000);
  };

  const handleAcceptSuccess = () => {
    if (pendingView) {
      setView(pendingView);
      setPendingView(null);
    }
    setSuccessMessage(null);
  };

  if (loading) return <Loading />;

  if (thanksMessage) {
    return (
      <div className="flex items-center justify-center h-screen bg-blue-600 text-white text-center p-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <h1 className="text-4xl font-bold mb-4">¡Gracias por usar CupiraApp 2.0!</h1>
          <p className="text-xl">Vuelve pronto.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-red-500 selection:text-white overflow-x-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 100, 0],
            y: [0, 50, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-red-600/10 blur-[120px] rounded-full"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            x: [0, -100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-pink-600/10 blur-[120px] rounded-full"
        />
      </div>

      <AnimatePresence>
        {error && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4">
            <motion.div 
              initial={{ y: -50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              className="bg-red-600 text-white p-5 rounded-[2rem] shadow-2xl shadow-red-600/20 flex items-center justify-between border border-red-500/50 backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1 rounded-lg"><X size={18} strokeWidth={3} /></div>
                <p className="font-black text-sm">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={20} strokeWidth={2.5} />
              </button>
            </motion.div>
          </div>
        )}
        
        {successMessage && (
          <SuccessModal message={successMessage} onAccept={handleAcceptSuccess} />
        )}
        
        {view === 'login' && (
          <Login 
            key="login-view" 
            setView={setView} 
            setSuccessMessage={setSuccessMessage} 
            setPendingView={setPendingView} 
          />
        )}
        
        {view === 'register' && (
          <Register 
            key="register-view" 
            setView={setView} 
            setSuccessMessage={setSuccessMessage} 
            setPendingView={setPendingView} 
          />
        )}
        
        {view !== 'login' && view !== 'register' && user && profile && (
          <div key="main-app" className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col md:flex-row gap-8">
            <Sidebar 
              setView={setView} 
              currentView={view} 
              onLogout={handleLogout} 
              isAdmin={profile.role === 'admin'} 
              onInstall={handleInstallApp}
              showInstall={!!deferredPrompt}
              profile={profile}
            />
            
            <main className="flex-1 md:ml-24 min-h-[calc(100vh-8rem)]">
              {/* Top Bar for Coins and Profile */}
              <div className="flex items-center justify-between mb-8 bg-zinc-900/40 backdrop-blur-xl p-4 rounded-[2rem] border border-white/5">
                <div className="flex items-center gap-4">
                  <img src={profile.photoURL} alt="avatar" className="w-10 h-10 rounded-xl border border-white/10 shadow-lg" />
                </div>
                
                <div className="flex flex-1 justify-end gap-3">
                  <div className="flex items-center gap-1.5 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
                      <span className="text-[8px] font-black text-zinc-900">F</span>
                    </div>
                    <span className="text-xs font-black text-white">{profile.coins || 0}</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-800/50 px-3 py-1.5 rounded-full border border-white/5">
                    <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <span className="text-[8px] font-black text-zinc-900">D</span>
                    </div>
                    <span className="text-xs font-black text-white">{profile.diamonds || 0}</span>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={view + (selectedUserId || '')}
                  initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {view === 'main' && <Feed profile={profile} updateCoins={updateCoins} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
                  {view === 'profile' && <ProfileView profile={profile} isOwn={true} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} onMessageClick={(uid) => setChatTargetId(uid)} setError={setError} setSuccessMessage={setSuccessMessage} />}
                  {view === 'search' && <SearchView profile={profile} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
                  {view === 'messages' && <MessagesView profile={profile} setView={setView} onChatSelect={(uid) => setChatTargetId(uid)} />}
                  {view === 'admin-messages' && <AdminMessagesView onChatSelect={(u1, u2) => setChatTargetId(`${u1}_${u2}`)} />}
                  {view === 'admin-users' && <AdminUsersView onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} setError={setError} setSuccessMessage={setSuccessMessage} />}
                  {view === 'admin-pets' && <AdminPetsView pets={pets} setError={setError} setSuccessMessage={setSuccessMessage} />}
                  {view === 'users-list' && <UsersListView onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
                  {view === 'shop' && <ShopView pets={pets} profile={profile} updateCoins={updateCoins} updateDiamonds={updateDiamonds} setError={setError} setSuccessMessage={setSuccessMessage} />}
                  {view === 'games' && <GamesView profile={profile} updateCoins={updateCoins} updateDiamonds={updateDiamonds} setError={setError} setSuccessMessage={setSuccessMessage} />}
                  {view === 'other-profile' && selectedUserId && (
                    <ProfileView 
                      profile={profile} 
                      isOwn={selectedUserId === profile.uid} 
                      targetUserId={selectedUserId} 
                      onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }}
                      onMessageClick={(uid) => setChatTargetId(uid)}
                      setError={setError}
                      setSuccessMessage={setSuccessMessage}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
              {profile.activePet && <PetDisplay pets={pets} petId={profile.activePet} />}
            </main>
            <AnimatePresence>
              {chatTargetId && profile && (
                <ChatWindow 
                  profile={profile} 
                  targetId={chatTargetId.includes('_') ? '' : chatTargetId} 
                  adminViewIds={chatTargetId.includes('_') ? { u1: chatTargetId.split('_')[0], u2: chatTargetId.split('_')[1] } : undefined}
                  onClose={() => setChatTargetId(null)} 
                  setError={setError}
                  updateCoins={updateCoins}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Auth Views ---

function Login({ setView, setSuccessMessage, setPendingView }: { setView: (v: any) => void, setSuccessMessage: (m: string) => void, setPendingView: (v: any) => void, key?: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Intentando iniciar sesión...");
    if (!email || !password) {
      setError("Por favor, completa todos los campos.");
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Autenticación exitosa para:", userCredential.user.email);
      setSuccessMessage("USUARIO VALIDADO");
      setPendingView("main");
    } catch (err: any) {
      console.error("Error en login:", err.code, err.message);
      let msg = 'Credenciales incorrectas.';
      if (err.code === 'auth/user-not-found') msg = 'El usuario no existe.';
      if (err.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
      if (err.code === 'auth/invalid-credential') msg = 'Correo o contraseña inválidos.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Ingresa tu correo arriba para restablecer la clave.");
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage("CORREO ENVIADO");
      setPendingView("login");
    } catch (err: any) {
      setError("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-900/20 to-black pointer-events-none"></div>
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-red-600/10 blur-[120px] rounded-full"
      />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/10"
      >
        <div className="text-center mb-10">
          <motion.div 
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.8 }}
            className="inline-block p-5 bg-gradient-to-br from-red-600 to-pink-600 rounded-[2rem] shadow-xl shadow-red-600/20 mb-6"
          >
            <Users className="text-white" size={40} strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">CUPIRA<span className="text-red-600">APP</span></h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Conectando a Cupira</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Correo Electrónico</label>
            <input 
              type="email" 
              className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Contraseña</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium pr-14"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-5 rounded-2xl font-black text-xl shadow-2xl shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>ENTRAR <ArrowRight size={22} strokeWidth={3} /></>
            )}
          </button>
          
          <button 
            type="button"
            onClick={handleResetPassword}
            className="w-full text-zinc-500 text-xs font-black hover:text-red-500 transition-colors uppercase tracking-widest"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-zinc-500 font-bold text-sm">
            ¿Eres nuevo aquí?{" "}
            <button onClick={() => setView('register')} className="text-red-500 font-black hover:underline ml-1">
              ÚNETE AHORA
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Register({ setView, setSuccessMessage, setPendingView }: { setView: (v: any) => void, setSuccessMessage: (m: string) => void, setPendingView: (v: any) => void, key?: any }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Intentando registrar usuario...");
    if (password.length < 8) {
      setError('La clave debe tener al menos 8 dígitos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const u = userCredential.user;
      console.log("Usuario creado en Auth:", u.email);
      
      const isAdmin = email === 'yorman.osorio16@gmail.com';

      await setDoc(doc(db, 'users', u.uid), {
        uid: u.uid,
        displayName: name,
        email: email,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
        coverURL: 'https://picsum.photos/seed/social/800/300',
        role: isAdmin ? 'admin' : 'user',
        gallery: [],
        location: '',
        status: ''
      });
      console.log("Documento de usuario creado en Firestore");
      
      // Auto-follow al administrador
      if (!isAdmin) {
        const adminQuery = query(collection(db, 'users'), where('email', '==', 'yorman.osorio16@gmail.com'));
        const adminSnap = await getDocs(adminQuery);
        if (!adminSnap.empty) {
          const adminUid = adminSnap.docs[0].id;
          await addDoc(collection(db, 'follows'), {
            followerId: u.uid,
            followingId: adminUid
          });
          console.log("Auto-follow al administrador completado");
        }
      }

      // IMPORTANTE: Primero el mensaje, luego el signout para evitar redirección prematura
      setSuccessMessage("REGISTRO EXITOSO");
      setPendingView("login");
      await signOut(auth);
      console.log("Cerrando sesión tras registro exitoso");
    } catch (err: any) {
      console.error("Error en registro:", err.code, err.message);
      let msg = 'Error al registrar. El correo podría estar en uso.';
      if (err.code === 'auth/email-already-in-use') msg = 'Este correo ya está registrado.';
      if (err.code === 'auth/weak-password') msg = 'La contraseña es muy débil.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-900/20 to-black pointer-events-none"></div>
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-zinc-900/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-white/10"
      >
        <div className="text-center mb-10">
          <motion.div 
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.8 }}
            className="inline-block p-5 bg-gradient-to-br from-red-600 to-pink-600 rounded-[2rem] shadow-xl shadow-red-600/20 mb-6"
          >
            <Users className="text-white" size={40} strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">CUPIRA<span className="text-red-600">APP</span></h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Únete a la manada</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Nombre Completo</label>
            <input 
              type="text" 
              className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Correo Electrónico</label>
            <input 
              type="email" 
              className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Contraseña</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium pr-14"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Confirmar Contraseña</label>
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-5 rounded-2xl font-black text-xl shadow-2xl shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>CREAR CUENTA <PlusCircle size={22} strokeWidth={3} /></>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-zinc-500 font-bold text-sm">
            ¿Ya tienes cuenta?{" "}
            <button onClick={() => setView('login')} className="text-red-500 font-black hover:underline ml-1">
              INICIA SESIÓN
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// --- Messaging ---

function MessagesView({ profile, onChatSelect, setView }: { profile: User, onChatSelect: (uid: string) => void, setView: (v: any) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const userCache = useRef<Map<string, User>>(new Map());

  const getUser = async (uid: string) => {
    if (userCache.current.has(uid)) return userCache.current.get(uid);
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      const userData = { ...docSnap.data() } as User;
      userCache.current.set(uid, userData);
      return userData;
    }
    return null;
  };

  useEffect(() => {
    const qConvs = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', profile.uid),
      orderBy('lastTimestamp', 'desc')
    );

    const unsubConvs = onSnapshot(qConvs, async (snapshot) => {
      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      
      const enriched = await Promise.all(convs.map(async (c) => {
        const otherId = c.participants.find(p => p !== profile.uid);
        if (!otherId) return null;
        const otherUser = await getUser(otherId);
        if (!otherUser) return null;
        return { ...c, otherUser };
      }));

      setConversations(enriched.filter((c): c is any => c !== null));
      setLoading(false);
    }, (error) => {
      console.error("Error en MessagesView (convs):", error);
      setLoading(false);
    });

    return () => unsubConvs();
  }, [profile.uid]);

  useEffect(() => {
    // Cargar Amigos (Seguidores Mutuos) que NO tienen conversación aún
    const qFollowing = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    const qFollowers = query(collection(db, 'follows'), where('followingId', '==', profile.uid));

    let followingIds: string[] = [];
    let followerIds: string[] = [];

    const updateFriends = async () => {
      const mutualIds = followingIds.filter(id => followerIds.includes(id));
      const existingChatUserIds = conversations.flatMap(c => c.participants).filter(id => id !== profile.uid);
      const potentialNewChatIds = mutualIds.filter(id => !existingChatUserIds.includes(id));

      if (potentialNewChatIds.length > 0) {
        const profiles = await Promise.all(
          potentialNewChatIds.map(async (id) => await getUser(id))
        );
        setFriends(profiles.filter((p): p is User => p !== null));
      } else {
        setFriends([]);
      }
    };

    const unsubFollowing = onSnapshot(qFollowing, (snap) => {
      followingIds = snap.docs.map(d => d.data().followingId);
      updateFriends();
    });

    const unsubFollowers = onSnapshot(qFollowers, (snap) => {
      followerIds = snap.docs.map(d => d.data().followerId);
      updateFriends();
    });

    return () => {
      unsubFollowing();
      unsubFollowers();
    };
  }, [profile.uid, conversations]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-12 pb-20">
      <div className="flex items-center justify-between mb-10 px-4">
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Mensajes</h1>
        <div className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/10">
          {conversations.length + friends.length} Contactos
        </div>
      </div>

      {/* Chats Activos */}
      {conversations.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] px-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            Chats Recientes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {conversations.map((conv) => (
              <motion.div
                key={conv.id}
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => onChatSelect(conv.otherUser.uid)}
                className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-2xl flex items-center gap-6 cursor-pointer group"
              >
                <div className="relative">
                  <img 
                    src={conv.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.otherUser.uid}`} 
                    className="w-20 h-20 rounded-[2rem] object-cover border-2 border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500"
                    alt="avatar"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-zinc-900 rounded-full"></div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-xl font-black text-white group-hover:text-red-500 transition-colors tracking-tight truncate">{conv.otherUser.displayName}</h3>
                  <p className="text-zinc-500 text-sm font-medium truncate mt-1 italic">"{conv.lastMessage}"</p>
                </div>
                <div className="bg-zinc-800 p-4 rounded-2xl text-zinc-600 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xl">
                  <ArrowRight size={24} strokeWidth={3} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Amigos para iniciar chat */}
      {friends.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em] px-4 flex items-center gap-3">
            <PlusCircle size={16} className="text-red-500" />
            Iniciar Nuevo Chat
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {friends.map((friend) => (
              <motion.div
                key={friend.uid}
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => onChatSelect(friend.uid)}
                className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-[3rem] border border-dashed border-white/10 shadow-xl flex items-center gap-6 cursor-pointer group"
              >
                <img 
                  src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} 
                  className="w-16 h-16 rounded-[1.5rem] object-cover border-2 border-white/5 opacity-70 group-hover:opacity-100 transition-all"
                  alt="friend"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-black text-zinc-300 group-hover:text-white transition-colors">{friend.displayName}</h3>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-1">¡Saluda ahora!</p>
                </div>
                <div className="p-4 text-zinc-700 group-hover:text-red-500 transition-colors">
                  <MessageSquare size={24} strokeWidth={3} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {conversations.length === 0 && friends.length === 0 && (
        <div className="bg-zinc-900/50 backdrop-blur-xl p-20 rounded-[4rem] text-center border border-white/5 shadow-2xl">
          <div className="w-32 h-32 bg-zinc-800 text-zinc-700 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Search size={64} strokeWidth={1} />
          </div>
          <h3 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">Busca a alguien</h3>
          <p className="text-zinc-500 max-w-sm mx-auto font-medium leading-relaxed italic mb-8">Usa la lupa para encontrar usuarios, entra en su perfil y pulsa "Mensaje".</p>
          <button 
            onClick={() => setView('search')}
            className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-red-600/20 hover:scale-105 transition-all"
          >
            Ir a Buscar
          </button>
        </div>
      )}

      {profile.role === 'admin' && (
        <div className="mt-12 pt-12 border-t border-white/5">
          <button 
            onClick={() => setView('admin-messages')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 p-8 rounded-[3rem] border border-white/10 flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="bg-red-600 p-5 rounded-2xl shadow-xl shadow-red-600/20 group-hover:scale-110 transition-transform">
                <ShieldCheck size={32} className="text-white" strokeWidth={3} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Supervisar Mensajes</h3>
                <p className="text-zinc-500 font-medium italic">Acceso administrativo a todas las conversaciones</p>
              </div>
            </div>
            <ArrowRight size={32} className="text-zinc-700 group-hover:text-red-500 group-hover:translate-x-2 transition-all" strokeWidth={3} />
          </button>

          <button 
            onClick={() => setView('admin-users')}
            className="w-full mt-6 bg-zinc-900 hover:bg-zinc-800 p-8 rounded-[3rem] border border-white/10 flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="bg-blue-600 p-5 rounded-2xl shadow-xl shadow-blue-600/20 group-hover:scale-110 transition-transform">
                <Users size={32} className="text-white" strokeWidth={3} />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gestión de Usuarios</h3>
                <p className="text-zinc-500 font-medium italic">Ver datos de acceso y perfiles de todos los usuarios</p>
              </div>
            </div>
            <ArrowRight size={32} className="text-zinc-700 group-hover:text-red-500 group-hover:translate-x-2 transition-all" strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

function AdminMessagesView({ onChatSelect }: { onChatSelect: (senderId: string, receiverId: string) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const userCache = useRef<Map<string, User>>(new Map());

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('lastTimestamp', 'desc'));
    
    const unsub = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setLoading(false);
        return;
      }

      const convs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      
      const getUser = async (uid: string) => {
        if (userCache.current.has(uid)) return userCache.current.get(uid);
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) {
          const userData = { ...docSnap.data() } as User;
          userCache.current.set(uid, userData);
          return userData;
        }
        return null;
      };

      const enriched = await Promise.all(convs.map(async (c) => {
        const [u1, u2] = await Promise.all([
          getUser(c.participants[0]),
          getUser(c.participants[1])
        ]);
        if (!u1 || !u2) return null;
        return { ...c, user1: u1, user2: u2 };
      }));

      setConversations(enriched.filter((c): c is any => c !== null));
      setLoading(false);
    }, (error) => {
      console.error("Error en AdminMessagesView:", error);
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      
      const pairs = new Map();
      
      // Migrar mensajes individuales para añadir conversationId y recolectar info de conversaciones
      for (const messageDoc of snap.docs) {
        const m = messageDoc.data();
        const convId = [m.senderId, m.receiverId].sort().join('_');
        
        // Actualizar mensaje si no tiene conversationId
        if (!m.conversationId) {
          await updateDoc(doc(db, 'messages', messageDoc.id), {
            conversationId: convId
          });
        }

        if (!pairs.has(convId)) {
          pairs.set(convId, {
            participants: [m.senderId, m.receiverId],
            lastMessage: m.content,
            lastTimestamp: m.createdAt
          });
        }
      }

      // Crear/Actualizar documentos de conversación
      for (const [id, data] of pairs.entries()) {
        await setDoc(doc(db, 'conversations', id), data, { merge: true });
      }
      alert("Migración y sincronización completada con éxito");
    } catch (err) {
      console.error("Error en migración:", err);
      alert("Error en migración");
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex flex-col">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Supervisión</h1>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-1">Archivo Maestro de Chats</p>
        </div>
        <div className="flex items-center gap-3">
          {conversations.length === 0 && (
            <button 
              onClick={handleMigrate}
              disabled={migrating}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/5 disabled:opacity-50"
            >
              {migrating ? 'Migrando...' : 'Sincronizar'}
            </button>
          )}
          <div className="bg-red-600/20 text-red-500 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-500/10">
            {conversations.length} Chats
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {conversations.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ scale: 1.01, x: 5 }}
            onClick={() => onChatSelect(c.participants[0], c.participants[1])}
            className="bg-zinc-900/80 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 shadow-2xl flex items-center gap-5 cursor-pointer group"
          >
            <div className="flex -space-x-4 relative">
              <img src={c.user1?.photoURL} className="w-12 h-12 rounded-xl border-2 border-zinc-900 shadow-xl z-10" alt="u1" />
              <img src={c.user2?.photoURL} className="w-12 h-12 rounded-xl border-2 border-zinc-900 shadow-xl" alt="u2" />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="text-sm font-black text-white group-hover:text-red-500 transition-colors truncate">
                {c.user1?.displayName} ↔ {c.user2?.displayName}
              </h3>
              <p className="text-zinc-500 text-[11px] font-medium mt-0.5 truncate max-w-md italic">"{c.lastMessage}"</p>
            </div>
            <div className="bg-zinc-800 p-3 rounded-xl text-zinc-600 group-hover:bg-red-600 group-hover:text-white transition-all">
              <Eye size={18} strokeWidth={3} />
            </div>
          </motion.div>
        ))}
        {conversations.length === 0 && !migrating && (
          <div className="text-center py-20 bg-zinc-900/50 rounded-[3rem] border border-white/5">
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No se encontraron conversaciones activas.</p>
            <button onClick={handleMigrate} className="mt-6 text-red-500 font-black hover:underline uppercase tracking-widest text-xs">Sincronizar desde mensajes antiguos</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatWindow({ profile, targetId, onClose, setError, adminViewIds, updateCoins }: { profile: User, targetId: string, onClose: () => void, setError: (m: string) => void, adminViewIds?: { u1: string, u2: string }, updateCoins: (uid: string, amount: number) => Promise<void> }) {
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [adminUser1, setAdminUser1] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGameMode, setIsGameMode] = useState(false);
  const [isGeneratingGame, setIsGeneratingGame] = useState(false);
  const [gameState, setGameState] = useState<{ type: 'riddle' | 'number', data: any } | null>(null);

  const generateGamePrompt = async () => {
    if (!targetUser) return;
    setIsGeneratingGame(true);
    
    // Local games list
    const localGameTypes = ['number', 'math', 'duel'];
    const useAI = Math.random() > 0.6; // 40% chance for AI if key is available
    
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || (window as any).API_KEY;
      
      if (!apiKey || apiKey === "" || !useAI) {
        // Fallback to local games
        const gameType = localGameTypes[Math.floor(Math.random() * localGameTypes.length)];
        
        if (gameType === 'number') {
          const targetNum = Math.floor(Math.random() * 20) + 1;
          setGameState({ type: 'number', data: { target: targetNum, attempts: 0 } });
          const challenge = `🎮 JUEGO EN PAREJA: @${profile.displayName} vs @${targetUser.displayName}. ¡Adivina el número del 1 al 20! El ganador obtiene 20 CupiraCoins y el otro los PIERDE. Tienes 3 intentos.`;
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: challenge,
            createdAt: serverTimestamp(),
            read: true
          });
        } else if (gameType === 'math') {
          const a = Math.floor(Math.random() * 50) + 1;
          const b = Math.floor(Math.random() * 50) + 1;
          const op = Math.random() > 0.5 ? '+' : '-';
          const result = op === '+' ? a + b : a - b;
          setGameState({ type: 'math', data: { answer: result, attempts: 0 } });
          const challenge = `🎮 RETO MATEMÁTICO: @${profile.displayName} vs @${targetUser.displayName}. ¿Cuánto es ${a} ${op} ${b}? Gana 20 CupiraCoins y el oponente los PIERDE. Tienes 2 intentos.`;
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: challenge,
            createdAt: serverTimestamp(),
            read: true
          });
        } else if (gameType === 'duel') {
          const duels = [
            { q: "¿Cuál es la capital de Francia?", a: "Paris" },
            { q: "¿Cuántos continentes hay?", a: "7" },
            { q: "¿Color del cielo despejado?", a: "Azul" },
            { q: "¿Animal que dice miau?", a: "Gato" }
          ];
          const duel = duels[Math.floor(Math.random() * duels.length)];
          setGameState({ type: 'duel', data: { ...duel, attempts: 0 } });
          const challenge = `⚔️ DUELO EN PAREJA: @${profile.displayName} vs @${targetUser.displayName}. El primero en responder correctamente gana 20 CupiraCoins y el otro los PIERDE. Pregunta: ${duel.q}`;
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: challenge,
            createdAt: serverTimestamp(),
            read: true
          });
        }
        setIsGeneratingGame(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Eres el Maestro de Juegos de CUPIRAAPP. Genera una pregunta de cultura general MUY CORTA para un duelo entre dos personas. Responde con un JSON: {"question": "texto de la pregunta", "answer": "respuesta corta"}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { 
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "{}";
      const gameData = JSON.parse(text);
      setGameState({ type: 'duel', data: { ...gameData, attempts: 0 } });
      const challenge = `⚔️ DUELO IA: El primero en responder correctamente gana 20 CupiraCoins y el otro los PIERDE. Pregunta: ${gameData.question}`;
      await addDoc(collection(db, 'messages'), {
        senderId: 'system',
        receiverId: 'all',
        conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
        content: challenge,
        createdAt: serverTimestamp(),
        read: true
      });
    } catch (err: any) {
      console.error("Error generating game:", err);
      // If AI fails, fallback to a local game instead of error
      const targetNum = Math.floor(Math.random() * 10) + 1;
      setGameState({ type: 'number', data: { target: targetNum, attempts: 0 } });
      const challenge = `🎮 JUEGO EN PAREJA: @${profile.displayName} vs @${targetUser.displayName}. ¡Adivina el número del 1 al 10! Gana 20 CupiraCoins y el otro los PIERDE.`;
      await addDoc(collection(db, 'messages'), {
        senderId: 'system',
        receiverId: 'all',
        conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
        content: challenge,
        createdAt: serverTimestamp(),
        read: true
      });
    } finally {
      setIsGeneratingGame(false);
    }
  };

  const checkGameAnswer = async (text: string, senderUid: string) => {
    if (!gameState) return;

    if (gameState.type === 'number') {
      const userGuess = parseInt(text.trim());
      if (userGuess === gameState.data.target) {
        const winnerName = senderUid === profile.uid ? profile.displayName : targetUser!.displayName;
        const loserUid = senderUid === profile.uid ? targetUser!.uid : profile.uid;
        await updateCoins(senderUid, 20);
        await updateCoins(loserUid, -20);
        setGameState(null);
        await addDoc(collection(db, 'messages'), {
          senderId: 'system',
          receiverId: 'all',
          conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
          content: `🎉 ¡VICTORIA! El número era ${gameState.data.target}. @${winnerName} ha ganado 20 CupiraCoins y el oponente los pierde.`,
          createdAt: serverTimestamp(),
          read: true
        });
      } else {
        const newAttempts = gameState.data.attempts + 1;
        if (newAttempts >= 3) {
          setGameState(null);
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: `💀 DERROTA: Nadie adivinó el número ${gameState.data.target}. Se acabaron los intentos.`,
            createdAt: serverTimestamp(),
            read: true
          });
        } else {
          setGameState({ ...gameState, data: { ...gameState.data, attempts: newAttempts } });
        }
      }
    } else if (gameState.type === 'math') {
      const userGuess = parseInt(text.trim());
      if (userGuess === gameState.data.answer) {
        const winnerName = senderUid === profile.uid ? profile.displayName : targetUser!.displayName;
        const loserUid = senderUid === profile.uid ? targetUser!.uid : profile.uid;
        await updateCoins(senderUid, 20);
        await updateCoins(loserUid, -20);
        setGameState(null);
        await addDoc(collection(db, 'messages'), {
          senderId: 'system',
          receiverId: 'all',
          conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
          content: `🧮 ¡GENIO! La respuesta era ${gameState.data.answer}. @${winnerName} ha ganado 20 CupiraCoins y el oponente los pierde.`,
          createdAt: serverTimestamp(),
          read: true
        });
      } else {
        const newAttempts = gameState.data.attempts + 1;
        if (newAttempts >= 2) {
          setGameState(null);
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: `💀 FALLO MATEMÁTICO: La respuesta era ${gameState.data.answer}. Se acabaron los intentos.`,
            createdAt: serverTimestamp(),
            read: true
          });
        } else {
          setGameState({ ...gameState, data: { ...gameState.data, attempts: newAttempts } });
        }
      }
    } else if (gameState.type === 'riddle') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || (window as any).API_KEY;
      if (!apiKey || apiKey === "") {
        setError("Error de API Key en el Maestro de Juegos.");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const checkResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `El acertijo era: "${gameState.data.riddle}". La respuesta correcta es: "${gameState.data.answer}". El usuario dijo: "${text}". ¿Es correcto? Responde solo SI o NO.` }] }],
      });

      if (checkResponse.text?.toUpperCase().includes('SI')) {
        const winnerName = senderUid === profile.uid ? profile.displayName : targetUser!.displayName;
        const loserUid = senderUid === profile.uid ? targetUser!.uid : profile.uid;
        await updateCoins(senderUid, 20);
        await updateCoins(loserUid, -20);
        setGameState(null);
        await addDoc(collection(db, 'messages'), {
          senderId: 'system',
          receiverId: 'all',
          conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
          content: `🎉 ¡GENIO! La respuesta era "${gameState.data.answer}". @${winnerName} ha ganado 20 CupiraCoins y el oponente los pierde.`,
          createdAt: serverTimestamp(),
          read: true
        });
      } else {
        const newAttempts = gameState.data.attempts + 1;
        if (newAttempts >= 2) {
          setGameState(null);
          await addDoc(collection(db, 'messages'), {
            senderId: 'system',
            receiverId: 'all',
            conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
            content: `💀 DERROTA: Fallaron el acertijo. La respuesta era "${gameState.data.answer}".`,
            createdAt: serverTimestamp(),
            read: true
          });
        } else {
          setGameState({ ...gameState, data: { ...gameState.data, attempts: newAttempts } });
        }
      }
    } else if (gameState.type === 'duel') {
      const isCorrect = text.toLowerCase().trim() === gameState.data.answer.toLowerCase().trim();
      if (isCorrect) {
        const winnerName = senderUid === profile.uid ? profile.displayName : targetUser!.displayName;
        const loserUid = senderUid === profile.uid ? targetUser!.uid : profile.uid;
        await updateCoins(senderUid, 20);
        await updateCoins(loserUid, -20);
        setGameState(null);
        await addDoc(collection(db, 'messages'), {
          senderId: 'system',
          receiverId: 'all',
          conversationId: [effectiveProfileId, effectiveTargetId].sort().join('_'),
          content: `🏆 ¡DUELO FINALIZADO! @${winnerName} respondió correctamente. Gana 20 CupiraCoins y el oponente los pierde.`,
          createdAt: serverTimestamp(),
          read: true
        });
      } else {
        // Penalizar por fallar en duelo para evitar spam
        await updateCoins(senderUid, -5);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: messages.length < 10 ? 'auto' : 'smooth' });
      }, 300);
    }
  }, [messages]);

  const effectiveProfileId = adminViewIds ? adminViewIds.u1 : profile.uid;
  const effectiveTargetId = adminViewIds ? adminViewIds.u2 : targetId;

  useEffect(() => {
    const fetchTarget = async () => {
      const userDoc = await getDoc(doc(db, 'users', effectiveTargetId));
      if (userDoc.exists()) setTargetUser({ id: userDoc.id, ...userDoc.data() } as any);
      
      if (adminViewIds) {
        const user1Doc = await getDoc(doc(db, 'users', adminViewIds.u1));
        if (user1Doc.exists()) setAdminUser1({ id: user1Doc.id, ...user1Doc.data() } as any);
      }
    };
    fetchTarget();

    const convId = [effectiveProfileId, effectiveTargetId].sort().join('_');

    // Consultas para asegurar compatibilidad total
    const qById = query(
      collection(db, 'messages'),
      where('conversationId', '==', convId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const qSent = query(
      collection(db, 'messages'),
      where('senderId', '==', effectiveProfileId),
      where('receiverId', '==', effectiveTargetId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const qReceived = query(
      collection(db, 'messages'),
      where('senderId', '==', effectiveTargetId),
      where('receiverId', '==', effectiveProfileId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const updateMessages = (d1: any[], d2: any[], d3: any[]) => {
      const uniqueMsgs = new Map();
      [...d1, ...d2, ...d3].forEach(d => {
        if (!uniqueMsgs.has(d.id)) {
          uniqueMsgs.set(d.id, { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Message);
        }
      });

      const sorted = Array.from(uniqueMsgs.values())
        .sort((a, b) => {
          const tA = a.createdAt?.toMillis?.() || 0;
          const tB = b.createdAt?.toMillis?.() || 0;
          return tA - tB;
        });
      
      setMessages(sorted);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: sorted.length < 10 ? 'auto' : 'smooth' }), 300);
    };

    let d1: any[] = [], d2: any[] = [], d3: any[] = [];
    const unsub1 = onSnapshot(qById, (s) => { d1 = s.docs; updateMessages(d1, d2, d3); });
    const unsub2 = onSnapshot(qSent, (s) => { d2 = s.docs; updateMessages(d1, d2, d3); });
    const unsub3 = onSnapshot(qReceived, (s) => { d3 = s.docs; updateMessages(d1, d2, d3); });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [effectiveProfileId, effectiveTargetId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (máximo 1MB para base64 en Firestore)
    if (file.size > 700 * 1024) {
      setError("La imagen es demasiado grande para el chat. El límite es 700KB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const convId = [effectiveProfileId, effectiveTargetId].sort().join('_');
        await addDoc(collection(db, 'messages'), {
          senderId: profile.uid,
          receiverId: adminViewIds ? effectiveTargetId : targetId,
          conversationId: convId,
          content: '',
          imageURL: base64String,
          createdAt: serverTimestamp(),
          read: false,
          deletedByAdmin: false
        });

        await setDoc(doc(db, 'conversations', convId), {
          participants: [effectiveProfileId, effectiveTargetId],
          lastMessage: '📷 Foto',
          lastTimestamp: serverTimestamp(),
        }, { merge: true });

        setIsUploading(false);
      } catch (err: any) {
        setError("Error al enviar imagen: " + err.message);
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const msgContent = newMessage.trim();
      const convId = [effectiveProfileId, effectiveTargetId].sort().join('_');
      
      await addDoc(collection(db, 'messages'), {
        senderId: profile.uid,
        receiverId: adminViewIds ? effectiveTargetId : targetId, // En modo admin, enviamos al "objetivo" de la vista
        conversationId: convId,
        content: msgContent,
        createdAt: serverTimestamp(),
        read: false,
        deletedByAdmin: false
      });

      // Actualizar o crear la conversación para acceso rápido
      await setDoc(doc(db, 'conversations', convId), {
        participants: [effectiveProfileId, effectiveTargetId],
        lastMessage: msgContent,
        lastTimestamp: serverTimestamp(),
      }, { merge: true });

      // Verificar respuesta de juego si está activo
      if (isGameMode && gameState) {
        await checkGameAnswer(msgContent, profile.uid);
      }

      console.log("Mensaje enviado con éxito");
      setNewMessage('');
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError("Error al enviar mensaje: " + err.message);
    }
  };

  if (!targetUser) return null;

  return (
    <motion.div 
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      className="fixed inset-0 md:inset-auto md:right-10 md:bottom-10 md:w-[450px] md:h-[750px] bg-zinc-950 md:rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border-t md:border border-white/10 flex flex-col z-[100] overflow-hidden"
    >
      {/* Header */}
      <div className={`p-6 md:p-8 ${isGameMode ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-zinc-900'} border-b border-white/5 flex items-center justify-between transition-colors duration-500`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={targetUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.uid}`} 
              alt={targetUser.displayName}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white/10 shadow-2xl"
            />
            {adminViewIds && (
              <div className="absolute -top-2 -left-2 w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center border-2 border-zinc-900 shadow-xl">
                <ShieldCheck size={16} className="text-white" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-zinc-900 rounded-full"></div>
          </div>
          <div>
            <h3 className="font-black text-white text-lg tracking-tight leading-none">
              {adminViewIds ? `${adminUser1?.displayName} & ${targetUser.displayName}` : targetUser.displayName}
            </h3>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 block ${isGameMode ? 'text-purple-200' : (adminViewIds ? 'text-blue-500' : 'text-green-500')}`}>
              {isGameMode ? 'Modo Juego Activo' : (adminViewIds ? 'Supervisando Chat' : 'En línea')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!adminViewIds && (
            <button 
              onClick={() => setIsGameMode(!isGameMode)}
              className={`p-3 rounded-2xl transition-all ${isGameMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Modo Juego IA"
            >
              <Gamepad2 size={20} strokeWidth={2.5} />
            </button>
          )}
          <button onClick={onClose} className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white">
            <X size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Game Mode Overlay */}
      <AnimatePresence>
        {isGameMode && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-purple-600/20 border-b border-purple-500/30 p-5 flex flex-col gap-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="text-purple-400 animate-pulse" size={18} />
                <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest">Maestro de Juegos IA</p>
              </div>
              <button 
                onClick={generateGamePrompt}
                disabled={isGeneratingGame}
                className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
              >
                {isGeneratingGame ? 'Generando...' : 'Nuevo Reto'}
              </button>
            </div>
            
            {gameState && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple-900/40 p-4 rounded-2xl border border-purple-500/20"
              >
                <p className="text-xs font-bold text-purple-100 leading-relaxed">
                  {gameState.type === 'riddle' ? `🧩 ACERTIJO: ${gameState.data.riddle}` : 
                   gameState.type === 'number' ? `🔢 ADIVINA: El número está entre 1 y ${gameState.data.target > 10 ? '20' : '10'}.` :
                   gameState.type === 'duel' ? `⚔️ DUELO: ${gameState.data.question}` :
                   `🧮 MATEMÁTICAS: Resuelve el reto enviado al chat.`}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">
                    {gameState.type === 'duel' ? '¡Responde rápido!' : `Intentos: ${gameState.data.attempts}`}
                  </span>
                  <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
                    {gameState.type === 'duel' ? '20 Coins' : (gameState.type === 'riddle' ? '200 Coins' : gameState.type === 'number' ? '100 Coins' : '150 Coins')}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 bg-zinc-950/50 custom-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === profile.uid;
          const isAdminMsg = msg.senderId !== effectiveProfileId && msg.senderId !== effectiveTargetId;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/msg items-end gap-3`}>
              {!isMe && (
                <img 
                  src={msg.senderId === targetUser.uid ? targetUser.photoURL : (adminUser1?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`)} 
                  alt="avatar" 
                  className="w-8 h-8 rounded-full border border-white/10 shadow-lg object-cover mb-1 flex-shrink-0"
                />
              )}
              <div className={`max-w-[90%] p-5 rounded-[2rem] font-medium text-sm shadow-2xl relative ${
                isMe
                  ? 'bg-red-600 text-white rounded-tr-none shadow-red-600/10' 
                  : isAdminMsg
                    ? 'bg-blue-600 text-white rounded-tl-none border border-white/5'
                    : msg.senderId === 'system'
                      ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 text-yellow-400 border-2 border-yellow-500/20 w-full text-center italic shadow-yellow-500/5'
                      : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-white/5'
              } ${msg.deletedByAdmin ? 'italic opacity-60' : ''}`}>
                {adminViewIds && !isAdminMsg && (
                  <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-zinc-500 flex items-center gap-1">
                    {msg.senderId === adminViewIds.u1 ? adminUser1?.displayName : targetUser?.displayName}
                  </div>
                )}
                {isAdminMsg && (
                  <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-blue-200 flex items-center gap-1">
                    <ShieldCheck size={10} />
                    Administrador
                  </div>
                )}
                {msg.deletedByAdmin ? (
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} />
                    <span className="italic">{msg.content || 'Este mensaje fue eliminado por un administrador'}</span>
                  </div>
                ) : (
                  <>
                    {msg.imageURL && (
                      <img 
                        src={msg.imageURL} 
                        alt="Imagen enviada" 
                        className="rounded-2xl max-w-full mb-2 shadow-lg border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {msg.content}
                  </>
                )}
                
                {(profile.role === 'admin' || isMe) && (
                  <button 
                    onClick={async () => {
                      const confirmMsg = profile.role === 'admin' 
                        ? "¿Estás seguro de eliminar este mensaje por completo de la base de datos? Esta acción no se puede deshacer."
                        : "¿Quieres eliminar este mensaje?";
                      if (!window.confirm(confirmMsg)) return;
                      try {
                        const convId = [effectiveProfileId, effectiveTargetId].sort().join('_');
                        await deleteDoc(doc(db, 'messages', msg.id));
                        // También actualizamos la vista previa de la conversación
                        await updateDoc(doc(db, 'conversations', convId), {
                          lastMessage: '[Mensaje eliminado]'
                        });
                      } catch (err: any) {
                        setError("Error al eliminar mensaje: " + err.message);
                      }
                    }}
                    className={`absolute -top-2 -right-2 bg-zinc-800 p-2 rounded-full shadow-xl transition-all hover:bg-red-600 hover:text-white border border-white/10 ${isMe && profile.role !== 'admin' ? 'text-zinc-400' : 'text-red-500'}`}
                    title="Eliminar mensaje"
                  >
                    <Trash2 size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      {(profile.role === 'admin' || !adminViewIds) && (
        <div className="p-4 md:p-8 bg-zinc-900/90 backdrop-blur-2xl border-t border-white/10">
          <form onSubmit={handleSend} className="flex gap-3 md:gap-5 items-center">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-12 w-12 md:h-16 md:w-16 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center shrink-0 border border-white/5"
            >
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ImageIcon size={24} className="md:w-8 md:h-8" strokeWidth={3} />
              )}
            </button>
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={gameState ? "Escribe tu respuesta..." : (adminViewIds ? "Intervenir en chat..." : "Escribe un mensaje...")}
                className={`w-full bg-zinc-800/50 border-2 border-transparent rounded-2xl px-5 md:px-7 py-4 md:py-5 text-sm md:text-base font-bold text-white focus:bg-zinc-800 focus:ring-4 outline-none transition-all placeholder:text-zinc-600 min-w-0 ${
                  gameState ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/5' : (adminViewIds ? 'focus:border-blue-500/20 focus:ring-blue-500/5' : 'focus:border-red-600/20 focus:ring-red-600/5')
                }`}
              />
            </div>
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className={`h-12 w-12 md:h-16 md:w-16 rounded-2xl shadow-2xl transition-all active:scale-90 flex items-center justify-center shrink-0 ${
                !newMessage.trim() 
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                  : (adminViewIds ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-700' : 'bg-red-600 text-white shadow-red-600/30 hover:bg-red-700')
              }`}
            >
              <Send size={24} className="md:w-8 md:h-8" strokeWidth={3} />
            </button>
          </form>
        </div>
      )}
      {!adminViewIds && profile.role !== 'admin' && false && (
        <div className="p-8 bg-zinc-900 border-t border-white/5 text-center">
          <p className="text-zinc-500 font-black text-xs uppercase tracking-widest">Modo Supervisión - Solo Lectura</p>
        </div>
      )}
    </motion.div>
  );
}

// --- Navigation ---

const Sidebar = memo(({ setView, currentView, onLogout, isAdmin, onInstall, showInstall, profile }: { 
  setView: (v: any) => void, 
  currentView: string, 
  onLogout: () => void, 
  isAdmin: boolean,
  onInstall: () => void,
  showInstall: boolean,
  profile: User | null
}) => {
  const items = [
    { id: 'main', icon: Home, label: 'Inicio' },
    { id: 'search', icon: Search, label: 'Buscar' },
    { id: 'messages', icon: MessageSquare, label: 'Mensajes' },
    { id: 'shop', icon: ShoppingBag, label: 'Tienda' },
    { id: 'games', icon: Gamepad2, label: 'Juegos' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
    ...(profile?.inventory?.includes('user_list_access') ? [{ id: 'users-list', icon: Users, label: 'Exploradores' }] : []),
    ...(isAdmin ? [
      { id: 'admin-users', icon: ShieldCheck, label: 'Admin Usuarios' },
      { id: 'admin-pets', icon: Sparkles, label: 'Admin Mascotas' }
    ] : [])
  ];

  return (
    <nav className="fixed bottom-2 left-2 right-2 md:left-4 md:top-4 md:bottom-4 md:w-20 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] md:rounded-[3rem] flex md:flex-col items-center justify-around md:justify-start md:pt-10 md:space-y-8 p-1.5 md:p-3 z-50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
      <div className="hidden md:flex flex-col items-center space-y-4 mb-2">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/40 cursor-pointer border-2 border-white/20"
          onClick={() => setView('main')}
        >
          <Users className="text-white" size={24} strokeWidth={3} />
        </motion.div>
        
        {/* Botón de Notificaciones */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if ("Notification" in window) {
              Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                  new Notification("¡Notificaciones Activadas!", {
                    body: "Ahora recibirás avisos de nuevos mensajes y publicaciones.",
                    icon: "https://picsum.photos/seed/cupiraapp-red/192/192"
                  });
                } else {
                  alert("Por favor, activa las notificaciones en la configuración de tu navegador.");
                }
              });
            } else {
              alert("Tu navegador no soporta notificaciones.");
            }
          }}
          className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors border border-white/5"
          title="Activar Notificaciones"
        >
          <Bell size={20} />
        </motion.button>

        {/* Botón de Instalación */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onInstall}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-white/5 ${showInstall ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
          title="Instalar Aplicación"
        >
          <Download size={20} />
        </motion.button>
      </div>
      {items.map((item) => (
        <button 
          key={item.id} 
          onClick={() => setView(item.id)}
          className="relative p-2 md:p-3 group transition-all"
        >
          {currentView === item.id && (
            <motion.div 
              layoutId="nav-active"
              className="absolute inset-0 bg-red-600 rounded-[1rem] md:rounded-[1.5rem] -z-10 shadow-2xl shadow-red-600/40"
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            />
          )}
          <item.icon 
            size={22} 
            className={`md:w-6 md:h-6 transition-all duration-500 ${currentView === item.id ? 'text-white scale-110' : 'text-zinc-600 group-hover:text-zinc-300'}`} 
            strokeWidth={currentView === item.id ? 3 : 2}
          />
        </button>
      ))}
      <button 
        onClick={onLogout}
        className="p-2 md:p-3 text-zinc-600 hover:text-red-500 transition-all md:mt-auto group"
      >
        <LogOut size={22} className="md:w-6 md:h-6 group-hover:rotate-12 transition-transform" strokeWidth={2} />
      </button>
    </nav>
  );
});

// --- Feed View ---

function Feed({ profile, onUserClick, updateCoins }: { profile: User, onUserClick: (uid: string) => void, updateCoins: (uid: string, amount: number) => Promise<void> }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [newPost, setNewPost] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get following list
  useEffect(() => {
    const q = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    return onSnapshot(q, (snapshot) => {
      setFollowing(snapshot.docs.map(doc => doc.data().followingId));
    });
  }, [profile.uid]);

  // Get posts
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      if (profile.role === 'admin') {
        setPosts(allPosts);
      } else {
        setPosts(allPosts.filter(p => 
          following.includes(p.authorId) || 
          p.authorId === profile.uid ||
          p.authorRole === 'admin' ||
          p.authorName === 'Administrador'
        ));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
  }, [following, profile.uid, profile.role]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 700 * 1024) {
        alert("La imagen es demasiado grande para una publicación. El límite es 700KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() && !postImage) return;
    await addDoc(collection(db, 'posts'), {
      authorId: profile.uid,
      authorName: profile.displayName,
      authorRole: profile.role,
      authorPhotoURL: profile.photoURL || null,
      authorInventory: profile.inventory || [],
      content: newPost,
      imageURL: postImage || null,
      likes: [],
      createdAt: serverTimestamp(),
    });

    setNewPost('');
    setPostImage(null);
  };

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-zinc-900/80 backdrop-blur-xl p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-white/10"
      >
        <form onSubmit={handlePost} className="space-y-4 md:space-y-6">
          <div className="flex gap-3 md:gap-5">
            <img src={profile.photoURL} alt="me" className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl shadow-xl border-2 border-white/10" />
            <textarea 
              placeholder="¿Qué está pasando en CupiraApp?" 
              className="w-full p-4 md:p-5 bg-zinc-800/50 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 focus:ring-2 focus:ring-red-500 outline-none resize-none font-medium text-white placeholder:text-zinc-500 transition-all text-sm md:text-base"
              rows={2} value={newPost} onChange={(e) => setNewPost(e.target.value)}
            />
          </div>
          
          <AnimatePresence>
            {postImage && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="relative w-full aspect-video rounded-[2rem] overflow-hidden shadow-inner bg-zinc-800 border border-white/5"
              >
                <img src={postImage} alt="preview" className="w-full h-full object-cover" />
                <button 
                  type="button" onClick={() => setPostImage(null)}
                  className="absolute top-4 right-4 bg-red-600 text-white p-2.5 rounded-2xl shadow-xl hover:scale-110 transition-transform"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between items-center pt-4 border-t border-white/5">
            {profile.role === 'admin' ? (
              <>
                <button 
                  type="button" onClick={() => fileInputRef.current?.click()}
                  className="p-4 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all flex items-center gap-3 font-black uppercase tracking-widest text-xs"
                >
                  <ImageIcon size={22} strokeWidth={2.5} /> 
                  <span>Imagen (Admin)</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              </>
            ) : (
              <div className="flex items-center gap-2 text-zinc-600 px-4">
                <ImageIcon size={18} className="opacity-50" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Imágenes solo en chat</span>
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={!newPost.trim() && !postImage}
              className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-red-600/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center gap-3 uppercase tracking-widest text-sm"
            >
              <Send size={20} strokeWidth={2.5} /> Publicar
            </button>
          </div>
        </form>
      </motion.div>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} profile={profile} onUserClick={onUserClick} />
          ))}
        </AnimatePresence>
        {posts.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 rounded-[3rem] border border-white/5">
            <div className="w-20 h-20 bg-zinc-800 text-zinc-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users size={40} />
            </div>
            <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tighter">Tu feed está vacío</h3>
            <p className="text-zinc-500 font-bold text-sm">Sigue a más personas para ver sus publicaciones.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const PostCard = memo(({ post, profile, onUserClick }: { post: Post, profile: User, onUserClick: (uid: string) => void }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const isLiked = post.likes?.includes(profile.uid);

  useEffect(() => {
    const q = query(collection(db, 'comments'), where('postId', '==', post.id), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
  }, [post.id]);

  const handleLike = async () => {
    const postRef = doc(db, 'posts', post.id);
    if (isLiked) {
      await updateDoc(postRef, { likes: arrayRemove(profile.uid) });
    } else {
      await updateDoc(postRef, { likes: arrayUnion(profile.uid) });
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addDoc(collection(db, 'comments'), {
      postId: post.id,
      authorId: profile.uid,
      authorName: profile.displayName,
      content: newComment,
      createdAt: serverTimestamp(),
    });
    setNewComment('');
  };

  const deletePost = async () => {
    await deleteDoc(doc(db, 'posts', post.id));
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden group"
    >
      <div className="p-5 md:p-8">
        <div className="flex justify-between items-start mb-4 md:mb-6">
          <div className="flex items-center gap-3 md:gap-5 cursor-pointer group/author" onClick={() => onUserClick(post.authorId)}>
            <div className={`relative ${post.authorInventory?.includes('profile_frame') ? 'p-1 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 rounded-full animate-pulse shadow-lg' : ''}`}>
              <img 
                src={post.authorPhotoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
                alt="avatar" 
                className="w-10 h-10 md:w-14 md:h-14 rounded-full shadow-xl group-hover/author:scale-110 transition-all duration-500 border-2 md:border-4 border-white/10 object-cover" 
                loading="lazy"
              />
              {(post.authorRole === 'admin' || post.authorName === 'Administrador') && (
                <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full border-2 border-zinc-900 shadow-lg">
                  <ShieldCheck size={12} strokeWidth={3} />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white group-hover/author:text-primary transition-colors text-lg tracking-tight leading-none">{post.authorName}</h3>
                {post.authorInventory?.includes('badge_unique') && <Sparkles size={16} className="text-yellow-500 animate-bounce" />}
              </div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest opacity-60 mt-1">Publicado recientemente</p>
            </div>
          </div>
          {(profile.role === 'admin' || post.authorId === profile.uid) && (
            <button 
              onClick={() => {
                if (window.confirm("¿Estás seguro de eliminar esta publicación?")) {
                  deletePost();
                }
              }} 
              className={`p-3 rounded-2xl transition-all ${profile.role === 'admin' ? 'text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white' : 'text-zinc-600 hover:text-red-500 hover:bg-red-500/10'}`}
              title="Eliminar publicación"
            >
              <Trash2 size={22} />
            </button>
          )}
        </div>
        
        <p className="text-zinc-200 text-xl leading-relaxed whitespace-pre-wrap mb-6 font-medium tracking-tight">{post.content}</p>
        
        {post.imageURL && (
          <div className="rounded-[2.5rem] overflow-hidden mb-6 shadow-2xl border border-white/5">
            <img 
              src={post.imageURL} 
              alt="post" 
              className="w-full max-h-[600px] object-cover hover:scale-105 transition-transform duration-700" 
              loading="lazy"
            />
          </div>
        )}
        
        <div className="flex items-center gap-6 pt-6 border-t border-white/5">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleLike} 
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-xs ${isLiked ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-zinc-500 bg-zinc-800/50 hover:bg-zinc-800'}`}
          >
            <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={3} />
            <span>{post.likes?.length || 0}</span>
          </motion.button>
          
          <button 
            onClick={() => setShowComments(!showComments)} 
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-xs ${showComments ? 'bg-zinc-700 text-white' : 'text-zinc-500 bg-zinc-800/50 hover:bg-zinc-800'}`}
          >
            <MessageCircle size={22} strokeWidth={3} />
            <span>{comments.length}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-zinc-950/50 backdrop-blur-2xl border-t border-white/5 overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="space-y-5 max-h-80 overflow-y-auto pr-3 custom-scrollbar">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-4 items-start">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.authorId}`} 
                      alt="avatar" 
                      className="w-10 h-10 rounded-xl flex-shrink-0 cursor-pointer shadow-lg border border-white/10" 
                      onClick={() => onUserClick(c.authorId)}
                    />
                    <div className="bg-zinc-800/50 p-4 rounded-[1.5rem] shadow-sm flex-1 border border-white/5 relative group/comment">
                      <div className="flex justify-between items-start">
                        <p 
                          className="text-xs font-black text-primary cursor-pointer hover:underline mb-1 uppercase tracking-widest"
                          onClick={() => onUserClick(c.authorId)}
                        >
                          {c.authorName}
                        </p>
                        {(profile.role === 'admin' || c.authorId === profile.uid) && (
                          <button 
                            onClick={async () => {
                              if (!window.confirm("¿Eliminar este comentario?")) return;
                              await deleteDoc(doc(db, 'comments', c.id));
                            }}
                            className="p-1 text-zinc-600 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 font-medium leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-zinc-600 text-sm font-black py-6 uppercase tracking-widest">Sé el primero en comentar</p>
                )}
              </div>
              
              <form onSubmit={handleComment} className="flex gap-4 pt-4 border-t border-white/5">
                <input 
                  type="text" placeholder="Escribe un comentario..." 
                  className="flex-1 px-6 py-4 bg-zinc-800/50 rounded-2xl border border-white/5 focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium text-white placeholder:text-zinc-500 transition-all"
                  value={newComment} onChange={(e) => setNewComment(e.target.value)}
                />
                <button type="submit" className="bg-primary text-white p-4 rounded-2xl hover:opacity-90 shadow-xl shadow-primary/20 transition-all active:scale-90">
                  <Send size={20} strokeWidth={3} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// --- Shop View ---

function GamesView({ profile, updateCoins, updateDiamonds, setError, setSuccessMessage }: { profile: User, updateCoins: (uid: string, amount: number) => Promise<void>, updateDiamonds: (uid: string, amount: number) => Promise<void>, setError: (m: string) => void, setSuccessMessage: (m: string) => void }) {
  const [activeGame, setActiveGame] = useState<'luck' | 'memory' | 'trivia' | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [result, setResult] = useState<{ win: boolean, message: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [timer, setTimer] = useState(0);

  const TRIVIA_QUESTIONS = [
    { q: "¿Cuál es el elemento más abundante en el universo?", a: "Hidrógeno", options: ["Helio", "Oxígeno", "Hidrógeno"] },
    { q: "¿En qué año terminó la Segunda Guerra Mundial?", a: "1945", options: ["1944", "1945", "1946"] },
    { q: "¿Quién pintó 'La persistencia de la memoria'?", a: "Salvador Dalí", options: ["Pablo Picasso", "Salvador Dalí", "Joan Miró"] },
    { q: "¿Cuál es el hueso más largo del cuerpo humano?", a: "Fémur", options: ["Húmero", "Fémur", "Tibia"] },
    { q: "¿Qué país tiene la mayor población del mundo?", a: "India", options: ["China", "India", "Estados Unidos"] },
    { q: "¿Cuál es la capital de Australia?", a: "Camberra", options: ["Sídney", "Melbourne", "Camberra"] },
    { q: "¿Quién escribió 'Cien años de soledad'?", a: "Gabriel García Márquez", options: ["Mario Vargas Llosa", "Gabriel García Márquez", "Julio Cortázar"] },
    { q: "¿Cuál es el metal más caro del mundo?", a: "Rodio", options: ["Oro", "Platino", "Rodio"] },
    { q: "¿En qué país se encuentra la ciudad de Petra?", a: "Jordania", options: ["Egipto", "Jordania", "Irak"] },
    { q: "¿Cuál es el río más largo del mundo?", a: "Amazonas", options: ["Nilo", "Amazonas", "Misisipi"] },
    { q: "¿Qué gas absorben las plantas para realizar la fotosíntesis?", a: "Dióxido de carbono", options: ["Oxígeno", "Nitrógeno", "Dióxido de carbono"] },
    { q: "¿Quién descubrió la penicilina?", a: "Alexander Fleming", options: ["Marie Curie", "Alexander Fleming", "Louis Pasteur"] },
    { q: "¿Cuál es el océano más grande?", a: "Pacífico", options: ["Atlántico", "Índico", "Pacífico"] },
    { q: "¿Cuántos corazones tiene un pulpo?", a: "3", options: ["1", "2", "3"] },
    { q: "¿Cuál es la montaña más alta del mundo?", a: "Everest", options: ["K2", "Everest", "Kangchenjunga"] },
    { q: "¿Quién fue el primer hombre en pisar la Luna?", a: "Neil Armstrong", options: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin"] },
    { q: "¿Cuál es el país más grande del mundo por superficie?", a: "Rusia", options: ["Canadá", "China", "Rusia"] },
    { q: "¿Qué instrumento mide la presión atmosférica?", a: "Barómetro", options: ["Termómetro", "Barómetro", "Higrómetro"] },
    { q: "¿Cuál es el idioma más hablado del mundo?", a: "Chino mandarín", options: ["Inglés", "Español", "Chino mandarín"] },
    { q: "¿Quién pintó la 'Mona Lisa'?", a: "Leonardo da Vinci", options: ["Miguel Ángel", "Leonardo da Vinci", "Rafael"] },
    { q: "¿Cuál es el planeta más cercano al Sol?", a: "Mercurio", options: ["Venus", "Mercurio", "Marte"] },
    { q: "¿En qué continente se encuentra el desierto del Sahara?", a: "África", options: ["Asia", "África", "Oceanía"] },
    { q: "¿Cuál es el símbolo químico del oro?", a: "Au", options: ["Ag", "Au", "Fe"] },
    { q: "¿Quién escribió 'Don Quijote de la Mancha'?", a: "Miguel de Cervantes", options: ["Lope de Vega", "Miguel de Cervantes", "Quevedo"] },
    { q: "¿Cuál es la velocidad de la luz?", a: "299,792 km/s", options: ["150,000 km/s", "299,792 km/s", "450,000 km/s"] },
    { q: "¿Qué órgano del cuerpo humano consume más energía?", a: "Cerebro", options: ["Corazón", "Hígado", "Cerebro"] },
    { q: "¿Cuál es el animal terrestre más rápido?", a: "Guepardo", options: ["León", "Guepardo", "Antílope"] },
    { q: "¿En qué año cayó el Muro de Berlín?", a: "1989", options: ["1987", "1989", "1991"] },
    { q: "¿Cuál es la capital de Japón?", a: "Tokio", options: ["Kioto", "Osaka", "Tokio"] },
    { q: "¿Quién formuló la teoría de la relatividad?", a: "Albert Einstein", options: ["Isaac Newton", "Albert Einstein", "Stephen Hawking"] },
    { q: "¿Cuál es el país más pequeño del mundo?", a: "Ciudad del Vaticano", options: ["Mónaco", "San Marino", "Ciudad del Vaticano"] },
    { q: "¿Qué parte de la célula contiene el material genético?", a: "Núcleo", options: ["Citoplasma", "Núcleo", "Mitocondria"] },
    { q: "¿Cuál es el desierto más seco del mundo?", a: "Atacama", options: ["Sahara", "Gobi", "Atacama"] },
    { q: "¿Quién compuso la 'Novena Sinfonía'?", a: "Beethoven", options: ["Mozart", "Beethoven", "Bach"] },
    { q: "¿Cuál es el metal más abundante en la corteza terrestre?", a: "Aluminio", options: ["Hierro", "Aluminio", "Cobre"] },
    { q: "¿En qué año llegó Cristóbal Colón a América?", a: "1492", options: ["1488", "1492", "1500"] },
    { q: "¿Cuál es la capital de Canadá?", a: "Ottawa", options: ["Toronto", "Montreal", "Ottawa"] },
    { q: "¿Qué científico propuso la teoría de la evolución?", a: "Charles Darwin", options: ["Gregor Mendel", "Charles Darwin", "Lamarck"] },
    { q: "¿Cuál es el lago más profundo del mundo?", a: "Baikal", options: ["Superior", "Victoria", "Baikal"] },
    { q: "¿Quién escribió 'Romeo y Julieta'?", a: "Shakespeare", options: ["Marlowe", "Shakespeare", "Milton"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'O'?", a: "Oxígeno", options: ["Oro", "Osmio", "Oxígeno"] },
    { q: "¿En qué país se originaron los Juegos Olímpicos?", a: "Grecia", options: ["Italia", "Grecia", "Francia"] },
    { q: "¿Cuál es la capital de Italia?", a: "Roma", options: ["Milán", "Nápoles", "Roma"] },
    { q: "¿Qué planeta es conocido como el 'Planeta Rojo'?", a: "Marte", options: ["Venus", "Marte", "Júpiter"] },
    { q: "¿Quién fue el primer presidente de los Estados Unidos?", a: "George Washington", options: ["Thomas Jefferson", "George Washington", "Abraham Lincoln"] },
    { q: "¿Cuál es el animal más grande del mundo?", a: "Ballena azul", options: ["Elefante africano", "Ballena azul", "Tiburón ballena"] },
    { q: "¿En qué año comenzó la Primera Guerra Mundial?", a: "1914", options: ["1912", "1914", "1918"] },
    { q: "¿Cuál es la capital de Francia?", a: "París", options: ["Lyon", "Marsella", "París"] },
    { q: "¿Qué sustancia es conocida como el 'solvente universal'?", a: "Agua", options: ["Alcohol", "Agua", "Acetona"] },
    { q: "¿Quién pintó 'La noche estrellada'?", a: "Vincent van Gogh", options: ["Claude Monet", "Vincent van Gogh", "Edvard Munch"] },
    { q: "¿Cuál es el continente más frío de la Tierra?", a: "Antártida", options: ["Ártico", "Antártida", "Groenlandia"] },
    { q: "¿Qué gas es esencial para la respiración humana?", a: "Oxígeno", options: ["Nitrógeno", "Oxígeno", "Helio"] },
    { q: "¿Quién escribió 'Odisea'?", a: "Homero", options: ["Sófocles", "Homero", "Eurípides"] },
    { q: "¿Cuál es la capital de España?", a: "Madrid", options: ["Barcelona", "Sevilla", "Madrid"] },
    { q: "¿Qué planeta tiene los anillos más visibles?", a: "Saturno", options: ["Júpiter", "Saturno", "Urano"] },
    { q: "¿Quién descubrió la gravedad?", a: "Isaac Newton", options: ["Galileo Galilei", "Isaac Newton", "Johannes Kepler"] },
    { q: "¿Cuál es el país con más islas en el mundo?", a: "Suecia", options: ["Indonesia", "Filipinas", "Suecia"] },
    { q: "¿Qué vitamina se obtiene principalmente del sol?", a: "Vitamina D", options: ["Vitamina C", "Vitamina D", "Vitamina B12"] },
    { q: "¿Cuál es la capital de Alemania?", a: "Berlín", options: ["Múnich", "Hamburgo", "Berlín"] },
    { q: "¿Quién escribió 'El principito'?", a: "Antoine de Saint-Exupéry", options: ["Jules Verne", "Antoine de Saint-Exupéry", "Victor Hugo"] },
    { q: "¿Cuál es el metal que es líquido a temperatura ambiente?", a: "Mercurio", options: ["Plomo", "Mercurio", "Estaño"] },
    { q: "¿En qué país se encuentra la Torre Eiffel?", a: "Francia", options: ["Italia", "Francia", "España"] },
    { q: "¿Cuál es el animal que nunca duerme?", a: "Tiburón", options: ["Delfín", "Tiburón", "Hormiga"] },
    { q: "¿Quién fue la primera mujer en ganar un Premio Nobel?", a: "Marie Curie", options: ["Rosalind Franklin", "Marie Curie", "Ada Lovelace"] },
    { q: "¿Cuál es la capital de Rusia?", a: "Moscú", options: ["San Petersburgo", "Moscú", "Novosibirsk"] },
    { q: "¿Qué parte del ojo es sensible a la luz?", a: "Retina", options: ["Córnea", "Iris", "Retina"] },
    { q: "¿Cuál es el país más poblado de África?", a: "Nigeria", options: ["Egipto", "Nigeria", "Etiopía"] },
    { q: "¿Quién escribió 'Hamlet'?", a: "Shakespeare", options: ["Marlowe", "Shakespeare", "Jonson"] },
    { q: "¿Cuál es el elemento químico más ligero?", a: "Hidrógeno", options: ["Helio", "Litio", "Hidrógeno"] },
    { q: "¿En qué año se hundió el Titanic?", a: "1912", options: ["1910", "1912", "1914"] },
    { q: "¿Cuál es la capital de China?", a: "Pekín", options: ["Shanghái", "Pekín", "Cantón"] },
    { q: "¿Qué planeta es el más caliente del sistema solar?", a: "Venus", options: ["Mercurio", "Venus", "Marte"] },
    { q: "¿Quién pintó 'La última cena'?", a: "Leonardo da Vinci", options: ["Miguel Ángel", "Leonardo da Vinci", "Rafael"] },
    { q: "¿Cuál es el océano que baña las costas de Brasil?", a: "Atlántico", options: ["Pacífico", "Atlántico", "Índico"] },
    { q: "¿Qué gas constituye la mayor parte de la atmósfera terrestre?", a: "Nitrógeno", options: ["Oxígeno", "Nitrógeno", "Argón"] },
    { q: "¿Cuál es la capital de Argentina?", a: "Buenos Aires", options: ["Córdoba", "Rosario", "Buenos Aires"] },
    { q: "¿Quién escribió 'La Ilíada'?", a: "Homero", options: ["Hesíodo", "Homero", "Píndaro"] },
    { q: "¿Cuál es el animal más rápido en el agua?", a: "Pez vela", options: ["Tiburón mako", "Pez vela", "Delfín"] },
    { q: "¿En qué país se encuentra la Gran Muralla?", a: "China", options: ["Japón", "China", "Mongolia"] },
    { q: "¿Cuál es la capital de México?", a: "Ciudad de México", options: ["Guadalajara", "Monterrey", "Ciudad de México"] },
    { q: "¿Qué científico propuso las leyes del movimiento?", a: "Isaac Newton", options: ["Albert Einstein", "Isaac Newton", "Galileo Galilei"] },
    { q: "¿Cuál es el país con mayor superficie de Sudamérica?", a: "Brasil", options: ["Argentina", "Brasil", "Perú"] },
    { q: "¿Quién escribió 'Crónica de una muerte anunciada'?", a: "Gabriel García Márquez", options: ["Isabel Allende", "Gabriel García Márquez", "Jorge Luis Borges"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'Fe'?", a: "Hierro", options: ["Flúor", "Fósforo", "Hierro"] },
    { q: "¿En qué año se fundó la ONU?", a: "1945", options: ["1944", "1945", "1946"] },
    { q: "¿Cuál es la capital de Portugal?", a: "Lisboa", options: ["Oporto", "Lisboa", "Coímbra"] },
    { q: "¿Qué planeta tiene la mancha roja gigante?", a: "Júpiter", options: ["Marte", "Júpiter", "Saturno"] },
    { q: "¿Quién pintó el techo de la Capilla Sixtina?", a: "Miguel Ángel", options: ["Leonardo da Vinci", "Miguel Ángel", "Rafael"] },
    { q: "¿Cuál es el mar más salado del mundo?", a: "Mar Muerto", options: ["Mar Rojo", "Mar Muerto", "Mar Caspio"] },
    { q: "¿Qué vitamina es buena para la vista?", a: "Vitamina A", options: ["Vitamina A", "Vitamina C", "Vitamina E"] },
    { q: "¿Cuál es la capital de Egipto?", a: "El Cairo", options: ["Alejandría", "El Cairo", "Luxor"] },
    { q: "¿Quién escribió 'El Aleph'?", a: "Jorge Luis Borges", options: ["Julio Cortázar", "Jorge Luis Borges", "Ernesto Sabato"] },
    { q: "¿Cuál es el metal más conductor de la electricidad?", a: "Plata", options: ["Cobre", "Oro", "Plata"] },
    { q: "¿En qué país se encuentran las pirámides de Giza?", a: "Egipto", options: ["México", "Egipto", "Perú"] },
    { q: "¿Cuál es la capital de Colombia?", a: "Bogotá", options: ["Medellín", "Cali", "Bogotá"] },
    { q: "¿Qué planeta es conocido como el 'gigante gaseoso'?", a: "Júpiter", options: ["Marte", "Júpiter", "Venus"] },
    { q: "¿Quién escribió '1984'?", a: "George Orwell", options: ["Aldous Huxley", "George Orwell", "Ray Bradbury"] },
    { q: "¿Cuál es el animal que tiene la gestación más larga?", a: "Elefante", options: ["Ballena", "Elefante", "Rinoceronte"] },
    { q: "¿En qué año comenzó la Revolución Francesa?", a: "1789", options: ["1776", "1789", "1804"] },
    { q: "¿Cuál es la capital de Grecia?", a: "Atenas", options: ["Esparta", "Atenas", "Tesalónica"] },
    { q: "¿Qué científico descubrió la estructura del ADN?", a: "Watson y Crick", options: ["Watson y Crick", "Franklin y Wilkins", "Mendel"] },
    { q: "¿Cuál es el país más grande de Centroamérica?", a: "Nicaragua", options: ["Guatemala", "Nicaragua", "Honduras"] },
    { q: "¿Quién escribió 'La metamorfosis'?", a: "Franz Kafka", options: ["Thomas Mann", "Franz Kafka", "Hermann Hesse"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'Ag'?", a: "Plata", options: ["Oro", "Plata", "Aluminio"] },
    { q: "¿En qué año se descubrió la penicilina?", a: "1928", options: ["1920", "1928", "1935"] },
    { q: "¿Cuál es la capital de Turquía?", a: "Ankara", options: ["Estambul", "Ankara", "Esmirna"] },
    { q: "¿Qué planeta tiene más lunas?", a: "Saturno", options: ["Júpiter", "Saturno", "Urano"] },
    { q: "¿Quién pintó 'El grito'?", a: "Edvard Munch", options: ["Vincent van Gogh", "Edvard Munch", "Gustav Klimt"] },
    { q: "¿Cuál es el río más caudaloso del mundo?", a: "Amazonas", options: ["Congo", "Nilo", "Amazonas"] },
    { q: "¿Qué gas es el principal responsable del efecto invernadero?", a: "Dióxido de carbono", options: ["Metano", "Dióxido de carbono", "Vapor de agua"] },
    { q: "¿Cuál es la capital de Chile?", a: "Santiago", options: ["Valparaíso", "Concepción", "Santiago"] },
    { q: "¿Quién escribió 'Fausto'?", a: "Goethe", options: ["Schiller", "Goethe", "Heine"] },
    { q: "¿Cuál es el animal más inteligente después del ser humano?", a: "Delfín", options: ["Chimpancé", "Delfín", "Elefante"] },
    { q: "¿En qué año terminó la Guerra Civil Española?", a: "1939", options: ["1936", "1939", "1945"] },
    { q: "¿Cuál es la capital de Perú?", a: "Lima", options: ["Cusco", "Arequipa", "Lima"] },
    { q: "¿Qué científico propuso el modelo atómico actual?", a: "Schrödinger", options: ["Bohr", "Rutherford", "Schrödinger"] },
    { q: "¿Cuál es el país más grande de Oceanía?", a: "Australia", options: ["Nueva Zelanda", "Papúa Nueva Guinea", "Australia"] },
    { q: "¿Quién escribió 'Ulises'?", a: "James Joyce", options: ["Virginia Woolf", "James Joyce", "T.S. Eliot"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'Cu'?", a: "Cobre", options: ["Cobalto", "Cromo", "Cobre"] },
    { q: "¿En qué año se lanzó el primer satélite artificial?", a: "1957", options: ["1955", "1957", "1961"] },
    { q: "¿Cuál es la capital de India?", a: "Nueva Delhi", options: ["Bombay", "Nueva Delhi", "Calcuta"] },
    { q: "¿Qué planeta es el más pequeño del sistema solar?", a: "Mercurio", options: ["Marte", "Mercurio", "Plutón"] },
    { q: "¿Quién escribió 'Rayuela'?", a: "Julio Cortázar", options: ["Gabriel García Márquez", "Julio Cortázar", "Mario Vargas Llosa"] },
    { q: "¿Cuál es el animal que puede cambiar de color?", a: "Camaleón", options: ["Pulpo", "Camaleón", "Sepia"] },
    { q: "¿En qué año se inventó la imprenta?", a: "1440", options: ["1400", "1440", "1500"] },
    { q: "¿Cuál es la capital de Suecia?", a: "Estocolmo", options: ["Gotemburgo", "Estocolmo", "Malmö"] },
    { q: "¿Qué parte del cerebro controla el equilibrio?", a: "Cerebelo", options: ["Cerebro", "Cerebelo", "Tronco encefálico"] },
    { q: "¿Cuál es el país más poblado de Europa?", a: "Rusia", options: ["Alemania", "Francia", "Rusia"] },
    { q: "¿Quién escribió 'Los miserables'?", a: "Victor Hugo", options: ["Balzac", "Victor Hugo", "Stendhal"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'Hg'?", a: "Mercurio", options: ["Hidrógeno", "Helio", "Mercurio"] },
    { q: "¿En qué año se descubrió América?", a: "1492", options: ["1488", "1492", "1500"] },
    { q: "¿Cuál es la capital de Noruega?", a: "Oslo", options: ["Bergen", "Oslo", "Trondheim"] },
    { q: "¿Qué planeta tiene la rotación más rápida?", a: "Júpiter", options: ["Tierra", "Júpiter", "Saturno"] },
    { q: "¿Quién escribió 'Guerra y paz'?", a: "León Tolstói", options: ["Dostoievski", "León Tolstói", "Chéjov"] },
    { q: "¿Cuál es el animal que tiene la lengua más larga?", a: "Camaleón", options: ["Oso hormiguero", "Camaleón", "Jirafa"] },
    { q: "¿En qué año comenzó la Revolución Rusa?", a: "1917", options: ["1905", "1917", "1922"] },
    { q: "¿Cuál es la capital de Suiza?", a: "Berna", options: ["Zúrich", "Ginebra", "Berna"] },
    { q: "¿Qué científico descubrió el neutrón?", a: "James Chadwick", options: ["Rutherford", "Bohr", "James Chadwick"] },
    { q: "¿Cuál es el país más grande de África por superficie?", a: "Argelia", options: ["Sudán", "Argelia", "Congo"] },
    { q: "¿Quién escribió 'El proceso'?", a: "Franz Kafka", options: ["Brecht", "Franz Kafka", "Mann"] },
    { q: "¿Cuál es el elemento químico con el símbolo 'Pb'?", a: "Plomo", options: ["Platino", "Plomo", "Paladio"] },
    { q: "¿En qué año se fundó la ciudad de Roma?", a: "753 a.C.", options: ["500 a.C.", "753 a.C.", "1000 a.C."] },
    { q: "¿Cuál es la capital de Holanda?", a: "Ámsterdam", options: ["La Haya", "Ámsterdam", "Róterdam"] },
    { q: "¿Qué planeta tiene la órbita más larga?", a: "Neptuno", options: ["Urano", "Neptuno", "Plutón"] },
    { q: "¿Quién escribió 'La divina comedia'?", a: "Dante Alighieri", options: ["Petrarca", "Dante Alighieri", "Boccaccio"] },
    { q: "¿Cuál es el animal que puede volar hacia atrás?", a: "Colibrí", options: ["Murciélago", "Colibrí", "Libélula"] },
    { q: "¿En qué año se inventó el teléfono?", a: "1876", options: ["1850", "1876", "1900"] },
    { q: "¿Cuál es la capital de Bélgica?", a: "Bruselas", options: ["Amberes", "Bruselas", "Gante"] },
    { q: "¿Qué parte de la planta realiza la fotosíntesis?", a: "Hojas", options: ["Raíz", "Tallo", "Hojas"] },
    { q: "¿Cuál es el país más grande de Asia?", a: "Rusia", options: ["China", "India", "Rusia"] },
    { q: "¿Quién escribió 'El retrato de Dorian Gray'?", a: "Oscar Wilde", options: ["Bram Stoker", "Oscar Wilde", "Mary Shelley"] }
  ];

  const checkLimit = (gameId: 'luck' | 'memory' | 'trivia') => {
    const today = new Date().toISOString().split('T')[0];
    const stats = profile.dailyPlays || { lastDate: today, luck: 0, memory: 0, trivia: 0 };
    
    if (stats.lastDate !== today) {
      return true; // New day, reset happens on update
    }
    
    const limit = gameId === 'trivia' ? 10 : 3;
    
    if (stats[gameId] >= limit) {
      setError(`Has alcanzado el límite de ${limit} partidas diarias para este juego. 🦊`);
      return false;
    }
    return true;
  };

  const incrementPlays = async (gameId: 'luck' | 'memory' | 'trivia') => {
    const today = new Date().toISOString().split('T')[0];
    let stats = profile.dailyPlays || { lastDate: today, luck: 0, memory: 0, trivia: 0 };
    
    if (stats.lastDate !== today) {
      stats = { lastDate: today, luck: 0, memory: 0, trivia: 0 };
    }
    
    stats[gameId] += 1;
    await updateDoc(doc(db, 'users', profile.uid), { dailyPlays: stats });
  };

  const startLuckGame = () => {
    if (!checkLimit('luck')) return;
    setActiveGame('luck');
    setGameState({ chests: [0, 1, 2].sort(() => Math.random() - 0.5) });
    setResult(null);
    setPlaying(true);
  };

  const handleLuckChoice = async (idx: number) => {
    if (!playing) return;
    setPlaying(false);
    await incrementPlays('luck');
    const outcomes = [
      { win: true, amount: 2, msg: "¡Increíble! Encontraste el tesoro real. +2 CupiraCoins" },
      { win: false, amount: 0, msg: "El cofre estaba vacío... Mejor suerte la próxima." },
      { win: false, amount: -2, msg: "¡Oh no! Era una trampa. -2 CupiraCoins" }
    ];
    const outcome = outcomes[gameState.chests[idx]];
    await updateCoins(profile.uid, outcome.amount);
    setResult({ win: outcome.win, message: outcome.msg });
  };

  const startMemoryGame = () => {
    if (!checkLimit('memory')) return;
    const emojis = ['🍎', '🍌', '🍇', '🍓', '🍒', '🥝'];
    const sequence = Array.from({ length: 4 }, () => emojis[Math.floor(Math.random() * emojis.length)]);
    setActiveGame('memory');
    setGameState({ sequence, userSequence: [], showSequence: true });
    setResult(null);
    setPlaying(true);
    setTimer(4);
    
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState((p: any) => ({ ...p, showSequence: false }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleMemoryClick = async (emoji: string) => {
    if (!playing || gameState.showSequence) return;
    if (gameState.userSequence.length >= 4) return;

    const newUserSeq = [...gameState.userSequence, emoji];
    setGameState((prev: any) => ({ ...prev, userSequence: newUserSeq }));

    if (newUserSeq.length === 4) {
      setPlaying(false);
      await incrementPlays('memory');
      
      const isCorrect = newUserSeq.every((e, i) => e === gameState.sequence[i]);
      
      if (isCorrect) {
        await updateCoins(profile.uid, 2);
        setResult({ win: true, message: "¡Memoria perfecta! +2 CupiraCoins" });
      } else {
        await updateCoins(profile.uid, -2);
        setResult({ win: false, message: "Secuencia incorrecta. -2 CupiraCoins" });
      }
    }
  };

  const startTriviaGame = () => {
    if (!checkLimit('trivia')) return;
    const firstQ = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    setActiveGame('trivia');
    setGameState({ 
      questions: [firstQ], 
      currentIndex: 0, 
      score: 0, 
      currentQ: firstQ,
      completed: false 
    });
    setResult(null);
    setPlaying(true);
  };

  const handleTriviaAnswer = async (ans: string) => {
    if (!playing) return;
    
    const isCorrect = ans === gameState.currentQ.a;
    const newScore = isCorrect ? gameState.score + 1 : gameState.score;
    const nextIndex = gameState.currentIndex + 1;

    if (nextIndex < 10) {
      const nextQ = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
      setGameState((prev: any) => ({
        ...prev,
        currentIndex: nextIndex,
        score: newScore,
        currentQ: nextQ
      }));
    } else {
      setPlaying(false);
      await incrementPlays('trivia');
      const coinReward = newScore * 2;
      await updateCoins(profile.uid, coinReward);
      setResult({ 
        win: newScore > 0, 
        message: `Ronda terminada. Puntuación: ${newScore}/10. ¡Has ganado ${coinReward} CupiraCoins! 🦊` 
      });
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const stats = profile.dailyPlays?.lastDate === today ? profile.dailyPlays : { luck: 0, memory: 0, trivia: 0 };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
      <div className="mb-8 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-red-600/20"
        >
          <Gamepad2 size={32} className="text-white" strokeWidth={2.5} />
        </motion.div>
        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Zona de Juegos</h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Gana (o pierde) CupiraCoins solo</p>
      </div>

      {!activeGame ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { id: 'luck', name: 'Cofres de Suerte', icon: '🎁', desc: 'Elige un cofre de color.', plays: stats.luck, limit: 3, start: startLuckGame },
            { id: 'memory', name: 'Emoji Memory', icon: '🧠', desc: 'Repite la secuencia.', plays: stats.memory, limit: 3, start: startMemoryGame },
            { id: 'trivia', name: 'Trivia Veloz', icon: '⚡', desc: '150+ preguntas difíciles.', plays: stats.trivia, limit: 10, start: startTriviaGame }
          ].map(game => (
            <motion.button
              key={game.id}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={game.start}
              className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 text-center group hover:bg-zinc-800/80 transition-all relative"
            >
              <div className="absolute top-4 right-4 bg-zinc-800 px-2 py-1 rounded-lg text-[8px] font-black text-zinc-400">
                {game.plays}/{game.limit} HOY
              </div>
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{game.icon}</div>
              <h3 className="text-lg font-black text-white mb-2">{game.name}</h3>
              <p className="text-zinc-500 text-xs font-medium">{game.desc}</p>
            </motion.button>
          ))}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 text-center relative overflow-hidden"
        >
          <button 
            onClick={() => setActiveGame(null)} 
            className="absolute top-6 right-6 p-2 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all z-10"
          >
            <X size={20} />
          </button>

          {activeGame === 'luck' && (
            <div className="space-y-8 py-4">
              <h2 className="text-2xl font-black text-white">Elige un Cofre</h2>
              <div className="flex flex-wrap justify-center gap-6 px-4">
                {[
                  { color: 'bg-blue-600', shadow: 'shadow-blue-600/40', name: 'Azul' },
                  { color: 'bg-red-600', shadow: 'shadow-red-600/40', name: 'Rojo' },
                  { color: 'bg-zinc-950', shadow: 'shadow-white/5', name: 'Negro' }
                ].map((c, i) => (
                  <motion.button
                    key={i}
                    whileHover={playing ? { scale: 1.1, y: -10 } : {}}
                    whileTap={playing ? { scale: 0.9 } : {}}
                    onClick={() => handleLuckChoice(i)}
                    className={`w-28 h-28 rounded-[2rem] transition-all flex items-center justify-center text-5xl shadow-2xl ${c.color} ${c.shadow} ${!playing ? 'opacity-50 grayscale' : 'border-4 border-white/10 hover:border-white/30'}`}
                  >
                    <div className="relative">
                      📦
                      {!playing && gameState.chests[i] === 0 && <span className="absolute -top-4 -right-4 text-2xl animate-bounce">✨</span>}
                      {!playing && gameState.chests[i] === 2 && <span className="absolute -top-4 -right-4 text-2xl">💀</span>}
                    </div>
                  </motion.button>
                ))}
              </div>
              <div className="flex justify-center gap-8 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Azul</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600"></div> Rojo</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-zinc-950 border border-white/20"></div> Negro</span>
              </div>
            </div>
          )}

          {activeGame === 'memory' && (
            <div className="space-y-8">
              <div className="relative">
                <h2 className="text-2xl font-black text-white">
                  {gameState.showSequence ? 'Memoriza la secuencia...' : '¡Tu turno! Repite los emojis'}
                </h2>
                {gameState.showSequence && (
                  <div className="mt-2 text-red-500 font-black text-xl animate-pulse">
                    {timer}s
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 max-w-[200px] mx-auto min-h-[200px]">
                {(gameState.showSequence ? gameState.sequence : gameState.userSequence).map((e: string, i: number) => (
                  <motion.div 
                    key={i} 
                    initial={{ scale: 0, rotate: -10 }} 
                    animate={{ scale: 1, rotate: 0 }} 
                    className={`aspect-square flex items-center justify-center text-5xl rounded-3xl border-2 transition-all shadow-xl ${gameState.showSequence ? 'bg-zinc-800 border-white/10' : 'bg-red-600/20 border-red-600 shadow-red-600/10'}`}
                  >
                    {e}
                  </motion.div>
                ))}
                {!gameState.showSequence && Array.from({ length: 4 - gameState.userSequence.length }).map((_, i) => (
                  <div key={i} className="aspect-square bg-zinc-800/50 rounded-3xl border-2 border-dashed border-white/5 flex items-center justify-center text-zinc-700 text-2xl font-black">
                    ?
                  </div>
                ))}
              </div>

              {!gameState.showSequence && playing && (
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto pt-4">
                  {['🍎', '🍌', '🍇', '🍓', '🍒', '🥝'].map(e => (
                    <button 
                      key={e} 
                      onClick={() => handleMemoryClick(e)}
                      className={`text-3xl p-5 rounded-2xl transition-all active:scale-90 border-2 ${gameState.userSequence.includes(e) ? 'bg-red-600 border-white/20 shadow-lg shadow-red-600/20' : 'bg-zinc-800 border-white/5 hover:bg-zinc-700'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeGame === 'trivia' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Pregunta {gameState.currentIndex + 1}/10</span>
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Aciertos: {gameState.score}</span>
              </div>
              <div className="bg-zinc-800/50 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                <h2 className="text-xl md:text-2xl font-black text-white px-2 leading-tight">{gameState.currentQ.q}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
                {gameState.currentQ.options.map((opt: string) => (
                  <button 
                    key={opt} 
                    onClick={() => handleTriviaAnswer(opt)}
                    className="w-full py-5 bg-zinc-800 text-white rounded-2xl font-black hover:bg-red-600 transition-all active:scale-95 border border-white/5 shadow-lg text-lg"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {result && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`mt-8 p-6 rounded-[2rem] font-black border-2 ${result.win ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}
            >
              <p className="text-lg mb-4">{result.message}</p>
              <button 
                onClick={() => setActiveGame(null)}
                className="px-8 py-3 bg-white text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
              >
                Continuar
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function ShopView({ pets, profile, updateCoins, updateDiamonds, setError, setSuccessMessage }: { pets: Pet[], profile: User, updateCoins: (uid: string, amount: number) => Promise<void>, updateDiamonds: (uid: string, amount: number) => Promise<void>, setError: (m: string) => void, setSuccessMessage: (m: string) => void }) {
  const prizes = [
    { id: 'badge_unique', name: 'Insignia Única', description: 'Una estrella dorada al lado de tu nombre.', cost: 300, icon: '⭐', currency: 'coins' },
    { id: 'profile_frame', name: 'Marco de Avatar', description: 'Un borde brillante para tu foto de perfil.', cost: 500, icon: '🖼️', currency: 'coins' },
    { id: 'full_profile_frame', name: 'Marco de Perfil Completo', description: 'Un diseño exclusivo que rodea todo tu perfil.', cost: 1500, icon: '👑', currency: 'coins' },
    { id: 'theme_custom', name: 'Color de Interfaz', description: 'Cambia el color principal de tu aplicación.', cost: 1000, icon: '🎨', currency: 'coins' },
    { id: 'premium_theme', name: 'Tema Premium', description: 'Sube tu propia imagen de fondo para tu perfil.', cost: 2000, icon: '✨', currency: 'coins' },
    { id: 'user_list_access', name: 'Lista de Usuarios', description: 'Acceso a la lista completa de exploradores.', cost: 800, icon: '📋', currency: 'coins' },
    { id: 'follow_request', name: 'Solicitud de Seguir', description: 'Sistema de seguimiento por aprobación.', cost: 400, icon: '🤝', currency: 'coins' },
    { id: 'diamond_pack_1', name: 'Pack 10 Diamantes', description: 'DiamantesCoint para funciones exclusivas.', cost: 5000, icon: '💎', currency: 'coins' },
    ...pets.map(p => ({ 
      ...p, 
      type: 'pet',
      icon: (
        <img 
          key={p.image} 
          src={p.image} 
          className="w-12 h-12 object-contain mx-auto" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes('weserv.nl')) {
              target.src = p.image.replace('https://images.weserv.nl/?url=', 'https://');
            }
          }}
        />
      )
    })),
  ];

  const handleBuy = async (prize: any) => {
    const currentBalance = prize.currency === 'diamonds' ? (profile.diamonds || 0) : (profile.coins || 0);
    
    if (currentBalance < prize.cost) {
      setError(`No tienes suficientes ${prize.currency === 'diamonds' ? 'DiamantesCoint' : 'CupiraCoins'}. Te faltan ${prize.cost - currentBalance} 🦊`);
      return;
    }

    if (profile.inventory?.includes(prize.id) && prize.id !== 'diamond_pack_1') {
      // If it's a pet, allow equipping/unequipping it
      if (prize.type === 'pet' || prize.id.startsWith('pet_')) {
        try {
          const newPet = profile.activePet === prize.id ? null : prize.id;
          await updateDoc(doc(db, 'users', profile.uid), { activePet: newPet });
          setSuccessMessage(newPet ? `¡Has equipado a ${prize.name}!` : `Has desequipado a ${prize.name}`);
          return;
        } catch (err: any) {
          setError("Error al gestionar mascota: " + err.message);
          return;
        }
      }
      setError("Ya has desbloqueado este premio.");
      return;
    }

    try {
      if (prize.currency === 'diamonds') {
        await updateDiamonds(profile.uid, -prize.cost);
      } else {
        await updateCoins(profile.uid, -prize.cost);
      }

      if (prize.id === 'diamond_pack_1') {
        await updateDiamonds(profile.uid, 10);
        setSuccessMessage(`¡Has comprado 10 DiamantesCoint!`);
        return; // Don't add to inventory
      }

      const updates: any = {
        inventory: arrayUnion(prize.id)
      };

      if (prize.id.startsWith('pet_')) {
        updates.activePet = prize.id;
      }

      await updateDoc(doc(db, 'users', profile.uid), updates);
      setSuccessMessage(`¡Felicidades! Has desbloqueado: ${prize.name}`);
    } catch (err: any) {
      console.error("Error buying prize:", err);
      setError("Error al procesar la compra: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
      <div className="mb-8 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-yellow-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-yellow-500/20"
        >
          <ShoppingBag size={32} className="text-zinc-900" strokeWidth={2.5} />
        </motion.div>
        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Tienda CupiraApp ✨</h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Canjea tus CupiraCoins y DiamantesCoint</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        {prizes.map((prize, idx) => (
          <motion.div
            key={prize.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-zinc-900/80 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] border border-white/10 flex flex-col justify-between group hover:bg-zinc-800/80 transition-all"
          >
            <div>
              <div className="text-3xl md:text-4xl mb-3 group-hover:scale-110 transition-transform duration-500">{prize.icon}</div>
              <h3 className="text-sm md:text-lg font-black text-white mb-1 truncate">{prize.name}</h3>
              <p className="text-zinc-500 font-medium text-[10px] md:text-xs leading-tight mb-4 line-clamp-2">{prize.description}</p>
            </div>
            <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
              {prize.id === 'theme_custom' && profile.inventory?.includes('theme_custom') && (
                <div className="flex flex-wrap gap-2 mb-2 justify-center">
                  {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'].map(color => (
                    <button 
                      key={color}
                      onClick={async () => {
                        await updateDoc(doc(db, 'users', profile.uid), { themeColor: color });
                        setSuccessMessage("Color de interfaz actualizado.");
                      }}
                      className={`w-6 h-6 rounded-full border-2 ${profile.themeColor === color ? 'border-white scale-110 shadow-lg' : 'border-white/20'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
              {prize.id === 'premium_theme' && profile.inventory?.includes('premium_theme') && (
                <div className="mt-2">
                  <input 
                    type="file" 
                    id="bg-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 500 * 1024) {
                          setError("La imagen es demasiado grande. Máximo 500KB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          await updateDoc(doc(db, 'users', profile.uid), { profileBg: reader.result });
                          setSuccessMessage("Fondo de perfil actualizado.");
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button 
                    onClick={() => document.getElementById('bg-upload')?.click()}
                    className="w-full py-2 bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-zinc-700 transition-all"
                  >
                    Subir Fondo
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className={`w-4 h-4 ${prize.currency === 'diamonds' ? 'bg-cyan-500' : 'bg-yellow-500'} rounded-full flex items-center justify-center`}>
                  <span className="text-[6px] font-black text-zinc-900">{prize.currency === 'diamonds' ? 'D' : 'F'}</span>
                </div>
                <span className={`text-sm md:text-base font-black ${prize.currency === 'diamonds' ? 'text-cyan-500' : 'text-yellow-500'} tracking-tighter`}>{prize.cost}</span>
              </div>
              <button 
                onClick={() => handleBuy(prize)}
                disabled={profile.inventory?.includes(prize.id) && prize.id !== 'diamond_pack_1'}
                className={`w-full py-2 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl ${
                  profile.inventory?.includes(prize.id) && prize.id !== 'diamond_pack_1'
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-white text-zinc-900 hover:bg-red-500 hover:text-white'
                }`}
              >
                {profile.inventory?.includes(prize.id) && prize.id !== 'diamond_pack_1' ? (
                  prize.id.startsWith('pet_') ? (profile.activePet === prize.id ? 'Desequipar' : 'Equipar') : 'OK'
                ) : 'Canjear'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Profile View ---

function ImageModal({ src, onClose, onDelete, onEdit, canEdit }: { src: string, onClose: () => void, onDelete?: () => void, onEdit?: () => void, canEdit?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-10 right-10 flex gap-4">
        {canEdit && (
          <>
            {onEdit && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-4 bg-zinc-800 text-white rounded-2xl shadow-2xl hover:bg-zinc-700 transition-all active:scale-90"
                title="Cambiar foto"
              >
                <Camera size={24} strokeWidth={3} />
              </button>
            )}
            {onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-4 bg-red-600 text-white rounded-2xl shadow-2xl hover:bg-red-700 transition-all active:scale-90"
                title="Eliminar foto"
              >
                <Trash2 size={24} strokeWidth={3} />
              </button>
            )}
          </>
        )}
        <button 
          onClick={onClose}
          className="p-4 bg-zinc-800 text-white rounded-2xl shadow-2xl hover:bg-zinc-700 transition-all active:scale-90"
        >
          <X size={24} strokeWidth={3} />
        </button>
      </div>
      
      <motion.img 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        src={src} 
        alt="Full screen" 
        className="max-w-full max-h-[80vh] object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
        onClick={(e) => e.stopPropagation()}
      />
      
      <p className="mt-8 text-zinc-500 font-black uppercase tracking-[0.3em] text-xs">Toca fuera para cerrar</p>
    </motion.div>
  );
}

function ProfileView({ profile, isOwn, targetUserId, onUserClick, onMessageClick, setError, setSuccessMessage }: { profile: User, isOwn: boolean, targetUserId?: string, onUserClick: (uid: string) => void, onMessageClick: (uid: string) => void, setError: (m: string) => void, setSuccessMessage: (m: string) => void }) {
  const [targetProfile, setTargetProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [filteredFollowers, setFilteredFollowers] = useState<string[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showList, setShowList] = useState<'followers' | 'following' | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', location: '', status: '' });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uid = targetUserId || profile.uid;
  const canEdit = isOwn || profile.role === 'admin';

  useEffect(() => {
    const unsubProfile = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setTargetProfile(data);
        setEditData({ 
          displayName: data.displayName || '', 
          location: data.location || '', 
          status: data.status || '' 
        });
      }
    });

    const qPosts = query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    });

    const qFollowers = query(collection(db, 'follows'), where('followingId', '==', uid));
    const unsubFollowers = onSnapshot(qFollowers, (snapshot) => {
      setFollowers(snapshot.docs.map(doc => doc.data().followerId));
      setIsFollowing(snapshot.docs.some(doc => doc.data().followerId === profile.uid));
    });

    const qFollowing = query(collection(db, 'follows'), where('followerId', '==', uid));
    const unsubFollowing = onSnapshot(qFollowing, (snapshot) => {
      setFollowing(snapshot.docs.map(doc => doc.data().followingId));
    });

    return () => { unsubProfile(); unsubPosts(); unsubFollowers(); unsubFollowing(); };
  }, [uid, profile.uid]);

  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'follow_requests'), where('fromId', '==', profile.uid), where('toId', '==', uid), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => setHasPendingRequest(!snap.empty));
  }, [uid, profile.uid]);

  useEffect(() => {
    if (!isOwn) return;
    const q = query(collection(db, 'follow_requests'), where('toId', '==', profile.uid), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [isOwn, profile.uid]);

  const handleAcceptRequest = async (req: any) => {
    try {
      await addDoc(collection(db, 'follows'), {
        followerId: req.fromId,
        followingId: profile.uid
      });
      await deleteDoc(doc(db, 'follow_requests', req.id));
      setSuccessMessage("Solicitud aceptada.");
    } catch (err: any) {
      setError("Error: " + err.message);
    }
  };

  const handleRejectRequest = async (req: any) => {
    try {
      await deleteDoc(doc(db, 'follow_requests', req.id));
      setSuccessMessage("Solicitud rechazada.");
    } catch (err: any) {
      setError("Error: " + err.message);
    }
  };

  const handleFollow = async () => {
    if (isFollowing) {
      const q = query(collection(db, 'follows'), where('followerId', '==', profile.uid), where('followingId', '==', uid));
      const snap = await getDocs(q);
      snap.forEach(async (d) => await deleteDoc(doc(db, 'follows', d.id)));
    } else {
      if (targetProfile?.inventory?.includes('follow_request')) {
        if (hasPendingRequest) {
          setSuccessMessage("Ya has enviado una solicitud.");
          return;
        }
        await addDoc(collection(db, 'follow_requests'), {
          fromId: profile.uid,
          fromName: profile.displayName,
          fromPhoto: profile.photoURL,
          toId: uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        setSuccessMessage("Solicitud de seguimiento enviada.");
      } else {
        await addDoc(collection(db, 'follows'), {
          followerId: profile.uid,
          followingId: uid
        });
      }
    }
  };

  const handleUpdateImage = async (type: 'photoURL' | 'coverURL' | 'gallery', e: React.ChangeEvent<HTMLInputElement>, replaceUrl?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 150 * 1024) {
        alert("La imagen es demasiado grande. Por favor, elige una de menos de 150KB.");
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          if (type === 'gallery') {
            if (replaceUrl) {
              // Reemplazar una imagen existente
              const currentGallery = targetProfile?.gallery || [];
              const newGallery = currentGallery.map(img => img === replaceUrl ? dataUrl : img);
              await updateDoc(doc(db, 'users', uid), { gallery: newGallery });
            } else {
              await updateDoc(doc(db, 'users', uid), { gallery: arrayUnion(dataUrl) });
            }
          } else {
            await updateDoc(doc(db, 'users', uid), { [type]: dataUrl });
          }
          setSelectedImage(null);
        } catch (err: any) {
          console.error("Error al actualizar imagen:", err);
          alert("Error al guardar la imagen: " + err.message);
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: editData.displayName,
        location: editData.location,
        status: editData.status
      });
      setIsEditing(false);
      console.log("Perfil guardado con éxito");
    } catch (err: any) {
      console.error("Error al guardar perfil:", err);
      alert("Error al guardar los cambios: " + err.message);
    }
  };

  const handleDeleteImage = async (imgUrl: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta foto de tu galería?")) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        gallery: arrayRemove(imgUrl)
      });
      setSelectedImage(null);
    } catch (err: any) {
      console.error("Error al eliminar imagen:", err);
      alert("Error al eliminar la imagen: " + err.message);
    }
  };

  const fetchUsersList = async (ids: string[], type: 'followers' | 'following') => {
    if (ids.length === 0) {
      if (type === 'followers') setFilteredFollowers([]);
      else setFilteredFollowing([]);
      setUsersList([]);
      return;
    }
    const list: User[] = [];
    const validIds: string[] = [];
    for (const id of ids) {
      const d = await getDoc(doc(db, 'users', id));
      if (d.exists()) {
        const userData = d.data() as User;
        if (!userData.isDeleted) {
          list.push(userData);
          validIds.push(id);
        }
      } else {
        // Limpiar relaciones huérfanas
        const q1 = query(collection(db, 'follows'), where('followerId', '==', id));
        const q2 = query(collection(db, 'follows'), where('followingId', '==', id));
        const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        s1.forEach(doc => deleteDoc(doc.ref));
        s2.forEach(doc => deleteDoc(doc.ref));
      }
    }
    if (type === 'followers') setFilteredFollowers(validIds);
    else setFilteredFollowing(validIds);
    setUsersList(list);
  };

  useEffect(() => {
    if (showList === 'followers') fetchUsersList(followers, 'followers');
    if (showList === 'following') fetchUsersList(following, 'following');
  }, [showList, followers, following]);

  // Efecto para mantener los contadores actualizados sin abrir el modal
  useEffect(() => {
    const updateCounts = async () => {
      const f1: string[] = [];
      for (const id of followers) {
        const d = await getDoc(doc(db, 'users', id));
        if (d.exists() && !(d.data() as User).isDeleted) f1.push(id);
      }
      setFilteredFollowers(f1);

      const f2: string[] = [];
      for (const id of following) {
        const d = await getDoc(doc(db, 'users', id));
        if (d.exists() && !(d.data() as User).isDeleted) f2.push(id);
      }
      setFilteredFollowing(f2);
    };
    updateCounts();
  }, [followers, following]);

  if (!targetProfile) return <Loading />;

  return (
    <div className={`space-y-8 pb-10 rounded-[3.5rem] transition-all duration-500 ${targetProfile.inventory?.includes('full_profile_frame') ? 'p-4 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : ''}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/90 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 relative"
        style={targetProfile.inventory?.includes('premium_theme') && targetProfile.profileBg ? {
          backgroundImage: `url(${targetProfile.profileBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}}
      >
        {targetProfile.inventory?.includes('premium_theme') && targetProfile.profileBg && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
        )}
        <div className="h-64 bg-zinc-800 relative group">
          <img src={targetProfile.coverURL} alt="cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
          {canEdit && (
            <>
              <button onClick={() => coverInputRef.current?.click()} className="absolute bottom-6 right-6 bg-white/10 backdrop-blur-md text-white p-4 rounded-2xl hover:bg-white/20 transition-all shadow-xl border border-white/10">
                <Camera size={24} strokeWidth={2.5} />
              </button>
              <input type="file" ref={coverInputRef} onChange={(e) => handleUpdateImage('coverURL', e)} className="hidden" accept="image/*" />
            </>
          )}
        </div>
        
        <div className="px-10 pb-10 relative z-10">
          <div className="absolute -top-24 left-10">
            <div className="relative group/avatar">
              <div className={`w-44 h-44 rounded-[3rem] border-8 border-zinc-900 bg-zinc-900 overflow-hidden shadow-2xl transition-transform group-hover/avatar:scale-105 duration-500 ${targetProfile.inventory?.includes('profile_frame') ? 'p-2 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 animate-pulse' : ''}`}>
                <img src={targetProfile.photoURL} alt="profile" className="w-full h-full object-cover rounded-[2.5rem]" />
              </div>
              {canEdit && (
                <>
                  <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-2 right-2 bg-primary text-white p-4 rounded-2xl border-4 border-zinc-900 hover:opacity-90 transition-all shadow-2xl active:scale-90">
                    <Camera size={22} strokeWidth={2.5} />
                  </button>
                  <input type="file" ref={photoInputRef} onChange={(e) => handleUpdateImage('photoURL', e)} className="hidden" accept="image/*" />
                </>
              )}
            </div>
          </div>
          
          <div className="pt-28 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">{targetProfile.displayName}</h1>
                {targetProfile.inventory?.includes('badge_unique') && <Sparkles size={28} className="text-yellow-500 animate-bounce" />}
                {targetProfile.role === 'admin' && (
                  <div className="bg-primary text-white p-1.5 rounded-xl shadow-xl shadow-primary/20" title="Administrador">
                    <ShieldCheck size={22} strokeWidth={3} />
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-6 bg-zinc-800/50 p-6 rounded-[2rem] border border-white/5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Nombre Público</label>
                    <input 
                      type="text" placeholder="Tu nombre" 
                      className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-white placeholder:text-zinc-500 shadow-inner transition-all"
                      value={editData.displayName} onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Ubicación</label>
                    <input 
                      type="text" placeholder="¿Dónde vives?" 
                      className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-white placeholder:text-zinc-500 shadow-inner transition-all"
                      value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Biografía / Estado</label>
                    <input 
                      type="text" placeholder="Estado actual (Bio)" 
                      className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-white placeholder:text-zinc-500 shadow-inner transition-all"
                      value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveProfile} className="bg-primary text-white px-8 py-3 rounded-2xl text-sm font-black shadow-xl shadow-primary/20 hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest">Guardar</button>
                    <button onClick={() => setIsEditing(false)} className="bg-zinc-700 text-zinc-300 px-8 py-3 rounded-2xl text-sm font-black hover:bg-zinc-600 transition-all uppercase tracking-widest">Cancelar</button>
                  </div>
                </motion.div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-zinc-400 text-xl font-medium leading-relaxed italic">"{targetProfile.status || "Sin estado actual"}"</p>
                  <div className="flex flex-wrap gap-4">
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-zinc-800/50 px-4 py-2 rounded-2xl border border-white/5">
                      <Home size={16} strokeWidth={2.5} className="text-primary" /> {targetProfile.location || "Planeta Tierra"}
                    </p>
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-zinc-800/50 px-4 py-2 rounded-2xl border border-white/5">
                      <Users size={16} strokeWidth={2.5} className="text-primary" /> {targetProfile.role === 'admin' ? 'Administrador' : 'Miembro'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              {canEdit && !isEditing && (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="px-8 py-4 bg-zinc-800 text-white rounded-[1.5rem] font-black text-sm shadow-xl border border-white/5 hover:bg-zinc-700 transition-all active:scale-95 uppercase tracking-widest"
                >
                  Editar Perfil
                </button>
              )}
              {!isOwn && (
                <div className="flex gap-3">
                  <button 
                    onClick={handleFollow}
                    className={`px-10 py-4 rounded-[1.5rem] font-black text-sm transition-all shadow-xl active:scale-95 uppercase tracking-widest ${
                      isFollowing 
                      ? 'bg-zinc-800 text-white border border-white/5 hover:bg-zinc-700' 
                      : hasPendingRequest
                      ? 'bg-zinc-800 text-yellow-500 border border-yellow-500/20'
                      : 'bg-primary text-white hover:opacity-90 shadow-primary/20'
                    }`}
                  >
                    {isFollowing ? 'Siguiendo' : hasPendingRequest ? 'Pendiente' : targetProfile?.inventory?.includes('follow_request') ? 'Solicitar' : 'Seguir'}
                  </button>
                  <button 
                    onClick={() => onMessageClick(uid)}
                    className="px-8 py-4 bg-zinc-800 text-white rounded-[1.5rem] font-black text-sm shadow-xl border border-white/5 hover:bg-zinc-700 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Mensaje
                  </button>
                </div>
              )}
            </div>
          </div>

          {isOwn && pendingRequests.length > 0 && (
            <div className="mt-12 bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Users size={16} className="text-primary" /> Solicitudes de Seguimiento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-zinc-800/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center justify-between group hover:bg-zinc-700/80 transition-all">
                    <div className="flex items-center gap-3">
                      <img src={req.fromPhoto} alt="avatar" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
                      <div>
                        <p className="font-black text-white text-sm tracking-tight">{req.fromName}</p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Quiere seguirte</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAcceptRequest(req)} 
                        className="p-3 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all active:scale-90"
                        title="Aceptar"
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(req)} 
                        className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                        title="Rechazar"
                      >
                        <X size={20} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-6 mt-6 border-t border-white/5 pt-6">
            <button onClick={() => setShowList('followers')} className="group transition-all">
              <p className="text-2xl font-black text-white group-hover:text-red-500 transition-colors">{filteredFollowers.length}</p>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Seguidores</p>
            </button>
            <button onClick={() => setShowList('following')} className="group transition-all">
              <p className="text-2xl font-black text-white group-hover:text-red-500 transition-colors">{filteredFollowing.length}</p>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Siguiendo</p>
            </button>
            <div className="group transition-all">
              <p className="text-2xl font-black text-white">{posts.length}</p>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Posts</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gallery */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/10"
      >
        <div className="flex justify-between items-center mb-8">
          <div className="flex flex-col">
            <h2 className="font-black text-3xl text-white tracking-tighter uppercase">Galería Multimedia</h2>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mt-1">Fotos subidas y publicadas</p>
          </div>
          {canEdit && (
            <>
              <button 
                onClick={() => galleryInputRef.current?.click()} 
                className="bg-red-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-3 shadow-xl shadow-red-600/20"
              >
                <PlusCircle size={20} strokeWidth={3} /> Añadir Foto
              </button>
              <input type="file" ref={galleryInputRef} onChange={(e) => handleUpdateImage('gallery', e)} className="hidden" accept="image/*" />
              <input type="file" id="replaceInput" onChange={(e) => handleUpdateImage('gallery', e, selectedImage!)} className="hidden" accept="image/*" />
            </>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          {/* Fotos de la Galería */}
          {targetProfile.gallery?.map((img, idx) => (
            <motion.div 
              key={`gallery-${idx}`} 
              whileHover={{ scale: 1.05, rotate: idx % 2 === 0 ? 1 : -1 }}
              onClick={() => setSelectedImage(img)}
              className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-zinc-800 shadow-2xl bg-zinc-800 cursor-pointer group relative"
            >
              <img src={img} alt={`gallery-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye size={32} className="text-white" strokeWidth={3} />
              </div>
            </motion.div>
          ))}
          
          {/* Fotos de Publicaciones */}
          {posts.filter(p => p.imageURL).map((post, idx) => (
            <motion.div 
              key={`post-img-${idx}`} 
              whileHover={{ scale: 1.05, rotate: idx % 2 === 0 ? -1 : 1 }}
              onClick={() => setSelectedImage(post.imageURL!)}
              className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-blue-900/30 shadow-2xl bg-zinc-800 cursor-pointer group relative"
            >
              <img src={post.imageURL} alt={`post-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <MessageSquare size={24} className="text-white" strokeWidth={3} />
                <span className="text-[8px] font-black text-white uppercase tracking-widest">De Publicación</span>
              </div>
            </motion.div>
          ))}

          {(!targetProfile.gallery || targetProfile.gallery.length === 0) && posts.filter(p => p.imageURL).length === 0 && (
            <div className="col-span-3 text-center py-20 bg-zinc-800/30 rounded-[3rem] border-2 border-dashed border-white/10">
              <ImageIcon size={64} className="mx-auto text-zinc-700 mb-4" strokeWidth={1} />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm italic">No hay fotos multimedia todavía</p>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedImage && (
          <ImageModal 
            src={selectedImage} 
            onClose={() => setSelectedImage(null)} 
            onDelete={targetProfile.gallery?.includes(selectedImage) ? () => handleDeleteImage(selectedImage) : undefined}
            onEdit={targetProfile.gallery?.includes(selectedImage) ? () => document.getElementById('replaceInput')?.click() : undefined}
            canEdit={canEdit}
          />
        )}
      </AnimatePresence>

      <div className="space-y-8">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Publicaciones</h2>
          <div className="h-1 flex-1 mx-8 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full w-24 bg-primary rounded-full"></div>
          </div>
        </div>
        
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} profile={profile} onUserClick={onUserClick} />
            ))}
          </AnimatePresence>
          {posts.length === 0 && (
            <div className="text-center py-20 bg-zinc-900/50 rounded-[3rem] border border-white/5">
              <p className="text-zinc-600 font-black uppercase tracking-widest italic">No hay publicaciones aún</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showList && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-start justify-center p-4 z-[100] overflow-y-auto pt-20">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 rounded-[2rem] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl border border-white/10 mb-20"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-800/50">
                <h3 className="font-black text-lg text-white tracking-tighter uppercase">{showList === 'followers' ? 'Seguidores' : 'Siguiendo'}</h3>
                <button onClick={() => setShowList(null)} className="p-2 hover:bg-zinc-800 rounded-xl transition-all">
                  <X size={18} strokeWidth={3} className="text-zinc-500 hover:text-white" />
                </button>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 custom-scrollbar flex-1">
                {usersList.length > 0 ? usersList.map((u) => (
                  <div 
                    key={u.uid} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800 p-2.5 rounded-xl transition-all group border border-transparent hover:border-white/5"
                    onClick={() => { onUserClick(u.uid); setShowList(null); }}
                  >
                    <img src={u.photoURL} alt="avatar" className="w-10 h-10 rounded-xl shadow-xl group-hover:scale-110 transition-transform border-2 border-white/10" />
                    <div>
                      <p className="font-black text-sm text-white group-hover:text-red-500 transition-colors">{u.displayName}</p>
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{u.role === 'admin' ? 'Administrador' : 'Miembro'}</p>
                    </div>
                    {profile.role === 'admin' ? (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const q = query(
                              collection(db, 'follows'), 
                              where('followerId', '==', showList === 'followers' ? u.uid : uid),
                              where('followingId', '==', showList === 'followers' ? uid : u.uid)
                            );
                            const snap = await getDocs(q);
                            for (const d of snap.docs) {
                              await deleteDoc(d.ref);
                            }
                            console.log("Relación de seguimiento eliminada por admin");
                          } catch (err: any) {
                            console.error("Error al eliminar seguimiento:", err);
                            setError("Error: " + err.message);
                          }
                        }}
                        className="ml-auto p-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        title="Eliminar relación"
                      >
                        <Trash2 size={18} strokeWidth={3} />
                      </button>
                    ) : (
                      <ArrowRight size={20} className="ml-auto text-zinc-700 group-hover:text-red-500 transition-colors" />
                    )}
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                    <Users size={40} strokeWidth={1} className="mb-2 opacity-20" />
                    <p className="font-black text-xs uppercase tracking-[0.2em]">Cargando lista...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Users List View ---

function UsersListView({ onUserClick }: { onUserClick: (uid: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User).filter(u => !u.isDeleted));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Exploradores</h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Comunidad CupiraApp</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map(u => (
          <motion.div 
            key={u.uid} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onUserClick(u.uid)}
            className="bg-zinc-900/80 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 flex items-center gap-5 cursor-pointer hover:bg-zinc-800 transition-all group shadow-xl"
          >
            <div className={`relative ${u.inventory?.includes('profile_frame') ? 'p-1 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 rounded-2xl animate-pulse' : ''}`}>
              <img src={u.photoURL} alt="avatar" className="w-14 h-14 rounded-xl object-cover shadow-2xl group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-black text-white text-lg tracking-tight group-hover:text-red-500 transition-colors">{u.displayName}</p>
                {u.inventory?.includes('badge_unique') && <Sparkles size={16} className="text-yellow-500 animate-bounce" />}
              </div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{u.role === 'admin' ? 'Administrador' : 'Explorador'}</p>
            </div>
            <ArrowRight size={20} className="ml-auto text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Admin Users View ---

const PETS = [
  { id: 'pet_purple_boba', name: 'Gatita Boba', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/b8229879-1300-4786-905c-3738596659c0.png', cost: 150, currency: 'diamonds', description: 'Le encanta el boba tea.' },
  { id: 'pet_pink_sitting', name: 'Niña Rosa', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/76866879-1300-4786-905c-3738596659c0.png', cost: 150, currency: 'diamonds', description: 'Una compañía tranquila.' },
  { id: 'pet_jiraiya', name: 'Sabio Chibi', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/69866879-1300-4786-905c-3738596659c0.png', cost: 200, currency: 'diamonds', description: 'El sabio legendario.' },
  { id: 'pet_gura', name: 'Tiburoncina', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/e045a794-6880-4573-8902-18451f211322.png', cost: 200, currency: 'diamonds', description: '¡Aaaaah! Tiburón.' },
  { id: 'pet_artist', name: 'Pequeña Artista', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/87a99602-0941-4712-9c42-2b6228308876.png', cost: 180, currency: 'diamonds', description: 'Siempre dibujando.' },
  { id: 'pet_flower_girl', name: 'Dama Floral', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/33499440-230f-48e0-a7d1-04279093226a.png', cost: 180, currency: 'diamonds', description: 'Elegancia y pétalos.' },
  { id: 'pet_bunny_hoodie', name: 'Conejita Blanca', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/8604856f-656f-40e1-88f2-89587f7a635a.png', cost: 150, currency: 'diamonds', description: 'Tierna y saltarina.' },
  { id: 'pet_rainbow_streak', name: 'Gatita Arcoíris', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/972688f9-4d9f-4315-9921-2771761612e4.png', cost: 150, currency: 'diamonds', description: 'Colores por todos lados.' },
  { id: 'pet_thumbs_up', name: 'Chico Genial', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/14101e69-0521-4993-9467-96a943a50239.png', cost: 150, currency: 'diamonds', description: 'Todo está bajo control.' },
  { id: 'pet_devil_suit', name: 'Diablillo Elegante', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/2680879f-067d-4171-9257-817865809117.png', cost: 200, currency: 'diamonds', description: 'Un toque travieso.' },
  { id: 'pet_cat_hoodie', name: 'Gatita Hoodie', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/9c229879-1300-4786-905c-3738596659c0.png', cost: 150, currency: 'diamonds', description: 'Cómoda y tierna.' },
  { id: 'pet_anya', name: 'Anya Chibi', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/ac229879-1300-4786-905c-3738596659c0.png', cost: 200, currency: 'diamonds', description: '¡Waku waku!' },
  { id: 'pet_strawberry', name: 'Gatita Fresa', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/bc229879-1300-4786-905c-3738596659c0.png', cost: 150, currency: 'diamonds', description: 'Dulce como una fresa.' },
  { id: 'pet_cinnamoroll_girl', name: 'Cinnamoroll Girl', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/cc229879-1300-4786-905c-3738596659c0.png', cost: 150, currency: 'diamonds', description: 'Suave como una nube.' },
  { id: 'pet_shark_boy', name: 'Tiburón Boy', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/dc229879-1300-4786-905c-3738596659c0.png', cost: 200, currency: 'diamonds', description: 'Explorador marino.' },
  { id: 'pet_devil_girl_white', name: 'Diablilla Blanca', image: 'https://images.weserv.nl/?url=storage.googleapis.com/static.antigravity.ai/user_uploads/139d92f9-893b-45d7-85e8-8a8ddf3c4fce/ec229879-1300-4786-905c-3738596659c0.png', cost: 200, currency: 'diamonds', description: 'Misteriosa y poderosa.' },
];

function PetDisplay({ pets, petId }: { pets: Pet[], petId: string }) {
  const pet = pets.find(p => p.id === petId);
  if (!pet) return null;

  return (
    <motion.div
      drag
      dragConstraints={{ left: -150, right: 150, top: -150, bottom: 150 }}
      initial={{ opacity: 0, scale: 0.5, x: 100 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: 0,
        y: [0, -15, 0],
        rotate: [-2, 2, -2],
      }}
      transition={{
        y: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        },
        rotate: {
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        },
        opacity: { duration: 0.5 },
        scale: { type: "spring", stiffness: 300, damping: 20 }
      }}
      className="fixed bottom-24 right-8 z-50 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="relative group">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center"
        >
          <img 
            key={pet.image}
            src={pet.image} 
            alt={pet.name} 
            className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src.includes('weserv.nl')) {
                target.src = pet.image.replace('https://images.weserv.nl/?url=', 'https://');
              }
            }}
          />
        </motion.div>
        
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-black text-white uppercase tracking-widest">{pet.name}</p>
        </div>
      </div>
    </motion.div>
  );
}


function AdminUsersView({ onUserClick, setError, setSuccessMessage }: { onUserClick: (uid: string) => void, setError: (m: string) => void, setSuccessMessage: (m: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [customCoins, setCustomCoins] = useState<{ [uid: string]: string }>({});
  const [customDiamonds, setCustomDiamonds] = useState<{ [uid: string]: string }>({});

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Correo de restablecimiento enviado con éxito.");
    } catch (err: any) {
      alert("Error al enviar el correo: " + err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Gestión de Usuarios</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mt-2">Panel de Administración / Usuarios</p>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 flex items-center gap-4">
          <Users className="text-primary" size={24} strokeWidth={3} />
          <span className="text-xl font-black text-white">{users.length}</span>
          <span className="text-zinc-500 font-black text-[10px] uppercase tracking-widest">Total</span>
        </div>
      </div>

      <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={28} strokeWidth={3} />
          <input 
            type="text" 
            placeholder="Busca por nombre o correo electrónico..." 
            className="w-full pl-16 pr-8 py-6 bg-zinc-800/50 rounded-[2rem] border-2 border-transparent focus:border-primary/20 focus:bg-zinc-800 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-xl font-black text-white placeholder:text-zinc-600 shadow-inner"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredUsers.map((u) => (
          <motion.div 
            key={u.uid}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-8 group"
          >
            <div className="flex items-center gap-6 cursor-pointer" onClick={() => onUserClick(u.uid)}>
              <img src={u.photoURL} alt="avatar" className="w-20 h-20 rounded-[2rem] shadow-2xl group-hover:scale-110 transition-transform duration-500 border-2 border-white/10" />
              <div>
                <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors tracking-tight">{u.displayName}</h3>
                <p className="text-sm font-bold text-zinc-400 mt-1">{u.email}</p>
                <div className="flex gap-3 mt-3">
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-blue-600/20 text-blue-500'}`}>
                    {u.role === 'admin' ? 'Administrador' : 'Miembro'}
                  </span>
                  <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-500">
                    UID: {u.uid.substring(0, 8)}...
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex flex-col gap-2">
                <div className="flex items-center bg-zinc-800 rounded-2xl p-1 border border-white/5">
                  <input 
                    type="number" 
                    placeholder="Coins" 
                    className="w-20 bg-transparent border-none outline-none text-white px-4 font-black text-xs"
                    value={customCoins[u.uid] || ''}
                    onChange={(e) => setCustomCoins({ ...customCoins, [u.uid]: e.target.value })}
                  />
                  <button 
                    onClick={async () => {
                      const amount = parseInt(customCoins[u.uid]);
                      if (isNaN(amount)) return;
                      try {
                        await updateDoc(doc(db, 'users', u.uid), { coins: (u.coins || 0) + amount });
                        setSuccessMessage(`Se han otorgado ${amount} CupiraCoins a ${u.displayName}`);
                        setCustomCoins({ ...customCoins, [u.uid]: '' });
                      } catch (err: any) {
                        setError("Error: " + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-yellow-500 text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-yellow-400 transition-all active:scale-95"
                  >
                    Coins
                  </button>
                </div>
                <div className="flex items-center bg-zinc-800 rounded-2xl p-1 border border-white/5">
                  <input 
                    type="number" 
                    placeholder="Diamonds" 
                    className="w-20 bg-transparent border-none outline-none text-white px-4 font-black text-xs"
                    value={customDiamonds[u.uid] || ''}
                    onChange={(e) => setCustomDiamonds({ ...customDiamonds, [u.uid]: e.target.value })}
                  />
                  <button 
                    onClick={async () => {
                      const amount = parseInt(customDiamonds[u.uid]);
                      if (isNaN(amount)) return;
                      try {
                        await updateDoc(doc(db, 'users', u.uid), { diamonds: (u.diamonds || 0) + amount });
                        setSuccessMessage(`Se han otorgado ${amount} DiamantesCoint a ${u.displayName}`);
                        setCustomDiamonds({ ...customDiamonds, [u.uid]: '' });
                      } catch (err: any) {
                        setError("Error: " + err.message);
                      }
                    }}
                    className="px-3 py-2 bg-cyan-500 text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-400 transition-all active:scale-95"
                  >
                    Diam
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={async () => {
                    if (!window.confirm(`¿Resetear juegos diarios de ${u.displayName}?`)) return;
                    try {
                      await updateDoc(doc(db, 'users', u.uid), { 
                        dailyPlays: { lastDate: '', luck: 0, memory: 0, trivia: 0 } 
                      });
                      setSuccessMessage(`Juegos de ${u.displayName} reseteados.`);
                    } catch (err: any) {
                      setError("Error: " + err.message);
                    }
                  }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all border border-white/5 active:scale-95"
                >
                  Reset Juegos
                </button>
                <button 
                  onClick={async () => {
                    if (!window.confirm(`¿Resetear inventario de ${u.displayName}?`)) return;
                    try {
                      await updateDoc(doc(db, 'users', u.uid), { inventory: [], themeColor: null });
                      setSuccessMessage(`Inventario de ${u.displayName} reseteado.`);
                    } catch (err: any) {
                      setError("Error: " + err.message);
                    }
                  }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all border border-white/5 active:scale-95"
                >
                  Reset Inv
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleResetPassword(u.email)}
                  className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-700 transition-all border border-white/5 active:scale-95"
                >
                  Reset Clave
                </button>
                <button 
                  onClick={() => onUserClick(u.uid)}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  Ver Perfil
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 rounded-[4rem] border border-white/5">
            <Search size={64} className="mx-auto text-zinc-800 mb-6" strokeWidth={1} />
            <p className="text-zinc-600 font-black text-xl uppercase tracking-[0.2em] italic">No se encontraron usuarios</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPetsView({ pets, setError, setSuccessMessage }: { pets: Pet[], setError: (m: string) => void, setSuccessMessage: (m: string) => void }) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [cost, setCost] = useState(150);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !image) {
      setError("Nombre e imagen son obligatorios.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'pets'), {
        name,
        image,
        cost: Number(cost),
        currency: 'diamonds',
        description,
        type: 'pet',
        createdAt: serverTimestamp()
      });
      setSuccessMessage("¡MASCOTA AÑADIDA CON ÉXITO! ✨");
      setName('');
      setImage('');
      setCost(150);
      setDescription('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePet = async (id: string) => {
    if (!window.confirm("¿Eliminar esta mascota?")) return;
    try {
      await deleteDoc(doc(db, 'pets', id));
      setSuccessMessage("MASCOTA ELIMINADA");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'pets');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between mb-10 px-4">
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Mascotas</h1>
        <div className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/10">
          {pets.length} Disponibles
        </div>
      </div>

      <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl">
        <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3 uppercase tracking-tighter">
          <PlusCircle className="text-red-500" /> Añadir Nueva Mascota
        </h2>
        <form onSubmit={handleAddPet} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Nombre</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="Ej: Gatito Ninja"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Precio (Diamantes)</label>
            <input 
              type="number"
              value={cost} 
              onChange={e => setCost(Number(e.target.value))}
              className="w-full bg-zinc-800/50 border border-white/5 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Descripción</label>
            <input 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="Breve descripción..."
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Imagen (URL o Subir)</label>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                value={image} 
                onChange={e => setImage(e.target.value)}
                className="flex-1 bg-zinc-800/50 border border-white/5 p-4 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all"
                placeholder="https://..."
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-8 py-4 rounded-2xl font-black transition-all uppercase text-xs tracking-widest"
              >
                SUBIR ARCHIVO
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            </div>
            {image && (
              <div className="mt-6 p-8 bg-zinc-800/50 rounded-[2rem] border border-white/5 flex justify-center">
                <img src={image} className="h-40 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]" alt="Preview" />
              </div>
            )}
          </div>
          <button 
            disabled={isSubmitting}
            className="md:col-span-2 bg-gradient-to-r from-red-600 to-pink-600 hover:scale-[1.02] active:scale-95 text-white py-5 rounded-2xl font-black text-xl transition-all shadow-2xl shadow-red-600/30 uppercase tracking-tighter"
          >
            {isSubmitting ? "AÑADIENDO..." : "AÑADIR MASCOTA A LA TIENDA"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {pets.map(pet => (
          <motion.div 
            key={pet.id} 
            whileHover={{ y: -10 }}
            className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 flex flex-col items-center text-center group shadow-2xl"
          >
            <div className="w-32 h-32 mb-6 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-red-600/10 blur-3xl rounded-full group-hover:bg-red-600/20 transition-all"></div>
              <img src={pet.image} className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{pet.name}</h3>
            <div className="flex items-center gap-2 mt-2 mb-6">
              <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-black text-zinc-900">D</span>
              </div>
              <span className="text-sm font-black text-cyan-500">{pet.cost}</span>
            </div>
            <button 
              onClick={() => handleDeletePet(pet.id)}
              className="mt-auto w-full bg-zinc-800/50 hover:bg-red-600 text-zinc-500 hover:text-white py-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-white/5"
            >
              <Trash2 size={16} /> ELIMINAR MASCOTA
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SearchView({ profile, onUserClick }: { profile: User, onUserClick: (uid: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<User[]>([]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => doc.data() as User);
      setResults(allUsers.filter(u => 
        u.uid !== profile.uid && 
        (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
         u.email.toLowerCase().includes(searchTerm.toLowerCase()))
      ));
    });
    return unsub;
  }, [searchTerm, profile.uid]);

  return (
    <div className="space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10"
      >
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={28} strokeWidth={3} />
          <input 
            type="text" 
            placeholder="Busca amigos, vecinos o familia..." 
            className="w-full pl-16 pr-8 py-6 bg-zinc-800/50 rounded-[2rem] border-2 border-transparent focus:border-primary/20 focus:bg-zinc-800 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-xl font-black text-white placeholder:text-zinc-600 shadow-inner"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AnimatePresence mode="popLayout">
          {results.map((u, idx) => (
            <motion.div 
              key={u.uid} 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -8 }}
              className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10 flex items-center justify-between group"
            >
              <div className="flex items-center gap-6 cursor-pointer" onClick={() => onUserClick(u.uid)}>
                <div className="relative">
                  <img src={u.photoURL} alt="avatar" className="w-20 h-20 rounded-[2rem] shadow-2xl group-hover:scale-110 transition-transform duration-500 border-2 border-white/10" />
                  {u.role === 'admin' && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full border-4 border-zinc-900 shadow-xl">
                      <ShieldCheck size={16} strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div>
                <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors tracking-tight">{u.displayName}</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">{u.role === 'admin' ? 'Administrador' : 'Miembro'}</p>
                </div>
              </div>
              <button 
                onClick={() => onUserClick(u.uid)}
                className="bg-zinc-800 text-white p-5 rounded-[1.5rem] hover:bg-primary transition-all shadow-xl border border-white/5 group-hover:shadow-primary/20 active:scale-90"
              >
                <ArrowRight size={24} strokeWidth={3} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {searchTerm && results.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full text-center py-32 bg-zinc-900/50 rounded-[4rem] border border-white/5"
          >
            <Search size={64} className="mx-auto text-zinc-800 mb-6" strokeWidth={1} />
            <p className="text-zinc-600 font-black text-xl uppercase tracking-[0.2em] italic">No encontramos a ningún "{searchTerm}"</p>
            <p className="text-zinc-700 font-bold mt-4 uppercase tracking-widest text-xs">Prueba con otro nombre o correo electrónico.</p>
          </motion.div>
        )}
        
        {!searchTerm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full text-center py-20"
          >
            <p className="text-gray-300 font-black text-2xl tracking-tighter uppercase opacity-50">Empieza a escribir para buscar...</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
