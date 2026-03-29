"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const MapLibre = dynamic(() => import("./components/MapLibreMap"), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Activity {
  id: string;
  time: string;
  name: string;
  location: string;
}

interface Day {
  id: string;
  dayNumber: number;
  activities: Activity[];
}

interface Tip {
  id: string;
  name: string;
  location: string;
  rating: number;
  category: string;
  user_id: string;
  lat?: number | null;
  lng?: number | null;
}

export default function HomePage() {
  const [days, setDays] = useState<Day[]>([
    { id: "1", dayNumber: 1, activities: [{ id: "a1", time: "09:00", name: "", location: "" }] },
  ]);

  const [user, setUser] = useState<any>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [showTipForm, setShowTipForm] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("Vše");
  const [filterRating, setFilterRating] = useState(0);
  const [tipForm, setTipForm] = useState({ name: "", location: "", rating: 3, category: "Kavárna" });
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.4378, 50.0755]);
  const [mapZoom] = useState<number>(12);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // AUTH
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) loadItinerary(user.id);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
      if (session?.user) loadItinerary(session.user.id);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const filteredTips = tips.filter((tip) => {
  const matchCategory =
    filterCategory === "Vše" || tip.category === filterCategory;

  const matchRating =
    tip.rating >= filterRating;

  return matchCategory && matchRating;
  });

  // FETCH TIPS
  useEffect(() => {
    const fetchTips = async () => {
      const { data, error } = await supabase.from("tips").select("*");
      if (error) console.error("Error fetching tips:", error);
      else setTips(data || []);
    };
    fetchTips();
  }, []);

  // GEOLOCATION
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => setUserLocation([position.coords.longitude, position.coords.latitude]),
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
  if (userLocation) {
    setMapCenter(userLocation);
  }
  }, [userLocation]);

  // GEOCODE HELPER
  async function geocodeLocation(location: string) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          location
        )}&email=${encodeURIComponent(process.env.NEXT_PUBLIC_NOMINATIM_EMAIL || "support@yourdomain.com")}`
      );
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || json.length === 0) return null;
      return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
    } catch {
      return null;
    }
  }

  // AUTH HANDLERS 
  const handleAuthSubmit = async () => {
    if (!loginEmail || !loginPassword) { alert("Vyplňte prosím email a heslo"); return; }
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        alert("Účet vytvořen! Nyní se můžete přihlásit.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        if (error) throw error;
        setLoginEmail(""); setLoginPassword(""); setShowLoginForm(false);
      }
    } catch (error: any) { alert("Chyba: " + error.message); }
    finally { setAuthLoading(false); }
  };

  const handleResetPassword = async () => {
  if (!loginEmail) {
    alert("Zadejte email");
    return;
  }

  setAuthLoading(true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
  redirectTo: "https://roamiatravelapp.vercel.app/reset-password"});

    if (error) throw error;

    alert("Email pro reset hesla byl odeslán!");
    setResetMode(false);
  } catch (error: any) {
    alert("Chyba: " + error.message);
  } finally {
    setAuthLoading(false);
  }
};

    const handleLogout = async () => { 
      await supabase.auth.signOut(); 
      setUser(null);

      // 🔽 RESET ITINERÁŘE
      setDays([
        { 
          id: "1", 
          dayNumber: 1, 
          activities: [
            { id: "a1", time: "09:00", name: "", location: "" }
          ] 
        },
      ]);
    };

  // PŘIDÁNÍ TIPŮ
  const handleAddTip = async () => {
    if (!user) { alert("Musíte být přihlášeni!"); return; }
    if (!tipForm.name || !tipForm.location) { alert("Vyplňte prosím všechna pole"); return; }

    setLoading(true);
    try {
      const coords = await geocodeLocation(tipForm.location);
      if (!coords) { alert("Nepodařilo se najít lokaci"); setLoading(false); return; }

      const insertObj = {
        user_id: user.id,
        name: tipForm.name,
        location: tipForm.location,
        rating: Number(tipForm.rating),
        category: tipForm.category || "Jiné",
        lat: coords.lat,
        lng: coords.lng,
      };

      const { data, error } = await supabase.from("tips").insert([insertObj]).select();
      if (error) { console.error(error); alert("Chyba při přidávání tipu"); setLoading(false); return; }

      setTips(prev => [...prev, ...(data || [])]);
      setTipForm({ name: "", location: "", rating: 3, category: "Kavárna" });
      setShowTipForm(false);
      alert("Tip byl úspěšně přidán!");
    } catch (err) { console.error(err); alert("Neočekávaná chyba"); }
    finally { setLoading(false); }
  };

  // MAZÁNÍ TIPŮ
  const handleDeleteTip = async (tipId: string) => {
    if (!user) return;
    if (!confirm("Opravdu chcete tento tip smazat?")) return;

    const { error } = await supabase.from("tips").delete().eq("id", tipId);
    if (error) { console.error(error); alert("Nepodařilo se smazat tip"); return; }
    setTips(prev => prev.filter(t => t.id !== tipId));
  };

  // ITINERARY HANDLERS
  const addDay = () => {
    setDays(prev => [
      ...prev,
      { id: `day-${Date.now()}`, dayNumber: prev.length + 1, activities: [] }
    ]);
  };

  const addActivity = (dayId: string) => {
    setDays(days.map(day => day.id === dayId ? {
      ...day,
      activities: [...day.activities, { id: `a${Date.now()}`, time: "12:00", name: "", location: "" }]
    } : day));
  };

  const removeActivity = (dayId: string, activityId: string) => {
    setDays(days.map(day => day.id === dayId ? {
      ...day,
      activities: day.activities.filter(a => a.id !== activityId)
    } : day));
  };

  const removeDay = (dayId: string) => {
    if (days.length <= 1) return;
    const filtered = days.filter(d => d.id !== dayId);
    setDays(filtered.map((d, i) => ({ ...d, dayNumber: i + 1 })));
  };

  const updateActivity = (dayId: string, activityId: string, field: keyof Activity, value: string) => {
    setDays(days.map(day => day.id === dayId ? {
      ...day,
      activities: day.activities.map(a => a.id === activityId ? { ...a, [field]: value } : a)
    } : day));
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // ULOŽENÍ ITINERÁŘE DO DB 
  const saveItinerary = async () => {
    if (!user) return;
    try {
      const { data: existing } = await supabase.from("itineraries")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      let itineraryId = existing?.id;

      if (!itineraryId) {
        const { data: newItinerary } = await supabase.from("itineraries")
          .insert({ user_id: user.id, title: "Můj itinerář" })
          .select()
          .single();
        itineraryId = newItinerary.id;
      }

      if (existing) {
        await supabase.from("days").delete().eq("itinerary_id", itineraryId);
      }

      for (const day of days) {
        const { data: dayData } = await supabase.from("days")
          .insert({ itinerary_id: itineraryId, day_number: day.dayNumber })
          .select()
          .single();

        const activitiesToInsert = day.activities.map(a => ({
          day_id: dayData.id,
          time: a.time,
          name: a.name,
          location: a.location
        }));

        if (activitiesToInsert.length > 0) await supabase.from("activities").insert(activitiesToInsert);
      }

      alert("Itinerář uložen!");
    } catch (err) { console.error(err); alert("Chyba při ukládání itineráře"); }
  };

  // NAČÍTÁNÍ ITINERÁŘE Z DB 
  const loadItinerary = async (userId: string) => {
    try {
      const { data: itinerary } = await supabase.from("itineraries")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (!itinerary) return;

      const { data: daysData } = await supabase.from("days")
        .select("*")
        .eq("itinerary_id", itinerary.id)
        .order("day_number");

      if (!daysData) return;

      const loadedDays: Day[] = [];
      for (const day of daysData) {
        const { data: activitiesData } = await supabase.from("activities")
          .select("*")
          .eq("day_id", day.id)
          .order("time");

        loadedDays.push({
          id: day.id,
          dayNumber: day.day_number,
          activities: (activitiesData || []).map(a => ({
            id: a.id,
            time: a.time,
            name: a.name,
            location: a.location
          }))
        });
      }

      setDays(loadedDays);
    } catch (err) { console.error(err); }
  };

  return (
    <main className="bg-[#0B132B] text-white scroll-smooth">

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#0B132B]/80 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <img src="/ROAMIA.png" alt="Logo" className="h-10 w-auto object-contain"/>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => scrollToSection("itinerary")} className="text-sm hover:text-orange-400">Itinerář</motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => scrollToSection("tips")} className="text-sm hover:text-orange-400">Tipy</motion.button>
            {user ? (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-600">Log out</motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowLoginForm(true)} className="bg-orange-500 px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-600">Log in</motion.button>
            )}
          </div>
        </div>
      </nav>

      {/* LANDING */}
      <section className="h-screen bg-cover bg-center relative flex items-center justify-center text-center" style={{ backgroundImage: "url('/landingPicture.jpg')" }}>
        <div className="absolute inset-0 bg-[#0B132B]/70"></div>
        <motion.div className="relative z-10 max-w-3xl px-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
         <h1 className="text-3xl sm:text-5xl font-bold mb-6">NAPLÁNUJTE SI<br />SVOU DOVOLENOU</h1>
          <p className="text-white/80 mb-10 text-sm sm:text-base">Vytvářejte krásné itineráře, objevujte skryté poklady od ostatních cestovatelů a proměňte své cestovatelské sny ve skutečnost.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => scrollToSection("itinerary")} className="bg-orange-500 px-6 py-3 rounded-full font-semibold hover:bg-orange-600">Začít plánovat</motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => scrollToSection("tips")} className="bg-orange-500/30 px-6 py-3 rounded-full font-semibold hover:bg-orange-500/50">Prozkoumat tipy</motion.button>
          </div>
        </motion.div>
      </section>

      {/* ITINERARY */}
      <section id="itinerary" className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-1 rounded-full text-sm mb-4">📅 Itinerář</span>
          <h2 className="text-4xl font-bold mb-4">NAPLÁNUJ SI CELÝ DEN</h2>
          <p className="text-white/70 mb-12">Vytvořte si dokonalý itinerář. Přidávejte aktivity, nastavte časy a naplánujte své dobrodružství.</p>

          <div className="space-y-6">
            {days.map(day => (
              <motion.div key={day.id} className="bg-[#111936] rounded-2xl p-6 text-left" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Den {day.dayNumber}</h3>
                  {days.length > 1 && <button onClick={() => removeDay(day.id)} className="text-red-500 hover:text-red-400 text-sm font-semibold">Smazat den</button>}
                </div>
                <div className="space-y-3 mb-4">
                  {day.activities.length > 0 ? day.activities.map(activity => (
                    <motion.div key={activity.id} className="flex flex-col sm:flex-row gap-3 sm:gap-4 bg-[#0B132B] p-3 rounded-xl sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                      <input type="time" value={activity.time} onChange={e => updateActivity(day.id, activity.id, "time", e.target.value)} className="w-20 bg-[#0B132B] text-orange-400 text-sm outline-none"/>
                      <input type="text" value={activity.name} onChange={e => updateActivity(day.id, activity.id, "name", e.target.value)} placeholder="Aktivita" className="flex-1 bg-transparent text-white outline-none text-sm"/>
                      <input type="text" value={activity.location} onChange={e => updateActivity(day.id, activity.id, "location", e.target.value)} placeholder="Lokace" className="w-32 bg-transparent text-white/60 outline-none text-sm"/>
                      <button onClick={() => removeActivity(day.id, activity.id)} className="text-red-500 hover:text-red-400 font-semibold text-sm">✕</button>
                    </motion.div>
                  )) : <p className="text-white/40 text-sm">Zatím žádné aktivity</p>}
                </div>
                <button onClick={() => addActivity(day.id)} className="w-full border border-dashed border-white/30 py-3 rounded-xl text-white/60 hover:border-orange-400 hover:text-orange-400">+ Přidat aktivitu</button>
              </motion.div>
            ))}
            <button onClick={addDay} className="w-full bg-orange-500 py-4 rounded-xl font-semibold hover:bg-orange-600 mt-6">+ Přidat den</button>
            <button onClick={saveItinerary} className="w-full bg-orange-500 py-4 rounded-xl font-semibold hover:bg-orange-600 mt-4">
              Uložit itinerář
            </button>
          </div>
        </div>
      </section>

      {/* TIPY */}
      <section id="tips" className="py-24 px-6 bg-[#0A1024]">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-1 rounded-full text-sm mb-4">📍 Tipy</span>
          <h2 className="text-4xl font-bold mb-4">NECHTE SE INSPIROVAT OSTATNÍMI</h2>
          <p className="text-white/70 mb-12">Tipy od skutečných cestovatelů. Prozkoumejte mapu, objevte místní poklady a sdílejte své vlastní objevy.</p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
  
          {/* Kategorie */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#111936] border border-white/10 px-3 py-2 rounded-lg text-white"
          >
            <option>Vše</option>
            <option>Kavárna</option>
            <option>Restaurace</option>
            <option>Muzeum</option>
            <option>Park</option>
            <option>Jiné</option>
          </select>

          {/* Hodnocení */}
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(Number(e.target.value))}
            className="bg-[#111936] border border-white/10 px-3 py-2 rounded-lg text-white"
          >
            <option value={0}>Všechna hodnocení</option>
            <option value={3}>⭐ 3+</option>
            <option value={4}>⭐ 4+</option>
            <option value={5}>⭐ 5</option>
          </select>
        </div>

          <div className="rounded-2xl mb-6 overflow-hidden">
            <MapLibre center={mapCenter} zoom={mapZoom} tips={filteredTips} />
          </div>

          {user && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowTipForm(!showTipForm)} className="bg-orange-500 px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-600 mb-6">
              {showTipForm ? "Zrušit přidání tipu" : "+ Přidat tip"}
            </motion.button>
          )}

          <AnimatePresence>
            {showTipForm && user && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-[#111936] p-6 rounded-2xl mb-6">
                <input type="text" placeholder="Název" value={tipForm.name} onChange={e => setTipForm({ ...tipForm, name: e.target.value })} className="w-full mb-3 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 outline-none focus:border-orange-400"/>
                <input type="text" placeholder="Lokace" value={tipForm.location} onChange={e => setTipForm({ ...tipForm, location: e.target.value })} className="w-full mb-3 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 outline-none focus:border-orange-400"/>
                <select value={tipForm.category} onChange={e => setTipForm({ ...tipForm, category: e.target.value })} className="w-full mb-3 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-400">
                  <option>Kavárna</option><option>Restaurace</option><option>Muzeum</option><option>Park</option><option>Jiné</option>
                </select>
                <input type="number" min={1} max={5} value={tipForm.rating} onChange={e => setTipForm({ ...tipForm, rating: parseInt(e.target.value) })} className="w-full mb-3 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 outline-none focus:border-orange-400"/>
                <div className="flex gap-2">
                  <button onClick={handleAddTip} disabled={loading} className="flex-1 bg-orange-500 py-2 rounded-lg font-semibold hover:bg-orange-600 transition">{loading ? "Přidávám..." : "Přidat"}</button>
                  <button onClick={() => setShowTipForm(false)} className="flex-1 border border-white/20 py-2 rounded-lg hover:border-white/40">Zrušit</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4 text-left">
           {filteredTips.length > 0 ? filteredTips.map(tip => (
            <motion.div
              key={tip.id}
              className="bg-[#111936] p-4 rounded-xl flex justify-between items-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >

              <div>
                <h4 className="font-semibold">{tip.name}</h4>
                <p className="text-white/60 text-sm">
                  {tip.category} • {"⭐".repeat(Math.max(0, Math.min(5, Math.round(tip.rating))))}
                </p>
                <p className="text-white/40 text-sm">{tip.location}</p>
              </div>

              {user && user.id === tip.user_id && (
                <button
                  onClick={() => handleDeleteTip(tip.id)}
                  className="text-red-400 hover:text-red-500 text-sm font-semibold"
                >
                  Smazat
                </button>
              )}

            </motion.div>
          )) : (
            <p className="text-white/60 text-center">Zatím žádné tipy</p>
          )}
          </div>
        </div>
      </section>

      {/* LOGIN MODAL */}
      <AnimatePresence>
        {showLoginForm && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-[#111936] rounded-2xl p-8 max-w-md w-full mx-4" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <h2 className="text-2xl font-bold mb-6 text-center"> {resetMode ? "Reset hesla" : isSignUp ? "Vytvořit účet" : "Přihlášení"}</h2>
              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full mb-3 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-400"/>
              <input type="password" placeholder="Heslo" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full mb-6 bg-[#0B132B] border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-400"/>
              {!isSignUp && !resetMode && (
                <button onClick={() => setResetMode(true)} className="w-full text-sm text-orange-400 mb-3"> Zapomenuté heslo? </button> )}
              <button onClick={resetMode ? handleResetPassword : handleAuthSubmit} disabled={authLoading} className="w-full bg-orange-500 py-2 rounded-lg font-semibold hover:bg-orange-600 transition mb-3"> {authLoading ? "Čekám..." : resetMode ? "Odeslat reset email" : isSignUp ? "Vytvořit účet" : "Přihlásit se"} </button>
              <button onClick={() => { setIsSignUp(!isSignUp); setResetMode(false); }} className="w-full mb-3" > {isSignUp ? "Už máte účet? Přihlaste se" : "Nemáte účet? Zaregistrujte se"} </button>
              <button onClick={() => setShowLoginForm(false)} className="w-full">Zavřít</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="py-10 text-center text-white/40 text-sm">© 2026 ROAMIA</footer>
    </main>
  );
}