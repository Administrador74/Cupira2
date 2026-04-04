/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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
import { User, Post, Follow, Comment, Message, Conversation } from './types';
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
  ChevronLeft,
  Eye,
  EyeOff
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
  const [view, setView] = useState<'login' | 'register' | 'main' | 'profile' | 'search' | 'other-profile' | 'messages' | 'admin-messages'>('login');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
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
            if (Notification.permission === "granted" && document.hidden) {
              new Notification("Nuevo Mensaje en Cupira", {
                body: msg.content,
                icon: "/favicon.ico"
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
              if (Notification.permission === "granted" && document.hidden) {
                new Notification("Nueva Publicación", {
                  body: `${post.authorName} ha compartido algo nuevo.`,
                  icon: "/favicon.ico"
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
                  {view === 'messages' && <MessagesView profile={profile} setView={setView} onChatSelect={(uid) => setChatTargetId(uid)} />}
                  {view === 'admin-messages' && <AdminMessagesView onChatSelect={(u1, u2) => setChatTargetId(`${u1}_${u2}`)} />}
                  {view === 'admin-users' && <AdminUsersView onUserClick={(uid) => { setSelectedUserId(uid); setView('other-profile'); }} />}
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
                  targetId={chatTargetId.includes('_') ? '' : chatTargetId} 
                  adminViewIds={chatTargetId.includes('_') ? { u1: chatTargetId.split('_')[0], u2: chatTargetId.split('_')[1] } : undefined}
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
      <div className="flex items-center justify-between mb-10 px-4">
        <div className="flex flex-col">
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Supervisión</h1>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.3em] mt-2">Archivo Maestro de Chats</p>
        </div>
        <div className="flex items-center gap-4">
          {conversations.length === 0 && (
            <button 
              onClick={handleMigrate}
              disabled={migrating}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/5 disabled:opacity-50"
            >
              {migrating ? 'Migrando...' : 'Sincronizar Historial'}
            </button>
          )}
          <div className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-500/10">
            {conversations.length} Conversaciones
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {conversations.map((c) => (
          <motion.div
            key={c.id}
            whileHover={{ scale: 1.01, x: 10 }}
            onClick={() => onChatSelect(c.participants[0], c.participants[1])}
            className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 shadow-2xl flex items-center gap-8 cursor-pointer group"
          >
            <div className="flex -space-x-6 relative">
              <img src={c.user1?.photoURL} className="w-16 h-16 rounded-2xl border-4 border-zinc-900 shadow-xl z-10" alt="u1" />
              <img src={c.user2?.photoURL} className="w-16 h-16 rounded-2xl border-4 border-zinc-900 shadow-xl" alt="u2" />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="text-xl font-black text-white group-hover:text-red-500 transition-colors truncate">
                {c.user1?.displayName} ↔ {c.user2?.displayName}
              </h3>
              <p className="text-zinc-500 text-sm font-medium mt-1 truncate max-w-md italic">"{c.lastMessage}"</p>
            </div>
            <div className="bg-zinc-800 p-4 rounded-2xl text-zinc-600 group-hover:bg-red-600 group-hover:text-white transition-all">
              <Eye size={24} strokeWidth={3} />
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

function ChatWindow({ profile, targetId, onClose, setError, adminViewIds }: { profile: User, targetId: string, onClose: () => void, setError: (m: string) => void, adminViewIds?: { u1: string, u2: string } }) {
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [adminUser1, setAdminUser1] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

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
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    };

    let d1: any[] = [], d2: any[] = [], d3: any[] = [];
    const unsub1 = onSnapshot(qById, (s) => { d1 = s.docs; updateMessages(d1, d2, d3); });
    const unsub2 = onSnapshot(qSent, (s) => { d2 = s.docs; updateMessages(d1, d2, d3); });
    const unsub3 = onSnapshot(qReceived, (s) => { d3 = s.docs; updateMessages(d1, d2, d3); });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [effectiveProfileId, effectiveTargetId]);

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
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 block ${adminViewIds ? 'text-blue-500' : 'text-green-500'}`}>
              {adminViewIds ? 'Supervisando Chat' : 'En línea'}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-white">
          <X size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-950/50 custom-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === profile.uid;
          const isAdminMsg = msg.senderId !== effectiveProfileId && msg.senderId !== effectiveTargetId;
          
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/msg`}>
              <div className={`max-w-[85%] p-5 rounded-[2rem] font-medium text-sm shadow-2xl relative ${
                isMe
                  ? 'bg-red-600 text-white rounded-tr-none shadow-red-600/10' 
                  : isAdminMsg
                    ? 'bg-blue-600 text-white rounded-tl-none border border-white/5'
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
                  msg.content
                )}
                
                {profile.role === 'admin' && (
                  <button 
                    onClick={async () => {
                      if (!window.confirm("¿Estás seguro de eliminar este mensaje por completo de la base de datos? Esta acción no se puede deshacer.")) return;
                      try {
                        const convId = [effectiveProfileId, effectiveTargetId].sort().join('_');
                        await deleteDoc(doc(db, 'messages', msg.id));
                        // También actualizamos la vista previa de la conversación para que no se vea el contenido prohibido
                        await updateDoc(doc(db, 'conversations', convId), {
                          lastMessage: '[Mensaje eliminado por el administrador]'
                        });
                      } catch (err: any) {
                        setError("Error al eliminar mensaje: " + err.message);
                      }
                    }}
                    className="absolute -top-2 -right-2 bg-zinc-800 text-red-500 p-2 rounded-full shadow-xl transition-all hover:bg-red-600 hover:text-white border border-white/10"
                    title="Eliminar mensaje por completo"
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
        <form onSubmit={handleSend} className="p-8 bg-zinc-900 border-t border-white/5 flex gap-4">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={adminViewIds ? "Intervenir en el chat..." : "Escribe un mensaje..."}
            className={`flex-1 bg-zinc-800/50 border-2 border-transparent rounded-[1.5rem] px-6 py-4 text-sm font-black text-white focus:bg-zinc-800 focus:ring-4 outline-none transition-all placeholder:text-zinc-600 ${
              adminViewIds ? 'focus:border-blue-500/20 focus:ring-blue-500/5' : 'focus:border-red-500/20 focus:ring-red-500/5'
            }`}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className={`${adminViewIds ? 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700' : 'bg-red-600 shadow-red-600/20 hover:bg-red-700'} text-white p-4 rounded-[1.5rem] shadow-2xl transition-all disabled:opacity-30 disabled:shadow-none active:scale-90`}
          >
            <Send size={24} strokeWidth={3} />
          </button>
        </form>
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

const Sidebar = memo(({ setView, currentView, onLogout, isAdmin }: { setView: (v: any) => void, currentView: string, onLogout: () => void, isAdmin: boolean }) => {
  const items = [
    { id: 'main', icon: Home, label: 'Inicio' },
    { id: 'search', icon: Search, label: 'Buscar' },
    { id: 'messages', icon: MessageSquare, label: 'Mensajes' },
    { id: 'profile', icon: UserIcon, label: 'Perfil' },
    ...(isAdmin ? [{ id: 'admin-users', icon: ShieldCheck, label: 'Admin' }] : [])
  ];

  return (
    <nav className="fixed bottom-4 left-4 right-4 md:left-4 md:top-4 md:bottom-4 md:w-24 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] flex md:flex-col items-center justify-around md:justify-start md:pt-12 md:space-y-10 p-2 md:p-4 z-50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
      <div className="hidden md:flex flex-col items-center space-y-6 mb-4">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/40 cursor-pointer border-2 border-white/20"
          onClick={() => setView('main')}
        >
          <Users className="text-white" size={32} strokeWidth={3} />
        </motion.div>
      </div>
      {items.map((item) => (
        <button 
          key={item.id} 
          onClick={() => setView(item.id)}
          className="relative p-3 md:p-4 group transition-all"
        >
          {currentView === item.id && (
            <motion.div 
              layoutId="nav-active"
              className="absolute inset-0 bg-red-600 rounded-[1.2rem] md:rounded-[1.5rem] -z-10 shadow-2xl shadow-red-600/40"
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            />
          )}
          <item.icon 
            size={28} 
            className={`md:w-8 md:h-8 transition-all duration-500 ${currentView === item.id ? 'text-white scale-110' : 'text-zinc-600 group-hover:text-zinc-300'}`} 
            strokeWidth={currentView === item.id ? 3 : 2}
          />
        </button>
      ))}
      <button 
        onClick={onLogout}
        className="p-3 md:p-4 text-zinc-600 hover:text-red-500 transition-all md:mt-auto group"
      >
        <LogOut size={28} className="md:w-8 md:h-8 group-hover:rotate-12 transition-transform" strokeWidth={2} />
      </button>
    </nav>
  );
});

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
      className="bg-zinc-900/80 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden group"
    >
      <div className="p-8">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-5 cursor-pointer group/author" onClick={() => onUserClick(post.authorId)}>
            <div className="relative">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
                alt="avatar" 
                className="w-14 h-14 rounded-2xl shadow-xl group-hover/author:scale-105 transition-transform border-2 border-white/10" 
                loading="lazy"
              />
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
                    <div className="bg-zinc-800/50 p-4 rounded-[1.5rem] shadow-sm flex-1 border border-white/5 relative group/comment">
                      <div className="flex justify-between items-start">
                        <p 
                          className="text-xs font-black text-red-500 cursor-pointer hover:underline mb-1 uppercase tracking-widest"
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
});

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
        setEditData({ location: data.location || '', status: data.status || '' });
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
          {canEdit && (
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
              {canEdit && (
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
                            alert("Error: " + err.message);
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

// --- Admin Users View ---

function AdminUsersView({ onUserClick }: { onUserClick: (uid: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Users className="text-red-500" size={24} strokeWidth={3} />
          <span className="text-xl font-black text-white">{users.length}</span>
          <span className="text-zinc-500 font-black text-[10px] uppercase tracking-widest">Total</span>
        </div>
      </div>

      <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10">
        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-red-500 transition-colors" size={28} strokeWidth={3} />
          <input 
            type="text" 
            placeholder="Busca por nombre o correo electrónico..." 
            className="w-full pl-16 pr-8 py-6 bg-zinc-800/50 rounded-[2rem] border-2 border-transparent focus:border-red-500/20 focus:bg-zinc-800 focus:ring-4 focus:ring-red-500/5 outline-none transition-all text-xl font-black text-white placeholder:text-zinc-600 shadow-inner"
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
                <h3 className="text-2xl font-black text-white group-hover:text-red-500 transition-colors tracking-tight">{u.displayName}</h3>
                <p className="text-sm font-bold text-zinc-400 mt-1">{u.email}</p>
                <div className="flex gap-3 mt-3">
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-red-600/20 text-red-500' : 'bg-blue-600/20 text-blue-500'}`}>
                    {u.role === 'admin' ? 'Administrador' : 'Miembro'}
                  </span>
                  <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-zinc-500">
                    UID: {u.uid.substring(0, 8)}...
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => handleResetPassword(u.email)}
                className="flex-1 md:flex-none px-8 py-4 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all border border-white/5 active:scale-95"
              >
                Resetear Clave
              </button>
              <button 
                onClick={() => onUserClick(u.uid)}
                className="flex-1 md:flex-none px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95"
              >
                Ver Perfil
              </button>
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
