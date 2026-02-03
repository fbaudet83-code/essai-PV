
import React, { useId } from 'react';
import { Roof, PanelConfig, MountingSystem } from '../types';

interface InstallationDiagramProps {
  roof: Roof;
  panels: PanelConfig;
  system: MountingSystem;
  railOrientation?: 'Horizontal' | 'Vertical'; // Nouvelle prop
}

const InstallationDiagram: React.FC<InstallationDiagramProps> = ({ roof, panels, system, railOrientation }) => {
  // Generate a unique ID for this diagram instance to avoid ID collisions in DOM (especially for PDF export with multiple diagrams)
  const rawId = useId();
  const uid = rawId.replace(/:/g, ''); // Remove colons for safer SVG ID references
  
  const arrowId = `arrow-${uid}`;
  const arrowDetailId = `arrow-detail-${uid}`;
  const hatchId = `hatch-${uid}`;
  const marginHatchId = `margin-hatch-${uid}`;

  // Safety checks
  if (!roof || !panels || !panels.model) {
      return <div className="text-center text-slate-400 text-sm p-10">Données insuffisantes pour le schéma</div>;
  }

  const roofWidthMM = roof.width * 1000;
  const roofHeightMM = roof.height * 1000;
  const margins = roof.margins || { top: 0, bottom: 0, left: 0, right: 0 };

  const isPortrait = panels.orientation === 'Portrait';
  // Use passed orientation or fallback to system default
  const effectiveRailOrientation = railOrientation || system.railOrientation || 'Horizontal';
  const railsVertical = effectiveRailOrientation === 'Vertical';
  
  const panelW = panels.model.width;
  const panelH = panels.model.height;
  const gap = 20; // Inter-panel gap in mm

  // --- Dynamic Scaling Factor ---
  const maxDim = Math.max(roofWidthMM, roofHeightMM);
  const safeMaxDim = maxDim > 0 ? maxDim : 1000;
  const s = safeMaxDim / 100; // Base scale unit (1% of roof)

  const FONT_SIZE_M = Math.max(10, s * 2.0); // Minimum 10px font
  const FONT_SIZE_S = Math.max(8, s * 1.8); // Detail font
  const STROKE_THIN = Math.max(1, s * 0.15);
  
  // Padding around the roof in the SVG
  const padding = s * 15; 
  const viewBoxWidth = roofWidthMM + padding * 2;
  const viewBoxHeight = roofHeightMM + padding * 2;

  const roofX = padding;
  const roofY = padding;

  // Calculate Field Area
  const cols = panels.columns;
  const rows = panels.rows;
  
  const fieldW = isPortrait
    ? cols * panelW + Math.max(0, cols - 1) * gap
    : cols * panelH + Math.max(0, cols - 1) * gap;
  
  const fieldH = isPortrait
    ? rows * panelH + Math.max(0, rows - 1) * gap
    : rows * panelW + Math.max(0, rows - 1) * gap;

  // Centering Field in Safe Area (Roof minus margins)
  const safeX = roofX + margins.left;
  const safeY = roofY + margins.top;
  const safeW = roofWidthMM - margins.left - margins.right;
  const safeH = roofHeightMM - margins.top - margins.bottom;

  // Center of safe area
  const fieldX = safeX + (safeW - fieldW) / 2;
  const fieldY = safeY + (safeH - fieldH) / 2;

  // --- Markers ---
  const defs = (
    <defs>
      <marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
      </marker>
      <marker id={arrowDetailId} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,4 L4,2 z" fill="#059669" />
      </marker>
      <pattern id={hatchId} patternUnits="userSpaceOnUse" width="4" height="4">
        <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#059669" strokeWidth="1" opacity="0.3" />
      </pattern>
       <pattern id={marginHatchId} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#fee2e2" opacity="0.5" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#fca5a5" strokeWidth="2" opacity="0.5" />
      </pattern>
    </defs>
  );

  // Helper to draw dimension lines
  const drawDimension = (x1: number, y1: number, x2: number, y2: number, text: string, offset: number, vertical: boolean, isDetail = false) => {
    const push = isDetail ? s * 1 : s * 3;
    let lx1 = x1, ly1 = y1, lx2 = x2, ly2 = y2;
    let textX = (x1 + x2) / 2;
    let textY = (y1 + y2) / 2;
    
    const color = isDetail ? "#059669" : "#ef4444"; // Green for details, Red for global
    const marker = isDetail ? `url(#${arrowDetailId})` : `url(#${arrowId})`;
    const fontSize = isDetail ? FONT_SIZE_S : FONT_SIZE_M;

    if (vertical) {
        // Vertical dimension (displayed on the side)
        lx1 -= offset; lx2 -= offset;
        textX -= (offset + push);
        
        return (
            <g key={`dim-v-${x1}-${y1}-${x2}-${Math.random()}`}>
                 <line x1={x1} y1={y1} x2={lx1} y2={y1} stroke={color} strokeWidth={STROKE_THIN} opacity="0.3" />
                 <line x1={x2} y1={y2} x2={lx2} y2={y2} stroke={color} strokeWidth={STROKE_THIN} opacity="0.3" />
                 <line x1={lx1} y1={y1} x2={lx2} y2={y2} stroke={color} strokeWidth={STROKE_THIN} markerStart={marker} markerEnd={marker} />
                 <text x={textX} y={textY} fill={color} fontSize={fontSize} textAnchor="end" alignmentBaseline="middle" fontWeight="bold" style={{textShadow: '0px 0px 4px white'}}>{text}</text>
            </g>
        );
    } else {
        // Horizontal dimension
        ly1 -= offset; ly2 -= offset;
        textY -= (offset + push);

        return (
            <g key={`dim-h-${x1}-${y1}-${x2}-${Math.random()}`}>
                 <line x1={x1} y1={y1} x2={x1} y2={ly1} stroke={color} strokeWidth={STROKE_THIN} opacity="0.3" />
                 <line x1={x2} y1={y2} x2={x2} y2={ly2} stroke={color} strokeWidth={STROKE_THIN} opacity="0.3" />
                 <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth={STROKE_THIN} markerStart={marker} markerEnd={marker} />
                 <text x={textX} y={textY} fill={color} fontSize={fontSize} textAnchor="middle" alignmentBaseline="baseline" fontWeight="bold" style={{textShadow: '0px 0px 4px white'}}>{text}</text>
            </g>
        );
    }
  };

  const rails = [];
  const clampZones = [];
  const railColor = system.brand === 'ESDEC' ? '#94a3b8' : '#475569';
  const railWidth = Math.max(2, s * 0.3);

  // Generate Rails
  if (railsVertical) {
      // Rails are vertical (up/down). Usually 2 per panel column.
      for (let c = 0; c < cols; c++) {
          const colLeft = fieldX + c * ((isPortrait ? panelW : panelH) + gap);
          const pWidth = isPortrait ? panelW : panelH;
          // Positions: approx 25% and 75% of panel width
          const r1 = colLeft + pWidth * 0.25;
          const r2 = colLeft + pWidth * 0.75;
          
          rails.push(<line key={`rv-${c}-1`} x1={r1} y1={fieldY} x2={r1} y2={fieldY + fieldH} stroke={railColor} strokeWidth={railWidth} strokeDasharray={`${s},${s}`} />);
          rails.push(<line key={`rv-${c}-2`} x1={r2} y1={fieldY} x2={r2} y2={fieldY + fieldH} stroke={railColor} strokeWidth={railWidth} strokeDasharray={`${s},${s}`} />);
      }
      
      // Visualizing Clamping Zones on the first panel
      const pWidth = isPortrait ? panelW : panelH;
      const zoneStart1 = fieldX + pWidth * 0.15; // 15%
      const zoneWidth = pWidth * 0.20; // 20% width zone
      const zoneStart2 = fieldX + pWidth * 0.65; // 65%
      
      clampZones.push(<rect key="cz-1" x={zoneStart1} y={fieldY} width={zoneWidth} height={isPortrait ? panelH : panelW} fill={`url(#${hatchId})`} stroke="none" />);
      clampZones.push(<rect key="cz-2" x={zoneStart2} y={fieldY} width={zoneWidth} height={isPortrait ? panelH : panelW} fill={`url(#${hatchId})`} stroke="none" />);

  } else {
      // Rails are horizontal. 2 per panel row.
      for (let r = 0; r < rows; r++) {
          const rowTop = fieldY + r * ((isPortrait ? panelH : panelW) + gap);
          const pHeight = isPortrait ? panelH : panelW;
          const r1 = rowTop + pHeight * 0.25;
          const r2 = rowTop + pHeight * 0.75;

          rails.push(<line key={`rh-${r}-1`} x1={fieldX} y1={r1} x2={fieldX + fieldW} y2={r1} stroke={railColor} strokeWidth={railWidth} strokeDasharray={`${s},${s}`} />);
          rails.push(<line key={`rh-${r}-2`} x1={fieldX} y1={r2} x2={fieldX + fieldW} y2={r2} stroke={railColor} strokeWidth={railWidth} strokeDasharray={`${s},${s}`} />);
      }

      // Visualizing Clamping Zones on the first panel
      const pHeight = isPortrait ? panelH : panelW;
      const zoneStart1 = fieldY + pHeight * 0.15;
      const zoneHeight = pHeight * 0.20;
      const zoneStart2 = fieldY + pHeight * 0.65;
      
      clampZones.push(<rect key="cz-1" x={fieldX} y={zoneStart1} width={isPortrait ? panelW : panelH} height={zoneHeight} fill={`url(#${hatchId})`} stroke="none" />);
      clampZones.push(<rect key="cz-2" x={fieldX} y={zoneStart2} width={isPortrait ? panelW : panelH} height={zoneHeight} fill={`url(#${hatchId})`} stroke="none" />);
  }

  // Generate Panels
  const panelRects = [];
  for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
          const pW = isPortrait ? panelW : panelH;
          const pH = isPortrait ? panelH : panelW;
          const x = fieldX + c * (pW + gap);
          const y = fieldY + r * (pH + gap);
          panelRects.push(
              <rect key={`p-${r}-${c}`} x={x} y={y} width={pW} height={pH} fill="#3b82f6" fillOpacity="0.05" stroke="#2563eb" strokeWidth={s*0.1} />
          );
      }
  }
  
  // Detailed rail measurements
  const detailDimensions = [];
  const marginDimensions = [];
  
  if (railsVertical) {
      // Measuring horizontal distances (Vertical Rails)
      const pW = isPortrait ? panelW : panelH;
      // Focus on the first panel column
      const r1 = fieldX + pW * 0.25;
      const r2 = fieldX + pW * 0.75;
      
      // 1. Margins
      if (margins.left > 0) {
          marginDimensions.push(drawDimension(roofX, fieldY + fieldH/2, fieldX, fieldY + fieldH/2, `Marge ${margins.left}`, -s*5, false, false));
      }
      if (margins.right > 0) {
          marginDimensions.push(drawDimension(fieldX + fieldW, fieldY + fieldH/2, roofX + roofWidthMM, fieldY + fieldH/2, `Marge ${margins.right}`, -s*5, false, false));
      }
      
      // 2. Rail Offset (Field Left to R1) - Draw inside first panel, near top
      const measY = fieldY + (isPortrait ? panelH : panelW) * 0.15; 
      detailDimensions.push(drawDimension(fieldX, measY, r1, measY, `${(pW*0.25).toFixed(0)}`, -s*2, false, true));
      
      // 3. Rail Spacing (R1 to R2) - Entraxe
      detailDimensions.push(drawDimension(r1, measY, r2, measY, `Entraxe ${(pW*0.5).toFixed(0)}`, -s*2, false, true));
      
      // 4. Zone Labels
      detailDimensions.push(<text key="txt-zone" x={fieldX + pW*0.15} y={fieldY - s*2} fontSize={FONT_SIZE_S} fill="#059669" fontWeight="bold">Zone de serrage</text>);

  } else {
      // Measuring vertical distances (Horizontal Rails)
      const pH = isPortrait ? panelH : panelW;
      // Focus on first panel row
      const r1 = fieldY + pH * 0.25;
      const r2 = fieldY + pH * 0.75;
      
      // 1. Margins
      if (margins.top > 0) {
          marginDimensions.push(drawDimension(roofX + roofWidthMM/2, roofY, roofX + roofWidthMM/2, fieldY, `Marge ${margins.top}`, -s*8, true, false));
      }
      if (margins.bottom > 0) {
          marginDimensions.push(drawDimension(roofX + roofWidthMM/2, fieldY + fieldH, roofX + roofWidthMM/2, roofY + roofHeightMM, `Marge ${margins.bottom}`, -s*8, true, false));
      }
      
      // 2. Rail Offset (Field Top to R1) - Draw inside first panel, near left
      const measX = fieldX + (isPortrait ? panelW : panelH) * 0.2;
      // Negative offset to push line right (inside panel)
      detailDimensions.push(drawDimension(measX, fieldY, measX, r1, `${(pH*0.25).toFixed(0)}`, -s*3, true, true));
      
      // 3. Rail Spacing (R1 to R2)
      detailDimensions.push(drawDimension(measX, r1, measX, r2, `Entraxe ${(pH*0.5).toFixed(0)}`, -s*3, true, true));
      
      // 4. Zone Labels
      detailDimensions.push(<text key="txt-zone" x={fieldX - s*15} y={fieldY + pH*0.15 + (pH*0.2)/2} fontSize={FONT_SIZE_S} fill="#059669" fontWeight="bold">Zone de serrage</text>);
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
        <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-full max-w-full max-h-full">
            {defs}
            
            {/* Roof */}
            <rect x={roofX} y={roofY} width={roofWidthMM} height={roofHeightMM} fill="#f8fafc" stroke="#64748b" strokeWidth={s * 0.2} />
            
            {/* Highlight "Edge Zones" (Zones de Rive) */}
             { (margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0) && (
                <path d={`
                    M ${roofX},${roofY} 
                    L ${roofX + roofWidthMM},${roofY} 
                    L ${roofX + roofWidthMM},${roofY + roofHeightMM} 
                    L ${roofX},${roofY + roofHeightMM} 
                    Z
                    M ${safeX},${safeY}
                    L ${safeX},${safeY + safeH}
                    L ${safeX + safeW},${safeY + safeH}
                    L ${safeX + safeW},${safeY}
                    Z
                `}
                fill={`url(#${marginHatchId})`}
                fillRule="evenodd"
                />
             )}

            {/* Safe Area (Dashed) */}
            { (margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0) && 
                <rect x={safeX} y={safeY} width={safeW} height={safeH} fill="none" stroke="#ef4444" strokeWidth={s * 0.1} strokeDasharray={`${s},${s}`} opacity="0.4" />
            }

            {/* Panels */}
            {panelRects}

            {/* Clamping Zones (Visual Indicators) */}
            {clampZones}

            {/* Rails */}
            {rails}

            {/* Dimensions - Roof */}
            {drawDimension(roofX, roofY + roofHeightMM, roofX + roofWidthMM, roofY + roofHeightMM, `${(roofWidthMM/1000).toFixed(2)}m`, s * 4, false)}
            {drawDimension(roofX, roofY, roofX, roofY + roofHeightMM, `${(roofHeightMM/1000).toFixed(2)}m`, s * 4, true)}

            {/* Dimensions - Margins */}
            {marginDimensions}

            {/* Dimensions - Field (if exists) */}
            {cols > 0 && rows > 0 && (
                <>
                    {drawDimension(fieldX, fieldY, fieldX + fieldW, fieldY, `Champ PV ${(fieldW/1000).toFixed(2)}m`, -s * 10, false)}
                    {drawDimension(fieldX + fieldW, fieldY, fieldX + fieldW, fieldY + fieldH, `Champ PV ${(fieldH/1000).toFixed(2)}m`, -s * 10, true)}
                </>
            )}
            
            {/* Detailed Dimensions (Green) */}
            {detailDimensions}
        </svg>
    </div>
  );
};

export default InstallationDiagram;
