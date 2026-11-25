import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import {
  formatArea,
  formatCurrencyEUR,
  STATUS_META,
  type Unit,
  type UnitStatus,
} from '../types/property';

interface UnitsTableViewProps {
  units: Unit[];
  canEdit: boolean;
  onSelectAndViewOnPlan: (unitId: string) => void;
  onChangeStatus: (unit: Unit, status: UnitStatus) => Promise<void>;
}

export function UnitsTableView({
  units,
  canEdit,
  onSelectAndViewOnPlan,
  onChangeStatus,
}: UnitsTableViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'todas'>('todas');
  const [typologyFilter, setTypologyFilter] = useState<string>('todas');

  const typologies = useMemo(() => {
    const set = new Set(units.map((u) => u.typology));
    return Array.from(set).sort();
  }, [units]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (statusFilter !== 'todas' && u.status !== statusFilter) return false;
      if (typologyFilter !== 'todas' && u.typology !== typologyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.code.toLowerCase().includes(q) ||
          u.typology.toLowerCase().includes(q) ||
          u.floor.toLowerCase().includes(q) ||
          u.orientation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [units, statusFilter, typologyFilter, searchQuery]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Filter Header */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Pesquisar fração, tipologia ou orientação..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'disponivel', label: 'Disponíveis' },
                { id: 'reservado', label: 'Reservadas' },
                { id: 'vendido', label: 'Vendidas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filtrar por tipologia"
            value={typologyFilter}
            onChange={(e) => setTypologyFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="todas">Todas as tipologias</option>
            {typologies.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Fração</th>
              <th className="py-3 px-4">Tipologia</th>
              <th className="py-3 px-4">Piso</th>
              <th className="py-3 px-4">Orientação</th>
              <th className="py-3 px-4 text-right">Área</th>
              <th className="py-3 px-4 text-right">Valor</th>
              <th className="py-3 px-4 text-right">€/m²</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                  Nenhuma fração corresponde aos critérios selecionados.
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit) => {
                const meta = STATUS_META[unit.status];
                const pricePerSqm =
                  unit.areaSqm > 0 ? Math.round(unit.price / unit.areaSqm) : 0;

                return (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {unit.code}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{unit.typology}</td>
                    <td className="py-2.5 px-4 text-slate-600">{unit.floor}</td>
                    <td className="py-2.5 px-4 text-slate-600">{unit.orientation || '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                      {formatArea(unit.areaSqm)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatCurrencyEUR(unit.price)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrencyEUR(pricePerSqm)}
                    </td>
                    <td className="py-2.5 px-4">
                      {canEdit ? (
                        <div className="inline-flex items-center gap-1">
                          {(['disponivel', 'reservado', 'vendido'] as UnitStatus[]).map((s) => {
                            const sMeta = STATUS_META[s];
                            const active = unit.status === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => void onChangeStatus(unit, s)}
                                className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors whitespace-nowrap cursor-pointer ${
                                  active ? sMeta.activeButton : sMeta.outlineButton
                                }`}
                              >
                                {sMeta.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${meta.softBadge}`}>
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectAndViewOnPlan(unit.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Ver na Planta</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
