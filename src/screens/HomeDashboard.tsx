import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSearchParams } from "react-router-dom";
import type {
  CreditResourceItem,
  CreditStatusBreakdownRow,
  DashboardMode,
  HomeDashboardKpis,
  HomeDashboardObjective,
  HomeDashboardResources,
  HomeDashboardRisk,
  NetCashTrendPoint,
  TopSupplierByCreditRow,
} from "@/api/dashboard";
import { useHomeDashboardQuery } from "@/hooks/useHomeDashboardQuery";
import { todayLocalDate } from "@/utils/localDate";
import { formatAmount, formatDateDDMMYYYY } from "@/utils/paymentDisplay";
import {
  formatCompactAmount,
  formatDueInDaysLabel,
  getObjectiveStatusClassName,
  orderCreditStatusBreakdown,
  resolveHomeDashboardSearchState,
  toHomeDashboardSearchParams,
  type HomeDashboardSearchState,
} from "./homeDashboardUtils";
import "./HomeDashboard.css";

const OBJECTIVE_STATUS_LABELS = {
  ON_TRACK: "En bonne voie",
  AT_RISK: "A risque",
  OFF_TRACK: "Hors trajectoire",
} as const;

const CREDIT_STATUS_LABELS = {
  OPEN: "Ouvert",
  DUE_SOON: "Echeance proche",
  OVERDUE: "En retard",
  SETTLED: "Regle",
} as const;

const CREDIT_STATUS_COLORS = {
  OPEN: "#6366f1",
  DUE_SOON: "#f59e0b",
  OVERDUE: "#ef4444",
  SETTLED: "#10b981",
} as const;

type DashboardFiltersBarProps = {
  value: HomeDashboardSearchState;
  isRefreshing: boolean;
  validationError: string;
  refreshError: string;
  onChange: (next: Partial<HomeDashboardSearchState>) => void;
  onRefresh: () => void;
};

type InfoTooltipProps = {
  title: string;
  description: string;
};

function InfoTooltip({ title, description }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="info-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="info-tooltip-content">
          {description}
        </span>
      )}
    </span>
  );
}

type SectionHeaderProps = {
  title: string;
  helpText: string;
  action?: ReactNode;
};

function SectionHeader({ title, helpText, action }: SectionHeaderProps) {
  return (
    <div className="dashboard-section-title">
      <div className="section-title-main">
        <h2>{title}</h2>
        <InfoTooltip title={`Aide ${title}`} description={helpText} />
      </div>
      {action && <div className="section-title-action">{action}</div>}
    </div>
  );
}

function DashboardFiltersBar({
  value,
  isRefreshing,
  validationError,
  refreshError,
  onChange,
  onRefresh,
}: DashboardFiltersBarProps) {
  return (
    <section className="home-dashboard-card">
      <div className="dashboard-filters-bar">
        <div className="dashboard-filter-field">
          <label htmlFor="dashboard-mode">Mode</label>
          <select
            id="dashboard-mode"
            value={value.mode}
            onChange={(event) => onChange({ mode: event.target.value as DashboardMode })}
          >
            <option value="WEEK">Hebdomadaire</option>
            <option value="MONTH">Mensuel</option>
          </select>
        </div>

        <div className="dashboard-filter-field">
          <label htmlFor="dashboard-anchor-date">Date d'ancrage</label>
          <input
            id="dashboard-anchor-date"
            type="date"
            value={value.anchor_date}
            onChange={(event) => onChange({ anchor_date: event.target.value })}
          />
        </div>

        <div className="dashboard-filter-field">
          <label htmlFor="dashboard-as-of">Arrete au</label>
          <input
            id="dashboard-as-of"
            type="date"
            value={value.as_of}
            onChange={(event) => onChange({ as_of: event.target.value })}
          />
        </div>

        <button className="primary dashboard-refresh-btn" type="button" onClick={onRefresh}>
          {isRefreshing ? "Rafraichissement..." : "Rafraichir"}
        </button>
      </div>

      {validationError && <p className="dashboard-inline-error">Erreur: {validationError}</p>}
      {refreshError && <p className="dashboard-inline-error">Erreur reseau: {refreshError}</p>}
    </section>
  );
}

