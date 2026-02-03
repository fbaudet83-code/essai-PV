
import React from 'react';
import { WindZone } from '../types';

interface WindZoneMapProps {
    currentZone: WindZone;
    onSelectZone: (zone: WindZone) => void;
}

const ZONE_DATA: { [key in Exclude<WindZone, WindZone.ZONE_5>]: { path: string; color: string; stroke: string } } = {
    [WindZone.ZONE_4]: {
        path: "M282 485 L322 494 L358 488 L390 470 L418 454 L422 426 L394 416 L360 428 L324 442 L294 466 L282 485 Z M448 504 L440 534 L462 548 L478 526 L466 504 L448 504 Z",
        color: 'fill-red-400',
        stroke: 'stroke-red-600'
    },
    [WindZone.ZONE_3]: {
        path: "M100 280 L76 312 L84 360 L114 410 L154 444 L200 462 L246 470 L282 485 L294 466 L268 448 L232 432 L198 402 L172 358 L178 308 L196 268 L164 242 L128 238 L100 280 Z M128 238 L164 242 L196 214 L232 184 L282 174 L320 182 L356 162 L392 142 L428 154 L448 180 L428 208 L394 218 L360 204 L332 216 L292 194 L260 204 L230 224 L196 214 L164 242 L128 238 Z",
        color: 'fill-orange-400',
        stroke: 'stroke-orange-600'
    },
    [WindZone.ZONE_2]: {
        path: "M260 204 L292 194 L332 216 L360 204 L394 218 L428 208 L448 180 L428 154 L392 142 L356 162 L320 182 L282 174 L232 184 L196 214 L230 224 L260 204 Z M164 242 L196 268 L178 308 L172 358 L198 402 L232 432 L268 448 L294 466 L324 442 L360 428 L394 416 L422 426 L418 454 L390 470 L358 488 L322 494 L282 485 L246 470 L200 462 L154 444 L114 410 L84 360 L76 312 L100 280 L128 238 L164 242 L196 214 M276 276 L304 268 L336 286 L338 318 L374 344 L362 368 L328 378 L288 394 L282 336 L258 312 L276 276 Z",
        color: 'fill-orange-200',
        stroke: 'stroke-orange-400'
    },
    [WindZone.ZONE_1]: {
        path: "M276 276 L304 268 L336 286 L338 318 L374 344 L362 368 L328 378 L288 394 L282 336 L258 312 L276 276 Z",
        color: 'fill-yellow-200',
        stroke: 'stroke-yellow-400'
    },
};

const CITIES = [
    { name: 'Lille', x: 304, y: 120 },
    { name: 'Roubaix', x: 310, y: 115 },
    { name: 'Paris', x: 298, y: 236 },
    { name: 'Strasbourg', x: 440, y: 250 },
    { name: 'Orléans', x: 280, y: 296 },
    { name: 'Angers', x: 204, y: 310 },
    { name: 'Nantes', x: 164, y: 324 },
    { name: 'Brest', x: 90, y: 260 },
    { name: 'Langres', x: 384, y: 298 },
    { name: 'Bourges', x: 298, y: 344 },
    { name: 'Lyon', x: 372, y: 384 },
    { name: 'Bordeaux', x: 200, y: 418 },
    { name: 'Toulouse', x: 252, y: 450 },
    { name: 'Millau', x: 318, y: 432 },
    { name: 'Marseille', x: 392, y: 458 },
];

const WindZoneMap: React.FC<WindZoneMapProps> = ({ currentZone, onSelectZone }) => {

    const ZonePath = ({ zone }: { zone: WindZone }) => {
        if (zone === WindZone.ZONE_5) return null; // Do not render Zone 5
        const { path, color, stroke } = ZONE_DATA[zone];
        const isSelected = currentZone === zone;
        return (
            <path
                d={path}
                className={`${color} ${stroke} cursor-pointer transition-all duration-200 hover:opacity-80`}
                strokeWidth={isSelected ? 1.5 : 0.5}
                onClick={() => onSelectZone(zone)}
                style={{ vectorEffect: 'non-scaling-stroke' }}
                fillRule="evenodd"
            />
        );
    };

    return (
        <div className="border rounded-lg p-2 bg-slate-50">
            <svg viewBox="0 0 550 560" className="w-full h-auto">
                <g>
                    {/* Render zones in reverse order for correct layering of strokes */}
                    <ZonePath zone={WindZone.ZONE_1} />
                    <ZonePath zone={WindZone.ZONE_2} />
                    <ZonePath zone={WindZone.ZONE_3} />
                    <ZonePath zone={WindZone.ZONE_4} />
                </g>
                <g>
                    {CITIES.map(city => (
                        <g key={city.name} className="pointer-events-none">
                            <circle cx={city.x} cy={city.y} r="2.5" fill="black" stroke="white" strokeWidth="0.5" />
                            <text x={city.x + 6} y={city.y + 4} fontSize="12px" fill="#2d3748" className="font-sans font-medium" style={{textShadow: '0 0 2px white'}}>{city.name}</text>
                        </g>
                    ))}
                </g>
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 px-1">
                 {Object.entries(ZONE_DATA).map(([zoneKey, data]) => {
                    const zone = zoneKey as WindZone;
                    // Fix for legend label to display correctly
                    const label = `Zone ${zone.split('_')[1]}`;
                    return (
                        <div key={zone} className="flex items-center gap-2 text-xs">
                            <div className={`w-3 h-3 rounded-full ${data.color} border ${data.stroke.replace('stroke', 'border')}`}></div>
                            <span>{label}</span>
                        </div>
                    );
                 })}
            </div>
        </div>
    );
};

export default WindZoneMap;
