import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_FLOOR_PLAN_IMAGE,
  SAMPLE_DEVELOPMENT_TEMPLATE,
  SAMPLE_FLOOR_1_ID,
  SAMPLE_UNITS_TEMPLATE,
} from '../data/defaultDevelopment';
import type {
  ActivityLog,
  Development,
  FloorPlan,
  Unit,
  UnitPrivateNote,
  UnitStatus,
} from '../types/property';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || `item_${Date.now()}`).slice(0, 64);
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

export function subscribeDevelopments(
  _userUid: string | null,
  isAdmin: boolean,
  onData: (devs: Development[]) => void,
): Unsubscribe {
  const path = 'developments';
  const colRef = collection(db, path);
  const q = isAdmin
    ? query(colRef, orderBy('createdAt', 'asc'))
    : query(colRef, where('isPublished', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Development[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Development, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeFloors(
  developmentId: string,
  onData: (floors: FloorPlan[]) => void,
): Unsubscribe {
  const path = `developments/${developmentId}/floors`;
  const colRef = collection(db, path);
  const q = query(colRef, orderBy('order', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FloorPlan[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FloorPlan, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeUnits(
  developmentId: string,
  onData: (units: Unit[]) => void,
): Unsubscribe {
  const path = `developments/${developmentId}/units`;
  const colRef = collection(db, path);
  const q = query(colRef, orderBy('code', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Unit[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Unit, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeUnitNotes(
  developmentId: string,
  onData: (notesByUnitId: Record<string, UnitPrivateNote>) => void,
): Unsubscribe {
  const path = `developments/${developmentId}/unitNotes`;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const map: Record<string, UnitPrivateNote> = {};
      for (const d of snapshot.docs) {
        map[d.id] = d.data() as UnitPrivateNote;
      }
      onData(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeActivityLogs(
  developmentId: string,
  onData: (logs: ActivityLog[]) => void,
): Unsubscribe {
  const path = `developments/${developmentId}/activityLogs`;
  const colRef = collection(db, path);
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: ActivityLog[] = snapshot.docs.slice(0, 40).map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ActivityLog, 'id'>),
      }));
      onData(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function seedSampleDevelopment(
  ownerId: string,
  actorName: string,
): Promise<string> {
  const devId = `dev_${sanitizeId(ownerId.slice(0, 8))}_${Date.now()}`;
  const devPath = `developments/${devId}`;

  try {
    const batch = writeBatch(db);
    const devRef = doc(db, 'developments', devId);
    batch.set(devRef, {
      name: SAMPLE_DEVELOPMENT_TEMPLATE.name.slice(0, 120),
      subtitle: SAMPLE_DEVELOPMENT_TEMPLATE.subtitle.slice(0, 180),
      floorLabel: SAMPLE_DEVELOPMENT_TEMPLATE.floorLabel.slice(0, 40),
      floorPlanUrl: DEFAULT_FLOOR_PLAN_IMAGE,
      isPublished: true,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const floorRef = doc(db, 'developments', devId, 'floors', SAMPLE_FLOOR_1_ID);
    batch.set(floorRef, {
      developmentId: devId,
      label: 'Piso 1',
      order: 1,
      floorPlanUrl: DEFAULT_FLOOR_PLAN_IMAGE,
      isPublished: true,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const unit of SAMPLE_UNITS_TEMPLATE) {
      const unitRef = doc(db, 'developments', devId, 'units', unit.id);
      batch.set(unitRef, {
        developmentId: devId,
        floorId: SAMPLE_FLOOR_1_ID,
        code: unit.code.slice(0, 32),
        typology: unit.typology.slice(0, 24),
        floor: unit.floor.slice(0, 32),
        areaSqm: clamp(unit.areaSqm, 1, 10000),
        price: clamp(unit.price, 0, 100000000),
        orientation: unit.orientation.slice(0, 40),
        status: unit.status,
        x: clamp(unit.x, 0, 100),
        y: clamp(unit.y, 0, 100),
        width: clamp(unit.width, 2, 100),
        height: clamp(unit.height, 2, 100),
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const logId = `log_seed_${Date.now()}`;
    const logRef = doc(db, 'developments', devId, 'activityLogs', logId);
    batch.set(logRef, {
      developmentId: devId,
      unitId: SAMPLE_UNITS_TEMPLATE[0].id,
      unitCode: SAMPLE_UNITS_TEMPLATE[0].code,
      previousStatus: 'novo',
      newStatus: SAMPLE_UNITS_TEMPLATE[0].status,
      actorUid: ownerId,
      actorName: actorName.slice(0, 120) || 'Administrador',
      ownerId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return devId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, devPath);
  }
}

export async function createDevelopment(input: {
  name: string;
  subtitle: string;
  floorLabel: string;
  floorPlanUrl: string;
  ownerId: string;
}): Promise<{ developmentId: string; floorId: string }> {
  const devId = `dev_${sanitizeId(input.name)}_${Date.now()}`;
  const floorId = `floor_${sanitizeId(input.floorLabel)}_${Date.now()}`;
  const path = `developments/${devId}`;

  try {
    const batch = writeBatch(db);
    const devRef = doc(db, 'developments', devId);
    batch.set(devRef, {
      name: input.name.trim().slice(0, 120) || 'Novo Projeto',
      subtitle: input.subtitle.trim().slice(0, 180),
      floorLabel: input.floorLabel.trim().slice(0, 40) || 'Piso 1',
      floorPlanUrl: input.floorPlanUrl.slice(0, 900000),
      isPublished: true,
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const floorRef = doc(db, 'developments', devId, 'floors', floorId);
    batch.set(floorRef, {
      developmentId: devId,
      label: input.floorLabel.trim().slice(0, 40) || 'Piso 1',
      order: 1,
      floorPlanUrl: input.floorPlanUrl.slice(0, 900000),
      isPublished: true,
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { developmentId: devId, floorId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDevelopmentDetails(
  developmentId: string,
  updates: {
    name?: string;
    subtitle?: string;
    floorLabel?: string;
    floorPlanUrl?: string;
    isPublished?: boolean;
  },
): Promise<void> {
  const path = `developments/${developmentId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === 'string') {
    payload.name = updates.name.trim().slice(0, 120) || 'Projeto';
  }
  if (typeof updates.subtitle === 'string') {
    payload.subtitle = updates.subtitle.trim().slice(0, 180);
  }
  if (typeof updates.floorLabel === 'string') {
    payload.floorLabel = updates.floorLabel.trim().slice(0, 40) || 'Piso 1';
  }
  if (typeof updates.floorPlanUrl === 'string') {
    payload.floorPlanUrl = updates.floorPlanUrl.slice(0, 900000);
  }
  if (typeof updates.isPublished === 'boolean') {
    payload.isPublished = updates.isPublished;
  }

  try {
    await updateDoc(doc(db, 'developments', developmentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createFloorPlan(input: {
  developmentId: string;
  label: string;
  order: number;
  floorPlanUrl: string;
  isPublished: boolean;
  ownerId: string;
}): Promise<string> {
  const floorId = `floor_${sanitizeId(input.label)}_${Date.now()}`;
  const path = `developments/${input.developmentId}/floors/${floorId}`;

  try {
    const batch = writeBatch(db);
    const floorRef = doc(db, 'developments', input.developmentId, 'floors', floorId);
    batch.set(floorRef, {
      developmentId: input.developmentId,
      label: input.label.trim().slice(0, 40) || 'Novo Piso',
      order: clamp(input.order, 0, 1000),
      floorPlanUrl: input.floorPlanUrl.slice(0, 900000),
      isPublished: input.isPublished,
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return floorId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFloorPlan(
  developmentId: string,
  floorId: string,
  updates: {
    label?: string;
    order?: number;
    floorPlanUrl?: string;
    isPublished?: boolean;
  },
): Promise<void> {
  const path = `developments/${developmentId}/floors/${floorId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.label === 'string') {
    payload.label = updates.label.trim().slice(0, 40) || 'Piso';
  }
  if (typeof updates.order === 'number') {
    payload.order = clamp(updates.order, 0, 1000);
  }
  if (typeof updates.floorPlanUrl === 'string') {
    payload.floorPlanUrl = updates.floorPlanUrl.slice(0, 900000);
  }
  if (typeof updates.isPublished === 'boolean') {
    payload.isPublished = updates.isPublished;
  }

  try {
    await updateDoc(doc(db, 'developments', developmentId, 'floors', floorId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFloorPlan(developmentId: string, floorId: string): Promise<void> {
  const path = `developments/${developmentId}/floors/${floorId}`;
  try {
    await deleteDoc(doc(db, 'developments', developmentId, 'floors', floorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createUnit(input: {
  developmentId: string;
  floorId?: string;
  ownerId: string;
  actorUid: string;
  actorName: string;
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
}): Promise<string> {
  const unitId = `unit_${sanitizeId(input.code)}_${Date.now()}`;
  const path = `developments/${input.developmentId}/units/${unitId}`;

  try {
    const batch = writeBatch(db);
    const unitRef = doc(db, 'developments', input.developmentId, 'units', unitId);

    const payload: Record<string, unknown> = {
      developmentId: input.developmentId,
      code: input.code.trim().slice(0, 32) || 'Fração',
      typology: input.typology.trim().slice(0, 24) || 'T2',
      floor: input.floor.trim().slice(0, 32) || 'Piso 1',
      areaSqm: clamp(input.areaSqm, 1, 10000),
      price: clamp(input.price, 0, 100000000),
      orientation: input.orientation.trim().slice(0, 40),
      status: input.status,
      x: clamp(input.x, 0, 100),
      y: clamp(input.y, 0, 100),
      width: clamp(input.width, 2, 100),
      height: clamp(input.height, 2, 100),
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.floorId) {
      payload.floorId = input.floorId;
    }

    batch.set(unitRef, payload);

    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const logRef = doc(db, 'developments', input.developmentId, 'activityLogs', logId);
    batch.set(logRef, {
      developmentId: input.developmentId,
      unitId,
      unitCode: input.code.trim().slice(0, 32) || 'Fração',
      previousStatus: 'novo',
      newStatus: input.status,
      actorUid: input.actorUid,
      actorName: input.actorName.slice(0, 120) || 'Administrador',
      ownerId: input.ownerId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return unitId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUnitStatus(input: {
  developmentId: string;
  unit: Unit;
  newStatus: UnitStatus;
  actorUid: string;
  actorName: string;
}): Promise<void> {
  if (input.unit.status === input.newStatus) return;
  const path = `developments/${input.developmentId}/units/${input.unit.id}`;

  try {
    const batch = writeBatch(db);
    const unitRef = doc(db, 'developments', input.developmentId, 'units', input.unit.id);
    batch.update(unitRef, {
      status: input.newStatus,
      updatedAt: serverTimestamp(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const logRef = doc(db, 'developments', input.developmentId, 'activityLogs', logId);
    batch.set(logRef, {
      developmentId: input.developmentId,
      unitId: input.unit.id,
      unitCode: input.unit.code.slice(0, 32),
      previousStatus: input.unit.status,
      newStatus: input.newStatus,
      actorUid: input.actorUid,
      actorName: input.actorName.slice(0, 120) || 'Administrador',
      ownerId: input.unit.ownerId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function batchUpdateUnitStatus(input: {
  developmentId: string;
  units: Unit[];
  newStatus: UnitStatus;
  actorUid: string;
  actorName: string;
}): Promise<void> {
  const targets = input.units.filter((u) => u.status !== input.newStatus);
  if (targets.length === 0) return;

  const path = `developments/${input.developmentId}/units`;
  try {
    const batch = writeBatch(db);
    targets.forEach((unit, idx) => {
      const unitRef = doc(db, 'developments', input.developmentId, 'units', unit.id);
      batch.update(unitRef, {
        status: input.newStatus,
        updatedAt: serverTimestamp(),
      });

      const logId = `log_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`;
      const logRef = doc(db, 'developments', input.developmentId, 'activityLogs', logId);
      batch.set(logRef, {
        developmentId: input.developmentId,
        unitId: unit.id,
        unitCode: unit.code.slice(0, 32),
        previousStatus: unit.status,
        newStatus: input.newStatus,
        actorUid: input.actorUid,
        actorName: input.actorName.slice(0, 120) || 'Administrador',
        ownerId: unit.ownerId,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUnitDetails(
  developmentId: string,
  unitId: string,
  updates: {
    floorId?: string;
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
): Promise<void> {
  const path = `developments/${developmentId}/units/${unitId}`;
  const payload: Record<string, unknown> = {
    code: updates.code.trim().slice(0, 32) || 'Fração',
    typology: updates.typology.trim().slice(0, 24) || 'T2',
    floor: updates.floor.trim().slice(0, 32) || 'Piso 1',
    areaSqm: clamp(updates.areaSqm, 1, 10000),
    price: clamp(updates.price, 0, 100000000),
    orientation: updates.orientation.trim().slice(0, 40),
    status: updates.status,
    x: clamp(updates.x, 0, 100),
    y: clamp(updates.y, 0, 100),
    width: clamp(updates.width, 2, 100),
    height: clamp(updates.height, 2, 100),
    updatedAt: serverTimestamp(),
  };
  if (updates.floorId) {
    payload.floorId = updates.floorId;
  }

  try {
    await updateDoc(doc(db, 'developments', developmentId, 'units', unitId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUnit(developmentId: string, unitId: string): Promise<void> {
  const path = `developments/${developmentId}/units/${unitId}`;
  try {
    await deleteDoc(doc(db, 'developments', developmentId, 'units', unitId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUnitPrivateNote(input: {
  developmentId: string;
  unitId: string;
  ownerId: string;
  buyerName: string;
  buyerContact: string;
  notes: string;
  existsAlready: boolean;
}): Promise<void> {
  const path = `developments/${input.developmentId}/unitNotes/${input.unitId}`;
  const noteRef = doc(db, 'developments', input.developmentId, 'unitNotes', input.unitId);

  try {
    const batch = writeBatch(db);
    if (input.existsAlready) {
      batch.update(noteRef, {
        buyerName: input.buyerName.trim().slice(0, 120),
        buyerContact: input.buyerContact.trim().slice(0, 120),
        notes: input.notes.trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(noteRef, {
        developmentId: input.developmentId,
        unitId: input.unitId,
        buyerName: input.buyerName.trim().slice(0, 120),
        buyerContact: input.buyerContact.trim().slice(0, 120),
        notes: input.notes.trim().slice(0, 1000),
        ownerId: input.ownerId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
