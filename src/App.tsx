import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FileDown, Layers, Plus, Printer, Upload } from 'lucide-react';
import { AdminPanelView } from './components/AdminPanelView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloorPlanCanvas } from './components/FloorPlanCanvas';
import { NewUnitModal } from './components/NewUnitModal';
import { ProjectFloorModal } from './components/ProjectFloorModal';
import { UnitInspectorPanel } from './components/UnitInspectorPanel';
import { UnitsTableView } from './components/UnitsTableView';
import {
  SAMPLE_DEVELOPMENT_ID,
  SAMPLE_DEVELOPMENT_TEMPLATE,
  SAMPLE_FLOORS_TEMPLATE,
  SAMPLE_FLOOR_1_ID,
  SAMPLE_UNITS_TEMPLATE,
} from './data/defaultDevelopment';
import { auth, BOOTSTRAP_ADMIN_EMAIL, db, googleProvider } from './lib/firebase';
import { processFloorPlanImage } from './lib/imageCompression';
import { exportFloorPlanPdf } from './lib/pdfExport';
import {
  batchUpdateUnitStatus,
  createDevelopment,
  createFloorPlan,
  createUnit,
  deleteFloorPlan,
  deleteUnit,
  saveUnitPrivateNote,
  seedSampleDevelopment,
  subscribeActivityLogs,
  subscribeDevelopments,
  subscribeFloors,
  subscribeUnitNotes,
  subscribeUnits,
  updateDevelopmentDetails,
  updateFloorPlan,
  updateUnitDetails,
  updateUnitStatus,
} from './lib/propertyService';
import {
  formatArea,
  formatCurrencyEUR,
  STATUS_META,
  type ActivityLog,
  type Development,
  type FloorPlan,
  type Unit,
  type UnitPrivateNote,
  type UnitStatus,
} from './types/property';

type ActiveTab = 'planta' | 'tabela' | 'admin';

function buildLocalPreviewUnits(): Unit[] {
  return SAMPLE_UNITS_TEMPLATE.map((u) => ({
    ...u,
    developmentId: SAMPLE_DEVELOPMENT_ID,
    ownerId: 'demo_preview',
  }));
}

function buildLocalPreviewFloors(): FloorPlan[] {
  return SAMPLE_FLOORS_TEMPLATE.map((f) => ({
    ...f,
    developmentId: SAMPLE_DEVELOPMENT_ID,
    ownerId: 'demo_preview',
  }));
}

