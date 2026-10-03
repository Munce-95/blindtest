import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function BuzzerOnly() {
  const [username] = useState(() => localStorage.getItem("bt_username") || "");
  const [status, setStatus] = useState("active"); 
  const [activeMusic, setActiveMusic] = useState(null); 
  
  const audioRef = useRef(null);
  const STORAGE_URL = "https://sxwltroedzxkvqpbcqjc.supabase.co/storage/v1/object/public/songs/";

  // --- LOGIQUE AUDIO ---
  useEffect(() => {
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
  }, []);

  // Lecture / Pause
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

  // --- ACTION DU BUZZ ---
  const handleBuzzAction = async () => {
    if (status !== "active" || !activeMusic || !username) return;
    setStatus("me");
    await supabase
      .from('BlindtestPlayer')
      .update({ status: 'buzzed', buzzed_at: new Date().toISOString() })
      .eq('username', username);
  };

  // --- ÉTATS DU JOUEUR EN TEMPS RÉEL ---
  useEffect(() => {
    if (!username) return;

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
  }, [username]);

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

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black overflow-hidden select-none items-center justify-center p-4">
      <audio ref={audioRef} src={activeMusic ? `${STORAGE_URL}${encodeURIComponent(activeMusic.filename)}` : ""} />

      {/* Buzzer taille max écran */}
      <button 
        disabled={status !== "active" || !activeMusic}
        onClick={handleBuzzAction}
        className={`w-[85vw] max-w-[380px] h-[85vw] max-h-[380px] md:w-[450px] md:h-[450px] md:max-w-none md:max-h-none aspect-square shrink-0 rounded-full border-[8px] md:border-[12px] border-black flex items-center justify-center font-[1000] italic transition-all uppercase leading-none p-4 text-center select-none touch-manipulation text-5xl sm:text-6xl md:text-8xl text-black ${getBuzzerStyle()}`}
      >
        {status === "active" && (!activeMusic ? "..." : "BUZZ")}
        {status === "me" && "OK!"}
        {status === "taken" && "STOP"}
        {status === "waiting" && "BLOQUÉ"}
      </button>
    </div>
  );
}