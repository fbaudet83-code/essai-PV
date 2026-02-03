
import React from 'react';
import { Project, Material, InverterBrand } from '../types';

interface ElectricalSchematicProps {
  project: Project;
  materials: Material[];
}

const ElectricalSchematic: React.FC<ElectricalSchematicProps> = ({ project, materials }) => {
  const isMicro = project.inverterConfig.brand === InverterBrand.ENPHASE || 
                  project.inverterConfig.brand === InverterBrand.APSYSTEMS || 
                  (project.inverterConfig.brand === InverterBrand.FOXESS && project.inverterConfig.model?.includes('MICRO'));
  
  const isFoxHybrid = project.inverterConfig.brand === InverterBrand.FOXESS && (
    project.inverterConfig.model?.includes('H1') || 
    project.inverterConfig.model?.includes('H3') || 
    project.inverterConfig.model?.includes('KH') || 
    project.inverterConfig.model?.includes('P3')
  );

  const COLORS = {
    NEUTRAL: "#3b82f6", 
    PHASE: "#ef4444",   
    GROUND: "#16a34a",  
    CABLING: "#1e293b", 
    RJ45: "#f97316",    
    TORE: "#eab308",    
    BG_BOX: "#f8fafc",
    BORDER: "#cbd5e1"
  };

  const Symbols = {
    Linky: (x: number, y: number) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="50" height="70" rx="4" fill="#a3e635" stroke="#4d7c0f" strokeWidth="2" />
        <rect x="10" y="10" width="30" height="20" fill="white" stroke="#4d7c0f" />
        <rect x="15" y="45" width="20" height="15" fill="#3f6212" rx="2" />
        <text x="25" y="25" fontSize="8" textAnchor="middle" fill="#4d7c0f" fontWeight="bold">LINKY</text>
      </g>
    ),
    AGCP: (x: number, y: number) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="40" height="60" rx="2" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
        <line x1="10" y1="15" x2="30" y2="15" stroke="#64748b" />
        <line x1="10" y1="30" x2="30" y2="30" stroke="#64748b" />
        <rect x="15" y="40" width="10" height="10" fill="#ef4444" />
        <text x="20" y="75" fontSize="8" textAnchor="middle" fontWeight="bold">AGCP</text>
      </g>
    ),
    InverterH1: (x: number, y: number, label: string) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="100" height="100" rx="12" fill="white" stroke="#64748b" strokeWidth="2" />
        <path d="M0 70 Q50 80 100 70 L100 100 Q50 110 0 100 Z" fill="#f1f5f9" stroke="#64748b" strokeWidth="2" />
        <circle cx="50" cy="40" r="10" fill="#e2e8f0" />
        <text x="50" y="125" fontSize="11" textAnchor="middle" fontWeight="bold" fill="#1e293b">{label}</text>
      </g>
    ),
    BatteryEP: (x: number, y: number) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="100" height="100" rx="8" fill="#1e293b" stroke="#0f172a" />
        <path d="M50 25 L35 55 L45 55 L40 75 L65 45 L55 45 L60 25 Z" fill="#3b82f6" />
        <text x="50" y="120" fontSize="11" textAnchor="middle" fontWeight="bold" fill="#1e293b">Batterie PV</text>
      </g>
    ),
    Gateway: (x: number, y: number, label: string) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="80" height="50" rx="4" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
        <circle cx="20" cy="25" r="3" fill="#22c55e" />
        <circle cx="40" cy="25" r="3" fill="#22c55e" />
        <circle cx="60" cy="25" r="3" fill="#94a3b8" />
        <text x="40" y="65" fontSize="9" textAnchor="middle" fontWeight="bold" fill="#1e293b">{label}</text>
      </g>
    ),
    CoffretAC: (x: number, y: number, label: string) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="160" height="110" rx="6" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="2" fillOpacity="0.5" />
        <rect x="20" y="30" width="25" height="50" fill="white" stroke="#0ea5e9" />
        <rect x="65" y="30" width="25" height="50" fill="white" stroke="#0ea5e9" />
        <rect x="110" y="30" width="25" height="50" fill="white" stroke="#0ea5e9" />
        <text x="80" y="-10" fontSize="12" textAnchor="middle" fontWeight="black" fill="#0369a1">{label}</text>
      </g>
    ),
    DomesticBoard: (x: number, y: number) => (
      <g transform={`translate(${x}, ${y})`}>
        <rect x="0" y="0" width="80" height="140" rx="2" fill="white" stroke="#64748b" strokeWidth="2" />
        {[20, 50, 80, 110].map(h => (
          <rect key={h} x="10" y={h} width="60" height="10" fill="#e2e8f0" />
        ))}
        <text x="40" y="160" fontSize="11" textAnchor="middle" fontWeight="bold" fill="#1e293b">Tableau électrique</text>
        <text x="40" y="175" fontSize="11" textAnchor="middle" fontWeight="bold" fill="#1e293b">domestique</text>
      </g>
    ),
    Tore: (x: number, y: number) => (
      <g transform={`translate(${x}, ${y})`}>
        <circle cx="0" cy="0" r="10" fill="white" stroke={COLORS.TORE} strokeWidth="3" />
        <text x="15" y="5" fontSize="10" fill={COLORS.TORE} fontWeight="black">Tore</text>
      </g>
    )
  };

  const renderHybridLayout = () => (
    <g transform="translate(50, 50)">
      {/* 1. PANELS */}
      <g transform="translate(0, 50)">
        <rect x="0" y="0" width="100" height="150" fill="#1e293b" rx="4" />
        <rect x="110" y="0" width="100" height="150" fill="#1e293b" rx="4" />
        <text x="105" y="-15" fontSize="14" fontWeight="black" textAnchor="middle" fill="#1e293b">Installation PV</text>
      </g>

      {/* 2. DC BOX */}
      <g transform="translate(40, 250)">
        <rect x="0" y="0" width="120" height="80" fill="white" stroke="#64748b" strokeWidth="2" rx="4" />
        <text x="60" y="100" fontSize="10" textAnchor="middle" fontWeight="bold">Coffret DC</text>
      </g>

      {/* 3. INVERTER */}
      {Symbols.InverterH1(210, 230, `Onduleur ${project.inverterConfig.model || 'Hybride'}`)}

      {/* 4. BATTERY */}
      {project.inverterConfig.hasBattery && Symbols.BatteryEP(210, 420)}

      {/* 5. AC BOX */}
      {Symbols.CoffretAC(450, 230, "Coffret AC Protection")}

      {/* 6. GRID ELEMENTS */}
      {Symbols.Linky(720, 100)}
      {Symbols.AGCP(790, 100)}
      {Symbols.DomesticBoard(500, 480)}

      {/* --- CONNECTIONS --- */}
      {/* DC Link */}
      <path d="M50 200 L50 250" stroke={COLORS.CABLING} strokeWidth="3" fill="none" />
      <path d="M160 290 L210 290" stroke={COLORS.CABLING} strokeWidth="3" fill="none" />

      {/* Battery Link */}
      {project.inverterConfig.hasBattery && (
        <>
            <line x1="260" y1="330" x2="260" y2="420" stroke={COLORS.CABLING} strokeWidth="3" />
            <line x1="240" y1="330" x2="240" y2="420" stroke={COLORS.RJ45} strokeWidth="2" strokeDasharray="3,3" />
        </>
      )}

      {/* AC Link to Box */}
      <path d="M310 280 L450 280" stroke={COLORS.CABLING} strokeWidth="3" fill="none" />

      {/* Box to Board */}
      <path d="M530 340 L530 480" stroke={COLORS.CABLING} strokeWidth="4" fill="none" />

      {/* Grid Path + TORE */}
      <path d="M745 170 L745 250 L610 250" stroke={COLORS.CABLING} strokeWidth="4" fill="none" />
      {Symbols.Tore(745, 210)}
      {/* Comms Tore to Inverter */}
      <path d="M745 210 L745 400 L260 400 L260 330" stroke={COLORS.TORE} strokeWidth="2" strokeDasharray="4,2" fill="none" opacity="0.6" />
      <text x="500" y="395" fontSize="8" fill={COLORS.TORE} fontWeight="bold">Com. Tore (Modbus/CT)</text>
    </g>
  );

  const renderMicroLayout = () => {
    const gatewayName = project.inverterConfig.brand === InverterBrand.ENPHASE ? "Passerelle ENVOY" : 
                       project.inverterConfig.brand === InverterBrand.APSYSTEMS ? "Passerelle ECU" : "Passerelle Com";

    return (
        <g transform="translate(50, 50)">
          {/* 1. PANELS WITH MICROS */}
          <g transform="translate(0, 50)">
            {[0, 1].map(i => (
              <g key={i} transform={`translate(${i * 120}, 0)`}>
                 <rect x="0" y="0" width="100" height="150" fill="#1e293b" rx="4" />
                 <rect x="25" y="160" width="50" height="40" fill="white" stroke="#64748b" rx="4" />
                 <text x="50" y="185" fontSize="8" textAnchor="middle">Micro-inv.</text>
                 <line x1="50" y1="150" x2="50" y2="160" stroke={COLORS.CABLING} strokeWidth="2" />
              </g>
            ))}
          </g>
    
          {/* 2. JUNCTION BOX */}
          <g transform="translate(300, 160)">
            <rect x="0" y="0" width="80" height="60" rx="4" fill="#f8fafc" stroke="#64748b" strokeWidth="2" />
            <text x="40" y="80" fontSize="10" textAnchor="middle" fontWeight="bold">Boîte de jonction</text>
          </g>
    
          {/* 3. AC BOX (Envoy inside or separate) */}
          {Symbols.CoffretAC(450, 140, "Coffret AC Monitoring")}
          
          {/* 4. GATEWAY (Envoy/ECU) */}
          {Symbols.Gateway(490, 270, gatewayName)}
    
          {/* 5. GRID */}
          {Symbols.Linky(720, 50)}
          {Symbols.AGCP(790, 50)}
          {Symbols.DomesticBoard(500, 420)}
    
          {/* --- CONNECTIONS --- */}
          <path d="M120 180 L300 180" stroke={COLORS.CABLING} strokeWidth="3" fill="none" />
          <path d="M380 190 L450 190" stroke={COLORS.CABLING} strokeWidth="3" fill="none" />
          
          {/* AC Box to Domestic Board */}
          <path d="M530 250 L530 420" stroke={COLORS.CABLING} strokeWidth="4" fill="none" />
          
          {/* Grid path + TORE */}
          <path d="M745 120 L745 190 L610 190" stroke={COLORS.CABLING} strokeWidth="4" fill="none" />
          {Symbols.Tore(745, 160)}

          {/* Comms Tore to Gateway */}
          <path d="M745 160 L745 300 L570 300" stroke={COLORS.TORE} strokeWidth="2" strokeDasharray="4,2" fill="none" opacity="0.6" />
          <text x="640" y="315" fontSize="8" fill={COLORS.TORE} fontWeight="bold">Liaison Tore</text>
        </g>
      );
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-white p-4">
      <svg width="100%" height="100%" viewBox="0 0 900 850" xmlns="http://www.w3.org/2000/svg">
        <text x="450" y="30" fontSize="20" fontWeight="black" textAnchor="middle" fill="#1e293b" textDecoration="underline">
          SCHÉMA ÉLECTRIQUE DE PRINCIPE - {isMicro ? "MICRO-ONDULEURS" : "ONDULEUR HYBRIDE"}
        </text>

        {isMicro ? renderMicroLayout() : renderHybridLayout()}

        {/* --- LEGEND --- */}
        <g transform="translate(50, 650)">
          <rect x="0" y="0" width="380" height="130" rx="8" fill="white" stroke={COLORS.BORDER} />
          <text x="20" y="25" fontSize="12" fontWeight="black">Légende</text>
          
          <g transform="translate(20, 45)">
            <line x1="0" y1="0" x2="30" y2="0" stroke={COLORS.NEUTRAL} strokeWidth="2" />
            <text x="40" y="4" fontSize="10">Neutre</text>
          </g>
          <g transform="translate(20, 65)">
            <line x1="0" y1="0" x2="30" y2="0" stroke={COLORS.PHASE} strokeWidth="2" />
            <text x="40" y="4" fontSize="10">Phase</text>
          </g>
          <g transform="translate(20, 85)">
            <line x1="0" y1="0" x2="30" y2="0" stroke={COLORS.GROUND} strokeWidth="2" strokeDasharray="3,3" />
            <text x="40" y="4" fontSize="10">Terre</text>
          </g>
          <g transform="translate(140, 45)">
            <line x1="0" y1="0" x2="30" y2="0" stroke={COLORS.CABLING} strokeWidth="3" />
            <text x="40" y="4" fontSize="10">Puissance AC/DC</text>
          </g>
          <g transform="translate(140, 65)">
            <line x1="0" y1="0" x2="30" y2="0" stroke={COLORS.RJ45} strokeWidth="2" />
            <text x="40" y="4" fontSize="10">RJ45 / Communication</text>
          </g>
          <g transform="translate(140, 85)">
            <circle cx="10" cy="0" r="8" fill="white" stroke={COLORS.TORE} strokeWidth="2" />
            <text x="40" y="4" fontSize="10">Tore de mesure (CT)</text>
          </g>
        </g>

        {/* Warning footer - Moved lower */}
        <g transform="translate(50, 810)">
          <path d="M0 20 L15 -10 L30 20 Z" fill="#facc15" stroke="#854d0e" strokeWidth="2" />
          <text x="15" y="16" textAnchor="middle" fontWeight="bold" fontSize="14">!</text>
          <text x="40" y="5" fontSize="10" fill="#854d0e" fontWeight="bold">Nouvelle norme NFC 15-100</text>
          <text x="40" y="18" fontSize="9" fill="#854d0e">Vérifier le calibrage de l'AGPC et la protection différentielle 30mA Type F/B</text>
        </g>
      </svg>
    </div>
  );
};

export default ElectricalSchematic;
