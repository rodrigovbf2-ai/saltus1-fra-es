import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckSquare, ImagePlus, Layers, Plus, Square, Trash2, Upload } from 'lucide-react';
import { processFloorPlanImage } from '../lib/imageCompression';
import {
  formatArea,
  formatCurrencyEUR,
  STATUS_META,
  type ActivityLog,
  type Development,
  type FloorPlan,
  type Unit,
  type UnitStatus,
} from '../types/property';

interface AdminPanelViewProps {
  developments: Development[];
  activeDevelopment: Development | null;
  floors: FloorPlan[];
  activeFloor: FloorPlan | null;
  units: Unit[];
  activityLogs: ActivityLog[];
  canEdit: boolean;
  onSignIn: () => void;
  onSelectDevelopment: (devId: string) => void;
  onSelectFloor: (floorId: string) => void;
  onUpdateDevelopment: (updates: {
    name?: string;
    subtitle?: string;
    floorLabel?: string;
    floorPlanUrl?: string;
    isPublished?: boolean;
  }) => Promise<void>;
  onUpdateFloorPlan: (
    floorId: string,
    updates: { label?: string; floorPlanUrl?: string },
  ) => Promise<void>;
  onDeleteFloorPlan: (floorId: string) => Promise<void>;
  onOpenNewProjectModal: () => void;
  onOpenNewFloorModal: () => void;
  onChangeUnitStatus: (unit: Unit, status: UnitStatus) => Promise<void>;
  onBatchChangeStatus: (units: Unit[], status: UnitStatus) => Promise<void>;
  onOpenNewUnitModal: () => void;
  onViewUnitOnPlan: (unitId: string) => void;
  onSeedSample?: () => Promise<void>;
}

