import { useState, useEffect, useMemo } from "react";
import { encode, PaymentOptions, CurrencyCode } from "bysquare/pay";
import QRCode from "qrcode";

// --- 1. KONFIGURÁCIA ---

const USG_ORDERS_KEY = "usgOrders_v1";
const USG_OPEN_SLOTS_KEY = "usgOpenSlots_v1";
const USG_SETTINGS_KEY = "usgSettings_v1";

// Cenník samoplatcovských USG vyšetrení (upravte podľa vlastného cenníka)
const usgExamTypes = [
  { id: "abdomen", label: "USG brucha", price: 40 },
  { id: "thyroid", label: "USG štítnej žľazy a krku", price: 35 },
  { id: "carotid", label: "USG krčných tepien (doppler)", price: 45 },
  { id: "veins", label: "USG žíl dolných končatín (doppler)", price: 45 },
  { id: "kidneys", label: "USG obličiek a močového mechúra", price: 35 },
  { id: "soft", label: "USG mäkkých častí / podkožia", price: 30 },
  { id: "breast", label: "USG prsníkov", price: 40 },
];

const insuranceOptions = [
  { id: "25", label: "25 - VšZP" },
  { id: "24", label: "24 - Dôvera" },
  { id: "27", label: "27 - Union" },
  { id: "other", label: "Iná / bez poistenia" },
];

const usgStatuses = {
  new: { label: "Čaká na platbu", badge: "bg-yellow-600", border: "border-yellow-500" },
  confirmed: { label: "Zaplatená / potvrdená", badge: "bg-green-600", border: "border-green-500" },
  rejected: { label: "Zamietnutá", badge: "bg-red-600", border: "border-red-500" },
  done: { label: "Vykonaná", badge: "bg-blue-600", border: "border-blue-500" },
  noshow: { label: "Neprišiel", badge: "bg-slate-500", border: "border-slate-400" },
};

const defaultSettings = {
  iban: "SK3112000000198742637541", // DEMO IBAN — nastavte vlastný v správe!
  beneficiary: "Rádiologické oddelenie",
};

// Sloty po 20 minút, ktoré môže pracovisko otvoriť
const SLOT_START_MINUTES = 7 * 60 + 30;
const SLOT_END_MINUTES = 14 * 60 + 30;
const SLOT_LENGTH_MINUTES = 20;

function generateDaySlots() {
  const slots = [];
  for (let m = SLOT_START_MINUTES; m + SLOT_LENGTH_MINUTES <= SLOT_END_MINUTES; m += SLOT_LENGTH_MINUTES) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}

const allDaySlots = generateDaySlots();

// --- 2. POMOCNÉ FUNKCIE ---

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateHuman(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("sk-SK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatDateShort(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("sk-SK", {
    weekday: "short", day: "numeric", month: "numeric",
  });
}

function formatPrice(price) {
  return `${price.toFixed(2).replace(".", ",")} €`;
}

function loadJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(`Nepodarilo sa načítať ${key}`, e);
  }
  return fallback;
}

function isSlotOccupying(order) {
  return order.status !== "rejected";
}

// --- 3. QR PLATBA (PAY by square) ---

const PaymentQr = ({ order, settings }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setDataUrl(null);
    setError("");
    try {
      const qrString = encode({
        payments: [{
          type: PaymentOptions.PaymentOrder,
          amount: order.price,
          currencyCode: CurrencyCode.EUR,
          variableSymbol: order.variableSymbol,
          paymentNote: `USG ${order.patient.name} ${order.date} ${order.time}`,
          beneficiary: { name: settings.beneficiary },
          bankAccounts: [{ iban: settings.iban.replace(/\s/g, "") }],
        }],
      });
      QRCode.toDataURL(qrString, { width: 280, margin: 2 })
        .then((url) => { if (alive) setDataUrl(url); })
        .catch((e) => { if (alive) setError(String(e)); });
    } catch (e) {
      setError(String(e));
    }
    return () => { alive = false; };
  }, [order, settings]);

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg text-sm text-red-200">
        QR kód sa nepodarilo vygenerovať — skontrolujte IBAN v nastaveniach správy. ({error})
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 inline-block">
      {dataUrl
        ? <img src={dataUrl} alt="QR platba" width={280} height={280} />
        : <div className="w-[280px] h-[280px] flex items-center justify-center text-slate-500">Generujem QR…</div>}
    </div>
  );
};