type ResponsiveGridProps = {
  className: string;
  children: ReactNode;
};

function ResponsiveGrid({ className, children }: ResponsiveGridProps) {
  return <div className={className}>{children}</div>;
}

type KpiCardProps = {
  label: string;
  value: number;
  subtitle?: string;
  infoText: string;
  testId: string;
  showSettings?: boolean;
};

function KpiCard({ label, value, subtitle, infoText, testId, showSettings = false }: KpiCardProps) {
  return (
    <article className="kpi-card" data-testid={testId}>
      <div className="kpi-card-header">
        <span>{label}</span>
        <div className="kpi-card-actions">
          <InfoTooltip title={`Infos ${label}`} description={infoText} />
          {showSettings && (
            <button
              type="button"
              aria-label={`Parametres ${label}`}
              aria-disabled="true"
              className="kpi-placeholder-btn"
            >
              ⚙
            </button>
          )}
        </div>
      </div>
      <strong title={formatAmount(value)}>{formatCompactAmount(value)}</strong>
      {subtitle && <small>{subtitle}</small>}
    </article>
  );
}

function KpiGrid({ kpis, risk }: { kpis: HomeDashboardKpis; risk: HomeDashboardRisk }) {
  const [isDetailedOpen, setIsDetailedOpen] = useState(false);

  return (
    <section className="home-dashboard-card">
      <SectionHeader
        title="Indicateurs essentiels"
        helpText="Vue rapide des indicateurs les plus critiques pour piloter la tresorerie."
        action={
          <button
            type="button"
            className="kpi-placeholder-btn"
            aria-label="Parametres indicateurs"
            aria-disabled="true"
          >
            ⚙
          </button>
        }
      />

      <ResponsiveGrid className="kpi-grid primary">
        <KpiCard
          label="Cash net"
          value={kpis.net_cash}
          subtitle={`Formule: recettes - paye`}
          infoText="Cash net = Recettes - Paye."
          testId="kpi-primary-net-cash"
        />
        <KpiCard
          label="Recettes"
          value={kpis.revenue}
          infoText="Montant total des recettes sur la periode."
          testId="kpi-primary-revenue"
        />
        <KpiCard
          label="Credit en cours"
          value={kpis.credit_outstanding}
          infoText="Montant total des credits non soldes."
          testId="kpi-primary-credit-outstanding"
        />
        <KpiCard
          label="Montant en retard"
          value={risk.overdue_amount}
          infoText="Somme des credits dont l'echeance est depassee."
          testId="kpi-primary-overdue-amount"
        />
      </ResponsiveGrid>

      <button
        type="button"
        className="dashboard-collapse-btn"
        onClick={() => setIsDetailedOpen((value) => !value)}
      >
        {isDetailedOpen ? "Masquer KPIs detailles" : "Afficher KPIs detailles"}
      </button>

      {isDetailedOpen && (
        <ResponsiveGrid className="kpi-grid detailed">
          <KpiCard
            label="Paye"
            value={kpis.paid}
            infoText="Montant regle sur la periode."
            testId="kpi-detailed-paid"
            showSettings
          />
          <KpiCard
            label="Credit ouvert (periode)"
            value={kpis.credit_opened_in_period}
            infoText="Nouveaux credits crees dans la periode."
            testId="kpi-detailed-opened"
            showSettings
          />
          <KpiCard
            label="Credit recouvre (periode)"
            value={kpis.credit_collected_in_period}
            infoText="Montant des credits recuperes pendant la periode."
            testId="kpi-detailed-collected"
            showSettings
          />
        </ResponsiveGrid>
      )}
    </section>
  );
}

type ProgressGaugeProps = {
  progress: number;
  statusClass: string;
};

