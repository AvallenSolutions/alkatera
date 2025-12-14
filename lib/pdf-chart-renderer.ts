import jsPDF from 'jspdf';

export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

export interface BarChartItem {
  name: string;
  value: number;
  color: string;
  maxValue?: number;
}

const PASSPORT_COLORS = {
  stone50: '#FAFAF9',
  stone100: '#F5F5F4',
  stone200: '#E7E5E4',
  stone300: '#D6D3D1',
  stone400: '#A8A29E',
  stone500: '#78716C',
  stone600: '#57534E',
  stone700: '#44403C',
  stone800: '#292524',
  stone900: '#1C1917',
  brandAccent: '#CCFF00',
  lime400: '#A3E635',
  lime500: '#84CC16',
  lime600: '#65A30D',
  lime700: '#4D7C0F',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  orange400: '#FB923C',
  orange500: '#F97316',
  emerald400: '#34D399',
  emerald500: '#10B981',
  green400: '#4ADE80',
  green500: '#22C55E',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  red400: '#F87171',
  red500: '#EF4444',
};

export function drawDonutChart(
  doc: jsPDF,
  data: ChartDataItem[],
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number
): void {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    doc.setFillColor(item.color);

    const segments = Math.ceil(sliceAngle / 0.1);
    const angleStep = sliceAngle / segments;

    for (let i = 0; i < segments; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep;

      const x1 = centerX + Math.cos(a1) * outerRadius;
      const y1 = centerY + Math.sin(a1) * outerRadius;
      const x2 = centerX + Math.cos(a2) * outerRadius;
      const y2 = centerY + Math.sin(a2) * outerRadius;
      const x3 = centerX + Math.cos(a2) * innerRadius;
      const y3 = centerY + Math.sin(a2) * innerRadius;
      const x4 = centerX + Math.cos(a1) * innerRadius;
      const y4 = centerY + Math.sin(a1) * innerRadius;

      doc.setFillColor(item.color);
      const points: [number, number][] = [
        [x1, y1],
        [x2, y2],
        [x3, y3],
        [x4, y4],
      ];
      doc.triangle(
        points[0][0], points[0][1],
        points[1][0], points[1][1],
        points[2][0], points[2][1],
        'F'
      );
      doc.triangle(
        points[0][0], points[0][1],
        points[2][0], points[2][1],
        points[3][0], points[3][1],
        'F'
      );
    }

    startAngle = endAngle;
  });

  doc.setFillColor(PASSPORT_COLORS.stone900);
  const innerSegments = 60;
  for (let i = 0; i < innerSegments; i++) {
    const a1 = (i / innerSegments) * 2 * Math.PI;
    const a2 = ((i + 1) / innerSegments) * 2 * Math.PI;
    const x1 = centerX + Math.cos(a1) * innerRadius;
    const y1 = centerY + Math.sin(a1) * innerRadius;
    const x2 = centerX + Math.cos(a2) * innerRadius;
    const y2 = centerY + Math.sin(a2) * innerRadius;
    doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
  }
}

export function drawPieChart(
  doc: jsPDF,
  data: ChartDataItem[],
  centerX: number,
  centerY: number,
  radius: number
): void {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    const segments = Math.ceil(sliceAngle / 0.1);
    const angleStep = sliceAngle / segments;

    for (let i = 0; i < segments; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep;

      const x1 = centerX + Math.cos(a1) * radius;
      const y1 = centerY + Math.sin(a1) * radius;
      const x2 = centerX + Math.cos(a2) * radius;
      const y2 = centerY + Math.sin(a2) * radius;

      doc.setFillColor(item.color);
      doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
    }

    startAngle = endAngle;
  });
}

export function drawHorizontalBarChart(
  doc: jsPDF,
  data: BarChartItem[],
  x: number,
  y: number,
  width: number,
  barHeight: number,
  gap: number
): number {
  const maxValue = Math.max(...data.map(item => item.maxValue ?? item.value));
  let currentY = y;

  data.forEach((item) => {
    doc.setFillColor(PASSPORT_COLORS.stone700);
    doc.roundedRect(x, currentY, width, barHeight, 2, 2, 'F');

    const barWidth = maxValue > 0 ? (item.value / maxValue) * width : 0;
    if (barWidth > 0) {
      doc.setFillColor(item.color);
      doc.roundedRect(x, currentY, barWidth, barHeight, 2, 2, 'F');
    }

    currentY += barHeight + gap;
  });

  return currentY;
}

