import React, { useState, useMemo, useReducer, useEffect } from 'react';

// --- 1. HELPER DATA (Bezo zmeny) ---
const nihssItemsDefinition = [
  {
    group: '1. Vedomie',
    items: [
      { id: '1a', label: '1a. Úroveň vedomia', max: 3, options: ['0: V bdelom stave', '1: Reaguje na oslovenie', '2: Reaguje na bolesť', '3: Nereaguje'], helpText: 'Hodnotenie bdelosti. Ak treba, stimulujte oslovením, potom bolestivým podnetom.' },
      { id: '1b', label: '1b. Otázky (mesiac, vek)', max: 2, options: ['0: Správne odpovede', '1: 1 správna odpoveď', '2: Žiadna správna odpoveď'], helpText: 'Spýtajte sa: "Aký je mesiac?" a "Koľko máte rokov?". Netoleruje sa ani čiastočná odpoveď.' },
      { id: '1c', label: '1c. Príkazy (zavrieť/otvoriť oči, ruka)', max: 2, options: ['0: Vyhovie obom', '1: Vyhovie jednému', '2: Nevyhovie'], helpText: 'Vyzvite: "Otvorte a zavrite oči." a "Zovrite a uvoľnite päsť (ne-paretickou rukou)".' },
    ],
  },
  {
    group: '2. Pohyb očí',
    items: [
      { id: '2', label: '2. Pohľad', max: 2, options: ['0: Normálny', '1: Čiastočná deviácia', '2: Vynútená deviácia'], helpText: 'Sledujte spontánne pohyby očí. Potom vyzvite pacienta, aby sledoval váš prst.' },
    ],
  },
  {
    group: '3. Zorné pole',
    items: [
      { id: '3', label: '3. Zorné pole (vyšetrenie konfrontáciou)', max: 3, options: ['0: Normálne', '1: Čiastočná hemianopsia', '2: Úplná hemianopsia', '3: Bilaterálna slepota'], helpText: 'Testujte 4 kvadranty vizuálnou konfrontáciou (pohybujúce sa prsty).' },
    ],
  },
  {
    group: '4. Paréza tváre',
    items: [
      { id: '4', label: '4. Paréza tváre', max: 3, options: ['0: Normálna symetria', '1: Minimálna (kútik)', '2: Čiastočná (celá dolná tvár)', '3: Úplná (1/2 tváre)'], helpText: 'Vyzvite pacienta, aby ukázal zuby, zdvihol obočie a pevne zavrel oči.' },
    ],
  },
  {
    group: '5. Motorika - Horné Končatiny',
    items: [
      { id: '5a', label: '5a. Ľavá horná končatina', max: 4, options: ['0: Udrží 10s', '1: Klesá', '2: Klesá predčasne', '3: Pohyb proti gravitácii', '4: Žiaden pohyb', '9: Nehodnotiteľné (amputácia)'], helpText: 'Ruka v predpažení 10 sekúnd (dlaňou dolu). Hodnoťte pokles.' },
      { id: '5b', label: '5b. Pravá horná končatina', max: 4, options: ['0: Udrží 10s', '1: Klesá', '2: Klesá predčasne', '3: Pohyb proti gravitácii', '4: Žiaden pohyb', '9: Nehodnotiteľné (amputácia)'], helpText: 'Ruka v predpažení 10 sekúnd (dlaňou dolu). Hodnoťte pokles.' },
    ],
  },
  {
    group: '6. Motorika - Dolné Končatiny',
    items: [
      { id: '6a', label: '6a. Ľavá dolná končatina', max: 4, options: ['0: Udrží 5s (30°)', '1: Klesá', '2: Klesá predčasne', '3: Pohyb proti gravitácii', '4: Žiaden pohyb', '9: Nehodnotiteľné (amputácia)'], helpText: 'Noha zdvihnutá v 30° uhle na 5 sekúnd. Hodnoťte pokles.' },
      { id: '6b', label: '6b. Pravá dolná končatina', max: 4, options: ['0: Udrží 5s (30°)', '1: Klesá', '2: Klesá predčasne', '3: Pohyb proti gravitácii', '4: Žiaden pohyb', '9: Nehodnotiteľné (amputácia)'], helpText: 'Noha zdvihnutá v 30° uhle na 5 sekúnd. Hodnoťte pokles.' },
    ],
  },
  {
    group: '7. Ataxia',
    items: [
      { id: '7', label: '7. Ataxia končatín (prst-nos, päta-koleno)', max: 2, options: ['0: Bez ataxie', '1: Prítomná v 1 končatine', '2: Prítomná v 2+ končatinách', '9: Nehodnotiteľné'], helpText: 'Test "prst-nos" a "päta-koleno". Hodnoťte len ataxiu, ktorá nie je spôsobená slabosťou.' },
    ],
  },
  {
    group: '8. Senzitíva',
    items: [
      { id: '8', label: '8. Senzitíva (citlivosť na pichnutie)', max: 2, options: ['0: Normálna', '1: Mierna porucha', '2: Vážna porucha / kóma'], helpText: 'Testujte citlivosť na pichnutie (napr. špendlíkom) na tvári, rukách a nohách. Porovnajte strany.' },
    ],
  },
  {
    group: '9. Jazyk / Afázia',
    items: [
      { id: '9', label: '9. Jazyk / Afázia (popis obrázku, pomenovanie)', max: 3, options: ['0: Bez afázie', '1: Mierna afázia', '2: Vážna afázia', '3: Globálna afázia / mutizmus'], helpText: 'Ukážte predmety (kľúč, pero), požiadajte o pomenovanie. Požiadajte o popis situácie.' },
    ],
  },
  {
    group: '10. Dyzartria',
    items: [
      { id: '10', label: '10. Dyzartria (artikulácia)', max: 2, options: ['0: Normálna artikulácia', '1: Mierna dyzartria', '2: Vážna / nezrozumiteľná reč', '9: Nehodnotiteľné (intubácia)'], helpText: 'Požiadajte pacienta, aby prečítal zoznam slov (napr. MAMA, TATA, ARTILÉRIA).' },
    ],
  },
  {
    group: '11. Neglect',
    items: [
      { id: '11', label: '11. Extinkcia / Neglect', max: 2, options: ['0: Bez neglectu', '1: Čiastočný neglect', '2: Úplný neglect'], helpText: 'Testujte simultánny dotyk na oboch stranách tváre/rúk. Spýtajte sa, či cíti obe.' },
    ],
  },
];

