import { useRef, useState, type PointerEvent } from 'react';
import { Building2, Maximize2, Move, PlusSquare, ZoomIn, ZoomOut } from 'lucide-react';
import { STATUS_META, type Unit, type UnitStatus } from '../types/property';

interface FloorPlanCanvasProps {
  floorPlanUrl: string;
  developmentName: string;
  units: Unit[];
  selectedUnitId: string | null;
  statusFilter: UnitStatus | 'todas';
  canEdit: boolean;
  isDrawMode: boolean;
  isRepositionMode: boolean;
  onToggleDrawMode: () => void;
  onToggleRepositionMode: () => void;
  onSelectUnit: (unitId: string) => void;
  onFinishDraw: (rect: { x: number; y: number; width: number; height: number }) => void;
  onMoveUnit: (unit: Unit, newX: number, newY: number) => void;
}

interface DragRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function FloorPlanCanvas({
  floorPlanUrl,
  developmentName,
  units,
  selectedUnitId,
  statusFilter,
  canEdit,
  isDrawMode,
  isRepositionMode,
  onToggleDrawMode,
  onToggleRepositionMode,
  onSelectUnit,
  onFinishDraw,
  onMoveUnit,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [imageError, setImageError] = useState(false);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);
  const [movingUnit, setMovingUnit] = useState<{
    unit: Unit;
    offsetX: number;
    offsetY: number;
    previewX: number;
    previewY: number;
  } | null>(null);

  const visibleUnits =
    statusFilter === 'todas'
      ? units
      : units.filter((u) => u.status === statusFilter);

  const getRelativePercent = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleCanvasPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canEdit || !isDrawMode) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getRelativePercent(e.clientX, e.clientY);
    setDragRect({
      startX: pt.x,
      startY: pt.y,
      currentX: pt.x,
      currentY: pt.y,
    });
  };

  const handleCanvasPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRect) {
      const pt = getRelativePercent(e.clientX, e.clientY);
      setDragRect((prev) => (prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null));
      return;
    }

    if (movingUnit) {
      const pt = getRelativePercent(e.clientX, e.clientY);
      const nextX = Math.min(100 - movingUnit.unit.width, Math.max(0, pt.x - movingUnit.offsetX));
      const nextY = Math.min(100 - movingUnit.unit.height, Math.max(0, pt.y - movingUnit.offsetY));
      setMovingUnit((prev) =>
        prev
          ? {
              ...prev,
              previewX: Number(nextX.toFixed(1)),
              previewY: Number(nextY.toFixed(1)),
            }
          : null,
      );
    }
  };

  const handleCanvasPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRect) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if not captured
      }
      const x = Math.min(dragRect.startX, dragRect.currentX);
      const y = Math.min(dragRect.startY, dragRect.currentY);
      const rawW = Math.abs(dragRect.currentX - dragRect.startX);
      const rawH = Math.abs(dragRect.currentY - dragRect.startY);
      setDragRect(null);

      // If user simply clicked without dragging far, create a clean default 14% x 18% zone centered on click
      const width = rawW < 3 ? 14 : Math.min(100 - x, Math.max(4, rawW));
      const height = rawH < 3 ? 18 : Math.min(100 - y, Math.max(4, rawH));
      const finalX = rawW < 3 ? Math.max(0, Math.min(100 - width, x - width / 2)) : x;
      const finalY = rawH < 3 ? Math.max(0, Math.min(100 - height, y - height / 2)) : y;

      onFinishDraw({
        x: Number(finalX.toFixed(1)),
        y: Number(finalY.toFixed(1)),
        width: Number(width.toFixed(1)),
        height: Number(height.toFixed(1)),
      });
      return;
    }

    if (movingUnit) {
      const { unit, previewX, previewY } = movingUnit;
      setMovingUnit(null);
      if (Math.abs(previewX - unit.x) > 0.2 || Math.abs(previewY - unit.y) > 0.2) {
        onMoveUnit(unit, previewX, previewY);
      }
    }
  };

  const handleUnitPointerDown = (e: PointerEvent<HTMLButtonElement>, unit: Unit) => {
    e.stopPropagation();
    onSelectUnit(unit.id);

    if (canEdit && isRepositionMode && !isDrawMode) {
      const pt = getRelativePercent(e.clientX, e.clientY);
      setMovingUnit({
        unit,
        offsetX: pt.x - unit.x,
        offsetY: pt.y - unit.y,
        previewX: unit.x,
        previewY: unit.y,
      });
    }
  };

  const previewRectStyle = dragRect
    ? {
        left: `${Math.min(dragRect.startX, dragRect.currentX)}%`,
        top: `${Math.min(dragRect.startY, dragRect.currentY)}%`,
        width: `${Math.abs(dragRect.currentX - dragRect.startX)}%`,
        height: `${Math.abs(dragRect.currentY - dragRect.startY)}%`,
      }
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col print:border-slate-300">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-600" aria-hidden="true" />
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" aria-hidden="true" />
            <span>Reservado</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-600" aria-hidden="true" />
            <span>Vendido</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onToggleDrawMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isDrawMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <PlusSquare className="w-3.5 h-3.5" />
                <span>{isDrawMode ? 'Cancelar Desenho' : 'Mapear Nova Fração'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleRepositionMode}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isRepositionMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{isRepositionMode ? 'Concluir Posicionamento' : 'Mover Frações'}</span>
              </button>
            </>
          )}

          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Reduzir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono tabular-nums text-slate-700 border-x border-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l border-slate-200 transition-colors cursor-pointer"
              aria-label="Ajustar zoom a 100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode banner when drawing or moving */}
      {(isDrawMode || isRepositionMode) && canEdit && (
        <div className="px-4 py-2 bg-slate-900 text-white text-xs flex items-center justify-between gap-4 print:hidden">
          <span>
            {isDrawMode
              ? 'Modo de mapeamento ativo: clique ou arraste sobre a planta para delimitar a nova fração.'
              : 'Modo de posicionamento ativo: arraste qualquer fração sobre a planta para ajustar a sua localização.'}
          </span>
          <button
            type="button"
            onClick={isDrawMode ? onToggleDrawMode : onToggleRepositionMode}
            className="text-slate-200 hover:text-white underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Fechar modo
          </button>
        </div>
      )}

      {/* Interactive Viewport */}
      <div className="overflow-auto bg-slate-100/80 p-4 sm:p-6 print:overflow-visible print:bg-white print:p-2">
        <div
          className="mx-auto transition-transform duration-150 origin-top-left print:!w-full print:!min-w-0"
          style={{ width: `${zoom * 100}%`, minWidth: '640px' }}
        >
          <div
            ref={containerRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className={`relative w-full select-none rounded-lg overflow-hidden border border-slate-200 bg-white ${
              isDrawMode ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            {!imageError && floorPlanUrl ? (
              <img
                src={floorPlanUrl}
                alt={`Planta arquitetónica de ${developmentName}`}
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setImageError(true)}
                className="w-full h-auto block pointer-events-none"
              />
            ) : (
              <div className="aspect-[16/9] w-full bg-slate-100 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Building2 className="w-10 h-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  Planta de {developmentName}
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Carregue uma imagem da planta no Painel Administrativo para visualizar as frações sobre o desenho técnico.
                </p>
              </div>
            )}

            {/* Unit Overlay Zones */}
            {visibleUnits.map((unit) => {
              const meta = STATUS_META[unit.status];
              const isSelected = unit.id === selectedUnitId;
              const isBeingMoved = movingUnit?.unit.id === unit.id;
              const posX = isBeingMoved ? movingUnit.previewX : unit.x;
              const posY = isBeingMoved ? movingUnit.previewY : unit.y;

              return (
                <button
                  key={unit.id}
                  type="button"
                  onPointerDown={(e) => handleUnitPointerDown(e, unit)}
                  aria-label={`${unit.code} - ${unit.typology} - Estado: ${meta.label}`}
                  style={{
                    left: `${posX}%`,
                    top: `${posY}%`,
                    width: `${unit.width}%`,
                    height: `${unit.height}%`,
                    backgroundColor: isSelected ? meta.zoneActiveFill : meta.zoneFill,
                    borderColor: meta.zoneBorder,
                  }}
                  className={`absolute border-2 rounded-md transition-all duration-150 flex flex-col items-center justify-center p-1.5 text-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    isRepositionMode && canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'ring-2 ring-slate-950 ring-offset-2 z-20 shadow-md'
                      : 'z-10 hover:brightness-95'
                  }`}
                >
                  <div
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-tight text-white shadow-xs whitespace-nowrap max-w-full truncate ${
                      unit.status === 'disponivel'
                        ? 'bg-green-700'
                        : unit.status === 'reservado'
                          ? 'bg-blue-700'
                          : 'bg-red-700'
                    }`}
                  >
                    {unit.code}
                  </div>
                  <div className="mt-1 px-1.5 py-0.5 rounded bg-white/95 text-slate-900 text-[10px] font-medium leading-none shadow-xs whitespace-nowrap max-w-full truncate">
                    {unit.typology} · {meta.label}
                  </div>
                </button>
              );
            })}

            {/* Live Drawing Rectangle Preview */}
            {previewRectStyle && (
              <div
                style={previewRectStyle}
                className="absolute border-2 border-dashed border-slate-900 bg-slate-900/15 rounded-md pointer-events-none z-30"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
