
import React, { useId } from 'react';
import { Roof, PanelConfig } from '../types';

interface RoofVisualizerProps {
  roof: Roof;
  panels: PanelConfig;
  maxDimension?: number;
  bare?: boolean;
  roofName?: string;
}

const RoofVisualizer: React.FC<RoofVisualizerProps> = ({ roof, panels, maxDimension = 400, bare = false, roofName }) => {
  const roofW = roof.width * 1000;
  const roofH = roof.height * 1000;
  const margins = roof.margins || { top: 0, bottom: 0, left: 0, right: 0 };

  if (roofW === 0 || roofH === 0 || !panels.model) {
    const emptyState = (
      <div className="flex items-center justify-center h-full bg-slate-200 rounded-lg" style={{width: `${maxDimension}px`, height: `${maxDimension * 0.75}px`}}>
        <p className="text-slate-500 text-center p-4">Veuillez entrer les dimensions de la toiture.</p>
      </div>
    );
     if(bare) return emptyState;
     return (
        <div className="p-4 bg-white rounded-lg shadow-md flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg font-semibold text-slate-700">Visualisation de la toiture {roofName && <span className="text-orange-500 uppercase font-black"> — {roofName}</span>}</h3>
            {emptyState}
        </div>
     )
  }

  const isPortrait = panels.orientation === 'Portrait';
  const panelW = panels.model.width;
  const panelH = panels.model.height;
  const cols = panels.columns;
  const rows = panels.rows;
  const gap = 20; // 20mm gap

  const fieldW = isPortrait ? cols * panelW + Math.max(0, cols - 1) * gap : cols * panelH + Math.max(0, cols - 1) * gap;
  const fieldH = isPortrait ? rows * panelH + Math.max(0, rows - 1) * gap : rows * panelW + Math.max(0, rows - 1) * gap;
  
  const widthRatio = Math.min(1, maxDimension / roofW);
  const heightRatio = Math.min(1, maxDimension / roofH);
  const scale = Math.min(widthRatio, heightRatio);
  
  const safeAreaW = roofW - margins.left - margins.right;
  const safeAreaH = roofH - margins.top - margins.bottom;

  const widthOverflow = fieldW > safeAreaW;
  const heightOverflow = fieldH > safeAreaH;
  const fits = !widthOverflow && !heightOverflow;

  // Use configuration if available, otherwise assume rectangular grid
  const rowConfig = panels.rowConfiguration || Array(rows).fill(cols);

  return (
    <div className={`flex flex-col items-center justify-center gap-4 w-full ${bare ? '' : 'p-4 bg-white rounded-lg shadow-md'}`}>
      {!bare && (
        <h3 className="text-lg font-semibold text-slate-700">
            Visualisation <span className="text-orange-500 font-black uppercase"> — {roofName || 'Toiture'}</span>
        </h3>
      )}
      <div
        className={`relative bg-orange-200 border-2 ${!fits ? 'border-red-500' : 'border-orange-400'} ${!bare && !fits ? 'animate-pulse' : ''}`}
        style={{ width: roofW * scale, height: roofH * scale }}
      >
        {/* Safe Area Container */}
        <div
          className="absolute"
          style={{
            top: margins.top * scale,
            left: margins.left * scale,
            width: safeAreaW > 0 ? safeAreaW * scale : 0,
            height: safeAreaH > 0 ? safeAreaH * scale : 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center', // Center field vertically in safe area
            alignItems: 'center', // Center rows horizontally
            gap: gap * scale
          }}
        >
            {/* Rows iteration */}
            {rowConfig.map((colCount, rowIndex) => {
                // If the row index exceeds the configured rows (can happen during live updates), don't render
                if (rowIndex >= rows) return null;

                const pW = (isPortrait ? panelW : panelH) * scale;
                const pH = (isPortrait ? panelH : panelW) * scale;

                return (
                    <div key={`row-${rowIndex}`} style={{ display: 'flex', gap: gap * scale }}>
                        {Array.from({ length: colCount }).map((_, colIndex) => {
                             // Too small to render details
                            if (pW < 8 || pH < 8) {
                                return (
                                    <div
                                        key={`p-${rowIndex}-${colIndex}`}
                                        className="bg-slate-800 border border-slate-600/50"
                                        style={{ width: pW, height: pH }}
                                    ></div>
                                );
                            }

                            const numCells = isPortrait ? 6 : 10;
                            const lastCellIndex = numCells - 1;

                            return (
                                <div
                                    key={`p-${rowIndex}-${colIndex}`}
                                    className="relative bg-slate-900 flex shadow-sm"
                                    style={{
                                    width: pW,
                                    height: pH,
                                    border: '1px solid #94a3b8',
                                    flexDirection: isPortrait ? 'column' : 'row',
                                    padding: '1px',
                                    }}
                                >
                                    <div className="flex-1 flex w-full h-full bg-[#172033]" style={{ flexDirection: isPortrait ? 'column' : 'row' }}>
                                        {Array.from({ length: numCells }).map((_, j) => (
                                        <div 
                                            key={j} 
                                            className="flex-1 border-slate-600/50" 
                                            style={{
                                            [isPortrait ? 'borderBottom' : 'borderRight']: j < lastCellIndex ? '1px solid' : 'none'
                                            }}
                                        />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        
        {/* Margin Labels */}
         <div className="absolute text-center text-xs text-slate-600 font-mono" style={{ left: 0, right: 0, top: (margins.top * scale) / 2 - 8 }}>
            {margins.top}
        </div>
        <div className="absolute text-center text-xs text-slate-600 font-mono" style={{ left: 0, right: 0, bottom: (margins.bottom * scale) / 2 - 8 }}>
            {margins.bottom}
        </div>
        <div className="absolute top-0 bottom-0 flex items-center text-xs text-slate-600 -rotate-90 whitespace-nowrap font-mono" style={{ left: (margins.left * scale) / 2 - 25, transformOrigin: 'center' }}>
            <span>{margins.left}</span>
        </div>
        <div className="absolute top-0 bottom-0 flex items-center text-xs text-slate-600 rotate-90 whitespace-nowrap font-mono" style={{ right: (margins.right * scale) / 2 - 25, transformOrigin: 'center' }}>
            <span>{margins.right}</span>
        </div>

        {/* Roof Dimensions */}
        <div className={`absolute -top-6 left-0 w-full text-center text-sm font-medium ${widthOverflow ? 'text-red-600' : 'text-slate-600'}`}>
            {roof.width.toFixed(2)} m
        </div>
        <div className={`absolute top-0 -left-12 h-full flex items-center text-sm font-medium -rotate-90 ${heightOverflow ? 'text-red-600' : 'text-slate-600'}`}>
             {roof.height.toFixed(2)} m
        </div>

        {/* Dashed line for safe area */}
         <div 
            className="absolute border border-dashed border-slate-600/40 pointer-events-none"
            style={{
                top: margins.top * scale,
                left: margins.left * scale,
                width: safeAreaW > 0 ? safeAreaW * scale : 0,
                height: safeAreaH > 0 ? safeAreaH * scale : 0,
            }}
        />
      </div>
       <div className={`text-center text-sm text-slate-600 w-full ${bare ? 'max-w-full' : 'max-w-md'}`}>
        <p>Dimensions du champ PV : <span className="font-bold">{(fieldW / 1000).toFixed(2)}m</span> x <span className="font-bold">{(fieldH / 1000).toFixed(2)}m</span></p>
        {!fits && (
            <div className={`mt-3 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-left ${bare ? 'text-xs' : ''}`} role="alert">
                <p className="font-bold">Le champ de panneaux est trop grand !</p>
                <ul className="list-disc list-inside mt-1 text-xs">
                    {widthOverflow && <li>La <strong>largeur</strong> dépasse de {((fieldW - safeAreaW)/1000).toFixed(2)} m.</li>}
                    {heightOverflow && <li>La <strong>hauteur</strong> dépasse de {((fieldH - safeAreaH)/1000).toFixed(2)} m.</li>}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
};

export default RoofVisualizer;
