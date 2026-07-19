import { useState, useEffect, useMemo } from "react";
import { encode, PaymentOptions, CurrencyCode } from "bysquare/pay";
import QRCode from "qrcode";

// --- 1. KONFIGURÁCIA ---

const USG_ORDERS_KEY = "usgOrders_v1";
const USG_OPEN_SLOTS_KEY = "usgOpenSlots_v1";
const USG_SETTINGS_KEY = "usgSettings_v1";
const USG_PRICELIST_KEY = "usgPricelist_v1";

// Predvolený cenník samoplatcovských vyšetrení — upraviteľný v správe
const defaultPricelist = [
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
  new: { label: "Nová", badge: "bg-yellow-600", border: "border-yellow-500" },
  confirmed: { label: "Potvrdená", badge: "bg-green-600", border: "border-green-500" },
  rejected: { label: "Zamietnutá", badge: "bg-red-600", border: "border-red-500" },
  done: { label: "Vykonaná", badge: "bg-blue-600", border: "border-blue-500" },
  noshow: { label: "Neprišiel", badge: "bg-slate-500", border: "border-slate-400" },
};

function statusLabel(order) {
  if (order.status === "new") return order.hasReferral ? "Nová — so žiadankou" : "Čaká na platbu";
  return usgStatuses[order.status].label;
}

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
  hasReferral: "", // "yes" = so žiadankou (hradí poisťovňa), "no" = samoplatca
  examTypeId: "",
  reason: "",
  referrerName: "",
  referrerFacility: "",
  patientName: "",
  birthNumber: "",
  insurance: "25",
  phone: "",
  email: "",
  date: "",
  time: "",
};

