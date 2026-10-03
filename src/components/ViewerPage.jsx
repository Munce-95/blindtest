import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function BuzzerOnly() {
  const [username, setUsername] = useState(() => localStorage.getItem("bt_username") || "");
  const [isRegistered, setIsRegistered] = useState(false);
  const [status, setStatus] = useState("active"); 
  const [activeMusic, setActiveMusic] = useState(null); 
  
  const audioRef = useRef(null);
  const STORAGE_URL = "https://sxwltroedzxkvqpbcqjc.supabase.co/storage/v1/object/public/songs/";

  // Vérification initiale du pseudo
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

  // Lecture / Pause Audio
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

  // --- 1. SAISIE DU PSEUDO ---
  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanName = username.trim().toUpperCase();
    if (cleanName.length > 2) {
      // Vérification si le pseudo existe déjà
      const { data: existingPlayer } = await supabase
        .from('BlindtestPlayer')
        .select('username')
        .eq('username', cleanName)
        .maybeSingle();

      if (existingPlayer) { 
        alert("CE PSEUDO EST DÉJÀ UTILISÉ !"); 
        return; 
      }

      // Enregistrement dans le localStorage et Supabase
      localStorage.setItem("bt_username", cleanName);
      const { error } = await supabase
        .from('BlindtestPlayer')
        .insert({ username: cleanName, score: 0, status: 'active' });

      if (!error) {
        setUsername(cleanName);
        setIsRegistered(true);
      }
    }
  };

  // --- 2. ACTION DU BUZZ ---
  const handleBuzzAction = async () => {
    if (status !== "active" || !activeMusic || !username) return;
    setStatus("me");
    await supabase
      .from('BlindtestPlayer')
      .update({ status: 'buzzed', buzzed_at: new Date().toISOString() })
      .eq('username', username);
  };

  // --- 3. ÉTATS DU JOUEUR EN TEMPS RÉEL ---
  useEffect(() => {
    if (!isRegistered || !username) return;

    const fetchData = async () => {
      const { data } = await supabase.from('BlindtestPlayer').select('*');
      if (data) {
        const me = data.find(p => p.username === username);
        const someoneElseBuzzed = data.find(p => p.status === 'buzzed' && p.username !== username);
        
        if (me?.status === 'buzzed') setStatus("me");
        else if (me?.status === 'waiting') setStatus("waiting");
        else if (someoneElseBuzzed) setStatus("taken");
        else setStatus("active");
      }
    };

    fetchData();
    const channel = supabase
      .channel('buzzer_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BlindtestPlayer' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isRegistered, username]);

  const getBuzzerStyle = () => {
    switch(status) {
      case "active": 
        return !activeMusic 
          ? "bg-[#22c55e]/20 border-white/10 cursor-not-allowed opacity-50" 
          : "bg-[#22c55e] shadow-[0_12px_0_0_#15803d] md:shadow-[0_20px_0_0_#15803d] hover:bg-[#4ade80] active:shadow-none active:translate-y-3 cursor-pointer";
      case "waiting": 
        return "bg-[#dc2626] shadow-[0_12px_0_0_#991b1b] md:shadow-[0_20px_0_0_#991b1b] cursor-not-allowed opacity-90";
      case "taken": 
        return "bg-[#6b7280] shadow-[0_12px_0_0_#374151] md:shadow-[0_20px_0_0_#374151] cursor-not-allowed opacity-80";
      case "me": 
        return "bg-[#f97316] shadow-[0_12px_0_0_#c2410c] md:shadow-[0_20px_0_0_#c2410c] animate-pulse";
      default: 
        return "bg-[#9ca3af]";
    }
  };

  // Écran Formulaire si pas encore enregistré
  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 md:px-[10vw] bg-black">
        <form onSubmit={handleJoin} className="w-full max-w-sm md:max-w-md border-[6px] md:border-[8px] border-[#2e1065] bg-[#262626]/80 p-6 md:p-8 backdrop-blur-md flex flex-col gap-5 md:gap-6 rounded-[20px] md:rounded-[24px]">
          <h2 className="text-[#facc15] font-[1000] text-2xl md:text-3xl text-center italic uppercase tracking-widest">TON PSEUDO ?</h2>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value.toUpperCase())} 
            placeholder="ÉCRIS ICI..." 
            className="w-full box-border bg-black/50 border-4 border-[#2e1065] p-3 md:p-4 text-[#facc15] text-xl md:text-2xl font-[900] text-center outline-none focus:border-[#facc15] transition-colors rounded-[10px] md:rounded-[12px]" 
            maxLength={12} 
          />
          <button 
            type="submit" 
            className="w-full bg-[#facc15] text-black font-[1000] py-3 md:py-4 text-xl md:text-2xl uppercase italic shadow-[0_4px_0_0_#a16207] md:shadow-[0_6px_0_0_#a16207] active:translate-y-1 active:shadow-none transition-all rounded-[10px] md:rounded-[12px]"
          >
            REJOINDRE
          </button>
        </form>
      </div>
    );
  }

  // Écran Buzzer Géant
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black overflow-hidden select-none items-center justify-center p-4 relative">
      <audio ref={audioRef} src={activeMusic ? `${STORAGE_URL}${encodeURIComponent(activeMusic.filename)}` : ""} />

      {/* Affichage discret du pseudo connecté en haut */}
      <div className="absolute top-4 text-white/40 font-bold uppercase tracking-widest text-sm">
        Joueur : <span className="text-[#facc15]">{username}</span>
      </div>

      <button 
        disabled={status !== "active" || !activeMusic}
        onClick={handleBuzzAction}
        className={`w-[85vw] max-w-[380px] h-[85vw] max-h-[380px] md:w-[480px] md:h-[480px] md:max-w-none md:max-h-none aspect-square shrink-0 rounded-full border-[8px] md:border-[12px] border-black flex items-center justify-center font-[1000] italic transition-all uppercase leading-none p-2 text-center select-none touch-manipulation text-6xl sm:text-7xl md:text-9xl tracking-tight text-black ${getBuzzerStyle()}`}
      >
        {status === "active" && (!activeMusic ? "..." : "BUZZ")}
        {status === "me" && "OK!"}
        {status === "taken" && "STOP"}
        {status === "waiting" && "BLOQUÉ"}
      </button>
    </div>
  );
}