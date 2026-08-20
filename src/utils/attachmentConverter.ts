import jsPDF from 'jspdf';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Converts image uploads to a letter-sized (8.5x11 in) PDF with the image
 * scaled to fit inside 0.5 inch margins. PDFs and other file types are
 * returned unchanged.
 */
export async function convertAttachmentToLetterPdf(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);

    if (!img.width || !img.height) return file;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 36; // 0.5 inch in points
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    const canvas = document.createElement('canvas');
    const roundedW = Math.max(1, Math.round(drawW));
    const roundedH = Math.max(1, Math.round(drawH));
    canvas.width = roundedW;
    canvas.height = roundedH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, roundedW, roundedH);
    ctx.drawImage(img, 0, 0, roundedW, roundedH);

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const x = margin + (maxW - drawW) / 2;
    const y = margin + (maxH - drawH) / 2;

    pdf.addImage(jpegDataUrl, 'JPEG', x, y, drawW, drawH);
    const blob = pdf.output('blob');
    const newName = file.name.replace(/\.[^.]*$/, '') + '.pdf';

    return new File([blob], newName, { type: 'application/pdf' });
  } catch (error) {
    console.error('Failed to convert attachment to letter-size PDF, using original file:', error);
    return file;
  }
}