const initialNihssScores = {};
nihssItemsDefinition.forEach(group => {
  group.items.forEach(item => {
    initialNihssScores[item.id] = 0; // Všetko defaultne na 0
  });
});

// --- 2. STATE MANAGEMENT (NOVÉ) ---

const LOCAL_STORAGE_KEY = 'strokePatientData_v1';

// Všetky dáta o pacientovi na jednom mieste
const initialPatientState = {
  befastTime: '',
  befastResult: false,
  ctActivated: false,
  nihssScores: initialNihssScores,
  ctResult: 'ischemia',
  timeWindow: '<4.5h',
  ctagResult: 'no_lvo',
  perfusionResult: 'mismatch',
};

// Reducer spravuje všetky zmeny v dátach pacienta
function patientReducer(state, action) {
  switch (action.type) {
    case 'SET_BEFAST':
      return {
        ...state,
        befastTime: action.payload.time,
        befastResult: action.payload.result,
      };
    case 'SET_CT_ACTIVATED':
      return {
        ...state,
        ctActivated: action.payload,
      };
    case 'UPDATE_NIHSS':
      return {
        ...state,
        nihssScores: {
          ...state.nihssScores,
          [action.payload.id]: action.payload.value,
        },
      };
    case 'SET_CT_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value,
      };
    case 'RESET':
      // Vymaže aj localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return initialPatientState;
    default:
      return state;
  }
}