function ProgressGauge({ progress, statusClass }: ProgressGaugeProps) {
  const normalized = Math.max(0, Math.min(100, progress));
  return (
    <div className="objective-progress-wrap">
      <div className="objective-progress-zones" aria-hidden="true">
        <span className="zone-green" />
        <span className="zone-amber" />
        <span className="zone-red" />
      </div>
      <div className="objective-progress-track" aria-hidden="true">
        <div className={`objective-progress-fill ${statusClass}`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}

function ObjectivesPanel({ objectives }: { objectives: HomeDashboardObjective[] }) {
  return (
    <section className="home-dashboard-card">
      <SectionHeader
        title="Progression des objectifs"
        helpText="Statuts et progression des objectifs metiers. Les regles de statut restent inchangees."
      />

      {objectives.length === 0 ? (
        <SectionEmptyState label="Aucun objectif retourne." />
      ) : (
        <ResponsiveGrid className="objective-grid">
          {objectives.map((objective) => {
            const statusClass = getObjectiveStatusClassName(objective.status);
            const progress = Math.max(0, Math.min(100, objective.progress_pct));

            return (
              <article key={objective.key} className="objective-card">
                <div className="objective-header">
                  <div className="objective-title-wrap">
                    <strong>{objective.label}</strong>
                    <InfoTooltip
                      title={`Infos ${objective.label}`}
                      description={`Valeur actuelle ${formatAmount(objective.value)}%, cible ${formatAmount(
                        objective.target
                      )}%.`}
                    />
                  </div>
                  <div className="objective-header-actions">
                    <span className={`objective-status ${statusClass}`}>
                      {OBJECTIVE_STATUS_LABELS[objective.status]}
                    </span>
                    <button
                      type="button"
                      className="objective-placeholder-btn"
                      aria-label={`Edition ${objective.label} bientot disponible`}
                      aria-disabled="true"
                    >
                      ✎
                    </button>
                  </div>
                </div>

                <p className="objective-values">
                  Valeur: {formatAmount(objective.value)}% • Cible: {formatAmount(objective.target)}%
                </p>
                <p className="objective-progress-label">Progression: {formatAmount(progress)}%</p>
                <ProgressGauge progress={progress} statusClass={statusClass} />
              </article>
            );
          })}
        </ResponsiveGrid>
      )}
    </section>
  );
}



function NetCashTrendChart({ data }: { data: NetCashTrendPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        short_label: formatDateDDMMYYYY(row.period_key),
      })),
    [data]
  );

  const averageValue = useMemo(() => {
    if (chartData.length === 0) return null;
    const total = chartData.reduce((sum, row) => sum + row.value, 0);
    return total / chartData.length;
  }, [chartData]);

  return (
    <section className="home-dashboard-card chart-card">
      <SectionHeader
        title="Tendance cash net"
        helpText="Evolution du cash net sur la periode selectionnee avec une ligne de moyenne."
      />

      {chartData.length === 0 ? (
        <SectionEmptyState label="Aucune tendance disponible." />
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="short_label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => formatAmount(value)}
                labelFormatter={(value) => `Date: ${value}`}
              />
              {averageValue !== null && (
                <ReferenceLine
                  y={averageValue}
                  stroke="#475569"
                  strokeDasharray="5 3"
                  label={{ value: "Moyenne", position: "insideTopRight", fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CreditStatusBreakdownChart({ data }: { data: CreditStatusBreakdownRow[] }) {
  const orderedData = useMemo(() => orderCreditStatusBreakdown(data), [data]);
  const totalAmount = orderedData.reduce((sum, row) => sum + row.amount, 0);

  const stackedDataset = [
    {
      name: "Statuts",
      OPEN: orderedData[0].amount,
      DUE_SOON: orderedData[1].amount,
      OVERDUE: orderedData[2].amount,
      SETTLED: orderedData[3].amount,
    },
  ];

  return (
    <section className="home-dashboard-card chart-card">
      <SectionHeader
        title="Repartition des statuts credit"
        helpText="Comparaison des montants par statut de credit avec detail montant, nombre et part."
      />

      {orderedData.length === 0 ? (
        <SectionEmptyState label="Aucun statut credit disponible." />
      ) : (
        <div className="credit-status-content">
          <div className="chart-wrap compact">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stackedDataset} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(value: number) => formatAmount(value)} />
                <Legend formatter={(value) => CREDIT_STATUS_LABELS[value as keyof typeof CREDIT_STATUS_LABELS]} />
                <Bar dataKey="OPEN" stackId="total" fill={CREDIT_STATUS_COLORS.OPEN} />
                <Bar dataKey="DUE_SOON" stackId="total" fill={CREDIT_STATUS_COLORS.DUE_SOON} />
                <Bar dataKey="OVERDUE" stackId="total" fill={CREDIT_STATUS_COLORS.OVERDUE} />
                <Bar dataKey="SETTLED" stackId="total" fill={CREDIT_STATUS_COLORS.SETTLED} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="status-table">
            {orderedData.map((row) => {
              const share = totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0;
              return (
                <div className="status-row" key={row.status}>
                  <span className="status-label">
                    <span
                      className="status-dot"
                      style={{ backgroundColor: CREDIT_STATUS_COLORS[row.status] }}
                      aria-hidden="true"
                    />
                    {CREDIT_STATUS_LABELS[row.status]}
                  </span>
                  <span>{formatAmount(row.amount)}</span>
                  <span>{row.count}</span>
                  <span>{formatAmount(share)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function TopSuppliersByCreditChart({ data }: { data: TopSupplierByCreditRow[] }) {
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        supplier_label: `${row.supplier} (${formatAmount(row.share_pct)}%)`,
      })),
    [data]
  );

  return (
    <section className="home-dashboard-card chart-card">
      <SectionHeader
        title="Top fournisseurs par credit"
        helpText="Classement des fournisseurs les plus exposes, avec part relative dans l'encours."
      />

      {chartData.length === 0 ? (
        <SectionEmptyState label="Aucun fournisseur expose." />
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 52)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="supplier_label" type="category" width={150} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, _name, context) => {
                  const payload = context.payload as TopSupplierByCreditRow;
                  return [`${formatAmount(value)} (${formatAmount(payload.share_pct)}%)`, payload.supplier];
                }}
              />
              <Bar dataKey="credit_amount" fill="#4f46e5" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="share_pct" position="right" formatter={(value: number) => `${formatAmount(value)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function CreditResourceList({ rows }: { rows: CreditResourceItem[] }) {
  if (rows.length === 0) return <SectionEmptyState label="Aucun element." />;

  return (
    <ul className="resource-list">
      {rows.map((row) => (
        <li key={row.credit_payment_id}>
          <div>
            <strong>{row.supplier}</strong>
            <p>
              Credit #{row.credit_payment_id} • {formatDueInDaysLabel(row.due_in_days)}
            </p>
          </div>
          <div className="resource-metrics">
            <span>{formatAmount(row.remaining_amount)}</span>
            <small>{row.expected_payment_date ? formatDateDDMMYYYY(row.expected_payment_date) : "-"}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResourcesPanel({ resources }: { resources: HomeDashboardResources }) {
  return (
    <section className="home-dashboard-card">
      <SectionHeader
        title="Ressources de suivi"
        helpText="Listes d'aide a la priorisation: credits urgents, echeances proches et fournisseurs a surveiller."
      />

      <ResponsiveGrid className="resources-grid">
        <article className="resource-card">
          <h3>
            Credits urgents en retard
            <InfoTooltip
              title="Infos credits urgents"
              description="Credits deja en retard a traiter en priorite."
            />
          </h3>
          <CreditResourceList rows={resources.urgent_overdue_credits} />
        </article>

        <article className="resource-card">
          <h3>
            Credits en echeance proche
            <InfoTooltip
              title="Infos echeances proches"
              description="Credits qui arrivent bientot a l'echeance."
            />
          </h3>
          <CreditResourceList rows={resources.due_soon_credits} />
        </article>

        <article className="resource-card">
          <h3>
            Fournisseurs a surveiller
            <InfoTooltip
              title="Infos fournisseurs a surveiller"
              description="Fournisseurs avec la plus forte exposition de credit."
            />
          </h3>
          {resources.watch_suppliers.length === 0 ? (
            <SectionEmptyState label="Aucun fournisseur a surveiller." />
          ) : (
            <ul className="resource-list">
              {resources.watch_suppliers.map((row) => (
                <li key={row.supplier_id}>
                  <div>
                    <strong>{row.supplier}</strong>
                    <p>{formatAmount(row.share_pct)}%</p>
                  </div>
                  <div className="resource-metrics">
                    <span>{formatAmount(row.credit_amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </ResponsiveGrid>
    </section>
  );
}

function SectionEmptyState({ label }: { label: string }) {
  return <div className="dashboard-empty-state">{label}</div>;
}

function DashboardErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <section className="home-dashboard-page">
      <div className="home-dashboard-card dashboard-error-state">
        <h2>Chargement impossible</h2>
        <p>{error}</p>
        <button type="button" className="primary" onClick={onRetry}>
          Reessayer
        </button>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <section className="home-dashboard-page">
      <div className="home-dashboard-card dashboard-skeleton-card">
        <div className="dashboard-skeleton-line large" />
        <div className="dashboard-skeleton-line" />
        <div className="dashboard-skeleton-line" />
      </div>

      <div className="home-dashboard-card dashboard-skeleton-grid">
        <div className="dashboard-skeleton-tile" />
        <div className="dashboard-skeleton-tile" />
        <div className="dashboard-skeleton-tile" />
        <div className="dashboard-skeleton-tile" />
      </div>
    </section>
  );
}

export default function HomeDashboardPage() {
  const today = todayLocalDate();
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(
    () => resolveHomeDashboardSearchState(searchParams, today),
    [searchParams, today]
  );

  useEffect(() => {
    const normalized = toHomeDashboardSearchParams(state).toString();
    if (searchParams.toString() !== normalized) {
      setSearchParams(toHomeDashboardSearchParams(state), { replace: true });
    }
  }, [searchParams, setSearchParams, state]);

  const queryResult = useHomeDashboardQuery(state);

  function updateState(nextPartial: Partial<HomeDashboardSearchState>) {
    const next = {
      ...state,
      ...nextPartial,
    };
    setSearchParams(toHomeDashboardSearchParams(next));
  }

  if (queryResult.isInitialLoading && queryResult.data === null) {
    return <DashboardSkeleton />;
  }

  if (queryResult.error && queryResult.data === null) {
    return <DashboardErrorState error={queryResult.error.message} onRetry={queryResult.refetch} />;
  }

  if (queryResult.data === null) {
    return <DashboardSkeleton />;
  }

  const dashboard = queryResult.data;

  return (
    <section className="home-dashboard-page">
      <DashboardFiltersBar
        value={state}
        isRefreshing={queryResult.isRefreshing}
        validationError={queryResult.validationError}
        refreshError={queryResult.error?.message ?? ""}
        onChange={updateState}
        onRefresh={queryResult.refetch}
      />

      <section className="home-dashboard-card dashboard-period-meta">
        <p>
          <strong>{dashboard.period.label}</strong>
        </p>
        <p>
          Debut: <strong>{dashboard.period.start}</strong> • Fin: <strong>{dashboard.period.end}</strong> •
          Arrete effectif: <strong>{dashboard.period.effective_end}</strong>
        </p>
        <p>
          Fuseau: <strong>{dashboard.timezone}</strong>
        </p>
      </section>

      <KpiGrid kpis={dashboard.kpis} risk={dashboard.risk} />
      <ObjectivesPanel objectives={dashboard.objectives} />

      <div className="dashboard-mid-grid">
        <CreditStatusBreakdownChart data={dashboard.charts.credit_status_breakdown} />
      </div>

      <div className="dashboard-charts-grid">
        <NetCashTrendChart data={dashboard.charts.net_cash_trend} />
        <TopSuppliersByCreditChart data={dashboard.charts.top_suppliers_by_credit} />
      </div>

      <ResourcesPanel resources={dashboard.resources} />
    </section>
  );
}
