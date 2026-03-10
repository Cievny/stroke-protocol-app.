import React, { useState, useMemo, useReducer, useEffect } from "react";
import ReactDOM from "react-dom/client";

// --- 1. HELPER DATA ---
const nihssItemsDefinition = [
  {
    group: "1. Vedomie",
    items: [
      { id: "1a", label: "1a. Úroveň vedomia", max: 3, options: ["0: V bdelom stave", "1: Reaguje na oslovenie", "2: Reaguje na bolesť", "3: Nereaguje"], helpText: "Hodnotenie bdelosti. Ak treba, stimulujte oslovením, potom bolestivým podnetom." },
      { id: "1b", label: "1b. Otázky (mesiac, vek)", max: 2, options: ["0: Správne odpovede", "1: 1 správna odpoveď", "2: Žiadna správna odpoveď"], helpText: 'Spýtajte sa: "Aký je mesiac?" a "Koľko máte rokov?". Netoleruje sa ani čiastočná odpoveď.' },
      { id: "1c", label: "1c. Príkazy (zavrieť/otvoriť oči, ruka)", max: 2, options: ["0: Vyhovie obom", "1: Vyhovie jednému", "2: Nevyhovie"], helpText: 'Vyzvite: "Otvorte a zavrite oči." a "Zovrite a uvoľnite päsť (ne-paretickou rukou)".' },
    ],
  },
  { group: "2. Pohyb očí", items: [{ id: "2", label: "2. Pohľad", max: 2, options: ["0: Normálny", "1: Čiastočná deviácia", "2: Vynútená deviácia"], helpText: "Sledujte spontánne pohyby očí. Potom vyzvite pacienta, aby sledoval váš prst." }] },
  { group: "3. Zorné pole", items: [{ id: "3", label: "3. Zorné pole (konfrontáciou)", max: 3, options: ["0: Normálne", "1: Čiastočná hemianopsia", "2: Úplná hemianopsia", "3: Bilaterálna slepota"], helpText: "Testujte 4 kvadranty vizuálnou konfrontáciou (pohybujúce sa prsty)." }] },
  { group: "4. Paréza tváre", items: [{ id: "4", label: "4. Paréza tváre", max: 3, options: ["0: Normálna symetria", "1: Minimálna (kútik)", "2: Čiastočná (celá dolná tvár)", "3: Úplná (1/2 tváre)"], helpText: "Vyzvite pacienta, aby ukázal zuby, zdvihol obočie a pevne zavrel oči." }] },
  { group: "5. Motorika - Horné Končatiny", items: [
      { id: "5a", label: "5a. Ľavá horná končatina", max: 4, options: ["0: Udrží 10s", "1: Klesá", "2: Klesá predčasne", "3: Pohyb proti gravitácii", "4: Žiaden pohyb", "9: Nehodnotiteľné"], helpText: "Ruka v predpažení 10 sekúnd (dlaňou dolu)." },
      { id: "5b", label: "5b. Pravá horná končatina", max: 4, options: ["0: Udrží 10s", "1: Klesá", "2: Klesá predčasne", "3: Pohyb proti gravitácii", "4: Žiaden pohyb", "9: Nehodnotiteľné"], helpText: "Ruka v predpažení 10 sekúnd (dlaňou dolu)." }
    ] },
  { group: "6. Motorika - Dolné Končatiny", items: [
      { id: "6a", label: "6a. Ľavá dolná končatina", max: 4, options: ["0: Udrží 5s (30°)", "1: Klesá", "2: Klesá predčasne", "3: Pohyb proti gravitácii", "4: Žiaden pohyb", "9: Nehodnotiteľné"], helpText: "Noha zdvihnutá v 30° uhle na 5 sekúnd." },
      { id: "6b", label: "6b. Pravá dolná končatina", max: 4, options: ["0: Udrží 5s (30°)", "1: Klesá", "2: Klesá predčasne", "3: Pohyb proti gravitácii", "4: Žiaden pohyb", "9: Nehodnotiteľné"], helpText: "Noha zdvihnutá v 30° uhle na 5 sekúnd." }
    ] },
  { group: "7. Ataxia", items: [{ id: "7", label: "7. Ataxia končatín", max: 2, options: ["0: Bez ataxie", "1: Prítomná v 1 končatine", "2: Prítomná v 2+ končatinách", "9: Nehodnotiteľné"], helpText: 'Test "prst-nos" a "päta-koleno". Hodnoťte len ataxiu nie spôsobenú slabosťou.' }] },
  { group: "8. Senzitíva", items: [{ id: "8", label: "8. Senzitíva (pichnutie)", max: 2, options: ["0: Normálna", "1: Mierna porucha", "2: Vážna porucha / kóma"], helpText: "Testujte citlivosť na pichnutie (napr. špendlíkom) a porovnajte strany." }] },
  { group: "9. Jazyk / Afázia", items: [{ id: "9", label: "9. Jazyk / Afázia", max: 3, options: ["0: Bez afázie", "1: Mierna afázia", "2: Vážna afázia", "3: Globálna afázia / mutizmus"], helpText: "Ukážte predmety (kľúč, pero), požiadajte o pomenovanie a popis situácie." }] },
  { group: "10. Dyzartria", items: [{ id: "10", label: "10. Dyzartria (artikulácia)", max: 2, options: ["0: Normálna artikulácia", "1: Mierna dyzartria", "2: Vážna / nezrozumiteľná reč", "9: Nehodnotiteľné"], helpText: "Požiadajte prečítať zoznam slov (napr. MAMA, TATA, ARTILÉRIA)." }] },
  { group: "11. Neglect", items: [{ id: "11", label: "11. Extinkcia / Neglect", max: 2, options: ["0: Bez neglectu", "1: Čiastočný neglect", "2: Úplný neglect"], helpText: "Testujte simultánny dotyk na oboch stranách tváre/rúk." }] },
];

