import { useState, useEffect, useMemo } from "react";

// --- 1. KONFIGURÁCIA ---

const BOOKING_STORAGE_KEY = "ctBookingOrders_v1";

const examTypes = [
  { id: "ct_head_native", label: "CT mozgu natívne", contrast: false },
  { id: "ct_head_contrast", label: "CT mozgu s kontrastom", contrast: true },
  { id: "ct_sinuses", label: "CT prínosových dutín natívne", contrast: false },
  { id: "ct_chest", label: "CT hrudníka s kontrastom", contrast: true },
  { id: "hrct", label: "HRCT pľúc natívne", contrast: false },
  { id: "ct_abdomen", label: "CT brucha a malej panvy s kontrastom", contrast: true },
  { id: "ct_spine", label: "CT chrbtice natívne", contrast: false },
  { id: "cta", label: "CT angiografia (CTA)", contrast: true },
  { id: "ct_urography", label: "CT urografia", contrast: true },
];

const insuranceOptions = [
  { id: "25", label: "25 - VšZP" },
  { id: "24", label: "24 - Dôvera" },
  { id: "27", label: "27 - Union" },
  { id: "other", label: "Iná / samoplatca" },
];

const orderStatuses = {
  new: { label: "Nová", badge: "bg-yellow-600", border: "border-yellow-500" },
  confirmed: { label: "Potvrdená", badge: "bg-green-600", border: "border-green-500" },
  rejected: { label: "Zamietnutá", badge: "bg-red-600", border: "border-red-500" },
  done: { label: "Vykonaná", badge: "bg-blue-600", border: "border-blue-500" },
  noshow: { label: "Neprišiel", badge: "bg-slate-500", border: "border-slate-400" },
};

// Pracovné dni, sloty po 20 minút
const SLOT_START_MINUTES = 7 * 60 + 30; // 07:30
const SLOT_END_MINUTES = 14 * 60 + 30; // posledný slot 14:10
const SLOT_LENGTH_MINUTES = 20;

