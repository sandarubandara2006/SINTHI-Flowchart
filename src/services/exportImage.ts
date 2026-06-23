// Export the rendered flowchart SVG to a PNG the student can paste into a report.
// Works by serializing the live <svg>, drawing it onto a canvas, and saving.

export async function exportSvgToPng(
  svg: SVGSVGElement,
  fileBaseName: string,
  scale = 2,
): Promise<void> {
  const width = Number(svg.getAttribute('width')) || svg.clientWidth || 800;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight || 600;

  // Clone so we can inline a white background without touching the live chart.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a drawing context for the export.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${sanitize(fileBaseName)}.png`;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to render the chart image.'));
    img.src = url;
  });
}

function sanitize(name: string): string {
  return name.trim().replace(/[^\w-]+/g, '_') || 'flowchart';
}