// --- 3. BUSINESS LOGIC (Oddelená logika) ---

/**
 * Vypočíta celkové NIHSS skóre.
 * @param {object} scores - Objekt s NIHSS skóre.
 * @returns {number} - Celkové skóre.
 */
function calculateTotalNihss(scores) {
  return Object.values(scores).reduce((acc, score) => {
    const numScore = parseInt(score, 10);
    if (!isNaN(numScore) && numScore !== 9) {
      return acc + numScore;
    }
    return acc;
  }, 0);
}

/**
 * Generuje finálne odporúčanie na základe dát pacienta.
 * @param {object} patientData - Celý stavový objekt pacienta.
 * @returns {object} - Objekt s { title, description, colorClass, details }.
 */
function getRecommendation(patientData) {
  const { ctResult, timeWindow, ctagResult, perfusionResult, befastTime } = patientData;
  const totalNihss = calculateTotalNihss(patientData.nihssScores);

  const baseDetails = [
      `BEFAST Čas: ${befastTime || 'Nezadaný'}`,
      `NIHSS Skóre: ${totalNihss}`
  ];

  if (ctResult === 'ich') {
    return { 
      title: "STOP: Intrakraniálna Hemorágia",
      description: "Liečba IVT a MTE je kontraindikovaná. Okamžite konzultovať neurochirurga.",
      colorClass: "border-red-500 bg-red-700",
      details: [...baseDetails, "Nález NCCT: Krvácanie"]
    };
  }

  if (ctResult === 'other') {
    return { 
      title: "STOP: Iný Nález",
      description: "Nález na CT nezodpovedá iCMP (napr. tumor). Zvážiť inú diagnózu a manažment.",
      colorClass: "border-yellow-500 bg-yellow-700",
      details: [...baseDetails, "Nález NCCT: Iný nález"]
    };
  }

  if (ctResult === 'ischemia') {
    // Okno < 4.5h
    if (timeWindow === '<4.5h') {
      if (ctagResult === 'lvo') {
        return { 
          title: "IVT (Tenektepláza) + MTE",
          description: "Pacient je v okne < 4.5h s LVO. Odporúča sa IVT (preferenčne Tenektepláza 0.25mg/kg) a následne MTE.",
          colorClass: "border-green-500 bg-green-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: < 4.5h", "CTAG: LVO"]
        };
      }
      if (ctagResult === 'no_lvo') {
        return { 
          title: "IVT (Altepláza)",
          description: "Pacient je v okne < 4.5h bez LVO. Odporúča sa IVT (Altepláza 0.9mg/kg).",
          colorClass: "border-green-500 bg-green-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: < 4.5h", "CTAG: Bez LVO"]
        };
      }
    }

    // Okno 4.5 - 9h
    if (timeWindow === '4.5-9h') {
      if (perfusionResult === 'mismatch') {
        if (ctagResult === 'lvo') {
          return { 
            title: "IVT (Tenektepláza) + MTE",
            description: "Pacient je v okne 4.5-9h s LVO a dôkazom penumbry (mismatch). Odporúča sa IVT (preferenčne Tenektepláza) a MTE.",
            colorClass: "border-green-500 bg-green-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5-9h", "CTAG: LVO", "Perfúzia: Mismatch PRÍTOMNÝ"]
          };
        }
        if (ctagResult === 'no_lvo') {
          return { 
            title: "IVT (Altepláza)",
            description: "Pacient je v okne 4.5-9h bez LVO, ale s dôkazom penumbry (mismatch). Odporúča sa IVT (Altepláza).",
            colorClass: "border-green-500 bg-green-700",
            details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5-9h", "CTAG: Bez LVO", "Perfúzia: Mismatch PRÍTOMNÝ"]
          };
        }
      }
      if (perfusionResult === 'no_mismatch') {
         return { 
          title: "Konzervatívny Postup",
          description: "Pacient je v okne 4.5-9h bez dôkazu penumbry (mismatch). Reperfúzna liečba sa neodporúča.",
          colorClass: "border-yellow-500 bg-yellow-700",
          details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: 4.5-9h", "Perfúzia: Mismatch NEPRÍTOMNÝ"]
        };
      }
    }

    // Prípad A. Basilaris
    if (timeWindow === 'basilaris>4.5h') {
      return { 
        title: "IVT + MTE (Život zachraňujúci)",
        description: "Symptomatická oklúzia A. Basilaris > 4.5h bez rozsiahlej ischémie kmeňa. Odporúča sa IVT + MTE ako život zachraňujúci výkon.",
        colorClass: "border-orange-500 bg-orange-700",
        details: [...baseDetails, "Nález NCCT: Ischémia", "Okno: Špeciálny prípad A. Basilaris > 4.5h"]
      };
    }
  }

  return { 
    title: "Nekompletné Dáta",
    description: "Nebolo možné určiť odporúčanie. Skontrolujte zadané parametre.",
    colorClass: "border-slate-500 bg-slate-700",
    details: [...baseDetails, "Skontrolujte zadané hodnoty."]
  };
}


