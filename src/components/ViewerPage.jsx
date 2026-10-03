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
      case "active": return !activeMusic ? "bg-[#22c55e]/20 border-white/10 cursor-not-allowed opacity-50" : "bg-[#22c55e] shadow-[0_12px_0_0_#15803d] hover:bg-[#4ade80] active:shadow-none active:translate-y-2 cursor-pointer";
      case "waiting": return "bg-[#dc2626] shadow-[0_12px_0_0_#991b1b] cursor-not-allowed opacity-90";
      case "taken": return "bg-[#6b7280] shadow-[0_12px_0_0_#374151] cursor-not-allowed opacity-80";
      case "me": return "bg-[#f97316] shadow-[0_12px_0_0_#c2410c] animate-pulse";
      default: return "bg-[#9ca3af]";
    }
  };

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full px-[10vw] bg-black">
        <form onSubmit={handleJoin} className="w-full max-w-md border-[8px] border-[#2e1065] bg-[#262626]/80 p-8 backdrop-blur-md flex flex-col gap-6" style={{ borderRadius: '24px' }}>
          <h2 className="text-[#facc15] font-[1000] text-3xl text-center italic uppercase tracking-widest">TON PSEUDO ?</h2>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} placeholder="ÉCRIS ICI..." className="w-full box-border bg-black/50 border-4 border-[#2e1065] p-4 text-[#facc15] text-2xl font-[900] text-center outline-none focus:border-[#facc15] transition-colors" style={{ borderRadius: '12px' }} maxLength={12} />
          <button type="submit" className="w-full bg-[#facc15] text-black font-[1000] py-4 text-2xl uppercase italic shadow-[0_6px_0_0_#a16207] active:translate-y-1 active:shadow-none transition-all" style={{ borderRadius: '12px' }}>REJOINDRE</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden relative">
      <audio ref={audioRef} src={activeMusic ? `${STORAGE_URL}${encodeURIComponent(activeMusic.filename)}` : ""} />

      {/* 1. SCOREBOARD */}
      <div className="flex-1 w-full p-4 flex justify-center min-h-0">
        <div className="w-full max-w-lg h-full border-[6px] border-[#2e1065] bg-[#262626]/45 p-4 backdrop-blur-sm overflow-y-auto" style={{ borderRadius: '20px' }}>
          <h2 className="text-[#facc15] font-[1000] text-2xl italic uppercase mb-2 border-b-4 border-[#2e1065] sticky top-0 bg-[#262626]/80 backdrop-blur-md pb-1 z-10">Scores</h2>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={i} className="flex justify-between items-center border-b border-white/5 pb-1">
                <span className="font-bold uppercase italic text-base md:text-lg" style={{ color: p.username === username ? '#facc15' : lightGrey }}>{p.username}</span>
                <span className="text-[#facc15] font-black text-base md:text-lg">{p.score} PTS</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. SECTION DU BUZZER */}
      <div className="flex justify-center my-8 shrink-0">
        <button 
          disabled={status !== "active" || !activeMusic}
          onClick={handleBuzzAction}
          className={`w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full border-[8px] border-black flex items-center justify-center font-[1000] italic transition-all uppercase leading-none px-4 text-center ${getBuzzerStyle()}`}
          style={{ fontSize: '36px', color: 'black' }}
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