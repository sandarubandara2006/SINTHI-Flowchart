// SVG rendering of a single laid-out symbol. Each kind gets its conventional
// flowchart shape; colours come from the shared symbol catalog.

import type { LaidOutShape } from '../../render/layout';
import { SYMBOL_BY_KIND } from '../symbols';

const TERMINAL_FILL = '#e5e7eb';
const TERMINAL_STROKE = '#6b7280';

interface ShapeStyle {
  fill: string;
  stroke: string;
}

function styleFor(kind: LaidOutShape['kind']): ShapeStyle {
  if (kind === 'start' || kind === 'end') {
    return { fill: TERMINAL_FILL, stroke: TERMINAL_STROKE };
  }
  const meta = SYMBOL_BY_KIND[kind];
  return { fill: meta.fill, stroke: meta.stroke };
}

/** Render the outline path/element for a shape (without label). */
export function ShapeOutline({
  shape,
  highlighted,
  selected,
  errored,
}: {
  shape: LaidOutShape;
  highlighted: boolean;
  selected: boolean;
  errored: boolean;
}) {
  const { fill, stroke } = styleFor(shape.kind);
  const strokeColor = errored
    ? '#dc2626'
    : highlighted
      ? '#f59e0b'
      : selected
        ? '#2563eb'
        : stroke;
  const strokeWidth = highlighted || selected || errored ? 3 : 1.6;
  const fillColor = highlighted ? '#fef3c7' : fill;
  const common = {
    fill: fillColor,
    stroke: strokeColor,
    strokeWidth,
  };
  const { x, y, w, h } = shape;

  switch (shape.kind) {
    case 'start':
    case 'end':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} ry={h / 2} {...common} />;

    case 'input':
    case 'output': {
      const skew = 18;
      const points = [
        [x + skew, y],
        [x + w, y],
        [x + w - skew, y + h],
        [x, y + h],
      ]
        .map((p) => p.join(','))
        .join(' ');
      return <polygon points={points} {...common} />;
    }

    case 'assignment':
      return <rect x={x} y={y} width={w} height={h} rx={4} {...common} />;

    case 'call':
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={4} {...common} />
          <line x1={x + 10} y1={y} x2={x + 10} y2={y + h} stroke={strokeColor} strokeWidth={1.4} />
          <line
            x1={x + w - 10}
            y1={y}
            x2={x + w - 10}
            y2={y + h}
            stroke={strokeColor}
            strokeWidth={1.4}
          />
        </g>
      );

    case 'selection':
    case 'loop': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const points = [
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ]
        .map((p) => p.join(','))
        .join(' ');
      return <polygon points={points} {...common} />;
    }
  }
}
