import re, pathlib
p=pathlib.Path('/mnt/data/work_step14/components/CalculationAudit.tsx')
txt=p.read_text(encoding='utf-8')
if '2. Liaison DC (Liaison coffret)' in txt or 'Liaison DC (Panneaux' in txt:
    print('already'); exit()

insert = '''

          {/* 1B. Liaison DC (câbles PV -> coffret DC / onduleur) */}
          {!isMicroSystem && stringsAnalysis.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">1B. Liaison DC (Panneaux → coffret DC / onduleur)</h4>
                <span className="px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">\u0394U DC (info)</span>
              </div>
              <div className="p-4 text-[12px] text-slate-700">
                <p className="text-[11px] text-slate-600 mb-3">
                  Renseigne la longueur et la section de la liaison DC pour chaque MPPT utilisé (liaison aller+retour = 2×L).\n
                  \n\nCalcul simplifié : <span className="font-mono">\u0394U = (2 × L × I × \u03c1) / S</span> avec <span className="font-mono">\u03c1 = 0,023 \u03a9·mm²/m</span>.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-2 text-left">MPPT</th>
                        <th className="py-2 px-2 text-right">L (m)</th>
                        <th className="py-2 px-2 text-right">S (mm²)</th>
                        <th className="py-2 px-2 text-right">I (A)</th>
                        <th className="py-2 px-2 text-right">\u0394U (V)</th>
                        <th className="py-2 px-2 text-right">\u0394U (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stringsAnalysis.map((mppt) => {
                        const run = project.inverterConfig.dcCablingRuns?.find(r => r.mpptIndex === mppt.mpptIndex);
                        const L = run?.lengthM ?? 0;
                        const S = run?.sectionMm2 ?? 0;
                        const I = mppt.iscCalculation; // Isc corrigé (sécurité)
                        const rho = 0.023;
                        const dropV = (L > 0 && S > 0) ? (2 * L * I * rho) / S : 0;
                        const baseV = mppt.vmpHot || 0;
                        const dropPct = (baseV > 0) ? (dropV / baseV) * 100 : 0;
                        const missing = L <= 0 || S <= 0;
                        const warn = !missing && dropPct > 3;
                        const ok = !missing && dropPct <= 3;
                        return (
                          <tr key={mppt.mpptIndex} className="border-b border-slate-100">
                            <td className="py-2 px-2 font-bold">MPPT {mppt.mpptIndex}</td>
                            <td className="py-2 px-2 text-right">{L || '—'}</td>
                            <td className="py-2 px-2 text-right">{S ? `${S}` : '—'}</td>
                            <td className="py-2 px-2 text-right">{I.toFixed(1)}</td>
                            <td className="py-2 px-2 text-right">{missing ? '—' : dropV.toFixed(1)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${missing ? 'text-orange-600' : (warn ? 'text-red-600' : 'text-green-600')}`}>{missing ? 'À renseigner' : `${dropPct.toFixed(2)} %`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-slate-500 mt-2">
                  Recommandation de conception en PV : viser \u2264 1% (pertes). Limite générale souvent utilisée en AC : 3% (réseau privé).\n
                  \n\nÀ valider selon contexte (longueur, sections, exigences du client et prescriptions fabricant).
                </p>
              </div>
            </div>
          )}
'''

# insert before MPPT detailed comment
marker = "          {/* Affichage DÉTAILLÉ des MPPT */}"
idx = txt.find(marker)
if idx==-1:
    raise SystemExit('marker not found')
new = txt[:idx] + insert + txt[idx:]
p.write_text(new, encoding='utf-8')
print('patched')
