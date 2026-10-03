import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function ViewerPage() {
  const [username, setUsername] = useState(() => localStorage.getItem("bt_username") || "");
  const [isRegistered, setIsRegistered] = useState(false);
  const [players, setPlayers] = useState([]); 
  const [status, setStatus] = useState("active"); 
  const [activeMusic, setActiveMusic] = useState(null); 
  
  const audioRef = useRef(null);
  const lightGrey = "#d1d5db";

  const STORAGE_URL = "https://sxwltroedzxkvqpbcqjc.supabase.co/storage/v1/object/public/songs/";

  useEffect(() => {
    if (username) {
      setIsRegistered(true);
    }
  }, []);

  // --- LOGIQUE AUDIO ---
  useEffect(() => {
    if (!isRegistered) return;

    const fetchMusic = async () => {
      const { data } = await supabase
        .from('BlindtestMusic')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      
      setActiveMusic(data);
    };

    fetchMusic();

    const musicChannel = supabase
      .channel('music_viewer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestMusic' }, fetchMusic)
      .subscribe();

    return () => supabase.removeChannel(musicChannel);
  }, [isRegistered]);

  // Gestion du lecteur Audio
  useEffect(() => {
    if (!audioRef.current) return;
    if (activeMusic) {
      if (activeMusic.is_paused) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Attente interaction"));
      }
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeMusic]);

  // 1. REJOINDRE LA PARTIE
  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanName = username.trim().toUpperCase();
    if (cleanName.length > 2) {
      const { data: existingPlayer } = await supabase.from('BlindtestPlayer').select('username').eq('username', cleanName).maybeSingle();
      if (existingPlayer) { alert("CE PSEUDO EST DÉJÀ UTILISÉ !"); return; }
      localStorage.setItem("bt_username", cleanName);
      const { error } = await supabase.from('BlindtestPlayer').insert({ username: cleanName, score: 0, status: 'active' });
      if (!error) setIsRegistered(true);
    }
  };

  // 2. ACTION DU BUZZ
  const handleBuzzAction = async () => {
    if (status !== "active" || !activeMusic) return;
    setStatus("me");
    await supabase.from('BlindtestPlayer').update({ status: 'buzzed', buzzed_at: new Date().toISOString() }).eq('username', username);
  };

  // 3. LOGIQUE TEMPS RÉEL JOUEURS
  useEffect(() => {
    if (!isRegistered) return;
    const fetchData = async () => {
      const { data } = await supabase.from('BlindtestPlayer').select('*').order('score', { ascending: false });
      if (data) {
        setPlayers(data);
        const me = data.find(p => p.username === username);
        const someoneElseBuzzed = data.find(p => p.status === 'buzzed' && p.username !== username);
        if (me?.status === 'buzzed') setStatus("me");
        else if (me?.status === 'waiting') setStatus("waiting");
        else if (someoneElseBuzzed) setStatus("taken");
        else setStatus("active");
      }
    };
    fetchData();
    const channel = supabase.channel('viewer_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestPlayer' }, fetchData).subscribe();
    return () => supabase.removeChannel(channel);
  }, [isRegistered, username]);

  const getBuzzerStyle = () => {
    switch(status) {
      case "active": return !activeMusic ? "bg-[#22c55e]/20 border-white/10 cursor-not-allowed opacity-50" : "bg-[#22c55e] shadow-[0_10px_0_0_#15803d] active:shadow-none active:translate-y-2 cursor-pointer";
      case "waiting": return "bg-[#dc2626] shadow-[0_10px_0_0_#991b1b] cursor-not-allowed opacity-90";
      case "taken": return "bg-[#6b7280] shadow-[0_10px_0_0_#374151] cursor-not-allowed opacity-80";
      case "me": return "bg-[#f97316] shadow-[0_10px_0_0_#c2410c] animate-pulse";
      default: return "bg-[#9ca3af]";
    }
  };

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 bg-black">
        <form onSubmit={handleJoin} className="w-full max-w-sm border-[6px] border-[#2e1065] bg-[#262626]/80 p-6 backdrop-blur-md flex flex-col gap-5 rounded-[20px]">
          <h2 className="text-[#facc15] font-[1000] text-2xl text-center italic uppercase tracking-widest">TON PSEUDO ?</h2>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} placeholder="ÉCRIS ICI..." className="w-full bg-black/50 border-4 border-[#2e1065] p-3 text-[#facc15] text-xl font-[900] text-center outline-none focus:border-[#facc15] transition-colors rounded-[10px]" maxLength={12} />
          <button type="submit" className="w-full bg-[#facc15] text-black font-[1000] py-3 text-xl uppercase italic shadow-[0_4px_0_0_#a16207] active:translate-y-1 active:shadow-none transition-all rounded-[10px]">REJOINDRE</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black overflow-hidden select-none p-4 justify-between items-center">
      <audio ref={audioRef} src={activeMusic ? `${STORAGE_URL}${encodeURIComponent(activeMusic.filename)}` : ""} />

      {/* 1. SCOREBOARD COMPACT */}
      <div className="w-full max-w-md max-h-[35vh] border-[4px] md:border-[6px] border-[#2e1065] bg-[#262626]/60 p-3 backdrop-blur-sm overflow-y-auto rounded-[16px] shrink-0">
        <h2 className="text-[#facc15] font-[1000] text-lg md:text-xl italic uppercase mb-2 border-b-2 border-[#2e1065] sticky top-0 bg-[#262626]/90 backdrop-blur-md pb-1 z-10 flex justify-between items-center">
          <span>Scores</span>
          <span className="text-xs text-white/40 not-italic font-normal">{username}</span>
        </h2>
        <div className="space-y-1.5">
          {players.map((p, i) => (
            <div key={i} className="flex justify-between items-center border-b border-white/5 pb-1 text-sm md:text-base">
              <span className="font-bold uppercase italic truncate max-w-[180px]" style={{ color: p.username === username ? '#facc15' : lightGrey }}>
                {i + 1}. {p.username}
              </span>
              <span className="text-[#facc15] font-black shrink-0">{p.score} PTS</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. SECTION DU BUZZER ERGONOMIQUE */}
      <div className="flex-1 flex items-center justify-center my-auto">
        <button 
          disabled={status !== "active" || !activeMusic}
          onClick={handleBuzzAction}
          className={`w-52 h-52 sm:w-60 sm:h-60 rounded-full border-[6px] border-black flex items-center justify-center font-[1000] italic transition-all uppercase leading-none p-4 text-center select-none touch-manipulation ${getBuzzerStyle()}`}
          style={{ fontSize: '32px', color: 'black' }}
        >
          {status === "active" && (!activeMusic ? "..." : "BUZZ")}
          {status === "me" && "OK!"}
          {status === "taken" && "STOP"}
          {status === "waiting" && "BLOQUÉ"}
        </button>
      </div>
    </div>
  );
}