const PatientView = ({ orders, openSlots, settings, pricelist, onSubmit }) => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  const isSelfPay = form.hasReferral === "no";
  const hasChosen = form.hasReferral !== "";
  const examType = pricelist.find((t) => t.id === form.examTypeId) || null;
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
    if (!examType) return setError("Vyberte typ vyšetrenia.");
    if (!form.date || !form.time) return setError("Vyberte si deň a čas z ponúkaných termínov.");
    if (!freeSlotsFor(form.date).includes(form.time)) {
      setField("time", "");
      return setError("Vybraný termín už nie je dostupný. Vyberte iný.");
    }

    const hasReferral = form.hasReferral === "yes";
    const order = {
      id: `USG-${Date.now().toString(36).toUpperCase()}`,
      variableSymbol: hasReferral ? null : String(Date.now()).slice(-10),
      createdAt: new Date().toISOString(),
      status: "new",
      statusNote: "",
      hasReferral,
      exam: {
        typeId: examType.id,
        label: examType.label,
        reason: form.reason.trim(),
        referrerName: hasReferral ? form.referrerName.trim() : "",
        referrerFacility: hasReferral ? form.referrerFacility.trim() : "",
      },
      price: hasReferral ? null : examType.price,
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
          <h3 className="text-2xl font-bold text-green-300">Žiadosť odoslaná</h3>
          <p>
            <strong>{createdOrder.exam.label}</strong> — {formatDateHuman(createdOrder.date)} o {createdOrder.time}
          </p>
          <p className="text-sm text-slate-300">Číslo objednávky: <strong className="text-yellow-300">{createdOrder.id}</strong></p>
        </div>

        {createdOrder.hasReferral ? (
          <div className="bg-slate-700 p-5 rounded-lg space-y-3">
            <h3 className="text-xl font-bold text-blue-300">Vyšetrenie na žiadanku</h3>
            <p className="text-sm text-slate-300">
              Vyšetrenie je hradené zdravotnou poisťovňou na základe žiadanky od lekára.
            </p>
            <p className="text-sm text-yellow-200 bg-yellow-900/40 p-3 rounded-lg">
              <strong>Nezabudnite si na vyšetrenie priniesť žiadanku (výmenný lístok)</strong> od odporúčajúceho lekára.
              Bez nej nebude možné vyšetrenie vykonať. Termín potvrdí pracovisko na uvedený kontakt.
            </p>
          </div>
        ) : (
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
        )}

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
        <h3 className="text-lg font-bold text-blue-300">Máte žiadanku od lekára?</h3>
        <p className="text-sm text-slate-300">
          Ak vám vyšetrenie odporučil lekár a máte žiadanku (výmenný lístok), vyšetrenie hradí zdravotná poisťovňa.
          Bez žiadanky je vyšetrenie spoplatnené podľa cenníka.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setField("hasReferral", "yes")}
            className={`flex-1 p-4 rounded-lg font-bold transition-colors ${
              form.hasReferral === "yes" ? "bg-green-600 text-white ring-2 ring-green-300" : "bg-slate-600 hover:bg-slate-500 text-white"
            }`}
          >
            Áno, mám žiadanku
            <span className="block text-xs font-normal opacity-80">hradí zdravotná poisťovňa</span>
          </button>
          <button
            type="button"
            onClick={() => setField("hasReferral", "no")}
            className={`flex-1 p-4 rounded-lg font-bold transition-colors ${
              form.hasReferral === "no" ? "bg-blue-600 text-white ring-2 ring-blue-300" : "bg-slate-600 hover:bg-slate-500 text-white"
            }`}
          >
            Nie, nemám žiadanku
            <span className="block text-xs font-normal opacity-80">samoplatca — platba podľa cenníka</span>
          </button>
        </div>
      </div>

      {hasChosen && (
        <>
          <div className={sectionCls}>
            <h3 className="text-lg font-bold text-blue-300">Vyšetrenie</h3>
            <div>
              <label className={labelCls}>Typ vyšetrenia *</label>
              <select required value={form.examTypeId} onChange={(e) => setField("examTypeId", e.target.value)} className={inputCls}>
                <option value="" disabled>— vyberte vyšetrenie —</option>
                {pricelist.map((t) => (
                  <option key={t.id} value={t.id}>
                    {isSelfPay ? `${t.label} — ${formatPrice(t.price)}` : t.label}
                  </option>
                ))}
              </select>
              {isSelfPay && examType && (
                <p className="text-yellow-300 font-bold text-lg mt-2">Cena: {formatPrice(examType.price)}</p>
              )}
              {!isSelfPay && (
                <p className="text-green-300 text-sm mt-2">Vyšetrenie hradené poisťovňou na základe žiadanky.</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Dôvod vyšetrenia / ťažkosti *</label>
              <textarea required rows={3} value={form.reason} onChange={(e) => setField("reason", e.target.value)} className={inputCls} placeholder="Popíšte svoje ťažkosti alebo dôvod, pre ktorý žiadate vyšetrenie…" />
            </div>
            {!isSelfPay && (
              <div className="border-l-4 border-green-500 bg-slate-800/60 p-3 rounded space-y-3">
                <p className="text-green-300 font-semibold text-sm">Údaje zo žiadanky:</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Odporúčajúci lekár *</label>
                    <input required value={form.referrerName} onChange={(e) => setField("referrerName", e.target.value)} className={inputCls} placeholder="MUDr. …" />
                  </div>
                  <div>
                    <label className={labelCls}>Ambulancia / pracovisko</label>
                    <input value={form.referrerFacility} onChange={(e) => setField("referrerFacility", e.target.value)} className={inputCls} placeholder="Ambulancia všeobecného lekára, …" />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Originál žiadanky si prineste so sebou na vyšetrenie.</p>
              </div>
            )}
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
            {isSelfPay ? "Odoslať žiadosť a prejsť na platbu" : "Odoslať žiadosť o termín"}
          </button>
        </>
      )}
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
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded ${order.hasReferral ? "bg-green-800 text-green-200" : "bg-blue-800 text-blue-200"}`}>
            {order.hasReferral ? "ŽIADANKA" : "SAMOPLATCA"}
          </span>
          <span className={`${status.badge} text-xs font-bold px-2 py-1 rounded`}>{statusLabel(order)}</span>
        </div>
      </div>
      <p className="text-sm">
        <strong className="text-blue-300">{order.exam.label}</strong> — {formatDateHuman(order.date)} o {order.time}
        {order.price != null && <span className="text-yellow-300 font-bold ml-2">{formatPrice(order.price)}</span>}
      </p>
      <p className="text-sm text-slate-300 italic">{order.exam.reason}</p>
      {order.hasReferral && order.exam.referrerName && (
        <p className="text-xs text-slate-400">
          Žiadanka od: {order.exam.referrerName}{order.exam.referrerFacility && `, ${order.exam.referrerFacility}`}
        </p>
      )}
      <p className="text-xs text-slate-400">
        Tel. {order.patient.phone}{order.patient.email && ` · ${order.patient.email}`}
        {order.variableSymbol && ` · VS ${order.variableSymbol}`} · objednávka {order.id}
      </p>
      {order.statusNote && <p className="text-xs text-red-300">Poznámka: {order.statusNote}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {order.status === "new" && (
          <>
            <button onClick={() => onSetStatus(order.id, "confirmed")} className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">
              {order.hasReferral ? "Potvrdiť termín" : "Platba prijatá — potvrdiť"}
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

const PricelistEditor = ({ pricelist, onSave }) => {
  const [rows, setRows] = useState(pricelist.map((r) => ({ ...r, price: String(r.price) })));
  const [saved, setSaved] = useState(false);

  const updateRow = (index, field, value) => {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const removeRow = (index) => {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== index));
  };
  const addRow = () => {
    setSaved(false);
    setRows((prev) => [...prev, { id: `item-${Date.now()}`, label: "", price: "" }]);
  };

  const handleSave = () => {
    const cleaned = rows
      .map((r) => ({ id: r.id, label: r.label.trim(), price: parseFloat(String(r.price).replace(",", ".")) }))
      .filter((r) => r.label && !isNaN(r.price) && r.price >= 0);
    onSave(cleaned);
    setRows(cleaned.map((r) => ({ ...r, price: String(r.price) })));
    setSaved(true);
  };

  return (
    <div className="bg-slate-700 p-4 rounded-lg space-y-3">
      <h3 className="text-lg font-bold text-blue-300">Cenník vyšetrení (samoplatcovia)</h3>
      <p className="text-sm text-slate-400">
        Položky sa ponúkajú pacientom pri objednávaní. Cena sa účtuje len samoplatcom bez žiadanky.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.id} className="flex gap-2 items-center">
            <input
              value={row.label}
              onChange={(e) => updateRow(i, "label", e.target.value)}
              className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
              placeholder="Názov vyšetrenia"
            />
            <input
              value={row.price}
              onChange={(e) => updateRow(i, "price", e.target.value)}
              className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-right"
              placeholder="Cena"
              inputMode="decimal"
            />
            <span className="text-slate-400 text-sm">€</span>
            <button type="button" onClick={() => removeRow(i)} className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded text-sm transition-colors" title="Odstrániť položku">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors">
          + Pridať položku
        </button>
        <button type="button" onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded transition-colors">
          Uložiť cenník
        </button>
        {saved && <span className="text-green-400 text-sm self-center">✓ Uložené</span>}
      </div>
    </div>
  );
};

const AdminView = ({ orders, openSlots, settings, pricelist, onToggleSlot, onOpenDay, onCloseDay, onSetStatus, onSaveSettings, onSavePricelist }) => {
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
        <h3 className="text-xl font-bold text-yellow-300 mb-3">Nové žiadosti ({pending.length})</h3>
        {pending.length === 0
          ? <p className="text-slate-400 bg-slate-700/50 p-4 rounded-lg">Žiadne žiadosti nečakajú na spracovanie.</p>
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
                  <span className="block text-xs opacity-75">{statusLabel(booked)}</span>
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

      <PricelistEditor pricelist={pricelist} onSave={onSavePricelist} />

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
  const [pricelist, setPricelist] = useState(() => loadJson(USG_PRICELIST_KEY, defaultPricelist));

  useEffect(() => { localStorage.setItem(USG_ORDERS_KEY, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(USG_OPEN_SLOTS_KEY, JSON.stringify(openSlots)); }, [openSlots]);
  useEffect(() => { localStorage.setItem(USG_SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(USG_PRICELIST_KEY, JSON.stringify(pricelist)); }, [pricelist]);

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
        So žiadankou hradí vyšetrenie poisťovňa, bez žiadanky platba podľa cenníka cez QR kód (PAY by square).
        Prototyp — dáta sú uložené len v tomto prehliadači.
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
        ? <PatientView orders={orders} openSlots={openSlots} settings={settings} pricelist={pricelist} onSubmit={addOrder} />
        : <AdminView
            orders={orders}
            openSlots={openSlots}
            settings={settings}
            pricelist={pricelist}
            onToggleSlot={toggleSlot}
            onOpenDay={openDay}
            onCloseDay={closeDay}
            onSetStatus={setStatus}
            onSaveSettings={setSettings}
            onSavePricelist={setPricelist}
          />}
    </div>
  );
}