const contraindicationsList = [
  { id: "hep", label: "Plná heparinizácia (podaný UFH na sále, aPTT nad normu, ACT > 180s)" },
  { id: "doac", label: "Užívanie DOACs (apixaban, dabigatran, rivaroxaban) v posledných 48 hodinách" },
  { id: "punct", label: "Nedávna arteriálna punkcia v nekomprimovateľnom mieste (do 7 dní)" },
  { id: "bleed", label: "Známy krvácavý stav, nedávny ťažký úraz hlavy, anamnéza ICH alebo iná závažná KI" }
];

const initialNihssScores = {};
nihssItemsDefinition.forEach((group) => {
  group.items.forEach((item) => {
    initialNihssScores[item.id] = 0;
  });
});

// --- 2. STATE MANAGEMENT ---

const LOCAL_STORAGE_KEY = "strokePatientData_v5";

const initialPatientState = {
  befastTime: "",
  befastResult: false,
  ctActivated: false,
  nihssScores: initialNihssScores,
  ivtContraindications: [],
  ctResult: "ischemia",
  timeWindow: "0-4.5h",
  ctagResult: "no_lvo",
  perfusionResult: "mismatch",
};

function patientReducer(state, action) {
  switch (action.type) {
    case "SET_BEFAST":
      return { ...state, befastTime: action.payload.time, befastResult: action.payload.result };
    case "SET_CT_ACTIVATED":
      return { ...state, ctActivated: action.payload };
    case "UPDATE_NIHSS":
      return { ...state, nihssScores: { ...state.nihssScores, [action.payload.id]: action.payload.value } };
    case "TOGGLE_CONTRAINDICATION": {
      const exists = state.ivtContraindications.includes(action.payload);
      const newContraindications = exists
        ? state.ivtContraindications.filter(id => id !== action.payload)
        : [...state.ivtContraindications, action.payload];
      return { ...state, ivtContraindications: newContraindications };
    }
    case "SET_CT_FIELD":
      return { ...state, [action.payload.field]: action.payload.value };
    case "RESET":
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return initialPatientState;
    default:
      return state;
  }
}

// --- 3. BUSINESS LOGIC ---

function calculateTotalNihss(scores) {
  return Object.values(scores).reduce((acc, score) => {
    const numScore = parseInt(score, 10);
    if (!isNaN(numScore) && numScore !== 9) return acc + numScore;
    return acc;
  }, 0);
}

function getElapsedTimeInfo(timeStr) {
  if (!timeStr || timeStr.toLowerCase().includes("neznám") || timeStr.toLowerCase().includes("wake")) {
    return { hours: 99, category: ">6h", isUnknown: true };
  }
  
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) throw new Error("Invalid time format");

    const now = new Date();
    const strokeTime = new Date();
    strokeTime.setHours(hours, minutes, 0, 0);
    
    if (strokeTime > now) strokeTime.setDate(strokeTime.getDate() - 1);
    
    const diffHrs = (now - strokeTime) / (1000 * 60 * 60);
    
    let category = "0-4.5h";
    if (diffHrs > 4.5 && diffHrs <= 6) category = "4.5-6h";
    if (diffHrs > 6) category = ">6h";
    
    return { hours: diffHrs, category, isUnknown: false };
  } catch (e) {
    return { hours: 99, category: ">6h", isUnknown: true };
  }
}