export function drawProgressBar(
  doc: jsPDF,
  value: number,
  maxValue: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  bgColor: string = PASSPORT_COLORS.stone700
): void {
  doc.setFillColor(bgColor);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');

  const fillWidth = maxValue > 0 ? (value / maxValue) * width : 0;
  if (fillWidth > 0) {
    doc.setFillColor(fillColor);
    doc.roundedRect(x, y, Math.min(fillWidth, width), height, height / 2, height / 2, 'F');
  }
}

export function drawChartLegend(
  doc: jsPDF,
  data: ChartDataItem[],
  x: number,
  y: number,
  columns: number = 2,
  itemWidth: number = 80,
  itemHeight: number = 16
): number {
  let currentX = x;
  let currentY = y;
  let col = 0;

  data.forEach((item, index) => {
    doc.setFillColor(item.color);
    doc.roundedRect(currentX, currentY + 2, 8, 8, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(PASSPORT_COLORS.stone400);
    doc.text(item.name.toUpperCase(), currentX + 12, currentY + 8);

    col++;
    if (col >= columns) {
      col = 0;
      currentX = x;
      currentY += itemHeight;
    } else {
      currentX += itemWidth;
    }
  });

  return col > 0 ? currentY + itemHeight : currentY;
}

export function drawGaugeChart(
  doc: jsPDF,
  value: number,
  maxValue: number,
  centerX: number,
  centerY: number,
  radius: number,
  label: string,
  color: string
): void {
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalAngle = endAngle - startAngle;

  doc.setDrawColor(PASSPORT_COLORS.stone700);
  doc.setLineWidth(6);

  const bgSegments = 40;
  for (let i = 0; i < bgSegments; i++) {
    const a1 = startAngle + (i / bgSegments) * totalAngle;
    const a2 = startAngle + ((i + 1) / bgSegments) * totalAngle;
    const x1 = centerX + Math.cos(a1) * radius;
    const y1 = centerY + Math.sin(a1) * radius;
    const x2 = centerX + Math.cos(a2) * radius;
    const y2 = centerY + Math.sin(a2) * radius;
    doc.setDrawColor(PASSPORT_COLORS.stone700);
    doc.line(x1, y1, x2, y2);
  }

  const valueAngle = startAngle + (value / maxValue) * totalAngle;
  const valueSegments = Math.ceil((value / maxValue) * bgSegments);
  for (let i = 0; i < valueSegments; i++) {
    const a1 = startAngle + (i / bgSegments) * totalAngle;
    const a2 = startAngle + ((i + 1) / bgSegments) * totalAngle;
    if (a2 > valueAngle) break;
    const x1 = centerX + Math.cos(a1) * radius;
    const y1 = centerY + Math.sin(a1) * radius;
    const x2 = centerX + Math.cos(a2) * radius;
    const y2 = centerY + Math.sin(a2) * radius;
    doc.setDrawColor(color);
    doc.line(x1, y1, x2, y2);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(color);
  doc.text(`${Math.round(value)}%`, centerX, centerY + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(PASSPORT_COLORS.stone400);
  doc.text(label.toUpperCase(), centerX, centerY + radius + 8, { align: 'center' });
}

export function drawScopeBreakdownBars(
  doc: jsPDF,
  scope1: number,
  scope2: number,
  scope3: number,
  x: number,
  y: number,
  width: number
): number {
  const total = scope1 + scope2 + scope3;
  const barHeight = 8;
  const labelWidth = 55;
  const valueWidth = 50;
  const barWidth = width - labelWidth - valueWidth - 10;

  const scopes = [
    { label: 'Scope 1 (Direct)', value: scope1, color: '#EF4444' },
    { label: 'Scope 2 (Energy)', value: scope2, color: '#F97316' },
    { label: 'Scope 3 (Value Chain)', value: scope3, color: '#FBBF24' },
  ];

  let currentY = y;

  scopes.forEach((scope) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(PASSPORT_COLORS.stone400);
    doc.text(scope.label, x, currentY + 6);

    const barX = x + labelWidth;
    drawProgressBar(
      doc,
      scope.value,
      total,
      barX,
      currentY,
      barWidth,
      barHeight,
      scope.color,
      PASSPORT_COLORS.stone700
    );

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#FFFFFF');
    const percentage = total > 0 ? ((scope.value / total) * 100).toFixed(1) : '0.0';
    doc.text(`${percentage}%`, x + width - 5, currentY + 6, { align: 'right' });

    currentY += barHeight + 8;
  });

  return currentY;
}

export { PASSPORT_COLORS };
