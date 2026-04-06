import { useEffect, useState } from "react";
import "./Recurrence.css";
import {
  getRecurringExpenses,
  createRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpense,
  type RecurringExpense,
  type RecurrenceFrequency,
} from "@/api/recurrence";

export default function Recurrence() {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<RecurrenceFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");

  async function load() {
    try {
      const data = await getRecurringExpenses();
      setItems(data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createRecurringExpense({
        expense_category_id: 1, // temporary until categories screen exists
        label,
        amount: Number(amount),
        frequency,
        start_date: startDate,
        due_day_of_month:
          frequency !== "WEEKLY" ? Number(dayOfMonth) || null : null,
        due_day_of_week:
          frequency === "WEEKLY" ? Number(dayOfWeek) || null : null,
      });

      setLabel("");
      setAmount("");
      setDayOfMonth("");
      setDayOfWeek("");
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    await deleteRecurringExpense(id);
    await load();
  }

  async function handleToggle(id: number) {
    await toggleRecurringExpense(id);
    await load();
  }

  return (
    <section className="recurrence-page">
      <div className="card">
        <h2>Ajouter récurrence</h2>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Libellé</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Montant</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Fréquence</label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurrenceFrequency)
              }
            >
              <option value="WEEKLY">Hebdomadaire</option>
              <option value="MONTHLY">Mensuelle</option>
              <option value="TRIMESTER">Trimestrielle</option>
              <option value="YEARLY">Annuelle</option>
            </select>
          </div>

          <div className="field">
            <label>Date début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {frequency !== "WEEKLY" && (
            <div className="field">
              <label>Jour du mois</label>
              <input
                type="number"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </div>
          )}

          {frequency === "WEEKLY" && (
            <div className="field">
              <label>Jour semaine (0-6)</label>
              <input
                type="number"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              />
            </div>
          )}

          <div className="form-actions full">
            <button className="primary" type="submit">
              Ajouter
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Récurrences</h2>

        <div className="list">
          {items.map((r) => (
            <div key={r.id} className="list-item">
              <div>
                <strong>{r.name}</strong>
                <div className="meta">
                  {r.recurrence_type} • {r.amount.toFixed(2)}
                </div>
              </div>

              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => handleToggle(r.id)}
                >
                  {r.is_active ? "Désactiver" : "Activer"}
                </button>

                <button
                  className="danger"
                  onClick={() => handleDelete(r.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