function generateDaySlots() {
  const slots = [];
  for (let m = SLOT_START_MINUTES; m + SLOT_LENGTH_MINUTES <= SLOT_END_MINUTES; m += SLOT_LENGTH_MINUTES) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

const daySlots = generateDaySlots();

// --- 2. POMOCNÉ FUNKCIE ---

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(isoDate) {
  const day = new Date(`${isoDate}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function formatDateHuman(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("sk-SK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function nextWorkday(fromDate) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function isSlotOccupying(order) {
  return order.status !== "rejected";
}

function loadOrders() {
  try {
    const stored = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error("Nepodarilo sa načítať objednávky", e);
  }
  return [];
}

const emptyForm = {
  patientName: "",
  birthNumber: "",
  insurance: "25",
  patientPhone: "",
  examTypeId: examTypes[0].id,
  indication: "",
  creatinine: "",
  contrastAllergy: "no",
  metformin: "no",
  urgency: "planned",
  referrerName: "",
  referrerFacility: "",
  referrerPhone: "",
  referrerEmail: "",
  date: toISODate(nextWorkday(new Date())),
  time: "",
};

// --- 3. FORMULÁR NOVEJ OBJEDNÁVKY (pohľad odosielajúcej ambulancie) ---

const OrderForm = ({ orders, onSubmit }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  const examType = examTypes.find((t) => t.id === form.examTypeId);
  const isStatim = form.urgency === "statim";

  const takenTimes = useMemo(
    () => new Set(orders.filter((o) => o.date === form.date && isSlotOccupying(o) && o.time).map((o) => o.time)),
    [orders, form.date]
  );

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!isStatim) {
      if (isWeekend(form.date)) return setError("Vybraný deň je víkend. Plánované vyšetrenia objednávame len v pracovné dni.");
      if (!form.time) return setError("Vyberte si voľný termín (čas).");
      if (takenTimes.has(form.time)) return setError("Vybraný termín bol medzičasom obsadený. Vyberte iný.");
    }
    if (examType.contrast && !form.creatinine.trim()) {
      return setError("Vyšetrenie s kontrastnou látkou vyžaduje hodnotu kreatinínu (eGFR).");
    }

    const order = {
      id: `CT-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      status: "new",
      statusNote: "",
      patient: {
        name: form.patientName.trim(),
        birthNumber: form.birthNumber.trim(),
        insurance: form.insurance,
        phone: form.patientPhone.trim(),
      },
      exam: { typeId: examType.id, label: examType.label, contrast: examType.contrast, indication: form.indication.trim() },
      contrastInfo: examType.contrast
        ? { creatinine: form.creatinine.trim(), allergy: form.contrastAllergy, metformin: form.metformin }
        : null,
      urgency: form.urgency,
      referrer: {
        name: form.referrerName.trim(),
        facility: form.referrerFacility.trim(),
        phone: form.referrerPhone.trim(),
        email: form.referrerEmail.trim(),
      },
      date: isStatim ? toISODate(new Date()) : form.date,
      time: isStatim ? null : form.time,
    };

    onSubmit(order);
    setCreatedOrder(order);
    setForm(emptyForm);
  };

  if (createdOrder) {
    return (
      <div className="bg-green-800/60 border border-green-500 p-6 rounded-lg text-center space-y-4">
        <h3 className="text-2xl font-bold text-green-300">Žiadanka odoslaná</h3>
        <p className="text-lg">
          Číslo objednávky: <strong className="text-yellow-300">{createdOrder.id}</strong>
        </p>
        <div className="bg-slate-800/60 rounded-lg p-4 text-left text-sm space-y-1">
          <p><strong>Pacient:</strong> {createdOrder.patient.name} ({createdOrder.patient.birthNumber})</p>
          <p><strong>Vyšetrenie:</strong> {createdOrder.exam.label}</p>
          <p>
            <strong>Termín:</strong>{" "}
            {createdOrder.urgency === "statim"
              ? "STATIM — kontaktujte CT pracovisko telefonicky!"
              : `${formatDateHuman(createdOrder.date)} o ${createdOrder.time}`}
          </p>
        </div>
        <p className="text-sm text-green-200">Termín platí po potvrdení rádiologickým pracoviskom. O potvrdení budete informovaní na uvedený kontakt.</p>
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
        <h3 className="text-lg font-bold text-blue-300">Pacient</h3>
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
            <label className={labelCls}>Telefón pacienta</label>
            <input value={form.patientPhone} onChange={(e) => setField("patientPhone", e.target.value)} className={inputCls} placeholder="+421 900 000 000" />
          </div>
        </div>
      </div>

      <div className={sectionCls}>
        <h3 className="text-lg font-bold text-blue-300">Vyšetrenie</h3>
        <div>
          <label className={labelCls}>Typ vyšetrenia *</label>
          <select value={form.examTypeId} onChange={(e) => setField("examTypeId", e.target.value)} className={inputCls}>
            {examTypes.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Indikácia / klinická otázka *</label>
          <textarea required rows={3} value={form.indication} onChange={(e) => setField("indication", e.target.value)} className={inputCls} placeholder="Anamnéza, dôvod vyšetrenia, na čo má rádiológ odpovedať…" />
        </div>
        {examType.contrast && (
          <div className="border-l-4 border-yellow-500 bg-slate-800/60 p-3 rounded space-y-3">
            <p className="text-yellow-300 font-semibold text-sm">Vyšetrenie s kontrastnou látkou — doplňte:</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Kreatinín / eGFR *</label>
                <input value={form.creatinine} onChange={(e) => setField("creatinine", e.target.value)} className={inputCls} placeholder="napr. 78 µmol/l" />
              </div>
              <div>
                <label className={labelCls}>Alergia na KL / jód</label>
                <select value={form.contrastAllergy} onChange={(e) => setField("contrastAllergy", e.target.value)} className={inputCls}>
                  <option value="no">Nie</option>
                  <option value="yes">Áno</option>
                  <option value="unknown">Neznáma</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Užíva metformín</label>
                <select value={form.metformin} onChange={(e) => setField("metformin", e.target.value)} className={inputCls}>
                  <option value="no">Nie</option>
                  <option value="yes">Áno</option>
                  <option value="unknown">Neznáme</option>
                </select>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className={labelCls}>Urgentnosť</label>
          <div className="flex gap-3 mt-1">
            <label className={`flex-1 text-center rounded-lg p-3 cursor-pointer ${!isStatim ? "bg-blue-600 font-bold" : "bg-slate-600"}`}>
              <input type="radio" name="urgency" value="planned" checked={!isStatim} onChange={() => setField("urgency", "planned")} className="sr-only" /> Plánované
            </label>
            <label className={`flex-1 text-center rounded-lg p-3 cursor-pointer ${isStatim ? "bg-red-600 font-bold" : "bg-slate-600"}`}>
              <input type="radio" name="urgency" value="statim" checked={isStatim} onChange={() => setField("urgency", "statim")} className="sr-only" /> STATIM
            </label>
          </div>
          {isStatim && (
            <p className="text-red-300 text-sm mt-2 bg-red-900/40 p-2 rounded">
              STATIM požiadavka sa nezaraďuje do kalendára — po odoslaní žiadanky <strong>ihneď telefonicky kontaktujte CT pracovisko (kl. 302 / 7302)</strong>.
            </p>
          )}
        </div>
      </div>

      {!isStatim && (
        <div className={sectionCls}>
          <h3 className="text-lg font-bold text-blue-300">Termín</h3>
          <div>
            <label className={labelCls}>Dátum (pracovné dni) *</label>
            <input type="date" required min={toISODate(new Date())} value={form.date} onChange={(e) => { setField("date", e.target.value); setField("time", ""); }} className={inputCls} />
            {isWeekend(form.date) && <p className="text-yellow-300 text-sm mt-1">Vybraný deň je víkend — vyberte pracovný deň.</p>}
          </div>
          {!isWeekend(form.date) && (
            <div>
              <label className={labelCls}>Voľné termíny — {formatDateHuman(form.date)}</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                {daySlots.map((slot) => {
                  const taken = takenTimes.has(slot);
                  const selected = form.time === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={taken}
                      onClick={() => setField("time", slot)}
                      className={`p-2 rounded-lg text-sm font-semibold transition-colors ${
                        taken ? "bg-slate-800 text-slate-500 line-through cursor-not-allowed"
                        : selected ? "bg-green-600 text-white ring-2 ring-green-300"
                        : "bg-slate-600 hover:bg-slate-500 text-white"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              {daySlots.every((s) => takenTimes.has(s)) && <p className="text-red-300 text-sm mt-2">Tento deň je plne obsadený — vyberte iný dátum.</p>}
            </div>
          )}
        </div>
      )}

      <div className={sectionCls}>
        <h3 className="text-lg font-bold text-blue-300">Odosielajúci lekár</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Meno lekára *</label>
            <input required value={form.referrerName} onChange={(e) => setField("referrerName", e.target.value)} className={inputCls} placeholder="MUDr. …" />
          </div>
          <div>
            <label className={labelCls}>Ambulancia / pracovisko *</label>
            <input required value={form.referrerFacility} onChange={(e) => setField("referrerFacility", e.target.value)} className={inputCls} placeholder="Neurologická ambulancia, …" />
          </div>
          <div>
            <label className={labelCls}>Telefón *</label>
            <input required value={form.referrerPhone} onChange={(e) => setField("referrerPhone", e.target.value)} className={inputCls} placeholder="+421 …" />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input type="email" value={form.referrerEmail} onChange={(e) => setField("referrerEmail", e.target.value)} className={inputCls} placeholder="ambulancia@..." />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-700 text-white p-3 rounded-lg font-semibold">{error}</div>}

      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg transition duration-200">
        Odoslať žiadanku
      </button>
    </form>
  );
};

// --- 4. SPRÁVA OBJEDNÁVOK (pohľad rádiológie) ---

const OrderCard = ({ order, onSetStatus }) => {
  const status = orderStatuses[order.status];
  const contrastWarnings = [];
  if (order.contrastInfo) {
    if (order.contrastInfo.allergy !== "no") contrastWarnings.push("alergia na KL");
    if (order.contrastInfo.metformin !== "no") contrastWarnings.push("metformín");
  }

  return (
    <div className={`bg-slate-700 rounded-lg p-4 border-l-4 ${status.border} space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold text-lg">{order.patient.name}</span>
          <span className="text-slate-400 text-sm ml-2">{order.patient.birthNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {order.urgency === "statim" && <span className="bg-red-600 text-xs font-bold px-2 py-1 rounded animate-pulse">STATIM</span>}
          <span className={`${status.badge} text-xs font-bold px-2 py-1 rounded`}>{status.label}</span>
        </div>
      </div>
      <p className="text-sm">
        <strong className="text-blue-300">{order.exam.label}</strong>
        {order.time ? ` — ${formatDateHuman(order.date)} o ${order.time}` : ` — ${formatDateHuman(order.date)}`}
      </p>
      <p className="text-sm text-slate-300 italic">{order.exam.indication}</p>
      {order.contrastInfo && (
        <p className="text-sm text-yellow-200">
          KL: kreatinín {order.contrastInfo.creatinine || "—"}
          {contrastWarnings.length > 0 && <strong className="text-red-300"> ⚠ {contrastWarnings.join(", ")}</strong>}
        </p>
      )}
      <p className="text-xs text-slate-400">
        Odoslal: {order.referrer.name}, {order.referrer.facility} · tel. {order.referrer.phone}
        {order.referrer.email && ` · ${order.referrer.email}`} · žiadanka {order.id}
      </p>
      {order.statusNote && <p className="text-xs text-red-300">Poznámka: {order.statusNote}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {order.status === "new" && (
          <>
            <button onClick={() => onSetStatus(order.id, "confirmed")} className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">Potvrdiť</button>
            <button
              onClick={() => {
                const reason = window.prompt("Dôvod zamietnutia (voliteľné):") ?? "";
                onSetStatus(order.id, "rejected", reason);
              }}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors"
            >
              Zamietnuť
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

const ManagementView = ({ orders, onSetStatus }) => {
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));

  const pending = orders
    .filter((o) => o.status === "new")
    .sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));

  const dayOrders = orders.filter((o) => o.date === selectedDate && isSlotOccupying(o));
  const dayStatim = dayOrders.filter((o) => o.urgency === "statim");
  const bySlot = new Map(dayOrders.filter((o) => o.time).map((o) => [o.time, o]));

  const shiftDay = (delta) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toISODate(d));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-yellow-300 mb-3">Čakajúce žiadanky ({pending.length})</h3>
        {pending.length === 0
          ? <p className="text-slate-400 bg-slate-700/50 p-4 rounded-lg">Žiadne nové žiadanky na spracovanie.</p>
          : <div className="space-y-3">{pending.map((o) => (<OrderCard key={o.id} order={o} onSetStatus={onSetStatus} />))}</div>}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xl font-bold text-blue-300">Rozpis dňa</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDay(-1)} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded font-bold transition-colors">‹</button>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="p-2 bg-slate-800 border border-slate-600 rounded-lg text-white" />
            <button onClick={() => shiftDay(1)} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded font-bold transition-colors">›</button>
          </div>
        </div>
        <p className="text-slate-300 mb-3 font-semibold">{formatDateHuman(selectedDate)}</p>

        {dayStatim.length > 0 && (
          <div className="mb-4 space-y-3">
            <h4 className="text-red-400 font-bold">STATIM požiadavky</h4>
            {dayStatim.map((o) => (<OrderCard key={o.id} order={o} onSetStatus={onSetStatus} />))}
          </div>
        )}

        {isWeekend(selectedDate)
          ? <p className="text-slate-400 bg-slate-700/50 p-4 rounded-lg">Víkend — plánované termíny sa neobjednávajú.</p>
          : (
            <div className="space-y-2">
              {daySlots.map((slot) => {
                const order = bySlot.get(slot);
                if (!order) {
                  return (
                    <div key={slot} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-4 py-2 text-slate-500">
                      <span className="font-mono font-semibold w-14">{slot}</span>
                      <span className="text-sm">voľný termín</span>
                    </div>
                  );
                }
                return (
                  <div key={slot} className="flex items-start gap-3">
                    <span className="font-mono font-semibold w-14 pt-4 text-slate-300">{slot}</span>
                    <div className="flex-1"><OrderCard order={order} onSetStatus={onSetStatus} /></div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
};

// --- 5. HLAVNÝ KOMPONENT MODULU ---

export default function CtBooking() {
  const [view, setView] = useState("order");
  const [orders, setOrders] = useState(loadOrders);

  useEffect(() => {
    localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  const addOrder = (order) => setOrders((prev) => [...prev, order]);

  const setStatus = (orderId, status, statusNote = "") =>
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, statusNote } : o)));

  const pendingCount = orders.filter((o) => o.status === "new").length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-center text-blue-300 mb-2">Objednávanie na CT</h1>
      <p className="text-center text-slate-400 text-sm mb-6">
        Prototyp — dáta sú uložené len v tomto prehliadači (localStorage), bez servera.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("order")}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${view === "order" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
        >
          Nová objednávka
        </button>
        <button
          onClick={() => setView("manage")}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-colors ${view === "manage" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
        >
          Rádiológia — správa
          {pendingCount > 0 && <span className="ml-2 bg-yellow-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">{pendingCount}</span>}
        </button>
      </div>

      {view === "order"
        ? <OrderForm orders={orders} onSubmit={addOrder} />
        : <ManagementView orders={orders} onSetStatus={setStatus} />}
    </div>
  );
}