function getRecommendation(patientData) {
  const { ctResult, timeWindow, ctagResult, perfusionResult, befastTime, ivtContraindications } = patientData;
  const totalNihss = calculateTotalNihss(patientData.nihssScores);
  
  const isIvtContraindicated = ivtContraindications.length > 0;
  const ivtWarningText = "⚠️ DÔLEŽITÉ: Infúzia Alteplázy musí prebiehať nepretržite počas transportu a samotného endovaskulárneho výkonu. Nečaká sa na efekt IVT – punkcia triesla/zápästia musí prebehnúť čo najskôr!";
  const mteContactText = "📞 KONTAKT: Pre realizáciu MTE okamžite kontaktujte OIRA tím (kl. 7294), resp. príslužbu konajúceho lekára!";

  const baseDetails = [
    `BEFAST Čas: ${befastTime || "Nezadaný"}`,
    `NIHSS Skóre: ${totalNihss}`,
    `Kontraindikácie IVT: ${isIvtContraindicated ? "PRÍTOMNÉ" : "Žiadne"}`
  ];

  if (ctResult === "ich") {
    return {
      title: "STOP: Intrakraniálna Hemorágia",
      description: "Liečba IVT a MTE je absolútne kontraindikovaná. Okamžite konzultovať neurochirurga.",
      colorClass: "border-red-500 bg-red-700",
      details: [...baseDetails, "Nález NCCT: Krvácanie"],
    };
  }

  if (ctResult === "other") {
    return {
      title: "STOP: Iný Nález",
      description: "Nález na CT nezodpovedá iCMP (napr. tumor). Zvážiť inú diagnózu a manažment.",
      colorClass: "border-yellow-500 bg-yellow-700",
      details: [...baseDetails, "Nález NCCT: Iný nález"],
    };
  }

  if (ctResult === "ischemia") {
    // 1. OKNO do 4.5 hodiny
    if (timeWindow === "0-4.5h") {
      if (ctagResult === "lvo") {
        if (isIvtContraindicated) {
          return {
            title: "Direct MTE (Priamo na sálu)",
            description: `Pacient je v okne do 4.5h s LVO, ale IVT je KONTRAINDIKOVANÁ. Odporúča sa okamžitá mechanická trombektómia (Direct MTE).\n\n${mteContactText}`,
            colorClass: "border-purple-500 bg-purple-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 0 - 4.5h", "CTAG: LVO"],
          };
        } else {
          return {
            title: "IVT (Altepláza) + MTE",
            description: `Pacient v okne do 4.5h s LVO. Odporúča sa IVT (Altepláza 0.9 mg/kg, max 90mg) + MTE.\n\n${ivtWarningText}\n\n${mteContactText}`,
            colorClass: "border-green-500 bg-green-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 0 - 4.5h", "CTAG: LVO"],
          };
        }
      }
      if (ctagResult === "no_lvo") {
        if (isIvtContraindicated) {
          return {
            title: "Konzervatívny Postup",
            description: "Pacient nemá LVO (nie je indikovaný na MTE) a IVT je KONTRAINDIKOVANÁ. Reperfúzna liečba nie je možná.",
            colorClass: "border-yellow-500 bg-yellow-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 0 - 4.5h", "CTAG: Bez LVO"],
          };
        } else {
          return {
            title: "IVT (Altepláza)",
            description: "Pacient je v okne do 4.5h bez LVO. Odporúča sa podanie IVT (Altepláza 0.9 mg/kg, max 90mg).",
            colorClass: "border-green-500 bg-green-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 0 - 4.5h", "CTAG: Bez LVO"],
          };
        }
      }
    }

    // 2. OKNO 4.5 - 6 hodín
    if (timeWindow === "4.5-6h") {
      if (isIvtContraindicated) {
        if (ctagResult === "lvo") {
          return {
            title: "Direct MTE (Priamo na sálu)",
            description: `Pacient s LVO. Trombolýza je KONTRAINDIKOVANÁ (perfúzia nebola nutná). Pre mechanickú trombektómiu je stále v okne do 6 hodín. Indikovaná je priama MTE.\n\n${mteContactText}`,
            colorClass: "border-purple-500 bg-purple-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: LVO"],
          };
        } else {
          return {
            title: "Konzervatívny Postup",
            description: "Bez LVO a s kontraindikáciou IVT. Reperfúzia nie je možná.",
            colorClass: "border-yellow-500 bg-yellow-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: Bez LVO"],
          };
        }
      } else {
        if (perfusionResult === "mismatch") {
          if (ctagResult === "lvo") {
            return {
              title: "IVT (Altepláza) + MTE",
              description: `MTE indikovaná na základe LVO (<6h). IVT indikovaná pre prítomný mismatch (EXTEND). Odporúča sa IVT + MTE.\n\n${ivtWarningText}\n\n${mteContactText}`,
              colorClass: "border-green-500 bg-green-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          } else {
            return {
              title: "IVT (Altepláza)",
              description: "Pacient bez LVO, ale s prítomnou penumbrou (mismatch). Odporúča sa IVT.",
              colorClass: "border-green-500 bg-green-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: Bez LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          }
        } else {
          if (ctagResult === "lvo") {
            return {
              title: "Direct MTE (Bez IVT)",
              description: `Pacient MÁ LVO a je v okne do 6h, čiže je plne indikovaný na MTE. Pre chýbajúci mismatch nepodávať IVT.\n\n${mteContactText}`,
              colorClass: "border-purple-500 bg-purple-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: LVO", "Perfúzia: Mismatch NEPRÍTOMNÝ"],
            };
          } else {
            return {
              title: "Konzervatívny Postup",
              description: "Bez LVO a bez mismatchu. Reperfúzia sa neodporúča.",
              colorClass: "border-yellow-500 bg-yellow-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5 - 6h", "CTAG: Bez LVO", "Perfúzia: Mismatch NEPRÍTOMNÝ"],
            };
          }
        }
      }
    }

    // 3. OKNO Nad 6 hodín / Wake up
    if (timeWindow === ">6h") {
      if (perfusionResult === "mismatch") {
        if (ctagResult === "lvo") {
          if (isIvtContraindicated) {
            return {
              title: "Direct MTE (Priamo na sálu)",
              description: `Prítomný mismatch potvrdil penumbru pre okno nad 6h (DAWN/DEFUSE-3). IVT je KONTRAINDIKOVANÁ. Indikovaná priama MTE.\n\n${mteContactText}`,
              colorClass: "border-purple-500 bg-purple-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: > 6h / Wake-up", "CTAG: LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          } else {
            return {
              title: "IVT (Altepláza) + MTE",
              description: `Prítomný mismatch potvrdil penumbru. Indikovaná IVT aj MTE.\n\n${ivtWarningText}\n\n${mteContactText}`,
              colorClass: "border-green-500 bg-green-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: > 6h / Wake-up", "CTAG: LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          }
        } else {
          if (isIvtContraindicated) {
            return {
              title: "Konzervatívny Postup",
              description: "Pacient s penumbrou bez LVO. IVT je KONTRAINDIKOVANÁ, MTE nie je technicky indikovaná.",
              colorClass: "border-yellow-500 bg-yellow-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: > 6h / Wake-up", "CTAG: Bez LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          } else {
            return {
              title: "IVT (Altepláza)",
              description: "Pacient bez LVO s prítomnou penumbrou (mismatch). Odporúča sa IVT.",
              colorClass: "border-green-500 bg-green-700",
              details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: > 6h / Wake-up", "CTAG: Bez LVO", "Perfúzia: Mismatch PRÍTOMNÝ"],
            };
          }
        }
      } else { 
        return {
          title: "Konzervatívny Postup",
          description: "V predĺženom okne nie je prítomná zachrániteľná penumbra (mismatch). Reperfúzia sa neodporúča.",
          colorClass: "border-yellow-500 bg-yellow-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: > 6h / Wake-up", "Perfúzia: Mismatch NEPRÍTOMNÝ"],
        };
      }
    }

    // Prípad A. Basilaris
    if (timeWindow === "basilaris>4.5h") {
      if (isIvtContraindicated) {
        return {
          title: "Direct MTE (Život zachraňujúci)",
          description: `Symptomatická oklúzia A. Basilaris > 4.5h. IVT je KONTRAINDIKOVANÁ. Odporúča sa priama MTE ako záchrana života.\n\n${mteContactText}`,
          colorClass: "border-purple-500 bg-purple-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: A. Basilaris > 4.5h"],
        };
      } else {
        return {
          title: "IVT (Altepláza) + MTE",
          description: `Symptomatická oklúzia A. Basilaris > 4.5h. Odporúča sa IVT (Altepláza) + MTE.\n\n${ivtWarningText}\n\n${mteContactText}`,
          colorClass: "border-orange-500 bg-orange-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: A. Basilaris > 4.5h"],
        };
      }
    }
  }

  return {
    title: "Nekompletné Dáta",
    description: "Nebolo možné určiť odporúčanie. Skontrolujte zadané parametre.",
    colorClass: "border-slate-500 bg-slate-700",
    details: [...baseDetails, "Skontrolujte zadané hodnoty."],
  };
}

