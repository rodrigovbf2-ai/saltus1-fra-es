import { jsPDF } from 'jspdf';
import {
  formatArea,
  formatCurrencyEUR,
  STATUS_META,
  type Development,
  type Unit,
} from '../types/property';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem da planta para o PDF.'));
    img.src = src;
  });
}

async function renderFloorPlanWithOverlays(
  floorPlanUrl: string,
  units: Unit[],
): Promise<{ dataUrl: string; aspectRatio: number } | null> {
  if (!floorPlanUrl) return null;

  try {
    const img = await loadImage(floorPlanUrl);
    const width = Math.min(1600, img.naturalWidth || 1280);
    const ratio = (img.naturalHeight || 720) / (img.naturalWidth || 1280);
    const height = Math.round(width * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const unit of units) {
      const meta = STATUS_META[unit.status];
      const ux = (unit.x / 100) * width;
      const uy = (unit.y / 100) * height;
      const uw = (unit.width / 100) * width;
      const uh = (unit.height / 100) * height;

      ctx.fillStyle = meta.zoneFill;
      ctx.fillRect(ux, uy, uw, uh);

      ctx.lineWidth = Math.max(2, width * 0.0022);
      ctx.strokeStyle = meta.zoneBorder;
      ctx.strokeRect(ux, uy, uw, uh);

      // Draw crisp label pill inside unit center
      const centerX = ux + uw / 2;
      const centerY = uy + uh / 2;
      const fontSize = Math.max(11, Math.min(18, Math.round(uw * 0.11)));
      ctx.font = `700 ${fontSize}px sans-serif`;
      const codeWidth = ctx.measureText(unit.code).width + 14;
      const badgeH = fontSize + 10;

      ctx.fillStyle = meta.hex;
      ctx.fillRect(centerX - codeWidth / 2, centerY - badgeH, codeWidth, badgeH);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.code, centerX, centerY - badgeH / 2);

      const subText = `${unit.typology} · ${meta.label}`;
      ctx.font = `600 ${Math.max(10, fontSize - 2)}px sans-serif`;
      const subWidth = ctx.measureText(subText).width + 12;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fillRect(centerX - subWidth / 2, centerY + 2, subWidth, badgeH - 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(subText, centerX, centerY + 2 + (badgeH - 2) / 2);
    }

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      aspectRatio: ratio,
    };
  } catch {
    return null;
  }
}

export async function exportFloorPlanPdf(input: {
  development: Development;
  floorLabel: string;
  floorPlanUrl: string;
  units: Unit[];
}): Promise<void> {
  const { development, floorLabel, floorPlanUrl, units } = input;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('MAPA DE FRAÇÕES', margin, 13);

  pdf.setFontSize(17);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${development.name} — ${floorLabel}`, margin, 21);

  if (development.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(development.subtitle, margin, 26.5);
  }

  const dateStr = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Exportado em ${dateStr}`, pageWidth - margin, 13, { align: 'right' });

  // KPI strip
  const total = units.length;
  const disp = units.filter((u) => u.status === 'disponivel').length;
  const res = units.filter((u) => u.status === 'reservado').length;
  const vend = units.filter((u) => u.status === 'vendido').length;

  let cursorY = 32;
  const boxGap = 4;
  const boxW = (contentWidth - boxGap * 3) / 4;
  const kpis: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: 'Total de Frações', value: String(total), color: [15, 23, 42] },
    { label: 'Disponíveis (Verde)', value: String(disp), color: STATUS_META.disponivel.rgb },
    { label: 'Reservadas (Azul)', value: String(res), color: STATUS_META.reservado.rgb },
    { label: 'Vendidas (Vermelho)', value: String(vend), color: STATUS_META.vendido.rgb },
  ];

  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxW + boxGap);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(bx, cursorY, boxW, 15, 1.5, 1.5, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(kpi.label, bx + 3, cursorY + 5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...kpi.color);
    pdf.text(kpi.value, bx + 3, cursorY + 11.5);
  });

  cursorY += 20;

  // Floor Plan Composite Image
  const renderedPlan = await renderFloorPlanWithOverlays(floorPlanUrl, units);
  if (renderedPlan) {
    const maxImgH = pageHeight - cursorY - 14;
    let imgW = contentWidth;
    let imgH = imgW * renderedPlan.aspectRatio;
    if (imgH > maxImgH) {
      imgH = maxImgH;
      imgW = imgH / renderedPlan.aspectRatio;
    }
    const imgX = margin + (contentWidth - imgW) / 2;
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(imgX - 0.5, cursorY - 0.5, imgW + 1, imgH + 1);
    pdf.addImage(renderedPlan.dataUrl, 'JPEG', imgX, cursorY, imgW, imgH);
  }

  // Page 2: Availability Table
  pdf.addPage('a4', 'landscape');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Listagem de Frações — ${development.name} (${floorLabel})`, margin, 16);

  let rowY = 24;
  const cols = [
    { label: 'Fração', x: margin, w: 36 },
    { label: 'Tipologia', x: margin + 36, w: 26 },
    { label: 'Piso', x: margin + 62, w: 30 },
    { label: 'Orientação', x: margin + 92, w: 46 },
    { label: 'Área', x: margin + 138, w: 28 },
    { label: 'Valor', x: margin + 166, w: 38 },
    { label: 'Estado', x: margin + 204, w: 42 },
  ];

  const drawTableHeader = (y: number) => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, contentWidth, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    cols.forEach((c) => {
      pdf.text(c.label, c.x + 2, y + 5.5);
    });
  };

  drawTableHeader(rowY);
  rowY += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  for (const unit of units) {
    if (rowY > pageHeight - 16) {
      pdf.addPage('a4', 'landscape');
      rowY = 16;
      drawTableHeader(rowY);
      rowY += 8;
    }

    const meta = STATUS_META[unit.status];
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, rowY + 8, margin + contentWidth, rowY + 8);

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.text(unit.code, cols[0].x + 2, rowY + 5.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(unit.typology, cols[1].x + 2, rowY + 5.5);
    pdf.text(unit.floor, cols[2].x + 2, rowY + 5.5);
    pdf.text(unit.orientation || '—', cols[3].x + 2, rowY + 5.5);
    pdf.text(formatArea(unit.areaSqm), cols[4].x + 2, rowY + 5.5);
    pdf.text(formatCurrencyEUR(unit.price), cols[5].x + 2, rowY + 5.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...meta.rgb);
    pdf.text(meta.label, cols[6].x + 2, rowY + 5.5);

    rowY += 8;
  }

  const safeSlug = `${development.name}-${floorLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  pdf.save(`mapa-de-fracoes-${safeSlug || 'empreendimento'}.pdf`);
}
