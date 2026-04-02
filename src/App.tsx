/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  arrayRemove
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Post, Follow, Comment, Message } from './types';
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
  ArrowRight,
  MoreVertical,
  MessageSquare,
  ChevronLeft
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
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={48} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">{message}</h2>
        <p className="text-gray-500 mb-8 font-medium">¡Todo listo para conectar!</p>
        <button 
          onClick={onAccept}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
        >
          ACEPTAR
        </button>
      </motion.div>
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
  const [view, setView] = useState<'login' | 'register' | 'main' | 'profile' | 'search' | 'other-profile' | 'messages'>('login');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
  const [thanksMessage, setThanksMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingView, setPendingView] = useState<any>(null);

  // Auth Listener
  useEffect(() => {
    console.log("Iniciando listener de autenticación...");
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("Estado de Auth cambiado:", u ? `Usuario: ${u.email}` : "Sin usuario");
      if (u) {
        setUser(u);
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profileData = docSnap.data() as User;
            console.log("Perfil encontrado:", profileData);
            setProfile(profileData);
            // Solo cambiamos a 'main' si venimos de login/register y no hay un mensaje de éxito pendiente
            if ((view === 'login' || view === 'register') && !successMessage) {
              console.log("Cambiando a vista main");
              setView('main');
            }
          } else {
            console.warn("Perfil no encontrado para el UID:", u.uid);
            // Si estamos en login y no hay perfil, algo salió mal
            if (view === 'login' && !successMessage) {
              setError("No se encontró el perfil de usuario. Por favor, contacta a soporte.");
              await signOut(auth);
            }
            setProfile(null);
          }
        } catch (error: any) {
          console.error("Error al obtener perfil:", error);
          setError("Error al cargar perfil: " + error.message);
        }
      } else {
        console.log("Usuario desconectado");
        setUser(null);
        setProfile(null);
        if (!thanksMessage && !successMessage && view !== 'register') {
          setView('login');
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [thanksMessage, successMessage, view]);

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
          <h1 className="text-4xl font-bold mb-4">¡Gracias por usar Cupira Conectada V2!</h1>
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
            <Sidebar setView={setView} currentView={view} onLogout={handleLogout} isAdmin={profile.role === 'admin'} />
            
            <main className="flex-1 md:ml-24 min-h-[calc(100vh-8rem)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view + (selectedUserId || '')}
                  initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {view === 'main' && <Feed profile={profile} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
                  {view === 'profile' && <ProfileView profile={profile} isOwn={true} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} onMessageClick={(uid) => setChatTargetId(uid)} />}
                  {view === 'search' && <SearchView profile={profile} onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
                  {view === 'messages' && <MessagesView profile={profile} onChatSelect={(uid) => setChatTargetId(uid)} />}
                  {view === 'other-profile' && selectedUserId && (
                    <ProfileView 
                      profile={profile} 
                      isOwn={selectedUserId === profile.uid} 
                      targetUserId={selectedUserId} 
                      onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }}
                      onMessageClick={(uid) => setChatTargetId(uid)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
            <AnimatePresence>
              {chatTargetId && profile && (
                <ChatWindow 
                  profile={profile} 
                  targetId={chatTargetId} 
                  onClose={() => setChatTargetId(null)} 
                  setError={setError}
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
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">FOX<span className="text-red-600">BLACK</span></h1>
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
            <input 
              type="password" 
              className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
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
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">FOX<span className="text-red-600">BLACK</span></h1>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Contraseña</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-zinc-800/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-white font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-widest">Confirmar</label>
              <input 
                type="password" 
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

function MessagesView({ profile, onChatSelect }: { profile: User, onChatSelect: (uid: string) => void }) {
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Find mutual follows
    const q1 = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    const q2 = query(collection(db, 'follows'), where('followingId', '==', profile.uid));

    const unsubscribe1 = onSnapshot(q1, (snapshot1) => {
      const followingIds = snapshot1.docs.map(doc => doc.data().followingId);
      
      const unsubscribe2 = onSnapshot(q2, async (snapshot2) => {
        const followerIds = snapshot2.docs.map(doc => doc.data().followerId);
        const mutualIds = followingIds.filter(id => followerIds.includes(id));
        
        if (mutualIds.length > 0) {
          const friendsData: User[] = [];
          for (const id of mutualIds) {
            const userDoc = await getDoc(doc(db, 'users', id));
            if (userDoc.exists()) {
              friendsData.push({ id: userDoc.id, ...userDoc.data() } as any);
            }
          }
          setFriends(friendsData);
        } else {
          setFriends([]);
        }
        setLoading(loading => false);
      });
      return () => unsubscribe2();
    });

    return () => unsubscribe1();
  }, [profile.uid]);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-10 px-4">
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Mensajes</h1>
        <div className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/10">
          {friends.length} Amigos
        </div>
      </div>

      {friends.length === 0 ? (
        <div className="bg-zinc-900/50 backdrop-blur-xl p-20 rounded-[4rem] text-center border border-white/5 shadow-2xl">
          <div className="w-32 h-32 bg-zinc-800 text-zinc-700 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <MessageSquare size={64} strokeWidth={1} />
          </div>
          <h3 className="text-3xl font-black text-white mb-4 tracking-tight uppercase">No hay chats todavía</h3>
          <p className="text-zinc-500 max-w-sm mx-auto font-medium leading-relaxed italic">Sigue a personas y espera a que te sigan de vuelta para empezar a chatear.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {friends.map((friend) => (
            <motion.div
              key={friend.uid}
              whileHover={{ scale: 1.02, y: -8 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChatSelect(friend.uid)}
              className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-2xl flex items-center gap-6 cursor-pointer group"
            >
              <div className="relative">
                <img 
                  src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} 
                  alt={friend.displayName}
                  className="w-20 h-20 rounded-[2rem] object-cover border-2 border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-zinc-900 rounded-full shadow-lg"></div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white group-hover:text-red-500 transition-colors tracking-tight">{friend.displayName}</h3>
                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-1">Toca para chatear</p>
              </div>
              <div className="bg-zinc-800 p-4 rounded-2xl text-zinc-600 group-hover:bg-red-600 group-hover:text-white transition-all shadow-xl border border-white/5 group-hover:shadow-red-600/20 active:scale-90">
                <ArrowRight size={24} strokeWidth={3} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatWindow({ profile, targetId, onClose, setError }: { profile: User, targetId: string, onClose: () => void, setError: (m: string) => void }) {
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTarget = async () => {
      const userDoc = await getDoc(doc(db, 'users', targetId));
      if (userDoc.exists()) setTargetUser({ id: userDoc.id, ...userDoc.data() } as any);
    };
    fetchTarget();

    const q = query(
      collection(db, 'messages'),
      where('senderId', 'in', [profile.uid, targetId]),
      where('receiverId', 'in', [profile.uid, targetId]),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error("Error en onSnapshot de mensajes:", error);
      // Si falla por falta de índice, intentamos una consulta más simple
      if (error.message.includes('index')) {
        console.warn("Falta índice para mensajes, intentando consulta simple...");
      }
    });

    return () => unsubscribe();
  }, [profile.uid, targetId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      console.log("Enviando mensaje de", profile.uid, "a", targetId);
      await addDoc(collection(db, 'messages'), {
        senderId: profile.uid,
        receiverId: targetId,
        content: newMessage.trim(),
        createdAt: serverTimestamp(),
        read: false
      });
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
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      className="fixed bottom-24 right-4 left-4 md:left-auto md:right-10 md:bottom-10 md:w-[450px] h-[650px] bg-zinc-950 rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col z-[100] overflow-hidden"
    >
      {/* Header */}
      <div className="p-8 bg-zinc-900 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={targetUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUser.uid}`} 
              alt={targetUser.displayName}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white/10 shadow-2xl"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-zinc-900 rounded-full"></div>
          </div>
          <div>
            <h3 className="font-black text-white text-lg tracking-tight leading-none">{targetUser.displayName}</h3>
            <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mt-1 block">En línea</span>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white">
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-950/50 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderId === profile.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-[2rem] font-medium text-sm shadow-2xl ${
              msg.senderId === profile.uid 
                ? 'bg-red-600 text-white rounded-tr-none shadow-red-600/10' 
                : 'bg-zinc-900 text-zinc-100 rounded-tl-none border border-white/5'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-8 bg-zinc-900 border-t border-white/5 flex gap-4">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-zinc-800/50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 text-sm font-black text-white focus:border-red-500/20 focus:bg-zinc-800 focus:ring-4 focus:ring-red-500/5 outline-none transition-all placeholder:text-zinc-600"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim()}
          className="bg-red-600 text-white p-4 rounded-[1.5rem] shadow-2xl shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-30 disabled:shadow-none active:scale-90"
        >
          <Send size={24} strokeWidth={3} />
        </button>
      </form>
    </motion.div>
  );
}

// --- Navigation ---

function Sidebar({ setView, currentView, onLogout, isAdmin }: { setView: (v: any) => void, currentView: string, onLogout: () => void, isAdmin: boolean }) {
  const items = [
    { id: 'main', icon: Home, label: 'Inicio' },
    { id: 'search', icon: Search, label: 'Buscar' },
    { id: 'messages', icon: MessageSquare, label: 'Mensajes' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 md:left-4 md:top-4 md:bottom-4 md:w-24 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] flex md:flex-col items-center justify-around md:justify-start md:pt-12 md:space-y-10 p-4 z-50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
      <div className="hidden md:flex flex-col items-center space-y-6 mb-4">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/40 cursor-pointer border-2 border-white/20"
          onClick={() => setView('main')}
        >
          <Users className="text-white" size={32} strokeWidth={3} />
        </motion.div>
        {isAdmin && (
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="text-red-500" 
            title="Administrador"
          >
            <ShieldCheck size={36} strokeWidth={3} />
          </motion.div>
        )}
      </div>
      {items.map((item) => (
        <button 
          key={item.id} 
          onClick={() => setView(item.id)}
          className="relative p-4 group transition-all"
        >
          {currentView === item.id && (
            <motion.div 
              layoutId="nav-active"
              className="absolute inset-0 bg-red-600 rounded-[1.5rem] -z-10 shadow-2xl shadow-red-600/40"
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            />
          )}
          <item.icon 
            size={32} 
            strokeWidth={currentView === item.id ? 3 : 2} 
            className={`transition-all duration-500 ${currentView === item.id ? 'text-white scale-110' : 'text-zinc-600 group-hover:text-zinc-300'}`} 
          />
        </button>
      ))}
      <button 
        onClick={onLogout}
        className="p-4 text-zinc-600 hover:text-red-500 transition-all md:mt-auto group"
      >
        <LogOut size={32} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
      </button>
    </nav>
  );
}

// --- Feed View ---

function Feed({ profile, onUserClick }: { profile: User, onUserClick: (uid: string) => void }) {
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
        className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10"
      >
        <form onSubmit={handlePost} className="space-y-6">
          <div className="flex gap-5">
            <img src={profile.photoURL} alt="me" className="w-14 h-14 rounded-2xl shadow-xl border-2 border-white/10" />
            <textarea 
              placeholder="¿Qué está pasando en FOXBLACK?" 
              className="w-full p-5 bg-zinc-800/50 rounded-[2rem] border border-white/5 focus:ring-2 focus:ring-red-500 outline-none resize-none font-medium text-white placeholder:text-zinc-500 transition-all"
              rows={3} value={newPost} onChange={(e) => setNewPost(e.target.value)}
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
            <button 
              type="button" onClick={() => fileInputRef.current?.click()}
              className="p-4 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all flex items-center gap-3 font-black uppercase tracking-widest text-xs"
            >
              <ImageIcon size={22} strokeWidth={2.5} /> 
              <span>Imagen</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            
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

function PostCard({ post, profile, onUserClick }: { key?: string, post: Post, profile: User, onUserClick: (uid: string) => void }) {
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
    if (window.confirm('¿Eliminar publicación?')) {
      await deleteDoc(doc(db, 'posts', post.id));
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-zinc-900/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden group"
    >
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-5 cursor-pointer group/author" onClick={() => onUserClick(post.authorId)}>
            <div className="relative">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} alt="avatar" className="w-14 h-14 rounded-2xl shadow-xl group-hover/author:scale-105 transition-transform border-2 border-white/10" />
              {(post.authorRole === 'admin' || post.authorName === 'Administrador') && (
                <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full border-4 border-zinc-900">
                  <ShieldCheck size={14} strokeWidth={3} />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-black text-white group-hover/author:text-red-500 transition-colors text-lg tracking-tight">{post.authorName}</h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hace un momento</p>
            </div>
          </div>
          {(profile.role === 'admin' || post.authorId === profile.uid) && (
            <button onClick={deletePost} className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all">
              <Trash2 size={22} />
            </button>
          )}
        </div>
        
        <p className="text-zinc-200 text-xl leading-relaxed whitespace-pre-wrap mb-6 font-medium tracking-tight">{post.content}</p>
        
        {post.imageURL && (
          <div className="rounded-[2.5rem] overflow-hidden mb-6 shadow-2xl border border-white/5">
            <img src={post.imageURL} alt="post" className="w-full max-h-[600px] object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        )}
        
        <div className="flex items-center gap-6 pt-6 border-t border-white/5">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={handleLike} 
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-xs ${isLiked ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 bg-zinc-800/50 hover:bg-zinc-800'}`}
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
                    <div className="bg-zinc-800/50 p-4 rounded-[1.5rem] shadow-sm flex-1 border border-white/5">
                      <p 
                        className="text-xs font-black text-red-500 cursor-pointer hover:underline mb-1 uppercase tracking-widest"
                        onClick={() => onUserClick(c.authorId)}
                      >
                        {c.authorName}
                      </p>
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
                <button type="submit" className="bg-red-600 text-white p-4 rounded-2xl hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all active:scale-90">
                  <Send size={20} strokeWidth={3} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Profile View ---

function ProfileView({ profile, isOwn, targetUserId, onUserClick, onMessageClick }: { profile: User, isOwn: boolean, targetUserId?: string, onUserClick: (uid: string) => void, onMessageClick: (uid: string) => void }) {
  const [targetProfile, setTargetProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showList, setShowList] = useState<'followers' | 'following' | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ location: '', status: '' });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uid = targetUserId || profile.uid;

  useEffect(() => {
    const fetchProfile = async () => {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        setTargetProfile(data);
        setEditData({ location: data.location || '', status: data.status || '' });
      }
    };
    fetchProfile();

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

    return () => { unsubPosts(); unsubFollowers(); unsubFollowing(); };
  }, [uid, profile.uid]);

  const handleFollow = async () => {
    if (isFollowing) {
      const q = query(collection(db, 'follows'), where('followerId', '==', profile.uid), where('followingId', '==', uid));
      const snap = await getDocs(q);
      snap.forEach(async (d) => await deleteDoc(doc(db, 'follows', d.id)));
    } else {
      await addDoc(collection(db, 'follows'), {
        followerId: profile.uid,
        followingId: uid
      });
    }
  };

  const handleUpdateImage = async (type: 'photoURL' | 'coverURL' | 'gallery', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        if (type === 'gallery') {
          await updateDoc(doc(db, 'users', profile.uid), { gallery: arrayUnion(dataUrl) });
          if (targetProfile) setTargetProfile({ ...targetProfile, gallery: [...(targetProfile.gallery || []), dataUrl] });
        } else {
          await updateDoc(doc(db, 'users', profile.uid), { [type]: dataUrl });
          if (targetProfile) setTargetProfile({ ...targetProfile, [type]: dataUrl });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    await updateDoc(doc(db, 'users', profile.uid), {
      location: editData.location,
      status: editData.status
    });
    setTargetProfile(prev => prev ? { ...prev, ...editData } : null);
    setIsEditing(false);
  };

  const fetchUsersList = async (ids: string[]) => {
    if (ids.length === 0) {
      setUsersList([]);
      return;
    }
    const list: User[] = [];
    for (const id of ids) {
      const d = await getDoc(doc(db, 'users', id));
      if (d.exists()) list.push(d.data() as User);
    }
    setUsersList(list);
  };

  useEffect(() => {
    if (showList === 'followers') fetchUsersList(followers);
    if (showList === 'following') fetchUsersList(following);
  }, [showList, followers, following]);

  if (!targetProfile) return <Loading />;

  return (
    <div className="space-y-8 pb-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/80 backdrop-blur-xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/10"
      >
        <div className="h-64 bg-zinc-800 relative group">
          <img src={targetProfile.coverURL} alt="cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
          {isOwn && (
            <>
              <button onClick={() => coverInputRef.current?.click()} className="absolute bottom-6 right-6 bg-white/10 backdrop-blur-md text-white p-4 rounded-2xl hover:bg-white/20 transition-all shadow-xl border border-white/10">
                <Camera size={24} strokeWidth={2.5} />
              </button>
              <input type="file" ref={coverInputRef} onChange={(e) => handleUpdateImage('coverURL', e)} className="hidden" accept="image/*" />
            </>
          )}
        </div>
        
        <div className="px-10 pb-10 relative">
          <div className="absolute -top-24 left-10">
            <div className="relative group/avatar">
              <div className="w-44 h-44 rounded-[3rem] border-8 border-zinc-900 bg-zinc-900 overflow-hidden shadow-2xl transition-transform group-hover/avatar:scale-105 duration-500">
                <img src={targetProfile.photoURL} alt="profile" className="w-full h-full object-cover" />
              </div>
              {isOwn && (
                <>
                  <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-2 right-2 bg-red-600 text-white p-4 rounded-2xl border-4 border-zinc-900 hover:bg-red-700 transition-all shadow-2xl active:scale-90">
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
                <h1 className="text-5xl font-black text-white tracking-tighter">{targetProfile.displayName}</h1>
                {targetProfile.role === 'admin' && (
                  <div className="bg-red-600 text-white p-1.5 rounded-xl shadow-xl shadow-red-600/20" title="Administrador">
                    <ShieldCheck size={22} strokeWidth={3} />
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-6 bg-zinc-800/50 p-6 rounded-[2rem] border border-white/5">
                  <input 
                    type="text" placeholder="¿Dónde vives?" 
                    className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-bold text-white placeholder:text-zinc-500 shadow-inner transition-all"
                    value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  />
                  <input 
                    type="text" placeholder="Estado actual (Bio)" 
                    className="w-full px-6 py-4 bg-zinc-900/50 border border-white/5 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-bold text-white placeholder:text-zinc-500 shadow-inner transition-all"
                    value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  />
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveProfile} className="bg-red-600 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 uppercase tracking-widest">Guardar</button>
                    <button onClick={() => setIsEditing(false)} className="bg-zinc-700 text-zinc-300 px-8 py-3 rounded-2xl text-sm font-black hover:bg-zinc-600 transition-all uppercase tracking-widest">Cancelar</button>
                  </div>
                </motion.div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-zinc-400 text-xl font-medium leading-relaxed italic">"{targetProfile.status || "Sin estado actual"}"</p>
                  <div className="flex flex-wrap gap-4">
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-zinc-800/50 px-4 py-2 rounded-2xl border border-white/5">
                      <Home size={16} strokeWidth={2.5} className="text-red-500" /> {targetProfile.location || "Planeta Tierra"}
                    </p>
                    <p className="text-zinc-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-zinc-800/50 px-4 py-2 rounded-2xl border border-white/5">
                      <Users size={16} strokeWidth={2.5} className="text-red-500" /> {targetProfile.role === 'admin' ? 'Administrador' : 'Miembro'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              {isOwn && !isEditing && (
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
                    className={`px-10 py-4 rounded-[1.5rem] font-black text-sm transition-all shadow-xl active:scale-95 uppercase tracking-widest ${isFollowing ? 'bg-zinc-800 text-white border border-white/5 hover:bg-zinc-700' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'}`}
                  >
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
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
          
          <div className="flex gap-10 mt-10 border-t border-white/5 pt-8">
            <button onClick={() => setShowList('followers')} className="group transition-all">
              <p className="text-3xl font-black text-white group-hover:text-red-500 transition-colors">{followers.length}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Seguidores</p>
            </button>
            <button onClick={() => setShowList('following')} className="group transition-all">
              <p className="text-3xl font-black text-white group-hover:text-red-500 transition-colors">{following.length}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Siguiendo</p>
            </button>
            <div className="group transition-all">
              <p className="text-3xl font-black text-white">{posts.length}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Publicaciones</p>
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
          <h2 className="font-black text-3xl text-white tracking-tighter uppercase">Galería de Fotos</h2>
          {isOwn && (
            <>
              <button 
                onClick={() => galleryInputRef.current?.click()} 
                className="bg-red-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-3 shadow-xl shadow-red-600/20"
              >
                <PlusCircle size={20} strokeWidth={3} /> Añadir Foto
              </button>
              <input type="file" ref={galleryInputRef} onChange={(e) => handleUpdateImage('gallery', e)} className="hidden" accept="image/*" />
            </>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          {targetProfile.gallery?.map((img, idx) => (
            <motion.div 
              key={idx} 
              whileHover={{ scale: 1.05, rotate: idx % 2 === 0 ? 1 : -1 }}
              className="aspect-square rounded-[2.5rem] overflow-hidden border-4 border-zinc-800 shadow-2xl bg-zinc-800 cursor-pointer group"
            >
              <img src={img} alt={`gallery-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </motion.div>
          ))}
          {(!targetProfile.gallery || targetProfile.gallery.length === 0) && (
            <div className="col-span-3 text-center py-20 bg-zinc-800/30 rounded-[3rem] border-2 border-dashed border-white/10">
              <ImageIcon size={64} className="mx-auto text-zinc-700 mb-4" strokeWidth={1} />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm italic">Tu galería está esperando tus mejores momentos</p>
            </div>
          )}
        </div>
      </motion.div>

      <div className="space-y-8">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Publicaciones</h2>
          <div className="h-1 flex-1 mx-8 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full w-24 bg-red-600 rounded-full"></div>
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 rounded-[3rem] w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-white/10"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-800/50">
                <h3 className="font-black text-2xl text-white tracking-tighter uppercase">{showList === 'followers' ? 'Seguidores' : 'Siguiendo'}</h3>
                <button onClick={() => setShowList(null)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-all">
                  <X size={24} strokeWidth={3} className="text-zinc-500 hover:text-white" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {usersList.map((u) => (
                  <div 
                    key={u.uid} 
                    className="flex items-center gap-4 cursor-pointer hover:bg-zinc-800 p-4 rounded-2xl transition-all group border border-transparent hover:border-white/5"
                    onClick={() => { onUserClick(u.uid); setShowList(null); }}
                  >
                    <img src={u.photoURL} alt="avatar" className="w-14 h-14 rounded-2xl shadow-xl group-hover:scale-110 transition-transform border-2 border-white/10" />
                    <div>
                      <p className="font-black text-white group-hover:text-red-500 transition-colors">{u.displayName}</p>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{u.role === 'admin' ? 'Administrador' : 'Miembro'}</p>
                    </div>
                    <ArrowRight size={20} className="ml-auto text-zinc-700 group-hover:text-red-500 transition-colors" />
                  </div>
                ))}
                {usersList.length === 0 && <p className="text-center text-zinc-600 font-black py-10 uppercase tracking-widest">Lista vacía</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Search View ---

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
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-red-500 transition-colors" size={28} strokeWidth={3} />
          <input 
            type="text" 
            placeholder="Busca amigos, vecinos o familia..." 
            className="w-full pl-16 pr-8 py-6 bg-zinc-800/50 rounded-[2rem] border-2 border-transparent focus:border-red-500/20 focus:bg-zinc-800 focus:ring-4 focus:ring-red-500/5 outline-none transition-all text-xl font-black text-white placeholder:text-zinc-600 shadow-inner"
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
                  <h3 className="text-xl font-black text-white group-hover:text-red-500 transition-colors tracking-tight">{u.displayName}</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">{u.role === 'admin' ? 'Administrador' : 'Miembro'}</p>
                </div>
              </div>
              <button 
                onClick={() => onUserClick(u.uid)}
                className="bg-zinc-800 text-white p-5 rounded-[1.5rem] hover:bg-red-600 transition-all shadow-xl border border-white/5 group-hover:shadow-red-600/20 active:scale-90"
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
