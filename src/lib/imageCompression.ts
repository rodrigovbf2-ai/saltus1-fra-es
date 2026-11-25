const MAX_DATA_URL_LENGTH = 850_000;
const MAX_DIMENSION_PX = 1800;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível ler o ficheiro da planta.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro selecionado.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O ficheiro selecionado não é uma imagem válida.'));
    img.src = src;
  });
}

/**
 * Prepares an uploaded floor plan image so it stays crisp and within Firestore's document size limit.
 */
export async function processFloorPlanImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Formato não suportado. Carregue uma imagem PNG, JPG, WebP ou SVG.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);

  // Preserve crisp SVG or already compact raster images
  if (file.type === 'image/svg+xml') {
    if (rawDataUrl.length <= MAX_DATA_URL_LENGTH) {
      return rawDataUrl;
    }
    throw new Error('O ficheiro SVG excede o limite de tamanho (aprox. 600 KB). Simplifique ou exporte como PNG/JPG.');
  }

  if (rawDataUrl.length <= MAX_DATA_URL_LENGTH) {
    return rawDataUrl;
  }

  const img = await loadImage(rawDataUrl);
  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > MAX_DIMENSION_PX || targetHeight > MAX_DIMENSION_PX) {
    const scale = Math.min(MAX_DIMENSION_PX / targetWidth, MAX_DIMENSION_PX / targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('O navegador não suporta processamento de imagem.');
  }

  let quality = 0.86;
  let scaleFactor = 1;

  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = Math.max(400, Math.round(targetWidth * scaleFactor));
    canvas.height = Math.max(300, Math.round(targetHeight * scaleFactor));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= MAX_DATA_URL_LENGTH) {
      return compressed;
    }
    quality = Math.max(0.55, quality - 0.1);
    scaleFactor *= 0.82;
  }

  throw new Error('A imagem da planta é demasiado pesada mesmo após compressão. Utilize uma imagem inferior a 5 MB.');
}
