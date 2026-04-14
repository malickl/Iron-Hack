import React, { useState, useEffect, useMemo, memo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import {
  XAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  YAxis,
} from "recharts";
import {
  Play,
  Plus,
  History,
  LayoutDashboard,
  Dumbbell,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronLeft,
  Save,
  X,
  Trophy,
  TrendingUp,
  Edit2,
  ChevronDown,
  ChevronUp,
  LogOut,
} from "lucide-react";

const firebaseConfig = {
  apiKey: "AIzaSyB1XLMb13uK0DDCn2LvVLALOD8PnS7KERw",
  authDomain: "irontrack-bd561.firebaseapp.com",
  projectId: "irontrack-bd561",
  storageBucket: "irontrack-bd561.firebasestorage.app",
  messagingSenderId: "173739266633",
  appId: "1:173739266633:web:5b7bd6196e6c37e3912598",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- GRAPHIQUES STABLES ---
const StableBarChart = memo(({ data }) => (
  <ResponsiveContainer width="100%" height="80%">
    <BarChart data={data}>
      <XAxis
        dataKey="date"
        stroke="#3f3f46"
        fontSize={10}
        tickLine={false}
        axisLine={false}
      />
      <Tooltip
        cursor={{ fill: "#27272a" }}
        contentStyle={{
          backgroundColor: "#18181b",
          border: "none",
          borderRadius: "12px",
        }}
      />
      <Bar
        dataKey="volume"
        fill="#f97316"
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
      />
    </BarChart>
  </ResponsiveContainer>
));

const StableLineChart = memo(({ data }) => (
  <ResponsiveContainer width="100%" height="80%">
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
      <XAxis
        dataKey="date"
        stroke="#52525b"
        fontSize={10}
        tickLine={false}
        axisLine={false}
      />
      <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
      <Tooltip
        contentStyle={{
          backgroundColor: "#18181b",
          border: "none",
          borderRadius: "12px",
        }}
      />
      <Line
        type="monotone"
        dataKey="poids"
        stroke="#f97316"
        strokeWidth={4}
        dot={{ r: 4, fill: "#f97316" }}
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
));

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState({ programs: [], history: [], records: {} });

  const [editingProgram, setEditingProgram] = useState(null);
  const [selectedStatEx, setSelectedStatEx] = useState("");
  const [statTimeFilter, setStatTimeFilter] = useState(30);
  const [filterRange, setFilterRange] = useState(30);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);

  const filteredDashboardHistory = useMemo(() => {
    return data.history.filter((h) => {
      if (filterRange === 999) return true;
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - filterRange);
      return new Date(h.date) >= dateLimit;
    });
  }, [data.history, filterRange]);

  useEffect(() => {
    if (activeTab === "live" && currentWorkout) {
      localStorage.setItem("iron_track_ongoing_workout", JSON.stringify(currentWorkout));
    } else if (!currentWorkout) {
      localStorage.removeItem("iron_track_ongoing_workout");
    }
  }, [currentWorkout, activeTab]);

  useEffect(() => {
    let interval;
    if (activeTab === "live" && currentWorkout) {
      interval = setInterval(() => {
        setGlobalTime(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
      }, 1000);
    } else {
      setGlobalTime(0);
    }
    return () => clearInterval(interval);
  }, [activeTab, currentWorkout]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        if (JSON.stringify(cloudData) !== JSON.stringify(data)) {
          setData(cloudData);
        }
      }
    });
    return unsubscribe;
  }, [user]);

  const saveToCloud = async (newData) => {
    if (!user) return;
    setData(newData); // Optimistic UI update
    await setDoc(doc(db, "users", user.uid), newData);
  };

  const handleAuth = async () => {
    if (isRegistering && authPass.length < 8) {
      alert("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPass);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPass);
      }
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  };

  // --- LOGIQUE SÉANCE ---
  useEffect(() => {
    let interval;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0 && isTimerActive) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  const startWorkout = (program) => {
    setCurrentWorkout({
      ...program,
      startTime: Date.now(),
      exercises: program.exercises.map((ex) => ({
        ...ex,
        completedSets: Array(parseInt(ex.sets))
          .fill(null)
          .map(() => ({ weight: "", reps: "", done: false })),
      })),
    });
    setActiveTab("live");
  };

  const validateSet = (exIdx, setIdx) => {
    const ex = currentWorkout.exercises[exIdx];
    const set = ex.completedSets[setIdx];
    const newExs = [...currentWorkout.exercises];
    newExs[exIdx].completedSets[setIdx] = {
      weight: set.weight || ex.weight,
      reps: set.reps || ex.reps,
      done: true,
    };
    setCurrentWorkout({ ...currentWorkout, exercises: newExs });
  };

  const startRestTimer = (restTime) => {
    setTimer(parseInt(restTime) || 60);
    setIsTimerActive(true);
  };

  const finishWorkout = () => {
    const duration = Math.floor(
      (Date.now() - currentWorkout.startTime) / 60000
    );
    const validExercises = currentWorkout.exercises
      .map((ex) => ({
        ...ex,
        completedSets: ex.completedSets.filter((s) => s.done),
      }))
      .filter((ex) => ex.completedSets.length > 0);

    const totalVolume = validExercises.reduce(
      (acc, ex) =>
        acc +
        ex.completedSets.reduce(
          (sAcc, s) => sAcc + parseFloat(s.weight || 0) * parseInt(s.reps || 0),
          0
        ),
      0
    );

    const newHistoryItem = {
      id: Date.now(),
      name: currentWorkout.name,
      date: new Date().toISOString(),
      duration,
      hasVisualTimer: true,
      totalVolume,
      exercises: validExercises,
    };

    const newRecords = { ...data.records };
    validExercises.forEach((ex) => {
      ex.completedSets.forEach((set) => {
        if (
          !newRecords[ex.name] ||
          parseFloat(set.weight) > newRecords[ex.name].weight
        ) {
          newRecords[ex.name] = {
            weight: parseFloat(set.weight),
            reps: set.reps,
            date: new Date().toLocaleDateString(),
          };
        }
      });
    });

    saveToCloud({
      ...data,
      history: [newHistoryItem, ...data.history],
      records: newRecords,
    });
    setCurrentWorkout(null);
    setActiveTab("dashboard");
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-orange-500 font-black italic tracking-widest animate-pulse text-2xl">
        IRON TRACK
      </div>
    );

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-10 text-white font-sans">
        <h1 className="text-5xl font-black italic tracking-tighter mb-2">
          IRON<span className="text-orange-500">TRACK</span>
        </h1>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mb-16 font-bold italic">
          Secure Cloud Sync
        </p>
        <div className="w-full space-y-4 max-w-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4 tracking-widest">
              Email
            </label>
            <input
              type="email"
              placeholder="nom@exemple.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white outline-none focus:border-orange-500 font-bold transition-all"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4 tracking-widest">
              Mot de passe
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white outline-none focus:border-orange-500 font-bold transition-all"
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
            />
          </div>
          <button
            onClick={handleAuth}
            className="w-full bg-orange-500 py-5 rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-950/20 active:scale-95 transition-all mt-6"
          >
            {isRegistering ? "Créer mon compte" : "Se connecter"}
          </button>
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] mt-2 underline underline-offset-8 decoration-zinc-800"
          >
            {isRegistering
              ? "Déjà un compte ? Connexion"
              : "Nouveau ? S'inscrire ici"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans max-w-md mx-auto border-x border-zinc-900 relative">
      <div className="p-4 flex justify-between items-center border-b border-zinc-900 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" />{" "}
          {user.email.split("@")[0]}
        </span>
        <button
          onClick={() => signOut(auth)}
          className="text-zinc-800 hover:text-red-500 transition-colors px-2"
        >
          <LogOut size={16} />
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-500">
          <header className="flex justify-between items-center pt-2">
            <h1 className="text-3xl font-black text-white italic tracking-tighter">
              IRON<span className="text-orange-500">TRACK</span>
            </h1>
            <Trophy className="text-orange-400 w-8 h-8 bg-zinc-800 p-1.5 rounded-full" />
          </header>
          
          {localStorage.getItem("iron_track_ongoing_workout") && (
            <button
              onClick={() => {
                const saved = localStorage.getItem("iron_track_ongoing_workout");
                if (saved) {
                  setCurrentWorkout(JSON.parse(saved));
                  setActiveTab("live");
                }
              }}
              className="w-full bg-orange-500/20 border border-orange-500 text-orange-500 py-4 rounded-3xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 mb-4 animate-pulse shadow-xl shadow-orange-950/20"
            >
              <Clock size={16} /> Reprendre la séance en cours
            </button>
          )}

          <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shadow-lg mb-4">
            {[7, 30, 999].map((val) => (
              <button
                key={val}
                onClick={() => setFilterRange(val)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  filterRange === val
                    ? "bg-zinc-800 text-white shadow-md border border-zinc-700"
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {val === 999 ? "Global" : val + "j"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-6">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-xl flex flex-col justify-center">
              <span className="text-2xl font-black text-orange-500 block mb-1">
                {filteredDashboardHistory.length}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-tight">
                Séances
              </span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-xl flex flex-col justify-center">
              <span className="text-2xl font-black text-orange-500 block mb-1">
                {(
                  filteredDashboardHistory.reduce((a, b) => a + (b.totalVolume || 0), 0) /
                  1000
                ).toFixed(1)}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-tight">
                Tonnage (t)
              </span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-xl flex flex-col justify-center">
              <span className="text-2xl font-black text-orange-500 block mb-1">
                {(() => {
                  const totalMin = filteredDashboardHistory.reduce((a, b) => {
                    if (!b.hasVisualTimer) return a;
                    return a + (typeof b.duration === 'number' && !isNaN(b.duration) ? b.duration : 0);
                  }, 0);
                  const h = Math.floor(totalMin / 60);
                  const m = totalMin % 60;
                  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`;
                })()}
              </span>
              <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-tight">
                Tps Total
              </span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl h-64 shadow-2xl">
            <h3 className="text-[10px] font-black text-zinc-500 mb-4 flex items-center gap-2 uppercase tracking-[0.2em]">
              <TrendingUp size={14} /> Volume Global (LineChart)
            </h3>
            <StableLineChart
              data={[...filteredDashboardHistory]
                .reverse()
                .map((h) => ({
                  date: new Date(h.date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                  }),
                  poids: h.totalVolume,
                }))}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Programmes
              </h3>
              <button
                onClick={() => {
                  setEditingProgram(null);
                  setActiveTab("editor");
                }}
                className="text-orange-500 text-[10px] font-black uppercase bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/20"
              >
                + Nouveau
              </button>
            </div>
            {data.programs.map((p) => (
              <div
                key={p.id}
                className="bg-zinc-900 border border-zinc-800 p-5 rounded-[2rem] flex justify-between items-center shadow-xl active:scale-[0.98] transition-all"
              >
                <div
                  onClick={() => startWorkout(p)}
                  className="flex-1 cursor-pointer"
                >
                  <h4 className="text-white font-black text-lg uppercase leading-none mb-1">
                    {p.name}
                  </h4>
                  <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                    {p.exercises.length} exercices
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProgram(p);
                      setActiveTab("editor");
                    }}
                    className="p-3 text-zinc-600 hover:text-white"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => startWorkout(p)}
                    className="bg-orange-500 p-3.5 rounded-2xl text-white shadow-lg shadow-orange-950/20"
                  >
                    <Play fill="white" size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "live" && currentWorkout && (
        <div className="p-4 pb-32 space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center sticky top-14 bg-black/95 backdrop-blur-md py-4 z-30 border-b border-zinc-900">
            <button
              onClick={() => {
                if (window.confirm("Abandonner la séance en cours ? (Cela ne sera pas sauvegardé)")) {
                  setCurrentWorkout(null);
                  setActiveTab("dashboard");
                }
              }}
              className="p-2 bg-zinc-900 rounded-full"
            >
              <X size={18} className="text-zinc-500" />
            </button>
            <div className="text-center">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">
                {currentWorkout.name}
              </h2>
              <div className="text-zinc-400 font-mono text-xs tracking-widest mt-1">
                {formatTime(globalTime)}
              </div>
              {isTimerActive && (
                <div className="text-orange-500 font-mono text-2xl font-black mt-1 animate-pulse">
                  REPOS: {timer}s
                </div>
              )}
            </div>
            <button
              onClick={finishWorkout}
              className="bg-green-600 px-6 py-2 rounded-full font-black text-xs text-white uppercase tracking-widest"
            >
              Finir
            </button>
          </div>
          {currentWorkout.exercises.map((ex, exIdx) => (
            <div
              key={exIdx}
              className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-2xl"
            >
              <div className="p-5 bg-zinc-800/40 flex justify-between items-center border-b border-zinc-800/50">
                <div>
                  <h3 className="text-white font-black uppercase text-xs tracking-widest">
                    {ex.name}
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5 italic">
                    Repos: {ex.rest}s
                  </p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-3 py-1 rounded-full text-[9px] font-black uppercase">
                  Max: {data.records[ex.name]?.weight || 0}kg
                </div>
              </div>
              <div className="p-4 space-y-3">
                {ex.completedSets.map((set, setIdx) => (
                  <div
                    key={setIdx}
                    className={`flex items-center gap-3 p-2 rounded-2xl border ${
                      set.done
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-black/40 border-transparent"
                    }`}
                  >
                    <span className="w-8 text-center font-black italic text-zinc-700">
                      {setIdx + 1}
                    </span>
                    <input
                      type="number"
                      placeholder={`${ex.weight}kg`}
                      value={set.weight}
                      onChange={(e) => {
                        const n = [...currentWorkout.exercises];
                        n[exIdx].completedSets[setIdx].weight = e.target.value;
                        setCurrentWorkout({ ...currentWorkout, exercises: n });
                      }}
                      disabled={set.done}
                      className="w-full bg-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none border border-zinc-800 focus:border-orange-500"
                    />
                    <input
                      type="number"
                      placeholder={`${ex.reps}`}
                      value={set.reps}
                      onChange={(e) => {
                        const n = [...currentWorkout.exercises];
                        n[exIdx].completedSets[setIdx].reps = e.target.value;
                        setCurrentWorkout({ ...currentWorkout, exercises: n });
                      }}
                      disabled={set.done}
                      className="w-full bg-zinc-800 rounded-xl p-3 text-center text-white font-bold outline-none border border-zinc-800 focus:border-orange-500"
                    />
                    <button
                      onClick={() => validateSet(exIdx, setIdx)}
                      disabled={set.done}
                      className={`p-2 ${
                        set.done
                          ? "text-green-500"
                          : "text-zinc-800 active:scale-75 transition-transform"
                      }`}
                    >
                      <CheckCircle2
                        size={32}
                        fill={set.done ? "currentColor" : "none"}
                      />
                    </button>
                    {set.done && (
                      <button
                        onClick={() => startRestTimer(ex.rest)}
                        className="p-2 bg-zinc-800 rounded-xl text-orange-500 flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <Clock size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "editor" && (
        <div className="p-4 pb-32 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveTab("dashboard")}
              className="p-3 bg-zinc-900 rounded-2xl"
            >
              <ChevronLeft className="text-white" size={20} />
            </button>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase">
              {editingProgram ? "Modifier" : "Nouveau"}
            </h2>
            {editingProgram && (
              <button
                onClick={() => {
                  if (window.confirm("Supprimer ?")) {
                    saveToCloud({
                      ...data,
                      programs: data.programs.filter(
                        (p) => p.id !== editingProgram.id
                      ),
                    });
                    setActiveTab("dashboard");
                  }
                }}
                className="text-red-900 bg-red-900/10 p-2.5 rounded-xl"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
          <input
            value={editingProgram ? editingProgram.name : ""}
            onChange={(e) => {
              const updated = editingProgram
                ? { ...editingProgram, name: e.target.value }
                : {
                    name: e.target.value,
                    exercises: [
                      { name: "", sets: 3, reps: 10, weight: 40, rest: 60 },
                    ],
                  };
              setEditingProgram(updated);
            }}
            placeholder="Nom du programme"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white font-black text-xl outline-none focus:border-orange-500 shadow-xl"
          />
          <div className="space-y-4">
            {(editingProgram?.exercises || []).map((ex, i) => (
              <div
                key={i}
                className="bg-zinc-900 p-6 rounded-[2.5rem] space-y-4 border border-zinc-800 relative shadow-2xl"
              >
                <button
                  onClick={() => {
                    const n = editingProgram.exercises.filter(
                      (_, idx) => idx !== i
                    );
                    setEditingProgram({ ...editingProgram, exercises: n });
                  }}
                  className="absolute top-6 right-6 text-zinc-700 hover:text-red-500"
                >
                  <X size={20} />
                </button>
                <input
                  value={ex.name}
                  onChange={(e) => {
                    const n = [...editingProgram.exercises];
                    n[i].name = e.target.value;
                    setEditingProgram({ ...editingProgram, exercises: n });
                  }}
                  placeholder="Exercice"
                  className="w-full bg-zinc-800 rounded-2xl p-4 text-white text-sm font-black uppercase tracking-widest outline-none focus:border-zinc-700 border border-transparent"
                />
                <div className="grid grid-cols-4 gap-2 text-[8px] font-black text-zinc-500 uppercase text-center tracking-widest">
                  <div>
                    SETS
                    <input
                      type="number"
                      value={ex.sets}
                      className="mt-1 w-full bg-zinc-800 rounded-xl p-2 text-white text-xs text-center border border-zinc-700"
                      onChange={(e) => {
                        const n = [...editingProgram.exercises];
                        n[i].sets = e.target.value;
                        setEditingProgram({ ...editingProgram, exercises: n });
                      }}
                    />
                  </div>
                  <div>
                    REPS
                    <input
                      type="number"
                      value={ex.reps}
                      className="mt-1 w-full bg-zinc-800 rounded-xl p-2 text-white text-xs text-center border border-zinc-700"
                      onChange={(e) => {
                        const n = [...editingProgram.exercises];
                        n[i].reps = e.target.value;
                        setEditingProgram({ ...editingProgram, exercises: n });
                      }}
                    />
                  </div>
                  <div>
                    KG
                    <input
                      type="number"
                      value={ex.weight}
                      className="mt-1 w-full bg-zinc-800 rounded-xl p-2 text-white text-xs text-center border border-zinc-700"
                      onChange={(e) => {
                        const n = [...editingProgram.exercises];
                        n[i].weight = e.target.value;
                        setEditingProgram({ ...editingProgram, exercises: n });
                      }}
                    />
                  </div>
                  <div>
                    REPOS
                    <input
                      type="number"
                      value={ex.rest}
                      className="mt-1 w-full bg-zinc-800 rounded-xl p-2 text-white text-xs text-center border border-zinc-700"
                      onChange={(e) => {
                        const n = [...editingProgram.exercises];
                        n[i].rest = e.target.value;
                        setEditingProgram({ ...editingProgram, exercises: n });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                const baseEx = {
                  name: "",
                  sets: 3,
                  reps: 10,
                  weight: 40,
                  rest: 60,
                };
                setEditingProgram(
                  editingProgram
                    ? {
                        ...editingProgram,
                        exercises: [...editingProgram.exercises, baseEx],
                      }
                    : { name: "", exercises: [baseEx] }
                );
              }}
              className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-[2rem] text-zinc-600 font-black text-[10px] tracking-[0.3em] uppercase transition-all"
            >
              + Ajouter exercice
            </button>
          </div>
          <button
            onClick={() => {
              if (!editingProgram?.name) return alert("Nom requis");
              const newP = {
                id: editingProgram.id || Date.now(),
                ...editingProgram,
              };
              saveToCloud({
                ...data,
                programs: [
                  ...data.programs.filter((p) => p.id !== editingProgram.id),
                  newP,
                ],
              });
              setActiveTab("dashboard");
            }}
            className="w-full bg-orange-500 py-6 rounded-[2.5rem] text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-orange-950/40 active:scale-[0.98] transition-all"
          >
            Enregistrer
          </button>
        </div>
      )}

      {activeTab === "history" && (
        <div className="p-4 pb-32 space-y-4">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-6 px-1">
            Journal
          </h2>
          {data.history.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-xl"
            >
              <div
                onClick={() =>
                  setExpandedHistory(
                    expandedHistory === item.id ? null : item.id
                  )
                }
                className="p-5 flex justify-between items-center cursor-pointer active:bg-zinc-800/50 transition-colors"
              >
                <div>
                  <h4 className="text-white font-black uppercase tracking-tight text-lg leading-none mb-1">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                    {new Date(item.date).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="text-right">
                    <p className="text-orange-500 font-black text-lg tracking-tighter">
                      {item.totalVolume}kg
                    </p>
                    <p className="text-[8px] text-zinc-700 font-black uppercase tracking-widest leading-none">
                      Vol. total
                    </p>
                  </div>
                  {expandedHistory === item.id ? (
                    <ChevronUp size={20} className="text-zinc-600" />
                  ) : (
                    <ChevronDown size={20} className="text-zinc-600" />
                  )}
                </div>
              </div>
              {expandedHistory === item.id && (
                <div className="p-5 pt-0 border-t border-zinc-800/30 bg-black/40 animate-in slide-in-from-top duration-300">
                  <div className="space-y-5 mt-5">
                    {item.exercises.map((ex, i) => (
                      <div
                        key={i}
                        className="border-l-4 border-orange-500/20 pl-4 py-1"
                      >
                        <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-3">
                          {ex.name}
                        </p>
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-black text-zinc-200">
                          {ex.completedSets.map((s, si) => (
                            <div
                              key={si}
                              className="bg-zinc-900/80 border border-zinc-800/50 rounded-xl p-2.5"
                            >
                              <p className="text-[8px] text-zinc-600 mb-1">
                                S{si + 1}
                              </p>
                              {s.weight}k × {s.reps}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm("Supprimer ?"))
                        saveToCloud({
                          ...data,
                          history: data.history.filter((h) => h.id !== item.id),
                        });
                    }}
                    className="w-full mt-8 py-4 text-[9px] font-black text-red-900 uppercase tracking-[0.3em] border border-red-900/10 rounded-2xl hover:bg-red-900/5 transition-all"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="p-4 pb-32 space-y-6">
          <h2 className="text-2xl font-bold text-white tracking-tight px-1">
            Stats
          </h2>
          <div className="flex gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shadow-lg">
            {[7, 30, 90, 999].map((val) => (
              <button
                key={val}
                onClick={() => setStatTimeFilter(val)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  statTimeFilter === val
                    ? "bg-orange-500 text-white shadow-md"
                    : "text-zinc-600"
                }`}
              >
                {val === 999 ? "Tout" : val + "j"}
              </button>
            ))}
          </div>
          <select
            className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-white outline-none font-bold shadow-xl"
            value={selectedStatEx}
            onChange={(e) => setSelectedStatEx(e.target.value)}
          >
            <option value="">Cibler un exercice</option>
            {Object.keys(data.records).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {selectedStatEx && (
            <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl h-64 shadow-2xl">
                <h3 className="text-[10px] font-black text-orange-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <Trophy size={14} /> Force Max (kg)
                </h3>
                <StableLineChart
                  data={data.history
                    .filter(
                      (h) =>
                        new Date(h.date) >=
                          new Date(
                            new Date().setDate(
                              new Date().getDate() - statTimeFilter
                            )
                          ) &&
                        h.exercises.some((ex) => ex.name === selectedStatEx)
                    )
                    .reverse()
                    .map((h) => {
                      const ex = h.exercises.find(
                        (e) => e.name === selectedStatEx
                      );
                      return {
                        date: new Date(h.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        }),
                        poids: Math.max(
                          ...ex.completedSets.map((s) =>
                            parseFloat(s.weight || 0)
                          )
                        ),
                      };
                    })}
                />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl h-64 shadow-2xl">
                <h3 className="text-[10px] font-black text-blue-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <Dumbbell size={14} /> Reps Totales
                </h3>
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart
                    data={data.history
                      .filter(
                        (h) =>
                          new Date(h.date) >=
                            new Date(
                              new Date().setDate(
                                new Date().getDate() - statTimeFilter
                              )
                            ) &&
                          h.exercises.some((ex) => ex.name === selectedStatEx)
                      )
                      .reverse()
                      .map((h) => {
                        const ex = h.exercises.find(
                          (e) => e.name === selectedStatEx
                        );
                        return {
                          date: new Date(h.date).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                          }),
                          reps: ex.completedSets.reduce(
                            (sum, s) => sum + parseInt(s.reps || 0),
                            0
                          ),
                        };
                      })}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#27272a"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#52525b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#52525b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        border: "none",
                        borderRadius: "12px",
                      }}
                    />
                    <Bar
                      dataKey="reps"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/95 backdrop-blur-3xl border-t border-zinc-900 px-8 py-5 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-2xl">
        {[
          { id: "dashboard", icon: LayoutDashboard, label: "Home" },
          { id: "history", icon: History, label: "Journal" },
          { id: "stats", icon: TrendingUp, label: "Stats" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
              activeTab === item.id
                ? "text-orange-500 scale-110"
                : "text-zinc-700 hover:text-zinc-500"
            }`}
          >
            <item.icon size={24} strokeWidth={activeTab === item.id ? 3 : 2} />
            <span
              className={`text-[8px] font-black uppercase tracking-[0.2em] transition-opacity ${
                activeTab === item.id ? "opacity-100" : "opacity-0"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
