import { useCallback, useEffect, useState } from "react";
import { Button, NumberInput, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { getRevenue, saveRevenue as apiSaveRevenue } from "@/api/revenue";
import { useDateAwareCachedData } from "@/hooks/useDateAwareCachedData";
import { useOnline } from "@/hooks/useOnline";
import { todayLocalDate } from "@/utils/localDate";
import "./Revenue.css";

function toAmountString(value: number): string {
  return value.toFixed(2);
}

function normalizeAmount(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export default function Revenue() {
  const isOnline = useOnline();

  const [selectedDate, setSelectedDate] = useState<string>(todayLocalDate());
  const [amount, setAmount] = useState<string>("0.00");
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchRevenue = useCallback(() => getRevenue(selectedDate), [selectedDate]);

  const revenueData = useDateAwareCachedData({
    isOnline,
    dateKey: selectedDate,
    fetchData: fetchRevenue,
  });

  useEffect(() => {
    if (revenueData.data) {
      setAmount(toAmountString(revenueData.data.amount));
      setNote(revenueData.data.note ?? "");
      setLoadError("");
      return;
    }

    if (revenueData.error) {
      setLoadError(revenueData.error.message);
      return;
    }

    setAmount("0.00");
    setNote("");
    setLoadError("");
  }, [revenueData.data, revenueData.error]);

  const onDateChange = (value: string | null) => {
    if (value) {
      setSelectedDate(value);
    }
  };

  const onAmountChange = (value: string | number) => {
    if (value === "") {
      setAmount("");
      return;
    }

    setAmount(String(value));
  };

  const onAmountBlur = () => {
    setAmount((previous) => normalizeAmount(previous));
  };

  async function handleSave() {
    setSubmitError("");
    setIsSaving(true);

    try {
      await apiSaveRevenue({
        date: selectedDate,
        amount: normalizeAmount(amount),
        note,
      });

      setAmount((previous) => normalizeAmount(previous));
      notifications.show({
        title: "Succès",
        message: "Recettes enregistrées avec succès.",
        color: "teal",
        autoClose: 2500,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur lors de l’enregistrement.";
      setSubmitError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="revenue-page">
      <div className="date-control">
        <DateInput
          label="Date"
          aria-label="Date des recettes"
          value={selectedDate}
          onChange={onDateChange}
          valueFormat="YYYY-MM-DD"
          clearable={false}
          placeholder="AAAA-MM-JJ"
        />
      </div>

      <div className="card revenue-form-card">
        <div className="section-title">
          <h2>Recettes du jour</h2>
        </div>

        {loadError && (
          <div className="state-error" role="alert">
            Erreur: {loadError}
          </div>
        )}

        {submitError && (
          <div className="state-error" role="alert">
            Erreur: {submitError}
          </div>
        )}

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="field">
            <NumberInput
              label="Montant"
              value={amount === "" ? "" : Number(amount)}
              min={0}
              step={0.01}
              decimalScale={2}
              fixedDecimalScale
              onChange={onAmountChange}
              onBlur={onAmountBlur}
              placeholder="0.00"
            />
          </div>

          <div className="field full">
            <TextInput
              label="Note"
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder="Notes optionnelles"
            />
          </div>

          <div className="form-actions full">
            <Button className="submit-revenue" type="submit" loading={isSaving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
