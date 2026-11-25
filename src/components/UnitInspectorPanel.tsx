import { useEffect, useState, type FormEvent } from 'react';
import { Check, Lock, Pencil, Trash2 } from 'lucide-react';
import {
  formatArea,
  formatCurrencyEUR,
  STATUS_META,
  type Unit,
  type UnitPrivateNote,
  type UnitStatus,
} from '../types/property';

interface UnitInspectorPanelProps {
  selectedUnit: Unit | null;
  units: Unit[];
  privateNote: UnitPrivateNote | undefined;
  canEdit: boolean;
  isUpdating: boolean;
  onSelectUnit: (unitId: string) => void;
  onChangeStatus: (unit: Unit, status: UnitStatus) => Promise<void>;
  onSaveDetails: (
    unitId: string,
    updates: {
      code: string;
      typology: string;
      floor: string;
      areaSqm: number;
      price: number;
      orientation: string;
      status: UnitStatus;
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ) => Promise<void>;
  onSaveNote: (unit: Unit, note: { buyerName: string; buyerContact: string; notes: string }) => Promise<void>;
  onDeleteUnit: (unitId: string) => Promise<void>;
  onSignIn: () => void;
}

export function UnitInspectorPanel({
  selectedUnit,
  units,
  privateNote,
  canEdit,
  isUpdating,
  onSelectUnit,
  onChangeStatus,
  onSaveDetails,
  onSaveNote,
  onDeleteUnit,
  onSignIn,
}: UnitInspectorPanelProps) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [code, setCode] = useState('');
  const [typology, setTypology] = useState('');
  const [floor, setFloor] = useState('');
  const [areaSqm, setAreaSqm] = useState('');
  const [price, setPrice] = useState('');
  const [orientation, setOrientation] = useState('');
  const [posX, setPosX] = useState('');
  const [posY, setPosY] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [notes, setNotes] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  useEffect(() => {
    setEditingDetails(false);
    setConfirmDelete(false);
    if (selectedUnit) {
      setCode(selectedUnit.code);
      setTypology(selectedUnit.typology);
      setFloor(selectedUnit.floor);
      setAreaSqm(String(selectedUnit.areaSqm));
      setPrice(String(selectedUnit.price));
      setOrientation(selectedUnit.orientation);
      setPosX(String(selectedUnit.x));
      setPosY(String(selectedUnit.y));
      setWidth(String(selectedUnit.width));
      setHeight(String(selectedUnit.height));
    }
  }, [selectedUnit]);

  useEffect(() => {
    setBuyerName(privateNote?.buyerName ?? '');
    setBuyerContact(privateNote?.buyerContact ?? '');
    setNotes(privateNote?.notes ?? '');
  }, [privateNote, selectedUnit?.id]);

  if (!selectedUnit) {
    return (
      <aside className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Detalhes da Fração</h2>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            Selecione qualquer unidade diretamente na planta ou na lista abaixo para consultar dados e alterar a disponibilidade em tempo real.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-500 mb-3">Acesso rápido às frações</p>
          {units.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma fração mapeada nesta planta.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {units.map((u) => {
                const meta = STATUS_META[u.status];
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onSelectUnit(u.id)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-900 truncate">{u.code}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded text-white shrink-0 ${
                        u.status === 'disponivel'
                          ? 'bg-green-600'
                          : u.status === 'reservado'
                            ? 'bg-blue-600'
                            : 'bg-red-600'
                      }`}
                    >
                      {meta.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  const activeMeta = STATUS_META[selectedUnit.status];

  const handleDetailsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSaveDetails(selectedUnit.id, {
      code,
      typology,
      floor,
      areaSqm: Number(areaSqm) || selectedUnit.areaSqm,
      price: Number(price) || 0,
      orientation,
      status: selectedUnit.status,
      x: Number(posX) ?? selectedUnit.x,
      y: Number(posY) ?? selectedUnit.y,
      width: Number(width) || selectedUnit.width,
      height: Number(height) || selectedUnit.height,
    });
    setEditingDetails(false);
  };

  const handleNoteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSaveNote(selectedUnit, { buyerName, buyerContact, notes });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2000);
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">{selectedUnit.code}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span>{selectedUnit.typology}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedUnit.floor}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatArea(selectedUnit.areaSqm)}</span>
            {selectedUnit.orientation && (
              <>
                <span aria-hidden="true">·</span>
                <span>{selectedUnit.orientation}</span>
              </>
            )}
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${activeMeta.softBadge}`}>
          {activeMeta.label}
        </span>
      </div>

      {/* Price & Value Metrics */}
      <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-200">
        <div>
          <p className="text-xs text-slate-500">Valor de Venda</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-900 font-mono tabular-nums">
            {formatCurrencyEUR(selectedUnit.price)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Preço por m²</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-700 font-mono tabular-nums">
            {selectedUnit.areaSqm > 0
              ? formatCurrencyEUR(Math.round(selectedUnit.price / selectedUnit.areaSqm))
              : '—'}
          </p>
        </div>
      </div>

      {/* Real-time Status Switcher (Green / Blue / Red) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-semibold text-slate-700">Estado de Disponibilidade</p>
          {isUpdating && <span className="text-xs text-slate-500">A guardar...</span>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['disponivel', 'reservado', 'vendido'] as UnitStatus[]).map((statusKey) => {
            const meta = STATUS_META[statusKey];
            const isActive = selectedUnit.status === statusKey;
            return (
              <button
                key={statusKey}
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  if (!canEdit) {
                    onSignIn();
                    return;
                  }
                  void onChangeStatus(selectedUnit, statusKey);
                }}
                className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                  isActive ? meta.activeButton : meta.outlineButton
                }`}
              >
                {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {!canEdit && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Entre como administrador para gravar alterações em tempo real.</span>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Entrar
            </button>
          </div>
        )}
      </div>

      {/* Admin Controls: Edit Metadata & Private Reservation Notes */}
      {canEdit && (
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700">Gestão da Fração</h3>
            <button
              type="button"
              onClick={() => setEditingDetails((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{editingDetails ? 'Cancelar edição' : 'Editar ficha'}</span>
            </button>
          </div>

          {editingDetails ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-xs text-slate-600">Fração</span>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Tipologia</span>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={typology}
                    onChange={(e) => setTypology(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-xs text-slate-600">Área (m²)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10000"
                    required
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Preço (€)</span>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="text-xs text-slate-600">Piso</span>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Orientação</span>
                  <input
                    type="text"
                    maxLength={40}
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <label className="block">
                  <span className="text-[11px] text-slate-500">X (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={posX}
                    onChange={(e) => setPosX(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500">Y (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={posY}
                    onChange={(e) => setPosY(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500">Larg. (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="100"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500">Alt. (%)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="2"
                    max="100"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onDeleteUnit(selectedUnit.id)}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
                  >
                    Confirmar eliminação
                  </button>
                )}

                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Guardar Ficha
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleNoteSubmit} className="space-y-3">
              <p className="text-xs text-slate-500">
                Registo privado de reserva ou comprador (visível apenas no painel administrativo).
              </p>
              <label className="block">
                <span className="text-xs text-slate-600">Interessado / Comprador</span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Nome completo do cliente"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-600">Contacto</span>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Telefone ou email"
                  value={buyerContact}
                  onChange={(e) => setBuyerContact(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-600">Notas da Operação</span>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Data do sinal, CPCV, condições..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 resize-none"
                />
              </label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-green-700 font-medium">
                  {noteSavedFeedback ? 'Notas guardadas com sucesso.' : ''}
                </span>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Guardar Notas
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