export function AdminPanelView({
  developments,
  activeDevelopment,
  floors,
  activeFloor,
  units,
  activityLogs,
  canEdit,
  onSignIn,
  onSelectDevelopment,
  onSelectFloor,
  onUpdateDevelopment,
  onUpdateFloorPlan,
  onDeleteFloorPlan,
  onOpenNewProjectModal,
  onOpenNewFloorModal,
  onChangeUnitStatus,
  onBatchChangeStatus,
  onOpenNewUnitModal,
  onViewUnitOnPlan,
  onSeedSample,
}: AdminPanelViewProps) {
  const replaceFloorFileRef = useRef<HTMLInputElement | null>(null);
  const [targetFloorForUpload, setTargetFloorForUpload] = useState<string | null>(null);

  const [devName, setDevName] = useState(activeDevelopment?.name ?? '');
  const [devSubtitle, setDevSubtitle] = useState(activeDevelopment?.subtitle ?? '');
  const [floorLabelEdit, setFloorLabelEdit] = useState(activeFloor?.label ?? '');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingDev, setSavingDev] = useState(false);
  const [confirmDeleteFloorId, setConfirmDeleteFloorId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [syncedDevId, setSyncedDevId] = useState<string | null>(null);
  if (activeDevelopment && activeDevelopment.id !== syncedDevId) {
    setSyncedDevId(activeDevelopment.id);
    setDevName(activeDevelopment.name);
    setDevSubtitle(activeDevelopment.subtitle);
    setSelectedIds([]);
  }

  const [syncedFloorId, setSyncedFloorId] = useState<string | null>(null);
  if (activeFloor && activeFloor.id !== syncedFloorId) {
    setSyncedFloorId(activeFloor.id);
    setFloorLabelEdit(activeFloor.label);
    setConfirmDeleteFloorId(null);
  }

  const handleReplaceFloorImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeDevelopment) return;

    setUploadError(null);
    setStatusMsg('A processar e atualizar planta do piso...');
    try {
      const optimizedUrl = await processFloorPlanImage(file);
      const targetId = targetFloorForUpload;
      if (targetId && floors.some((f) => f.id === targetId)) {
        await onUpdateFloorPlan(targetId, { floorPlanUrl: optimizedUrl });
      } else {
        await onUpdateDevelopment({ floorPlanUrl: optimizedUrl });
      }
      setStatusMsg('Planta atualizada em tempo real.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg(null);
      setUploadError(err instanceof Error ? err.message : 'Erro ao carregar a planta.');
    } finally {
      setTargetFloorForUpload(null);
    }
  };

  const handleSaveDevDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeDevelopment) return;
    setSavingDev(true);
    setUploadError(null);
    try {
      await onUpdateDevelopment({
        name: devName,
        subtitle: devSubtitle,
      });
      if (activeFloor && floorLabelEdit.trim() && floorLabelEdit.trim() !== activeFloor.label) {
        await onUpdateFloorPlan(activeFloor.id, { label: floorLabelEdit.trim() });
      }
      setStatusMsg('Dados do projeto e piso guardados.');
      setTimeout(() => setStatusMsg(null), 2500);
    } finally {
      setSavingDev(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === units.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(units.map((u) => u.id));
    }
  };

  const toggleSelectUnit = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectedUnits = units.filter((u) => selectedIds.includes(u.id));

  if (!canEdit) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">
          Painel Administrativo — MAPA DE FRAÇÕES
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Para gerir múltiplos projetos, adicionar pisos com plantas distintas ou atualizar a disponibilidade das frações em tempo real, inicie sessão com a sua conta Google autorizada.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onSignIn}
            className="px-5 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Entrar como Administrador
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={replaceFloorFileRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceFloorImage}
        className="hidden"
      />

      {/* Row 1: Projects & Floors Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Projetos, Pisos e Plantas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gerencie vários empreendimentos e associe uma planta específica a cada piso.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenNewProjectModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Projeto</span>
              </button>
              {activeDevelopment && (
                <button
                  type="button"
                  onClick={onOpenNewFloorModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Adicionar Piso</span>
                </button>
              )}
            </div>
          </div>

          {/* Project Switcher List */}
          {developments.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-600 block">
                Projeto Selecionado ({developments.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {developments.map((dev) => {
                  const isCurrent = dev.id === activeDevelopment?.id;
                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => onSelectDevelopment(dev.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {dev.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeDevelopment ? (
            <>
              {/* Floor List for Active Project */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Pisos do Projeto ({floors.length || 1})
                  </span>
                  <button
                    type="button"
                    onClick={onOpenNewFloorModal}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
                  >
                    + Novo piso com planta
                  </button>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {(floors.length > 0
                    ? floors
                    : [
                        {
                          id: 'default',
                          developmentId: activeDevelopment.id,
                          label: activeDevelopment.floorLabel,
                          order: 1,
                          floorPlanUrl: activeDevelopment.floorPlanUrl,
                          isPublished: activeDevelopment.isPublished,
                          ownerId: activeDevelopment.ownerId,
                        },
                      ]
                  ).map((fl) => {
                    const isSelected = activeFloor ? fl.id === activeFloor.id : true;
                    return (
                      <div
                        key={fl.id}
                        className={`px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 ${
                          isSelected ? 'bg-slate-50' : 'bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (floors.length > 0) onSelectFloor(fl.id);
                          }}
                          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
                        >
                          <img
                            src={fl.floorPlanUrl}
                            alt={`Miniatura ${fl.label}`}
                            className="w-14 h-9 object-cover rounded border border-slate-200 bg-white shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {fl.label}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {isSelected ? 'Piso ativo no editor' : 'Clique para selecionar'}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetFloorForUpload(fl.id === 'default' ? null : fl.id);
                              replaceFloorFileRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-white cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Alterar Planta</span>
                          </button>

                          {floors.length > 1 && fl.id !== 'default' && (
                            confirmDeleteFloorId === fl.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void onDeleteFloorPlan(fl.id);
                                  setConfirmDeleteFloorId(null);
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer"
                              >
                                Confirmar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFloorId(fl.id)}
                                className="p-1.5 text-slate-400 hover:text-red-700 rounded-md hover:bg-red-50 cursor-pointer"
                                aria-label={`Eliminar ${fl.label}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Metadata Form */}
              <form onSubmit={handleSaveDevDetails} className="space-y-4 border-t border-slate-200 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Nome do Projeto</span>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Nome do Piso Ativo</span>
                    <input
                      type="text"
                      maxLength={40}
                      value={floorLabelEdit}
                      onChange={(e) => setFloorLabelEdit(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Descrição / Morada</span>
                  <input
                    type="text"
                    maxLength={180}
                    value={devSubtitle}
                    onChange={(e) => setDevSubtitle(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeDevelopment.isPublished}
                      onChange={(e) =>
                        void onUpdateDevelopment({ isPublished: e.target.checked })
                      }
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>Projeto visível ao público</span>
                  </label>

                  <button
                    type="submit"
                    disabled={savingDev}
                    className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                  >
                    {savingDev ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>

                {statusMsg && <p className="text-xs font-medium text-green-700">{statusMsg}</p>}
                {uploadError && <p className="text-xs font-medium text-red-700">{uploadError}</p>}
              </form>
            </>
          ) : (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Ainda não existe nenhum projeto gravado na base de dados.
              </p>
              {onSeedSample && (
                <button
                  type="button"
                  onClick={() => void onSeedSample()}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Carregar Projeto de Demonstração
                </button>
              )}
            </div>
          )}
        </div>

        {/* Real-Time Activity Log */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Registo de Alterações em Tempo Real
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Histórico automático das mudanças de disponibilidade das frações.
            </p>
          </div>

          {activityLogs.length === 0 ? (
            <div className="py-10 text-center border-t border-slate-200 space-y-2">
              <ImagePlus className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500">
                As alterações de estado aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[380px] overflow-y-auto border-t border-slate-200">
              {activityLogs.map((log) => {
                const newMeta = STATUS_META[log.newStatus];
                const prevLabel =
                  log.previousStatus === 'novo'
                    ? 'Criada'
                    : STATUS_META[log.previousStatus].label;

                return (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {log.unitCode}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {prevLabel} → {newMeta.label} · {log.actorName}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${newMeta.softBadge}`}>
                      {newMeta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Fast Admin Table for Active Floor */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Gestão Rápida de Frações — {activeFloor?.label ?? activeDevelopment?.floorLabel ?? 'Piso 1'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Clique num estado para atualizar a cor na planta instantaneamente: Verde (Disponível), Azul (Reservado) ou Vermelho (Vendido).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedUnits.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="text-xs font-medium text-slate-700 mr-1">
                  {selectedUnits.length} selecionadas:
                </span>
                {(['disponivel', 'reservado', 'vendido'] as UnitStatus[]).map((statusKey) => {
                  const meta = STATUS_META[statusKey];
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => {
                        void onBatchChangeStatus(selectedUnits, statusKey);
                        setSelectedIds([]);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer ${meta.solidButton}`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeDevelopment && (
              <button
                type="button"
                onClick={onOpenNewUnitModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Fração neste Piso</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label="Selecionar todas as frações"
                    className="text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    {units.length > 0 && selectedIds.length === units.length ? (
                      <CheckSquare className="w-4 h-4 text-slate-900" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Fração</th>
                <th className="py-3 px-4">Tipologia</th>
                <th className="py-3 px-4 text-right">Área</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4">Estado em Tempo Real</th>
                <th className="py-3 px-4 text-right">Planta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Sem frações registadas neste piso. Adicione uma fração ou mapeie diretamente sobre a planta.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isChecked = selectedIds.includes(unit.id);
                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSelectUnit(unit.id)}
                          aria-label={`Selecionar ${unit.code}`}
                          className="text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-slate-900" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{unit.code}</td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {unit.typology} · {unit.floor}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatArea(unit.areaSqm)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatCurrencyEUR(unit.price)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          {(['disponivel', 'reservado', 'vendido'] as UnitStatus[]).map(
                            (statusKey) => {
                              const meta = STATUS_META[statusKey];
                              const active = unit.status === statusKey;
                              return (
                                <button
                                  key={statusKey}
                                  type="button"
                                  onClick={() => void onChangeUnitStatus(unit, statusKey)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                                    active ? meta.activeButton : meta.outlineButton
                                  }`}
                                >
                                  {meta.label}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onViewUnitOnPlan(unit.id)}
                          className="text-xs font-medium text-slate-700 hover:text-slate-900 underline cursor-pointer"
                        >
                          Abrir na planta
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
    </div>
  );
}