// --- 4. SUB-KOMPONENTY (Obrazovky) ---

const StartScreen = ({ onStart }) => (
  <div className="text-center">
    <h1 className="text-4xl font-bold text-red-400 mb-4">STROKE PROTOKOL</h1>
    <p className="text-xl text-slate-300 mb-8">Sprievodca pre akútny príjem pacienta so suspektnou cievnou mozgovou príhodou.</p>
    <button onClick={onStart} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-2xl shadow-lg transition duration-200">
      ŠTART PROTOKOL
    </button>
  </div>
);

const BefastScreen = ({ initialTime, onSubmit, onBack }) => {
  const [timeValue, setTimeValue] = useState(initialTime || "");

  const handleBefastSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let isPositive = false;
    for (let [key, value] of formData.entries()) {
      if (key !== "time" && value === "yes") isPositive = true;
    }
    onSubmit({ time: timeValue, result: isPositive });
  };

  const formatTime = (date) => date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  
  const setNow = () => setTimeValue(formatTime(new Date()));
  const setMinus = (mins) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - mins);
    setTimeValue(formatTime(d));
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 1: BEFAST Skríning</h2>
      <form onSubmit={handleBefastSubmit} className="space-y-6">
        <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
          <label htmlFor="time" className="block text-xl font-semibold text-yellow-300 mb-2">T - Time (Čas vzniku)</label>
          <p className="text-sm text-slate-300 mb-3">Zadajte čas vzniku príznakov (alebo kedy bol naposledy v poriadku).</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={setNow} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded shadow text-sm font-semibold transition-colors">
              Teraz (Na sále)
            </button>
            <button type="button" onClick={() => setMinus(30)} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded shadow text-sm transition-colors">
              Pred 30 min
            </button>
            <button type="button" onClick={() => setMinus(60)} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-2 rounded shadow text-sm transition-colors">
              Pred 1 hod
            </button>
            <button type="button" onClick={() => setTimeValue("Neznámy / Wake-up")} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded shadow text-sm font-semibold transition-colors">
              Wake-up / Neznámy
            </button>
          </div>

          <input 
            type="text" 
            id="time" 
            name="time" 
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            required 
            placeholder="Napr. 14:30 alebo Wake-up"
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {[
          { key: "B", label: "Balance (Rovnováha)", text: "Náhla strata rovnováhy alebo koordinácie?" },
          { key: "E", label: "Eyes (Oči)", text: "Náhla strata videnia alebo dvojité videnie?" },
          { key: "F", label: "Face (Tvár)", text: "Pokles ústneho kútika alebo viečka?" },
          { key: "A", label: "Arms (Ruky)", text: "Slabosť alebo necitlivosť ruky/nohy?" },
          { key: "S", label: "Speech (Reč)", text: "Nerozrozumiteľná reč alebo problém rozumieť?" }
        ].map((item) => (
          <div key={item.key} className="bg-slate-700 p-4 rounded-lg shadow-inner">
            <label className="block text-xl font-semibold text-slate-100">{item.key} - {item.label}</label>
            <p className="text-sm text-slate-300 mb-3">{item.text}</p>
            <div className="flex gap-4">
              <label className="flex-1 bg-slate-600 text-center rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
                <input type="radio" name={item.key} value="yes" className="sr-only"/> ÁNO
              </label>
              <label className="flex-1 bg-slate-600 text-center rounded-lg p-3 cursor-pointer has-[:checked]:bg-green-600 has-[:checked]:font-bold">
                <input type="radio" name={item.key} value="no" defaultChecked className="sr-only"/> NIE
              </label>
            </div>
          </div>
        ))}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200">Pokračovať na Aktiváciu CT</button>
        <button type="button" onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">Späť na Štart</button>
      </form>
    </div>
  );
};

