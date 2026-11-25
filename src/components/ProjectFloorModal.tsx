import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { processFloorPlanImage } from '../lib/imageCompression';

interface ProjectFloorModalProps {
  mode: 'project' | 'floor' | null;
  projectName?: string;
  onClose: () => void;
  onCreateProject: (input: {
    name: string;
    subtitle: string;
    floorLabel: string;
    floorPlanUrl: string;
  }) => Promise<void>;
  onCreateFloor: (input: {
    label: string;
    floorPlanUrl: string;
  }) => Promise<void>;
}

export function ProjectFloorModal({
  mode,
  projectName,
  onClose,
  onCreateProject,
  onCreateFloor,
}: ProjectFloorModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [floorLabel, setFloorLabel] = useState(mode === 'project' ? 'Piso 0 (R/C)' : '');
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!mode) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const optimized = await processFloorPlanImage(file);
      setFloorPlanUrl(optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a imagem.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!floorPlanUrl) {
      setError('Carregue a imagem da planta para continuar.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'project') {
        if (!name.trim()) {
          setError('Indique o nome do projeto.');
          setSubmitting(false);
          return;
        }
        await onCreateProject({
          name: name.trim(),
          subtitle: subtitle.trim(),
          floorLabel: floorLabel.trim() || 'Piso 1',
          floorPlanUrl,
        });
      } else {
        if (!floorLabel.trim()) {
          setError('Indique a designação do piso (ex: Piso 2).');
          setSubmitting(false);
          return;
        }
        await onCreateFloor({
          label: floorLabel.trim(),
          floorPlanUrl,
        });
      }
      setName('');
      setSubtitle('');
      setFloorLabel('');
      setFloorPlanUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'project' ? 'Novo Projeto / Empreendimento' : `Adicionar Piso a ${projectName ?? 'Projeto'}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'project'
                ? 'Crie um novo projeto e carregue a planta do primeiro piso.'
                : 'Cada piso possui a sua própria planta e frações independentes.'}
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
          {mode === 'project' && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Nome do Projeto</span>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  placeholder="Ex: Residencial Atlântico"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Localização / Subtítulo</span>
                <input
                  type="text"
                  maxLength={180}
                  placeholder="Ex: Foz do Douro, Porto"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="text-xs font-medium text-slate-700">
              {mode === 'project' ? 'Designação do Primeiro Piso' : 'Designação do Piso'}
            </span>
            <input
              type="text"
              required
              autoFocus={mode === 'floor'}
              maxLength={40}
              placeholder="Ex: Piso 0, Piso 2, Cobertura"
              value={floorLabel}
              onChange={(e) => setFloorLabel(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-slate-700 block mb-2">
              Planta do Piso (PNG, JPG, WebP ou SVG)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 px-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
            >
              <ImagePlus className="w-6 h-6 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                {floorPlanUrl ? 'Planta carregada — clique para substituir' : 'Selecionar imagem da planta'}
              </span>
            </button>
            {floorPlanUrl && (
              <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 max-h-44">
                <img
                  src={floorPlanUrl}
                  alt="Pré-visualização da planta"
                  className="w-full h-40 object-contain"
                />
              </div>
            )}
          </div>

          {error && <p className="text-xs font-medium text-red-700">{error}</p>}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
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
              {submitting
                ? 'A guardar...'
                : mode === 'project'
                  ? 'Criar Projeto'
                  : 'Adicionar Piso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