function MainApp() {
  const quickUploadRef = useRef<HTMLInputElement | null>(null);

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('planta');
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'todas'>('todas');
  const [tableScope, setTableScope] = useState<'floor' | 'project'>('floor');

  const [developments, setDevelopments] = useState<Development[]>([]);
  const [developmentsLoaded, setDevelopmentsLoaded] = useState(false);
  const [activeDevelopmentId, setActiveDevelopmentId] = useState<string | null>(null);

  const [firestoreFloors, setFirestoreFloors] = useState<FloorPlan[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  const [firestoreUnits, setFirestoreUnits] = useState<Unit[]>([]);
  const [unitNotesMap, setUnitNotesMap] = useState<Record<string, UnitPrivateNote>>({});
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Local interactive preview state used before any project is persisted in Firestore
  const [previewDevs, setPreviewDevs] = useState<Development[]>([
    { ...SAMPLE_DEVELOPMENT_TEMPLATE },
  ]);
  const [previewActiveDevId, setPreviewActiveDevId] = useState<string>(SAMPLE_DEVELOPMENT_ID);
  const [previewFloors, setPreviewFloors] = useState<FloorPlan[]>(buildLocalPreviewFloors);
  const [previewActiveFloorId, setPreviewActiveFloorId] = useState<string>(SAMPLE_FLOOR_1_ID);
  const [previewUnits, setPreviewUnits] = useState<Unit[]>(buildLocalPreviewUnits);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>('fracao_a');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isRepositionMode, setIsRepositionMode] = useState(false);
  const [newUnitModalOpen, setNewUnitModalOpen] = useState(false);
  const [projectFloorModalMode, setProjectFloorModalMode] = useState<'project' | 'floor' | null>(null);
  const [drawnRect, setDrawnRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // 1. Auth Listener & Admin Privilege Verification
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.emailVerified) {
        if (currentUser.email === BOOTSTRAP_ADMIN_EMAIL) {
          setIsSuperAdmin(true);
        } else {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
            setIsSuperAdmin(adminSnap.exists());
          } catch {
            setIsSuperAdmin(false);
          }
        }
      } else {
        setIsSuperAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 2. Real-time Developments (Projects) Listener
  useEffect(() => {
    if (!authReady) return;
    const unsub = subscribeDevelopments(user?.uid ?? null, isSuperAdmin, (list) => {
      setDevelopments(list);
      setDevelopmentsLoaded(true);
      setActiveDevelopmentId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [authReady, user?.uid, isSuperAdmin]);

  const usingPreview = developmentsLoaded && developments.length === 0;
  const activeDevelopmentsList = usingPreview ? previewDevs : developments;

  const activeDevelopment = useMemo(() => {
    if (usingPreview) {
      return previewDevs.find((d) => d.id === previewActiveDevId) ?? previewDevs[0] ?? null;
    }
    return developments.find((d) => d.id === activeDevelopmentId) ?? developments[0] ?? null;
  }, [usingPreview, previewDevs, previewActiveDevId, developments, activeDevelopmentId]);

  // 3. Real-time Floors Listener for Active Project
  useEffect(() => {
    if (!authReady || usingPreview || !activeDevelopment?.id) {
      setFirestoreFloors([]);
      return;
    }
    const unsub = subscribeFloors(activeDevelopment.id, (list) => {
      setFirestoreFloors(list);
      setActiveFloorId((prev) => {
        if (prev && list.some((f) => f.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [authReady, usingPreview, activeDevelopment?.id]);

  // Floors for active project (with graceful fallback to legacy single-floor Development doc)
  const floors = useMemo(() => {
    if (!activeDevelopment) return [];
    if (usingPreview) {
      return previewFloors.filter((f) => f.developmentId === activeDevelopment.id);
    }
    if (firestoreFloors.length > 0) {
      return firestoreFloors;
    }
    return [
      {
        id: 'legacy_floor',
        developmentId: activeDevelopment.id,
        label: activeDevelopment.floorLabel || 'Piso 1',
        order: 1,
        floorPlanUrl: activeDevelopment.floorPlanUrl,
        isPublished: activeDevelopment.isPublished,
        ownerId: activeDevelopment.ownerId,
      },
    ];
  }, [activeDevelopment, usingPreview, previewFloors, firestoreFloors]);

  const activeFloor = useMemo(() => {
    if (floors.length === 0) return null;
    const targetId = usingPreview ? previewActiveFloorId : activeFloorId;
    return floors.find((f) => f.id === targetId) ?? floors[0];
  }, [floors, usingPreview, previewActiveFloorId, activeFloorId]);

  // 4. Real-time Units Listener for Active Project
  useEffect(() => {
    if (!authReady || usingPreview || !activeDevelopment?.id) {
      setFirestoreUnits([]);
      return;
    }
    const unsub = subscribeUnits(activeDevelopment.id, (list) => {
      setFirestoreUnits(list);
    });
    return () => unsub();
  }, [authReady, usingPreview, activeDevelopment?.id]);

  const allProjectUnits = useMemo(() => {
    if (!activeDevelopment) return [];
    if (usingPreview) {
      return previewUnits.filter((u) => u.developmentId === activeDevelopment.id);
    }
    return firestoreUnits;
  }, [activeDevelopment, usingPreview, previewUnits, firestoreUnits]);

  // Units scoped to the currently active floor
  const floorUnits = useMemo(() => {
    if (!activeFloor) return allProjectUnits;
    const firstFloorId = floors[0]?.id;
    return allProjectUnits.filter((u) => {
      if (u.floorId) return u.floorId === activeFloor.id;
      if (activeFloor.id === 'legacy_floor' || activeFloor.id === firstFloorId) {
        return true;
      }
      return u.floor.trim().toLowerCase() === activeFloor.label.trim().toLowerCase();
    });
  }, [allProjectUnits, activeFloor, floors]);

  useEffect(() => {
    setSelectedUnitId((prev) => {
      if (prev && floorUnits.some((u) => u.id === prev)) return prev;
      return floorUnits[0]?.id ?? null;
    });
  }, [floorUnits]);

  const canEditFirestore = Boolean(
    user &&
      user.emailVerified &&
      activeDevelopment &&
      (isSuperAdmin || activeDevelopment.ownerId === user.uid),
  );

  const canEdit = usingPreview ? true : canEditFirestore;

  // 5. Private Notes & Activity Logs (Admin/Owner Only)
  useEffect(() => {
    if (!authReady || usingPreview || !activeDevelopment?.id || !canEditFirestore) {
      setUnitNotesMap({});
      setActivityLogs([]);
      return;
    }
    const unsubNotes = subscribeUnitNotes(activeDevelopment.id, setUnitNotesMap);
    const unsubLogs = subscribeActivityLogs(activeDevelopment.id, setActivityLogs);
    return () => {
      unsubNotes();
      unsubLogs();
    };
  }, [authReady, usingPreview, activeDevelopment?.id, canEditFirestore]);

  const selectedUnit = useMemo(
    () => floorUnits.find((u) => u.id === selectedUnitId) ?? null,
    [floorUnits, selectedUnitId],
  );

  // KPIs for active floor (or full project when table is in project scope)
  const kpiUnits = activeTab === 'tabela' && tableScope === 'project' ? allProjectUnits : floorUnits;

  const metrics = useMemo(() => {
    const total = kpiUnits.length;
    const disponivel = kpiUnits.filter((u) => u.status === 'disponivel').length;
    const reservado = kpiUnits.filter((u) => u.status === 'reservado').length;
    const vendido = kpiUnits.filter((u) => u.status === 'vendido').length;
    const availableValue = kpiUnits
      .filter((u) => u.status === 'disponivel')
      .reduce((sum, u) => sum + u.price, 0);
    return { total, disponivel, reservado, vendido, availableValue };
  }, [kpiUnits]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (developmentsLoaded && developments.length === 0 && cred.user) {
        const seededId = await seedSampleDevelopment(
          cred.user.uid,
          cred.user.displayName || cred.user.email || 'Administrador',
        );
        setActiveDevelopmentId(seededId);
        setBannerMessage('Sessão iniciada e projeto inicial sincronizado na base de dados.');
        setTimeout(() => setBannerMessage(null), 4000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Não foi possível concluir a autenticação Google.');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setIsDrawMode(false);
    setIsRepositionMode(false);
  };

  const handleSeedSample = async () => {
    if (!user) {
      await handleSignIn();
      return;
    }
    setIsUpdating(true);
    try {
      const newId = await seedSampleDevelopment(
        user.uid,
        user.displayName || user.email || 'Administrador',
      );
      setActiveDevelopmentId(newId);
      setBannerMessage('Projeto de demonstração criado na base de dados.');
      setTimeout(() => setBannerMessage(null), 3500);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectDevelopment = (devId: string) => {
    if (usingPreview) {
      setPreviewActiveDevId(devId);
      const firstFloor = previewFloors.find((f) => f.developmentId === devId);
      setPreviewActiveFloorId(firstFloor?.id ?? '');
    } else {
      setActiveDevelopmentId(devId);
      setActiveFloorId(null);
    }
    setSelectedUnitId(null);
  };

  const handleSelectFloor = (floorId: string) => {
    if (usingPreview) {
      setPreviewActiveFloorId(floorId);
    } else {
      setActiveFloorId(floorId);
    }
    setSelectedUnitId(null);
  };

  const handleChangeUnitStatus = async (unit: Unit, newStatus: UnitStatus) => {
    if (usingPreview) {
      setPreviewUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, status: newStatus } : u)),
      );
      return;
    }
    if (!user || !activeDevelopment) {
      await handleSignIn();
      return;
    }
    setIsUpdating(true);
    try {
      await updateUnitStatus({
        developmentId: activeDevelopment.id,
        unit,
        newStatus,
        actorUid: user.uid,
        actorName: user.displayName || user.email || 'Administrador',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBatchChangeStatus = async (targetUnits: Unit[], newStatus: UnitStatus) => {
    if (usingPreview) {
      const ids = new Set(targetUnits.map((u) => u.id));
      setPreviewUnits((prev) =>
        prev.map((u) => (ids.has(u.id) ? { ...u, status: newStatus } : u)),
      );
      return;
    }
    if (!user || !activeDevelopment) return;
    setIsUpdating(true);
    try {
      await batchUpdateUnitStatus({
        developmentId: activeDevelopment.id,
        units: targetUnits,
        newStatus,
        actorUid: user.uid,
        actorName: user.displayName || user.email || 'Administrador',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveUnitDetails = async (
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
  ) => {
    if (usingPreview) {
      setPreviewUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, ...updates } : u)),
      );
      return;
    }
    if (!activeDevelopment) return;
    setIsUpdating(true);
    try {
      await updateUnitDetails(activeDevelopment.id, unitId, {
        ...updates,
        floorId: activeFloor && activeFloor.id !== 'legacy_floor' ? activeFloor.id : undefined,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMoveUnit = async (unit: Unit, newX: number, newY: number) => {
    await handleSaveUnitDetails(unit.id, {
      code: unit.code,
      typology: unit.typology,
      floor: unit.floor,
      areaSqm: unit.areaSqm,
      price: unit.price,
      orientation: unit.orientation,
      status: unit.status,
      x: newX,
      y: newY,
      width: unit.width,
      height: unit.height,
    });
  };

  const handleCreateUnit = async (data: {
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
  }) => {
    const currentFloorId = activeFloor && activeFloor.id !== 'legacy_floor' ? activeFloor.id : undefined;

    if (usingPreview && activeDevelopment) {
      const newId = `unit_${Date.now()}`;
      setPreviewUnits((prev) => [
        ...prev,
        {
          id: newId,
          developmentId: activeDevelopment.id,
          floorId: currentFloorId,
          ownerId: 'demo_preview',
          ...data,
        },
      ]);
      setSelectedUnitId(newId);
      setIsDrawMode(false);
      return;
    }
    if (!user || !activeDevelopment) return;
    setIsUpdating(true);
    try {
      const newId = await createUnit({
        developmentId: activeDevelopment.id,
        floorId: currentFloorId,
        ownerId: activeDevelopment.ownerId,
        actorUid: user.uid,
        actorName: user.displayName || user.email || 'Administrador',
        ...data,
      });
      setSelectedUnitId(newId);
      setIsDrawMode(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (usingPreview) {
      setPreviewUnits((prev) => prev.filter((u) => u.id !== unitId));
      setSelectedUnitId(null);
      return;
    }
    if (!activeDevelopment) return;
    setIsUpdating(true);
    try {
      await deleteUnit(activeDevelopment.id, unitId);
      setSelectedUnitId(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNote = async (
    unit: Unit,
    note: { buyerName: string; buyerContact: string; notes: string },
  ) => {
    if (usingPreview) {
      setBannerMessage('Inicie sessão como administrador para guardar notas privadas na base de dados.');
      setTimeout(() => setBannerMessage(null), 3500);
      return;
    }
    if (!activeDevelopment) return;
    await saveUnitPrivateNote({
      developmentId: activeDevelopment.id,
      unitId: unit.id,
      ownerId: activeDevelopment.ownerId,
      buyerName: note.buyerName,
      buyerContact: note.buyerContact,
      notes: note.notes,
      existsAlready: Boolean(unitNotesMap[unit.id]),
    });
  };

  const handleUpdateDevelopment = async (updates: {
    name?: string;
    subtitle?: string;
    floorLabel?: string;
    floorPlanUrl?: string;
    isPublished?: boolean;
  }) => {
    if (usingPreview && activeDevelopment) {
      setPreviewDevs((prev) =>
        prev.map((d) => (d.id === activeDevelopment.id ? { ...d, ...updates } : d)),
      );
      if (updates.floorPlanUrl && activeFloor) {
        setPreviewFloors((prev) =>
          prev.map((f) =>
            f.id === activeFloor.id ? { ...f, floorPlanUrl: updates.floorPlanUrl! } : f,
          ),
        );
      }
      return;
    }
    if (!activeDevelopment) return;
    await updateDevelopmentDetails(activeDevelopment.id, updates);
  };

  const handleUpdateFloorPlan = async (
    floorId: string,
    updates: { label?: string; floorPlanUrl?: string },
  ) => {
    if (!activeDevelopment) return;
    if (usingPreview) {
      setPreviewFloors((prev) =>
        prev.map((f) => (f.id === floorId ? { ...f, ...updates } : f)),
      );
      return;
    }
    await updateFloorPlan(activeDevelopment.id, floorId, updates);
  };

  const handleDeleteFloorPlan = async (floorId: string) => {
    if (!activeDevelopment) return;
    if (usingPreview) {
      setPreviewFloors((prev) => prev.filter((f) => f.id !== floorId));
      setPreviewUnits((prev) => prev.filter((u) => u.floorId !== floorId));
      return;
    }
    await deleteFloorPlan(activeDevelopment.id, floorId);
  };

  const handleCreateProject = async (input: {
    name: string;
    subtitle: string;
    floorLabel: string;
    floorPlanUrl: string;
  }) => {
    if (usingPreview) {
      const devId = `dev_preview_${Date.now()}`;
      const floorId = `floor_preview_${Date.now()}`;
      setPreviewDevs((prev) => [
        ...prev,
        {
          id: devId,
          name: input.name,
          subtitle: input.subtitle,
          floorLabel: input.floorLabel,
          floorPlanUrl: input.floorPlanUrl,
          isPublished: true,
          ownerId: 'demo_preview',
        },
      ]);
      setPreviewFloors((prev) => [
        ...prev,
        {
          id: floorId,
          developmentId: devId,
          label: input.floorLabel,
          order: 1,
          floorPlanUrl: input.floorPlanUrl,
          isPublished: true,
          ownerId: 'demo_preview',
        },
      ]);
      setPreviewActiveDevId(devId);
      setPreviewActiveFloorId(floorId);
      setSelectedUnitId(null);
      setActiveTab('planta');
      return;
    }
    if (!user) {
      await handleSignIn();
      return;
    }
    const { developmentId, floorId } = await createDevelopment({
      ...input,
      ownerId: user.uid,
    });
    setActiveDevelopmentId(developmentId);
    setActiveFloorId(floorId);
    setSelectedUnitId(null);
    setActiveTab('planta');
  };

  const handleCreateFloor = async (input: { label: string; floorPlanUrl: string }) => {
    if (!activeDevelopment) return;
    const nextOrder = floors.reduce((max, f) => Math.max(max, f.order), 0) + 1;

    if (usingPreview) {
      const floorId = `floor_preview_${Date.now()}`;
      setPreviewFloors((prev) => [
        ...prev,
        {
          id: floorId,
          developmentId: activeDevelopment.id,
          label: input.label,
          order: nextOrder,
          floorPlanUrl: input.floorPlanUrl,
          isPublished: true,
          ownerId: 'demo_preview',
        },
      ]);
      setPreviewActiveFloorId(floorId);
      setSelectedUnitId(null);
      setActiveTab('planta');
      return;
    }

    const newFloorId = await createFloorPlan({
      developmentId: activeDevelopment.id,
      label: input.label,
      order: nextOrder,
      floorPlanUrl: input.floorPlanUrl,
      isPublished: activeDevelopment.isPublished,
      ownerId: activeDevelopment.ownerId,
    });
    setActiveFloorId(newFloorId);
    setSelectedUnitId(null);
    setActiveTab('planta');
  };

  const handleQuickFloorPlanUpload = async (file: File) => {
    setAuthError(null);
    try {
      const optimizedUrl = await processFloorPlanImage(file);
      if (activeFloor && activeFloor.id !== 'legacy_floor' && (usingPreview || firestoreFloors.length > 0)) {
        await handleUpdateFloorPlan(activeFloor.id, { floorPlanUrl: optimizedUrl });
      } else {
        await handleUpdateDevelopment({ floorPlanUrl: optimizedUrl });
      }
      setBannerMessage(`Planta de "${activeFloor?.label ?? 'Piso'}" atualizada com sucesso.`);
      setTimeout(() => setBannerMessage(null), 3000);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erro ao processar a imagem.');
    }
  };

  const handleExportPdf = async () => {
    if (!activeDevelopment) return;
    setIsExportingPdf(true);
    setAuthError(null);
    try {
      await exportFloorPlanPdf({
        development: activeDevelopment,
        floorLabel: activeFloor?.label ?? activeDevelopment.floorLabel,
        floorPlanUrl: activeFloor?.floorPlanUrl ?? activeDevelopment.floorPlanUrl,
        units: floorUnits,
      });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Não foi possível exportar o PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col print:bg-white">
      {/* Top Navigation Bar: Strict 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('planta')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            MAPA DE FRAÇÕES
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Navegação principal">
            <button
              type="button"
              onClick={() => setActiveTab('planta')}
              className={`py-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'planta'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Planta Interativa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tabela')}
              className={`py-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'tabela'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabela de Frações
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`py-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'admin'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Painel Administrativo
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Terminar Sessão
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Entrar como Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Print-Only Header */}
      <div className="hidden print:block px-2 pb-4 border-b border-slate-300 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">MAPA DE FRAÇÕES</p>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeDevelopment?.name} — {activeFloor?.label ?? activeDevelopment?.floorLabel}
            </h1>
            {activeDevelopment?.subtitle && (
              <p className="text-sm text-slate-600">{activeDevelopment.subtitle}</p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Impresso em {new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5 print:p-0 print:space-y-4">
        {/* Notifications */}
        {authError && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-center justify-between gap-4 print:hidden">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {bannerMessage && (
          <div className="px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-medium flex items-center justify-between gap-4 print:hidden">
            <span>{bannerMessage}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-slate-300 hover:text-white underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {usingPreview && (
          <div className="px-4 py-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-xs text-slate-600">
              Pré-visualização interativa ativa. Para guardar projetos, plantas e sincronizar alterações em tempo real entre dispositivos, inicie sessão como administrador.
            </p>
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sincronizar com Conta Google
            </button>
          </div>
        )}

        {/* Development Header & Multi-Project / Export Toolbar */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 print:hidden">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{activeFloor?.label ?? activeDevelopment?.floorLabel ?? 'Piso 1'}</span>
              <span aria-hidden="true">·</span>
              <span>{usingPreview ? 'Pré-visualização local' : 'Sincronizado em tempo real'}</span>
              {user && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{user.email}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {activeDevelopment?.name ?? 'Projeto'}
            </h1>
            {activeDevelopment?.subtitle && (
              <p className="mt-0.5 text-sm text-slate-600">{activeDevelopment.subtitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Switcher */}
            {activeDevelopmentsList.length > 0 && (
              <select
                aria-label="Selecionar projeto"
                value={activeDevelopment?.id ?? ''}
                onChange={(e) => handleSelectDevelopment(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-slate-900"
              >
                {activeDevelopmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    Projeto: {d.name}
                  </option>
                ))}
              </select>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setProjectFloorModalMode('project')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Projeto</span>
              </button>
            )}

            {canEdit && (
              <>
                <input
                  ref={quickUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleQuickFloorPlanUpload(file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => quickUploadRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Alterar Planta do Piso</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isExportingPdf || !activeDevelopment}
              onClick={() => void handleExportPdf()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'A gerar PDF...' : 'Exportar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </section>

        {/* Multi-Floor Tabs & Status Filter Bar */}
        <section className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Pisos:</span>
            </span>

            {floors.map((fl) => {
              const isCurrent = activeFloor?.id === fl.id;
              return (
                <button
                  key={fl.id}
                  type="button"
                  onClick={() => handleSelectFloor(fl.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {fl.label}
                </button>
              );
            })}

            {canEdit && activeDevelopment && (
              <button
                type="button"
                onClick={() => setProjectFloorModalMode('floor')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-dashed border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-900 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Piso</span>
              </button>
            )}
          </div>

          {activeTab === 'planta' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'disponivel', label: 'Disponível' },
                  { id: 'reservado', label: 'Reservado' },
                  { id: 'vendido', label: 'Vendido' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'tabela' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTableScope('floor')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tableScope === 'floor'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Piso Atual ({activeFloor?.label ?? 'Piso 1'})
              </button>
              <button
                type="button"
                onClick={() => setTableScope('project')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tableScope === 'project'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo o Projeto ({allProjectUnits.length})
              </button>
            </div>
          )}
        </section>

        {/* 4-Column KPI Summary Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 print:p-3">
            <p className="text-xs font-medium text-slate-500">Total de Frações</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics.total}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              Oferta: {formatCurrencyEUR(metrics.availableValue)}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 print:p-3">
            <p className="text-xs font-medium text-green-700">Disponíveis (Verde)</p>
            <p className="mt-1 text-2xl font-bold text-green-700 font-mono tabular-nums">
              {metrics.disponivel}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {metrics.total > 0 ? Math.round((metrics.disponivel / metrics.total) * 100) : 0}% do total
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 print:p-3">
            <p className="text-xs font-medium text-blue-700">Reservadas (Azul)</p>
            <p className="mt-1 text-2xl font-bold text-blue-700 font-mono tabular-nums">
              {metrics.reservado}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {metrics.total > 0 ? Math.round((metrics.reservado / metrics.total) * 100) : 0}% do total
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 print:p-3">
            <p className="text-xs font-medium text-red-700">Vendidas (Vermelho)</p>
            <p className="mt-1 text-2xl font-bold text-red-700 font-mono tabular-nums">
              {metrics.vendido}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {metrics.total > 0 ? Math.round((metrics.vendido / metrics.total) * 100) : 0}% do total
            </p>
          </div>
        </section>

        {/* Active View Workspace */}
        {activeTab === 'planta' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block">
            <div className="lg:col-span-8">
              <FloorPlanCanvas
                floorPlanUrl={activeFloor?.floorPlanUrl ?? activeDevelopment?.floorPlanUrl ?? ''}
                developmentName={`${activeDevelopment?.name ?? 'Projeto'} · ${activeFloor?.label ?? ''}`}
                units={floorUnits}
                selectedUnitId={selectedUnitId}
                statusFilter={statusFilter}
                canEdit={canEdit}
                isDrawMode={isDrawMode}
                isRepositionMode={isRepositionMode}
                onToggleDrawMode={() => {
                  setIsDrawMode((v) => !v);
                  setIsRepositionMode(false);
                }}
                onToggleRepositionMode={() => {
                  setIsRepositionMode((v) => !v);
                  setIsDrawMode(false);
                }}
                onSelectUnit={(id) => setSelectedUnitId(id)}
                onFinishDraw={(rect) => {
                  setDrawnRect(rect);
                  setNewUnitModalOpen(true);
                }}
                onMoveUnit={(unit, x, y) => void handleMoveUnit(unit, x, y)}
              />
            </div>

            <div className="lg:col-span-4 print:hidden">
              <UnitInspectorPanel
                selectedUnit={selectedUnit}
                units={floorUnits}
                privateNote={selectedUnit ? unitNotesMap[selectedUnit.id] : undefined}
                canEdit={canEdit}
                isUpdating={isUpdating}
                onSelectUnit={(id) => setSelectedUnitId(id)}
                onChangeStatus={handleChangeUnitStatus}
                onSaveDetails={handleSaveUnitDetails}
                onSaveNote={handleSaveNote}
                onDeleteUnit={handleDeleteUnit}
                onSignIn={() => void handleSignIn()}
              />
            </div>

            {/* Print-Only Summary Table below Floor Plan */}
            <div className="hidden print:block mt-6">
              <h2 className="text-sm font-bold text-slate-900 mb-2">
                Frações — {activeFloor?.label ?? activeDevelopment?.floorLabel}
              </h2>
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-2 px-3">Fração</th>
                    <th className="py-2 px-3">Tipologia</th>
                    <th className="py-2 px-3">Piso</th>
                    <th className="py-2 px-3">Orientação</th>
                    <th className="py-2 px-3 text-right">Área</th>
                    <th className="py-2 px-3 text-right">Valor</th>
                    <th className="py-2 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {floorUnits.map((u) => {
                    const meta = STATUS_META[u.status];
                    return (
                      <tr key={u.id} className="border-b border-slate-200">
                        <td className="py-1.5 px-3 font-semibold">{u.code}</td>
                        <td className="py-1.5 px-3">{u.typology}</td>
                        <td className="py-1.5 px-3">{u.floor}</td>
                        <td className="py-1.5 px-3">{u.orientation || '—'}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatArea(u.areaSqm)}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatCurrencyEUR(u.price)}</td>
                        <td className="py-1.5 px-3 font-semibold" style={{ color: meta.hex }}>
                          {meta.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tabela' && (
          <UnitsTableView
            units={tableScope === 'project' ? allProjectUnits : floorUnits}
            canEdit={canEdit}
            onSelectAndViewOnPlan={(id) => {
              const target = allProjectUnits.find((u) => u.id === id);
              if (target?.floorId && target.floorId !== activeFloor?.id) {
                handleSelectFloor(target.floorId);
              }
              setSelectedUnitId(id);
              setActiveTab('planta');
            }}
            onChangeStatus={handleChangeUnitStatus}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanelView
            developments={activeDevelopmentsList}
            activeDevelopment={activeDevelopment}
            floors={floors}
            activeFloor={activeFloor}
            units={floorUnits}
            activityLogs={activityLogs}
            canEdit={canEdit}
            onSignIn={() => void handleSignIn()}
            onSelectDevelopment={handleSelectDevelopment}
            onSelectFloor={handleSelectFloor}
            onUpdateDevelopment={handleUpdateDevelopment}
            onUpdateFloorPlan={handleUpdateFloorPlan}
            onDeleteFloorPlan={handleDeleteFloorPlan}
            onOpenNewProjectModal={() => setProjectFloorModalMode('project')}
            onOpenNewFloorModal={() => setProjectFloorModalMode('floor')}
            onChangeUnitStatus={handleChangeUnitStatus}
            onBatchChangeStatus={handleBatchChangeStatus}
            onOpenNewUnitModal={() => {
              setDrawnRect({ x: 42, y: 42, width: 14, height: 16 });
              setNewUnitModalOpen(true);
            }}
            onViewUnitOnPlan={(id) => {
              setSelectedUnitId(id);
              setActiveTab('planta');
            }}
            onSeedSample={handleSeedSample}
          />
        )}
      </main>

      <NewUnitModal
        isOpen={newUnitModalOpen}
        defaultFloor={activeFloor?.label ?? activeDevelopment?.floorLabel ?? 'Piso 1'}
        initialRect={drawnRect}
        onClose={() => {
          setNewUnitModalOpen(false);
          setDrawnRect(null);
        }}
        onCreate={handleCreateUnit}
      />

      <ProjectFloorModal
        mode={projectFloorModalMode}
        projectName={activeDevelopment?.name}
        onClose={() => setProjectFloorModalMode(null)}
        onCreateProject={handleCreateProject}
        onCreateFloor={handleCreateFloor}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