const ActivateScreen = ({ patientData, dispatch, onNext, onBack }) => {
  const { befastTime, befastResult, ctActivated } = patientData;
  const handleActivateCt = () => dispatch({ type: "SET_CT_ACTIVATED", payload: true });

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 2: Aktivácia CT</h2>
      {!ctActivated ? (
        <>
          <div className="bg-slate-700 p-6 rounded-lg shadow-inner space-y-4 mb-8">
            <div>
              <p className="text-sm font-medium text-slate-400">Čas vzniku / Posledne v norme</p>
              <p className="text-3xl font-bold text-yellow-300">{befastTime || "Nezadaný"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">BEFAST Skríning</p>
              <p className={`text-2xl font-bold ${befastResult ? "text-red-400" : "text-green-400"}`}>{befastResult ? "POZITÍVNY" : "Negatívny"}</p>
            </div>
            {!befastResult && <p className="text-yellow-400 text-lg p-4 bg-yellow-900/50 rounded-lg">BEFAST je negatívny. Aktivácia CT nemusí byť nutná.</p>}
          </div>
          <button onClick={handleActivateCt} disabled={!befastResult} className={`w-full text-white font-bold py-5 px-6 rounded-lg text-3xl shadow-lg transition duration-200 flex flex-col items-center justify-center gap-2 ${befastResult ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-slate-600 opacity-50 cursor-not-allowed"}`}>
            <span>AKTIVOVAŤ CT TÍM</span>
            <span className="text-xl font-medium tracking-wide border-t border-white/30 pt-2 px-4">
              📞 Volajte kl. 302 / 7302
            </span>
          </button>
          <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-6">Späť na BEFAST</button>
        </>
      ) : (
        <div className="bg-green-700 text-white p-8 rounded-lg shadow-xl text-center">
          <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <h3 className="text-3xl font-bold mb-3">CT TÍM (kl. 302/7302) AKTIVOVANÝ!</h3>
          <p className="text-lg mb-6">Teraz vykonajte NIHSS hodnotenie.</p>
          <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200">Pokračovať na NIHSS</button>
        </div>
      )}
    </div>
  );
};