// --- 4. PACIENTSKY POHĽAD — ŽIADANKA + VÝBER TERMÍNU ---

const emptyForm = {
  examTypeId: usgExamTypes[0].id,
  reason: "",
  referral: "",
  patientName: "",
  birthNumber: "",
  insurance: "25",
  phone: "",
  email: "",
  date: "",
  time: "",
};

const PatientView = ({ orders, openSlots, settings, onSubmit }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  const examType = usgExamTypes.find((t) => t.id === form.examTypeId);
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Obsadené termíny naprieč objednávkami
  const takenByDate = useMemo(() => {
    const map = new Map();
    orders.filter(isSlotOccupying).forEach((o) => {
      if (!map.has(o.date)) map.set(o.date, new Set());
      map.get(o.date).add(o.time);
    });
    return map;
  }, [orders]);

  const freeSlotsFor = (isoDate) => {
    const open = openSlots[isoDate] || [];
    const taken = takenByDate.get(isoDate) || new Set();
    return open.filter((s) => !taken.has(s));
  };

  // Najbližších 60 dní, v ktorých pracovisko otvorilo aspoň 1 voľný termín
  const availableDays = useMemo(() => {
    const days = [];
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const iso = toISODate(d);
      if (freeSlotsFor(iso).length > 0) days.push(iso);
      d.setDate(d.getDate() + 1);
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlots, takenByDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.date || !form.time) return setError("Vyberte si deň a čas z ponúkaných termínov.");
    if (!freeSlotsFor(form.date).includes(form.time)) {
      setField("time", "");
      return setError("Vybraný termín už nie je dostupný. Vyberte iný.");
    }

    const order = {
      id: `USG-${Date.now().toString(36).toUpperCase()}`,
      variableSymbol: String(Date.now()).slice(-10),
      createdAt: new Date().toISOString(),
      status: "new",
      statusNote: "",
      exam: { typeId: examType.id, label: examType.label, reason: form.reason.trim(), referral: form.referral.trim() },
      price: examType.price,
      patient: {
        name: form.patientName.trim(),
        birthNumber: form.birthNumber.trim(),
        insurance: form.insurance,
        phone: form.phone.trim(),
        email: form.email.trim(),
      },
      date: form.date,
      time: form.time,
    };
    onSubmit(order);
    setCreatedOrder(order);
    setForm(emptyForm);
  };

  if (createdOrder) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-green-800/60 border border-green-500 p-5 rounded-lg space-y-2">
          <h3 className="text-2xl font-bold text-green-300">Žiadanka odoslaná</h3>
          <p>
            <strong>{createdOrder.exam.label}</strong> — {formatDateHuman(createdOrder.date)} o {createdOrder.time}
          </p>
          <p className="text-sm text-slate-300">Číslo žiadanky: <strong className="text-yellow-300">{createdOrder.id}</strong></p>
        </div>

        <div className="bg-slate-700 p-5 rounded-lg space-y-3">
          <h3 className="text-xl font-bold text-blue-300">Platba za vyšetrenie</h3>
          <p className="text-3xl font-bold text-yellow-300">{formatPrice(createdOrder.price)}</p>
          <p className="text-sm text-slate-300">Naskenujte QR kód v mobilnej aplikácii vašej banky (PAY by square):</p>
          <PaymentQr order={createdOrder} settings={settings} />
          <div className="bg-slate-800/60 rounded-lg p-3 text-left text-sm space-y-1 max-w-md mx-auto">
            <p><strong>IBAN:</strong> {settings.iban}</p>
            <p><strong>Príjemca:</strong> {settings.beneficiary}</p>
            <p><strong>Variabilný symbol:</strong> {createdOrder.variableSymbol}</p>
            <p><strong>Suma:</strong> {formatPrice(createdOrder.price)}</p>
          </div>
          <p className="text-sm text-yellow-200 bg-yellow-900/40 p-3 rounded-lg">
            Termín je rezervovaný a bude <strong>potvrdený po prijatí platby</strong>. Ak platba nepríde do 24 hodín, rezervácia môže byť zrušená.
          </p>
        </div>

        <button onClick={() => setCreatedOrder(null)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg transition duration-200">
          Nová objednávka
        </button>
      </div>
    );
  }

  const inputCls = "w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500";
  const sectionCls = "bg-slate-700 p-4 rounded-lg shadow-inner space-y-3";
  const labelCls = "block text-sm font-semibold text-slate-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={sectionCls}>
        <h3 className="text-lg font-bold text-blue-300">Vyšetrenie</h3>
        <div>
          <label className={labelCls}>Typ vyšetrenia *</label>
          <select value={form.examTypeId} onChange={(e) => setField("examTypeId", e.target.value)} className={inputCls}>
            {usgExamTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {formatPrice(t.price)}</option>
            ))}
          </select>
          <p className="text-yellow-300 font-bold text-lg mt-2">Cena: {formatPrice(examType.price)}</p>
        </div>
        <div>
          <label className={labelCls}>Dôvod vyšetrenia / ťažkosti *</label>
          <textarea required rows={3} value={form.reason} onChange={(e) => setField("reason", e.target.value)} className={inputCls} placeholder="Popíšte svoje ťažkosti alebo dôvod, pre ktorý žiadate vyšetrenie…" />
        </div>
        <div>
          <label className={labelCls}>Odporúčanie lekára (voliteľné)</label>
          <input value={form.referral} onChange={(e) => setField("referral", e.target.value)} className={inputCls} placeholder="Meno odporúčajúceho lekára, ak máte výmenný lístok" />
        </div>
      </div>

      <div className={sectionCls}>
        <h3 className="text-lg font-bold text-blue-300">Termín</h3>
        {availableDays.length === 0 ? (
          <p className="text-slate-400 bg-slate-800/60 p-4 rounded-lg">
            Momentálne nie sú otvorené žiadne termíny na objednávanie. Skúste to prosím neskôr.
          </p>
        ) : (
          <>
            <label className={labelCls}>Vyberte deň *</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {availableDays.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  title={iso}
                  onClick={() => { setField("date", iso); setField("time", ""); }}
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    form.date === iso ? "bg-blue-600 text-white ring-2 ring-blue-300" : "bg-slate-600 hover:bg-slate-500 text-white"
                  }`}
                >
                  {formatDateShort(iso)}
                  <span className="block text-xs font-normal opacity-75">{freeSlotsFor(iso).length} voľných</span>
                </button>
              ))}
            </div>
            {form.date && (
              <div>
                <label className={labelCls}>Voľné časy — {formatDateHuman(form.date)}</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                  {freeSlotsFor(form.date).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setField("time", slot)}
                      className={`p-2 rounded-lg text-sm font-semibold transition-colors ${
                        form.time === slot ? "bg-green-600 text-white ring-2 ring-green-300" : "bg-slate-600 hover:bg-slate-500 text-white"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={sectionCls}>
        <h3 className="text-lg font-bold text-blue-300">Vaše údaje</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Meno a priezvisko *</label>
            <input required value={form.patientName} onChange={(e) => setField("patientName", e.target.value)} className={inputCls} placeholder="Ján Novák" />
          </div>
          <div>
            <label className={labelCls}>Rodné číslo *</label>
            <input required value={form.birthNumber} onChange={(e) => setField("birthNumber", e.target.value)} className={inputCls} placeholder="800101/1234" />
          </div>
          <div>
            <label className={labelCls}>Zdravotná poisťovňa</label>
            <select value={form.insurance} onChange={(e) => setField("insurance", e.target.value)} className={inputCls}>
              {insuranceOptions.map((o) => (<option key={o.id} value={o.id}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Telefón *</label>
            <input required value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={inputCls} placeholder="+421 900 000 000" />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>E-mail (na potvrdenie termínu)</label>
            <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputCls} placeholder="jan.novak@..." />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-700 text-white p-3 rounded-lg font-semibold">{error}</div>}

      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition duration-200">
        Odoslať žiadanku a prejsť na platbu
      </button>
    </form>
  );
};

// --- 5. SPRÁVA (pohľad sonografického pracoviska) ---

const UsgOrderCard = ({ order, onSetStatus }) => {
  const status = usgStatuses[order.status];
  return (
    <div className={`bg-slate-700 rounded-lg p-4 border-l-4 ${status.border} space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-lg">{order.patient.name}</span>
          <span className="text-slate-400 text-sm ml-2">{order.patient.birthNumber}</span>
        </div>
        <span className={`${status.badge} text-xs font-bold px-2 py-1 rounded`}>{status.label}</span>
      </div>
      <p className="text-sm">
        <strong className="text-blue-300">{order.exam.label}</strong> — {formatDateHuman(order.date)} o {order.time}
        <span className="text-yellow-300 font-bold ml-2">{formatPrice(order.price)}</span>
      </p>
      <p className="text-sm text-slate-300 italic">{order.exam.reason}</p>
      {order.exam.referral && <p className="text-xs text-slate-400">Odporúčanie: {order.exam.referral}</p>}
      <p className="text-xs text-slate-400">
        Tel. {order.patient.phone}{order.patient.email && ` · ${order.patient.email}`} · VS {order.variableSymbol} · žiadanka {order.id}
      </p>
      {order.statusNote && <p className="text-xs text-red-300">Poznámka: {order.statusNote}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {order.status === "new" && (
          <>
            <button onClick={() => onSetStatus(order.id, "confirmed")} className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">
              Platba prijatá — potvrdiť
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("Dôvod zamietnutia / zrušenia (voliteľné):") ?? "";
                onSetStatus(order.id, "rejected", reason);
              }}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors"
            >
              Zrušiť
            </button>
          </>
        )}
        {order.status === "confirmed" && (
          <>
            <button onClick={() => onSetStatus(order.id, "done")} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">Vykonané</button>
            <button onClick={() => onSetStatus(order.id, "noshow")} className="bg-slate-500 hover:bg-slate-400 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">Neprišiel</button>
          </>
        )}
      </div>
    </div>
  );
};

const AdminView = ({ orders, openSlots, settings, onToggleSlot, onOpenDay, onCloseDay, onSetStatus, onSaveSettings }) => {
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [ibanDraft, setIbanDraft] = useState(settings.iban);
  const [beneficiaryDraft, setBeneficiaryDraft] = useState(settings.beneficiary);

  const pending = orders
    .filter((o) => o.status === "new")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const dayOpen = openSlots[selectedDate] || [];
  const dayOrders = new Map(
    orders.filter((o) => o.date === selectedDate && isSlotOccupying(o)).map((o) => [o.time, o])
  );

  const shiftDay = (delta) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toISODate(d));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-yellow-300 mb-3">Žiadanky čakajúce na platbu ({pending.length})</h3>
        {pending.length === 0
          ? <p className="text-slate-400 bg-slate-700/50 p-4 rounded-lg">Žiadne žiadanky nečakajú na spracovanie.</p>
          : <div className="space-y-3">{pending.map((o) => (<UsgOrderCard key={o.id} order={o} onSetStatus={onSetStatus} />))}</div>}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xl font-bold text-blue-300">Kalendár — otváranie termínov</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDay(-1)} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded font-bold transition-colors">‹</button>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
            <button onClick={() => shiftDay(1)} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded font-bold transition-colors">›</button>
          </div>
        </div>
        <p className="text-slate-300 mb-2 font-semibold">{formatDateHuman(selectedDate)}</p>
        <p className="text-sm text-slate-400 mb-3">
          Kliknutím na čas termín otvoríte (zelený) alebo zatvoríte (sivý). Obsadené termíny sú označené menom pacienta.
        </p>
        <div className="flex gap-2 mb-3">
          <button onClick={() => onOpenDay(selectedDate)} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">
            Otvoriť celý deň
          </button>
          <button onClick={() => onCloseDay(selectedDate)} className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">
            Zavrieť voľné termíny
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {allDaySlots.map((slot) => {
            const isOpen = dayOpen.includes(slot);
            const booked = dayOrders.get(slot);
            if (booked) {
              return (
                <div key={slot} className="p-2 rounded-lg text-sm bg-blue-900/70 border border-blue-500 text-center">
                  <span className="font-mono font-bold">{slot}</span>
                  <span className="block text-xs truncate">{booked.patient.name}</span>
                  <span className="block text-xs opacity-75">{usgStatuses[booked.status].label}</span>
                </div>
              );
            }
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onToggleSlot(selectedDate, slot)}
                className={`p-2 rounded-lg text-sm font-semibold transition-colors ${
                  isOpen ? "bg-green-600 hover:bg-green-500 text-white" : "bg-slate-800 hover:bg-slate-600 text-slate-400"
                }`}
              >
                {slot}
                <span className="block text-xs font-normal">{isOpen ? "otvorený" : "zatvorený"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-700 p-4 rounded-lg space-y-3">
        <h3 className="text-lg font-bold text-blue-300">Nastavenia platby</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-200">IBAN pracoviska</label>
            <input value={ibanDraft} onChange={(e) => setIbanDraft(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-200">Názov príjemcu</label>
            <input value={beneficiaryDraft} onChange={(e) => setBeneficiaryDraft(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white" />
          </div>
        </div>
        <button
          onClick={() => onSaveSettings({ iban: ibanDraft.trim(), beneficiary: beneficiaryDraft.trim() })}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
        >
          Uložiť nastavenia
        </button>
        {settings.iban === defaultSettings.iban && (
          <p className="text-yellow-300 text-sm bg-yellow-900/40 p-2 rounded">⚠ Používa sa DEMO IBAN — pred spustením nastavte skutočný účet pracoviska.</p>
        )}
      </div>
    </div>
  );
};

// --- 6. HLAVNÝ KOMPONENT MODULU ---

export default function UsgBooking() {
  const [view, setView] = useState("patient");
  const [orders, setOrders] = useState(() => loadJson(USG_ORDERS_KEY, []));
  const [openSlots, setOpenSlots] = useState(() => loadJson(USG_OPEN_SLOTS_KEY, {}));
  const [settings, setSettings] = useState(() => loadJson(USG_SETTINGS_KEY, defaultSettings));

  useEffect(() => { localStorage.setItem(USG_ORDERS_KEY, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(USG_OPEN_SLOTS_KEY, JSON.stringify(openSlots)); }, [openSlots]);
  useEffect(() => { localStorage.setItem(USG_SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

  const addOrder = (order) => setOrders((prev) => [...prev, order]);

  const setStatus = (orderId, status, statusNote = "") =>
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, statusNote } : o)));

  const toggleSlot = (date, slot) =>
    setOpenSlots((prev) => {
      const day = prev[date] || [];
      const next = day.includes(slot) ? day.filter((s) => s !== slot) : [...day, slot].sort();
      return { ...prev, [date]: next };
    });

  const openDay = (date) => setOpenSlots((prev) => ({ ...prev, [date]: [...allDaySlots] }));

  const closeDay = (date) =>
    setOpenSlots((prev) => {
      const bookedTimes = new Set(orders.filter((o) => o.date === date && isSlotOccupying(o)).map((o) => o.time));
      const next = (prev[date] || []).filter((s) => bookedTimes.has(s));
      return { ...prev, [date]: next };
    });

  const pendingCount = orders.filter((o) => o.status === "new").length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-center text-blue-300 mb-2">Objednávanie na USG</h1>
      <p className="text-center text-slate-400 text-sm mb-6">
        Samoplatcovské vyšetrenia s platbou cez QR kód (PAY by square). Prototyp — dáta sú uložené len v tomto prehliadači.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("patient")}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${view === "patient" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
        >
          Objednať sa
        </button>
        <button
          onClick={() => setView("admin")}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${view === "admin" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
        >
          Sonografia — správa
          {pendingCount > 0 && <span className="ml-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">{pendingCount}</span>}
        </button>
      </div>

      {view === "patient"
        ? <PatientView orders={orders} openSlots={openSlots} settings={settings} onSubmit={addOrder} />
        : <AdminView
            orders={orders}
            openSlots={openSlots}
            settings={settings}
            onToggleSlot={toggleSlot}
            onOpenDay={openDay}
            onCloseDay={closeDay}
            onSetStatus={setStatus}
            onSaveSettings={setSettings}
          />}
    </div>
  );
}