// --- 4. SUB-KOMPONENTY (Obrazovky) ---

const StartScreen = ({ onStart }) => (
  <div className="text-center">
    <h1 className="text-4xl font-bold text-red-400 mb-4">STROKE PROTOKOL</h1>
    <p className="text-xl text-slate-300 mb-8">Sprievodca pre akútny príjem pacienta so suspektnou cievnou mozgovou príhodou.</p>
    <button
      onClick={onStart}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-2xl shadow-lg transition duration-200"
    >
      ŠTART PROTOKOL
    </button>
  </div>
);

const BefastScreen = ({ initialTime, onSubmit, onBack }) => {
  
  const handleBefastSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    let isPositive = false;
    let time = '';
    
    for (let [key, value] of formData.entries()) {
      if (key !== 'time' && value === 'yes') {
        isPositive = true;
      }
      if (key === 'time') {
        time = value;
      }
    }
    
    onSubmit({ time, result: isPositive });
  };
  
  return (
    <div>
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 1: BEFAST Skríning</h2>
      <form onSubmit={handleBefastSubmit} className="space-y-6">
        <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
          <label htmlFor="time" className="block text-xl font-semibold text-yellow-300 mb-2">T - Time (Čas)</label>
          <p className="text-sm text-slate-300 mb-3">Zadajte čas vzniku príznakov (alebo kedy bol pacient naposledy v poriadku).</p>
          <input
            type="time"
            id="time"
            name="time"
            defaultValue={initialTime} // Použije sa defaultValue na umožnenie opätovnej editácie
            required
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg"
          />
        </div>
        
        {[
          { key: 'B', label: 'Balance (Rovnováha)', text: 'Náhla strata rovnováhy alebo koordinácie?' },
          { key: 'E', label: 'Eyes (Oči)', text: 'Náhla strata videnia alebo dvojité videnie?' },
          { key: 'F', label: 'Face (Tvár)', text: 'Pokles ústneho kútika alebo viečka?' },
          { key: 'A', label: 'Arms (Ruky)', text: 'Slabosť alebo necitlivosť ruky/nohy?' },
          { key: 'S', label: 'Speech (Reč)', text: 'Nerozrozumiteľná reč alebo problém rozumieť?' },
        ].map(item => (
          <div key={item.key} className="bg-slate-700 p-4 rounded-lg shadow-inner">
            <label className="block text-xl font-semibold text-slate-100">{item.key} - {item.label}</label>
            <p className="text-sm text-slate-300 mb-3">{item.text}</p>
            <div className="flex gap-4">
              <label className="flex-1 bg-slate-600 text-center rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
                <input type="radio" name={item.key} value="yes" className="sr-only" /> ÁNO
              </label>
              <label className="flex-1 bg-slate-600 text-center rounded-lg p-3 cursor-pointer has-[:checked]:bg-green-600 has-[:checked]:font-bold">
                <input type="radio" name={item.key} value="no" defaultChecked className="sr-only" /> NIE
              </label>
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200"
        >
          Pokračovať na Aktiváciu CT
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4"
        >
          Späť na Štart
        </button>
      </form>
    </div>
  );
};

const ActivateScreen = ({ patientData, dispatch, onNext, onBack }) => {
  const { befastTime, befastResult, ctActivated } = patientData;

  const handleActivateCt = () => {
    console.log("AKTIVÁCIA CT TÍMU!");
    console.log("Čas vzniku:", befastTime);
    dispatch({ type: 'SET_CT_ACTIVATED', payload: true });
  };
  
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 2: Aktivácia CT</h2>
      
      {!ctActivated ? (
        <>
          <div className="bg-slate-700 p-6 rounded-lg shadow-inner space-y-4 mb-8">
            <div>
              <p className="text-sm font-medium text-slate-400">Čas vzniku / Posledne v norme</p>
              <p className="text-3xl font-bold text-yellow-300">{befastTime || 'Nezadaný'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">BEFAST Skríning</p>
              <p className={`text-2xl font-bold ${befastResult ? 'text-red-400' : 'text-green-400'}`}>
                {befastResult ? 'POZITÍVNY' : 'Negatívny'}
              </p>
            </div>
             { !befastResult && (
                <p className="text-yellow-400 text-lg p-4 bg-yellow-900/50 rounded-lg">
                  BEFAST je negatívny. Zvážte iné diagnózy. Aktivácia CT nemusí byť nutná.
                </p>
             )}
          </div>
          
          <button
            onClick={handleActivateCt}
            disabled={!befastResult}
            className={`w-full text-white font-bold py-6 px-6 rounded-lg text-3xl shadow-lg transition duration-200 ${
              befastResult 
                ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                : 'bg-slate-600 opacity-50 cursor-not-allowed'
            }`}
          >
            AKTIVOVAŤ CT TÍM
          </button>
          
          <button
            onClick={onBack}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-6"
          >
            Späť na BEFAST
          </button>
        </>
      ) : (
        <div className="bg-green-700 text-white p-8 rounded-lg shadow-xl text-center">
          <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <h3 className="text-3xl font-bold mb-3">CT TÍM AKTIVOVANÝ!</h3>
          <p className="text-lg mb-6">Teraz vykonajte NIHSS hodnotenie. Pacient je pripravený na transport.</p>
          <button
            onClick={onNext}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200"
          >
            Pokračovať na NIHSS
          </button>
        </div>
      )}
    </div>
  );
};

const NihssScreen = ({ patientData, totalNihss, dispatch, onNext, onBack }) => {
  
  const handleNihssChange = (e) => {
    const { name, value } = e.target;
    dispatch({
      type: 'UPDATE_NIHSS',
      payload: { id: name, value: parseInt(value, 10) }
    });
  };
  
  return (
    <div>
      <div className="sticky top-0 bg-slate-800 py-4 z-10 mb-4 border-b border-slate-700">
        <h2 className="text-3xl font-bold text-center text-blue-300">Krok 3: NIHSS Hodnotenie</h2>
        {patientData.ctActivated && (
          <p className="text-center text-green-400 text-sm font-semibold">(CT Tím je aktivovaný)</p>
        )}
        <div className="text-center text-4xl font-bold text-yellow-300 mt-4">
          Celkové skóre: {totalNihss}
        </div>
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
                  <select
                    id={item.id}
                    name={item.id}
                    value={patientData.nihssScores[item.id]} // Hodnota je riadená zo stavu
                    onChange={handleNihssChange}
                    className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  >
                    {item.options.map((option, index) => {
                      const value = option.match(/^[0-9]+/)[0];
                      return (
                        <option key={index} value={value}>
                          {option}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </form>
      
      <button
        onClick={onNext}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200 mt-8"
      >
        Uložiť NIHSS a Zobraziť Zhrnutie
      </button>
      <button
        onClick={onBack}
        className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4"
      >
        Späť na Aktiváciu CT
      </button>
    </div>
  );
};

const SummaryScreen = ({ patientData, totalNihss, onNext, onBack }) => (
  <div className="text-center">
    <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 4: Pre-CT Zhrnutie</h2>
    
    <div className="bg-slate-700 p-6 rounded-lg shadow-inner space-y-4 mb-8 text-left">
      <div>
        <p className="text-sm font-medium text-slate-400">Čas vzniku / Posledne v norme</p>
        <p className="text-2xl font-bold text-yellow-300">{patientData.befastTime || 'Nezadaný'}</p>
      </div>
      <hr className="border-slate-600" />
      <div>
        <p className="text-sm font-medium text-slate-400">BEFAST Skríning</p>
        <p className={`text-2xl font-bold ${patientData.befastResult ? 'text-red-400' : 'text-green-400'}`}>
          {patientData.befastResult ? 'POZITÍVNY' : 'Negatívny'}
        </p>
      </div>
      <hr className="border-slate-600" />
      <div>
        <p className="text-sm font-medium text-slate-400">Stav CT Tímu</p>
        <p className={`text-2xl font-bold ${patientData.ctActivated ? 'text-green-400' : 'text-red-400'}`}>
          {patientData.ctActivated ? 'AKTIVOVANÝ' : 'NEAKTIVOVANÝ'}
        </p>
      </div>
      <hr className="border-slate-600" />
      <div>
        <p className="text-sm font-medium text-slate-400">Celkové NIHSS Skóre</p>
        <p className="text-5xl font-bold text-yellow-300 text-center py-4">{totalNihss}</p>
      </div>
    </div>
    
    <button
      onClick={onNext}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200"
    >
      Pokračovať na Zadanie CT Výsledkov
    </button>
    <button
      onClick={onBack}
      className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4"
    >
      Späť na NIHSS
    </button>
  </div>
);

const CtResultsScreen = ({ patientData, dispatch, onNext, onBack }) => {

  // Generický handler pre všetky CT polia
  const handleCtFieldChange = (field, value) => {
    dispatch({ type: 'SET_CT_FIELD', payload: { field, value } });
  };
  
  const { ctResult, timeWindow, ctagResult, perfusionResult } = patientData;

  return (
    <div>
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 5: Výsledky CT & CTAG</h2>
      <div className="space-y-6">
        
        {/* Q1: Nález Natívneho CT */}
        <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
          <label className="block text-xl font-semibold text-slate-100 mb-3">Nález Natívneho CT (NCCT)</label>
          <div className="flex flex-col gap-2">
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="ischemia" checked={ctResult === 'ischemia'} onChange={(e) => handleCtFieldChange('ctResult', e.target.value)} className="mr-2" /> Ischemická CMP (bez krvácania)
            </label>
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="ich" checked={ctResult === 'ich'} onChange={(e) => handleCtFieldChange('ctResult', e.target.value)} className="mr-2" /> Intrakraniálna hemorágia (ICH)
            </label>
            <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-yellow-600 has-[:checked]:font-bold">
              <input type="radio" name="ctResult" value="other" checked={ctResult === 'other'} onChange={(e) => handleCtFieldChange('ctResult', e.target.value)} className="mr-2" /> Iný nález (napr. tumor, ...)
            </label>
          </div>
        </div>

        {ctResult === 'ischemia' && (
          <>
            {/* Q2: Časové Okno */}
            <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
              <label className="block text-xl font-semibold text-slate-100 mb-3">Relevantné Časové Okno</label>
              <div className="flex flex-col gap-2">
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="<4.5h" checked={timeWindow === '<4.5h'} onChange={(e) => handleCtFieldChange('timeWindow', e.target.value)} className="mr-2" /> &lt; 4.5 hodiny (vrátane WUS &lt; 4.5h)
                </label>
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="4.5-9h" checked={timeWindow === '4.5-9h'} onChange={(e) => handleCtFieldChange('timeWindow', e.target.value)} className="mr-2" /> 4.5 - 9 hodín (alebo WUS / Neznámy čas)
                </label>
                <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-orange-600 has-[:checked]:font-bold">
                  <input type="radio" name="timeWindow" value="basilaris>4.5h" checked={timeWindow === 'basilaris>4.5h'} onChange={(e) => handleCtFieldChange('timeWindow', e.target.value)} className="mr-2" /> Špeciálny prípad: Oklúzia A. Basilaris &gt; 4.5h
                </label>
              </div>
            </div>

            {/* Q3: Nález CTAG */}
            {timeWindow !== 'basilaris>4.5h' && (
              <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
                <label className="block text-xl font-semibold text-slate-100 mb-3">Nález CTAG (Angiografia)</label>
                <div className="flex flex-col gap-2">
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-blue-600 has-[:checked]:font-bold">
                    <input type="radio" name="ctagResult" value="no_lvo" checked={ctagResult === 'no_lvo'} onChange={(e) => handleCtFieldChange('ctagResult', e.target.value)} className="mr-2" /> Bez oklúzie veľkej cievy (non-LVO)
                  </label>
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-red-600 has-[:checked]:font-bold">
                    <input type="radio" name="ctagResult" value="lvo" checked={ctagResult === 'lvo'} onChange={(e) => handleCtFieldChange('ctagResult', e.target.value)} className="mr-2" /> LVO - Oklúzia veľkej cievy (ACI/ACM/AB)
                  </label>
                </div>
              </div>
            )}
            
            {/* Q4: Perfúzia */}
            {timeWindow === '4.5-9h' && (
              <div className="bg-slate-700 p-4 rounded-lg shadow-inner">
                <label className="block text-xl font-semibold text-slate-100 mb-3">Nález Perfúzie (CTP) / Mismatch (MR)</label>
                <p className="text-sm text-slate-300 mb-3">Vyžaduje sa pre okno 4.5-9h alebo neznámy čas vzniku.</p>
                <div className="flex flex-col gap-2">
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-green-600 has-[:checked]:font-bold">
                    <input type="radio" name="perfusionResult" value="mismatch" checked={perfusionResult === 'mismatch'} onChange={(e) => handleCtFieldChange('perfusionResult', e.target.value)} className="mr-2" /> Prítomný Mismatch / Penumbra (Core &lt; 70ml, Mismatch &gt; 1.2)
                  </label>
                  <label className="bg-slate-600 w-full text-left rounded-lg p-3 cursor-pointer has-[:checked]:bg-yellow-600 has-[:checked]:font-bold">
                    <input type="radio" name="perfusionResult" value="no_mismatch" checked={perfusionResult === 'no_mismatch'} onChange={(e) => handleCtFieldChange('perfusionResult', e.target.value)} className="mr-2" /> Neprítomný Mismatch / Penumbra
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={onNext}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200"
        >
          Zobraziť Odporúčaný Postup
        </button>
        <button
          onClick={onBack}
          className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4"
        >
          Späť na Pre-CT Zhrnutie
        </button>
      </div>
    </div>
  );
};

// Helper komponenta pre zobrazenie odporúčania
const RecommendationDisplay = ({ title, description, colorClass, details }) => (
  <div className={`text-white p-8 rounded-lg shadow-xl text-center border-t-8 ${colorClass}`}>
    <h3 className="text-3xl font-bold mb-3">{title}</h3>
    <p className="text-lg mb-6">{description}</p>
    <div className="bg-slate-800/50 p-4 rounded-lg text-left text-sm space-y-2">
      <p><strong>Zhrnutie Dát:</strong></p>
      <ul className="list-disc list-inside">
        {details.map(detail => <li key={detail}>{detail}</li>)}
      </ul>
    </div>
  </div>
);

const RecommendationScreen = ({ patientData, onReset, onBack }) => {
  // Zavolá čistú logickú funkciu
  const recommendation = getRecommendation(patientData);

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-center text-blue-300 mb-6">Krok 6: Odporúčaný Postup</h2>
      
      <RecommendationDisplay
        title={recommendation.title}
        description={recommendation.description}
        colorClass={recommendation.colorClass}
        details={recommendation.details}
      />

      <button
        onClick={onReset}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg transition duration-200 mt-8"
      >
        Nový Pacient
      </button>
      <button
        onClick={onBack}
        className="w-full bg-slate-600 hover:bg-slate-700 text-white font-normal py-2 px-4 rounded-lg text-sm mt-4"
      >
        Späť na Zadanie CT Výsledkov
      </button>
    </div>
  );
};


// --- 5. HLAVNÁ KOMPONENTA APLIKÁCIE ---

export default function App() {
  // Stav UI (ktorá stránka sa zobrazuje)
  const [page, setPage] = useState('start');

  // Stav DÁT (všetko o pacientovi)
  const [patientData, dispatch] = useReducer(
    patientReducer,
    initialPatientState,
    (initial) => {
      // Funkcia na hydratáciu stavu z localStorage pri načítaní
      try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedData) {
          return JSON.parse(storedData);
        }
      } catch (e) {
        console.error("Nepodarilo sa načítať stav z localStorage", e);
      }
      return initial;
    }
  );

  // Efekt, ktorý Ukladá dáta do localStorage pri každej zmene
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(patientData));
  }, [patientData]);

  // Vypočítané hodnoty
  const totalNihss = useMemo(() => {
    return calculateTotalNihss(patientData.nihssScores);
  }, [patientData.nihssScores]);

  // Funkcia na reset
  const resetApp = () => {
    dispatch({ type: 'RESET' });
    setPage('start');
  };

  // Funkcia na odoslanie BEFAST formulára
  const handleBefastSubmit = (data) => {
    dispatch({ type: 'SET_BEFAST', payload: data });
    setPage('activate');
  };

  // Hlavný "Router" aplikácie
  const renderCurrentPage = () => {
    switch (page) {
      case 'start':
        return <StartScreen onStart={() => setPage('befast')} />;
      
      case 'befast':
        return <BefastScreen 
                 initialTime={patientData.befastTime}
                 onSubmit={handleBefastSubmit} 
                 onBack={() => setPage('start')} 
               />;
      
      case 'activate':
        return <ActivateScreen 
                 patientData={patientData} 
                 dispatch={dispatch} 
                 onNext={() => setPage('nihss')} 
                 onBack={() => setPage('befast')} 
               />;
      
      case 'nihss':
        return <NihssScreen 
                 patientData={patientData}
                 totalNihss={totalNihss}
                 dispatch={dispatch}
                 onNext={() => setPage('summary')}
                 onBack={() => setPage('activate')}
               />;
      
      case 'summary':
        return <SummaryScreen 
                 patientData={patientData}
                 totalNihss={totalNihss}
                 onNext={() => setPage('ct_results')}
                 onBack={() => setPage('nihss')}
               />;
      
      case 'ct_results':
        return <CtResultsScreen 
                 patientData={patientData}
                 dispatch={dispatch}
                 onNext={() => setPage('recommendation')}
                 onBack={() => setPage('summary')}
               />;
      
      case 'recommendation':
        return <RecommendationScreen 
                 patientData={patientData}
                 onReset={resetApp}
                 onBack={() => setPage('ct_results')}
               />;
      
      default:
        return <StartScreen onStart={() => setPage('befast')} />;
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