const NihssScreen = ({ patientData, totalNihss, dispatch, onNext, onBack }) => {
  const handleNihssChange = (e) => dispatch({ type: "UPDATE_NIHSS", payload: { id: e.target.name, value: parseInt(e.target.value, 10) } });
  return (
    <div>
      <div className="sticky top-0 bg-slate-800 py-4 z-10 mb-4 border-b border-slate-700">
        <h2 className="text-3xl font-bold text-center text-blue-300">Krok 3: NIHSS Hodnotenie</h2>
        <div className="text-center text-4xl font-bold text-yellow-300 mt-4">Celkové skóre: {totalNihss}</div>
      </div>
      <form className="space-y-4">
        {nihssItemsDefinition.map((group) => (
          <fieldset key={group.group} className="bg-slate-700 p-4 rounded-lg shadow-inner border-t-4 border-blue-500">
            <legend className="text-xl font-semibold text-slate-100 mb-4 px-2">{group.group}</legend>
            <div className="space-y-5">
              {group.items.map((item) => (
                <div key={item.id}>
                  <label htmlFor={item.id} className="block text-md font-medium text-slate-200 mb-1">{item.label}</label>
                  <p className="text-sm text-slate-400 mb-2 italic">{item.helpText}</p>
                  <select id={item.id} name={item.id} value={patientData.nihssScores[item.id]} onChange={handleNihssChange} className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white">
                    {item.options.map((option, index) => (<option key={index} value={option.match(/^[0-9]+/)[0]}>{option}</option>))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </form>
      <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200 mt-8">Uložiť NIHSS a Pokračovať</button>
      <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">Späť na Aktiváciu CT</button>
    </div>
  );
};

const SummaryScreen = ({ patientData, totalNihss, onNext, onBack }) => (
  <div className="text-center">
    <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 4: Pre-CT Zhrnutie</h2>
    <div className="bg-slate-700 p-6 rounded-lg shadow-inner space-y-4 mb-8 text-left">
      <div><p className="text-sm font-medium text-slate-400">Čas vzniku</p><p className="text-2xl font-bold text-yellow-300">{patientData.befastTime || "Nezadaný"}</p></div>
      <hr className="border-slate-600" />
      <div><p className="text-sm font-medium text-slate-400">BEFAST</p><p className={`text-2xl font-bold ${patientData.befastResult ? "text-red-400" : "text-green-400"}`}>{patientData.befastResult ? "POZITÍVNY" : "Negatívny"}</p></div>
      <hr className="border-slate-600" />
      <div><p className="text-sm font-medium text-slate-400">NIHSS Skóre</p><p className="text-5xl font-bold text-yellow-300 text-center py-4">{totalNihss}</p></div>
    </div>
    <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200">Zhodnotiť Kontraindikácie IVT</button>
    <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">Späť na NIHSS</button>
  </div>
);

const IvtContraindicationsScreen = ({ patientData, dispatch, onNext, onBack }) => {
  const { ivtContraindications } = patientData;

  return (
    <div>
      <h2 className="text-3xl font-bold text-center text-red-400 mb-2">Krok 5: Kontraindikácie IVT</h2>
      <p className="text-center text-slate-300 mb-6 text-sm">Vyznačte, ak je u pacienta prítomný niektorý z nasledujúcich stavov. Aj jedno označenie znamená KONTRAINDIKÁCIU trombolýzy (Alteplázy).</p>
      
      <div className="space-y-4 mb-8">
        {contraindicationsList.map((item) => {
          const isChecked = ivtContraindications.includes(item.id);
          return (
            <label 
              key={item.id} 
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors duration-200 ${isChecked ? 'bg-red-900/50 border-red-500' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
            >
              <input 
                type="checkbox" 
                checked={isChecked}
                onChange={() => dispatch({ type: "TOGGLE_CONTRAINDICATION", payload: item.id })}
                className="mt-1 w-6 h-6 text-red-600 bg-slate-800 border-slate-500 rounded focus:ring-red-500 focus:ring-2"
              />
              <span className={`ml-4 text-lg font-medium ${isChecked ? 'text-red-200' : 'text-slate-200'}`}>
                {item.label}
              </span>
            </label>
          );
        })}
      </div>

      {ivtContraindications.length > 0 && (
        <div className="bg-red-600 text-white p-4 rounded-lg mb-6 shadow-lg animate-pulse">
          <strong>UPOZORNENIE:</strong> Trombolýza je kontraindikovaná. Pacient s LVO pôjde priamo na mechanickú trombektómiu (Direct MTE).
        </div>
      )}
      {ivtContraindications.length === 0 && (
        <div className="bg-green-700 text-white p-4 rounded-lg mb-6 shadow-lg">
          <strong>V PORIADKU:</strong> Z tohto zoznamu nie je prítomná žiadna prekážka pre IVT.
        </div>
      )}

      <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200">
        Zobraziť Návrh Potrebných Modalít
      </button>
      <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">
        Späť na Pre-CT Zhrnutie
      </button>
    </div>
  );
};

const CtResultsScreen = ({ patientData, dispatch, onNext, onBack }) => {
  const handleCtFieldChange = (field, value) => dispatch({ type: "SET_CT_FIELD", payload: { field, value } });
  const { ctResult, timeWindow, ctagResult, perfusionResult, befastTime, ivtContraindications } = patientData;

  const timeInfo = useMemo(() => getElapsedTimeInfo(befastTime), [befastTime]);
  const isContraindicated = ivtContraindications.length > 0;
  
  useEffect(() => {
    if (timeWindow !== timeInfo.category && timeWindow !== "basilaris>4.5h") {
      handleCtFieldChange("timeWindow", timeInfo.category);
    }
  }, [timeInfo.category]);

  const requiresPerfusion = timeWindow === ">6h" || (timeWindow === "4.5-6h" && !isContraindicated);

  return (
    <div>
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 6: Výsledky CT & CTAG</h2>

      <div className="bg-slate-800 border-2 border-blue-500 p-5 rounded-lg mb-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          NÁVRH MODALÍT
        </div>
        <h3 className="text-xl font-bold text-blue-300 mb-3 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          Potrebné zobrazenia pre Rádiológa:
        </h3>
        
        <p className="text-2xl font-bold text-white mb-2">
            {requiresPerfusion ? "Zahrnúť modality: NCCT, CTA, CTP" : "Zahrnúť modality: NCCT, CTA"}
        </p>
        <p className="text-sm text-yellow-300 mb-4 italic">
          (Presný optimálny postup a poradie vyšetrení zatiaľ nie je definovaný)
        </p>
        
        <div className="space-y-2 text-sm">
          {timeWindow === "0-4.5h" && (
             <p className="text-blue-100 bg-blue-900/40 p-2 rounded">
                <strong>Zákl. info:</strong> Pacient je v okne do 4.5 hodín ({timeInfo.hours.toFixed(1)}h). Perfúzia štandardne NIE JE nutná pre indikáciu reperfúzie, cieľom je ušetriť čas.
             </p>
          )}
          {timeWindow === "4.5-6h" && isContraindicated && (
             <p className="text-purple-200 bg-purple-900/50 p-2 rounded">
                <strong>UPOZORNENIE:</strong> Pacient je v okne 4.5 - 6h, avšak <strong>MÁ KONTRAINDIKÁCIU na IVT</strong>. Perfúzia NIE JE nutná, pre MTE je stále v štandardnom okne do 6h bez nutnosti CTP.
             </p>
          )}
          {timeWindow === "4.5-6h" && !isContraindicated && (
             <p className="text-blue-100 bg-blue-900/40 p-2 rounded">
                <strong>Zákl. info:</strong> Pacient je v okne 4.5 - 6h. Perfúzia JE nutná výlučne na posúdenie mismatchu pre prípadné podanie IVT (Alteplázy). MTE je inak indikovaná priamo.
             </p>
          )}
          {timeWindow === ">6h" && (
             <p className="text-blue-100 bg-blue-900/40 p-2 rounded">
                <strong>Zákl. info:</strong> Pacient je v predĺženom okne {">"} 6h alebo Wake-up. Perfúzia JE nutná pre posúdenie penumbry (mismatchu) pred akoukoľvek indikáciou IVT alebo MTE.
             </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
          <label className="block text-xl font-semibold text-slate-100 mb-3">Nález Natívneho CT (NCCT)</label>
          <div className="flex flex-col gap-2">
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="ischemia" checked={ctResult === "ischemia"} onChange={(e) => handleCtFieldChange("ctResult", e.target.value)} className="mr-2"/> Ischemická CMP (bez krvácania)
            </label>
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="ich" checked={ctResult === "ich"} onChange={(e) => handleCtFieldChange("ctResult", e.target.value)} className="mr-2"/> Intrakraniálna hemorágia (ICH)
            </label>
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-yellow-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="other" checked={ctResult === "other"} onChange={(e) => handleCtFieldChange("ctResult", e.target.value)} className="mr-2"/> Iný nález (napr. tumor)
            </label>
          </div>
        </div>
        
        {ctResult === "ischemia" && (
          <>
            <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
              <label className="block text-xl font-semibold text-slate-100 mb-3">Relevantné Časové Okno <span className="text-sm font-normal text-slate-400">(Automaticky predvyplnené)</span></label>
              <div className="flex flex-col gap-2">
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="0-4.5h" checked={timeWindow === "0-4.5h"} onChange={(e) => handleCtFieldChange("timeWindow", e.target.value)} className="mr-2"/> Do 4.5 hodiny
                </label>
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="4.5-6h" checked={timeWindow === "4.5-6h"} onChange={(e) => handleCtFieldChange("timeWindow", e.target.value)} className="mr-2"/> 4.5 - 6 hodín
                </label>
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value=">6h" checked={timeWindow === ">6h"} onChange={(e) => handleCtFieldChange("timeWindow", e.target.value)} className="mr-2"/> Nad 6 hodín / Wake-up / Neznámy
                </label>
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="basilaris>4.5h" checked={timeWindow === "basilaris>4.5h"} onChange={(e) => handleCtFieldChange("timeWindow", e.target.value)} className="mr-2"/> Špeciálne: Oklúzia A. Basilaris &gt; 4.5h
                </label>
              </div>
            </div>
            
            {timeWindow !== "basilaris>4.5h" && (
              <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
                <label className="block text-xl font-semibold text-slate-100 mb-3">Nález CTAG</label>
                <div className="flex flex-col gap-2">
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                    <input type="radio" name="ctagResult" value="no_lvo" checked={ctagResult === "no_lvo"} onChange={(e) => handleCtFieldChange("ctagResult", e.target.value)} className="mr-2"/> Bez oklúzie veľkej cievy (non-LVO)
                  </label>
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
                    <input type="radio" name="ctagResult" value="lvo" checked={ctagResult === "lvo"} onChange={(e) => handleCtFieldChange("ctagResult", e.target.value)} className="mr-2"/> LVO (ACI/ACM/AB)
                  </label>
                </div>
              </div>
            )}
            
            {requiresPerfusion && (
              <div className="bg-slate-700 p-4 rounded-lg shadow-inner border-l-4 border-green-500">
                <label className="block text-xl font-semibold text-slate-100 mb-3">Nález Perfúzie (CTP)</label>
                <div className="flex flex-col gap-2">
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-green-600 has-[:checked]:font-bold">
                    <input type="radio" name="perfusionResult" value="mismatch" checked={perfusionResult === "mismatch"} onChange={(e) => handleCtFieldChange("perfusionResult", e.target.value)} className="mr-2"/> Prítomný Mismatch (Penumbra)
                  </label>
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-yellow-600 has-[:checked]:font-bold">
                    <input type="radio" name="perfusionResult" value="no_mismatch" checked={perfusionResult === "no_mismatch"} onChange={(e) => handleCtFieldChange("perfusionResult", e.target.value)} className="mr-2"/> Neprítomný Mismatch
                  </label>
                </div>
              </div>
            )}
          </>
        )}
        <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200">Zobraziť Odporúčaný Postup</button>
        <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">Späť na Potrebné Modality</button>
      </div>
    </div>
  );
};

const RecommendationDisplay = ({ title, description, colorClass, details }) => (
  <div className={`text-white p-8 rounded-lg shadow-xl text-center border-t-8 ${colorClass}`}>
    <h3 className="text-3xl font-bold mb-3 whitespace-pre-line">{title}</h3>
    <p className="text-lg mb-6 whitespace-pre-line">{description}</p>
    <div className="bg-slate-800/50 p-4 rounded-lg text-left text-sm space-y-2">
      <p><strong>Zhrnutie Dát:</strong></p>
      <ul className="list-disc list-inside">
        {details.map((detail, idx) => (<li key={idx}>{detail}</li>))}
      </ul>
    </div>
  </div>
);

const RecommendationScreen = ({ patientData, onReset, onBack }) => {
  const recommendation = getRecommendation(patientData);
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 7: Odporúčaný Postup</h2>
      <RecommendationDisplay title={recommendation.title} description={recommendation.description} colorClass={recommendation.colorClass} details={recommendation.details}/>
      <button onClick={onReset} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200 mt-8">Nový Pacient</button>
      <button onClick={onBack} className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4">Späť na Zadanie CT Výsledkov</button>
    </div>
  );
};

// --- 5. HLAVNÁ KOMPONENTA APLIKÁCIE ---

function App() {
  const [page, setPage] = useState("start");

  const [patientData, dispatch] = useReducer(patientReducer, initialPatientState, (initial) => {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) return JSON.parse(storedData);
    } catch (e) { console.error("Nepodarilo sa načítať stav", e); }
    return initial;
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(patientData));
  }, [patientData]);

  const totalNihss = useMemo(() => calculateTotalNihss(patientData.nihssScores), [patientData.nihssScores]);

  const resetApp = () => { dispatch({ type: "RESET" }); setPage("start"); };
  const handleBefastSubmit = (data) => { dispatch({ type: "SET_BEFAST", payload: data }); setPage("activate"); };

  const renderCurrentPage = () => {
    switch (page) {
      case "start": return <StartScreen onStart={() => setPage("befast")} />;
      case "befast": return <BefastScreen initialTime={patientData.befastTime} onSubmit={handleBefastSubmit} onBack={() => setPage("start")} />;
      case "activate": return <ActivateScreen patientData={patientData} dispatch={dispatch} onNext={() => setPage("nihss")} onBack={() => setPage("befast")} />;
      case "nihss": return <NihssScreen patientData={patientData} totalNihss={totalNihss} dispatch={dispatch} onNext={() => setPage("summary")} onBack={() => setPage("activate")} />;
      case "summary": return <SummaryScreen patientData={patientData} totalNihss={totalNihss} onNext={() => setPage("ivt_contraindications")} onBack={() => setPage("nihss")} />;
      case "ivt_contraindications": return <IvtContraindicationsScreen patientData={patientData} dispatch={dispatch} onNext={() => setPage("ct_results")} onBack={() => setPage("summary")} />;
      case "ct_results": return <CtResultsScreen patientData={patientData} dispatch={dispatch} onNext={() => setPage("recommendation")} onBack={() => setPage("ivt_contraindications")} />;
      case "recommendation": return <RecommendationScreen patientData={patientData} onReset={resetApp} onBack={() => setPage("ct_results")} />;
      default: return <StartScreen onStart={() => setPage("befast")} />;
    }
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen p-4 md:p-8 flex items-center justify-center font-sans">
      <div className="max-w-3xl w-full bg-slate-800 p-6 md:p-10 rounded-xl shadow-2xl border-slate-700">
        {renderCurrentPage()}
      </div>
    </div>
  );
}

// --- ŠTART APLIKÁCIE PRE PREHLIADAČ ---
const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
