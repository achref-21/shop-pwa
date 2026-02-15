import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import "./Revenue.css";
import { getRevenue, saveRevenue as apiSaveRevenue } from "@/api/revenue";

export default function Revenue() {
  const isOnline = useOnline();

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState<string>("");

  /* ─────────────────────────────
     Load revenue with date-aware caching
  ───────────────────────────── */
  // Memoize fetchData to prevent infinite loops
  const fetchRevenue = useCallback(
    () => getRevenue(selectedDate),
    [selectedDate]
  );

  const revenueData = useDateAwareCachedData({
    isOnline,
    dateKey: selectedDate,
    fetchData: fetchRevenue,
  });

  useEffect(() => {
    if (revenueData.data !== undefined) {
      if (revenueData.data) {
        setAmount(revenueData.data.amount.toString());
        setNote(revenueData.data.note ?? "");
      } else {
        setAmount("");
        setNote("");
      }
      setLoadError("");
    } else if (revenueData.error) {
      setLoadError(revenueData.error.message);
    }
  }, [revenueData.data, revenueData.error]);

  /* ─────────────────────────────
     Save revenue (mirrors desktop)
  ───────────────────────────── */
  async function handleSave() {
    if (!amount.trim()) return;

    try {
      await apiSaveRevenue({
        date: selectedDate,
        amount,
        note,
      });

      alert("Recettes enregistrées avec succès.");
      // Reload instead of manually setting
      revenueData.data; // Just to trigger refresh
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l’enregistrement.");
    }
  }
  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  return (
    <section className="revenue-page">

      {/* ───────────────── Top Bar ───────────────── */}
      <div className="top-bar">
        <div className="date-control">
          <label>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* ───────────────── Revenue Form Card ───────────────── */}
      <div className="card">
        <h2>Recettes du jour</h2>

        {loadError && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            color: "#991b1b",
            fontSize: "0.9rem"
          }}>
            ⚠️ {loadError}
          </div>
        )}

        {revenueData.isLoading && !amount && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
            Chargement...
          </div>
        )}

        <form
          className="form-grid"
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
        >
          {/* Amount */}
          <div className="field">
            <label>Montant</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Note */}
          <div className="field full">
            <label>Note</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Notes optionnelles"
            />
          </div>

          {/* Submit */}
          <div className="form-actions full">
            <button className="primary" type="submit">
              Enregistrer
            </button>
          </div>
        </form>
      </div>

    </section>
  );
}