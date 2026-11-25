import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { STATUS_META, type UnitStatus } from '../types/property';

interface NewUnitModalProps {
  isOpen: boolean;
  defaultFloor: string;
  initialRect: { x: number; y: number; width: number; height: number } | null;
  onClose: () => void;
  onCreate: (data: {
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
  }) => Promise<void>;
}

export function NewUnitModal({
  isOpen,
  defaultFloor,
  initialRect,
  onClose,
  onCreate,
}: NewUnitModalProps) {
  const [code, setCode] = useState('');
  const [typology, setTypology] = useState('T2');
  const [floor, setFloor] = useState(defaultFloor || 'Piso 1');
  const [areaSqm, setAreaSqm] = useState('95');
  const [price, setPrice] = useState('320000');
  const [orientation, setOrientation] = useState('Sul');
  const [status, setStatus] = useState<UnitStatus>('disponivel');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const rect = initialRect ?? { x: 40, y: 40, width: 14, height: 16 };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        code: code.trim(),
        typology: typology.trim() || 'T2',
        floor: floor.trim() || defaultFloor || 'Piso 1',
        areaSqm: Math.max(1, Number(areaSqm) || 85),
        price: Math.max(0, Number(price) || 0),
        orientation: orientation.trim(),
        status,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      setCode('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-unit-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="new-unit-title" className="text-base font-semibold text-slate-900">
              Nova Fração na Planta
            </h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Posição X: {rect.x}% · Y: {rect.y}% · {rect.width}% × {rect.height}%
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Fechar janela"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Código da Fração</span>
              <input
                type="text"
                required
                autoFocus
                maxLength={32}
                placeholder="Ex: Fração I"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Tipologia</span>
              <input
                type="text"
                required
                maxLength={24}
                placeholder="Ex: T2, T3, Loja"
                value={typology}
                onChange={(e) => setTypology(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Piso</span>
              <input
                type="text"
                required
                maxLength={32}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Área (m²)</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10000"
                required
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Preço (€)</span>
              <input
                type="number"
                step="500"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Exposição Solar</span>
            <input
              type="text"
              maxLength={40}
              placeholder="Ex: Nascente / Sul"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-slate-700 block mb-2">Estado Inicial</span>
            <div className="grid grid-cols-3 gap-2">
              {(['disponivel', 'reservado', 'vendido'] as UnitStatus[]).map((key) => {
                const meta = STATUS_META[key];
                const active = status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      active ? meta.activeButton : meta.outlineButton
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'A guardar...' : 'Criar Fração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
