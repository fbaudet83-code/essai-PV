import re, pathlib
root=pathlib.Path('/mnt/data/work_step14')

def write(path, text):
    p=root/path
    p.write_text(text, encoding='utf-8')

def read(path):
    return (root/path).read_text(encoding='utf-8')

def apply(path, fn):
    txt=read(path)
    new=fn(txt)
    if new!=txt:
        write(path,new)
        print('updated',path)
    else:
        print('nochange',path)

# --- types.ts ---

def patch_types(txt:str)->str:
    if 'DcCablingRun' not in txt:
        # insert interface after MicroBranchConfig or near other interfaces
        ins = '\nexport interface DcCablingRun {\n  mpptIndex: number;\n  /** Longueur aller (m) entre chaîne PV (MPPT) et coffret DC / onduleur. */\n  lengthM: number;\n  /** Section conducteur (mm²) */\n  sectionMm2: number;\n}\n'
        # place after MicroBranchConfig interface (which ends around line with '}\n\nexport interface')
        m=re.search(r'export interface MicroBranchConfig\s*\{[\s\S]*?\}\n', txt)
        if m:
            pos=m.end()
            txt = txt[:pos] + ins + txt[pos:]
        else:
            txt += ins
    # add to InverterConfig
    if 'dcCablingRuns' not in txt:
        txt = re.sub(r'(export interface InverterConfig\s*\{[\s\S]*?)(\n\})', r"\1\n  /** Paramètres de liaison DC par MPPT (onduleur centralisé) */\n  dcCablingRuns?: DcCablingRun[];\2", txt, count=1)
    return txt

apply('types.ts', patch_types)

# --- App.tsx ---

def patch_app(txt:str)->str:
    # ensure inverterConfig default includes dcCablingRuns
    if 'dcCablingRuns' not in txt:
        txt = txt.replace("mpptCount: undefined,", "mpptCount: undefined,\n    dcCablingRuns: [],")

    # add UI block near Câblage AC
    marker = "<label className=\"text-[11px] font-black text-slate-700\">\n                                                <b>Câblage AC (m)</b>"
    if marker in txt and 'Câblage DC (m)' not in txt:
        insert_block = r'''

                                        {/* --- LIAISON DC (CENTRAL) : longueur + section par MPPT --- */}
                                        {project.inverterConfig.type === 'central' && (project.inverterConfig.configuredStrings?.length || 0) > 0 && (
                                          <div className="mt-3 p-2 rounded-xl border border-slate-200 bg-white">
                                            <div className="flex items-center justify-between">
                                              <div className="text-[11px] font-black text-slate-700">Câblage DC (par MPPT)</div>
                                              <div className="text-[10px] text-slate-500">Panneaux → coffret DC / onduleur</div>
                                            </div>
                                            <div className="mt-2 space-y-2">
                                              {Array.from(new Set((project.inverterConfig.configuredStrings || []).map(s => s.mpptIndex))).sort((a,b)=>a-b).map((mpptIndex) => {
                                                const run = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mpptIndex) || { mpptIndex, lengthM: 0, sectionMm2: 4 };
                                                return (
                                                  <div key={mpptIndex} className="grid grid-cols-[70px_1fr_90px] gap-2 items-center">
                                                    <div className="text-[10px] font-black text-slate-600">MPPT {mpptIndex}</div>
                                                    <div className="flex items-center gap-2">
                                                      <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={run.lengthM}
                                                        onChange={(e) => {
                                                          const v = Number(e.target.value || 0);
                                                          setProject(p => ({
                                                            ...p,
                                                            inverterConfig: {
                                                              ...p.inverterConfig,
                                                              dcCablingRuns: [
                                                                ...((p.inverterConfig.dcCablingRuns || []).filter(r => r.mpptIndex !== mpptIndex)),
                                                                { ...run, lengthM: v }
                                                              ]
                                                            }
                                                          }));
                                                        }}
                                                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[12px]"
                                                      />
                                                      <span className="text-[10px] text-slate-400">m</span>
                                                    </div>
                                                    <select
                                                      value={run.sectionMm2}
                                                      onChange={(e) => {
                                                        const s = Number(e.target.value);
                                                        setProject(p => ({
                                                          ...p,
                                                          inverterConfig: {
                                                            ...p.inverterConfig,
                                                            dcCablingRuns: [
                                                              ...((p.inverterConfig.dcCablingRuns || []).filter(r => r.mpptIndex !== mpptIndex)),
                                                              { ...run, sectionMm2: s }
                                                            ]
                                                          }
                                                        }));
                                                      }}
                                                      className="border border-slate-200 rounded-lg px-2 py-1 text-[12px]"
                                                    >
                                                      {[2.5,4,6,10].map(v => <option key={v} value={v}>{v} mm²</option>)}
                                                    </select>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            <div className="mt-2 text-[10px] text-slate-500">
                                              Longueur aller par MPPT (la formule utilise 2×L pour aller/retour). À renseigner pour documenter le dossier Consuel.
                                            </div>
                                          </div>
                                        )}
'''
        txt = txt.replace(marker, insert_block + "\n" + marker)

    return txt

apply('App.tsx', patch_app)

# --- CalculationAudit.tsx ---

def patch_audit(txt:str)->str:
    if 'Liaison DC (chute de tension)' in txt:
        return txt
    # Insert a new section after DC currents/voltage blocks, before "VALIDATION MATÉRIEL" table
    hook = "<h2 className=\"text-sm font-black text-slate-700 uppercase tracking-widest mb-2\">Validation matériel de protection DC</h2>"
    if hook in txt:
        block = r'''

              {project.inverterConfig.type === 'central' && stringsAnalysis.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Liaison DC (chute de tension)</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Longueur entre les chaînes PV (MPPT) et le coffret DC / l'onduleur. Objectif de conception souvent visé ≤ 1% ; au-delà de 3% il est recommandé d'augmenter la section ou de réduire la longueur.
                  </p>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">MPPT</th>
                          <th className="p-2 text-right">Vmp été (V)</th>
                          <th className="p-2 text-right">I calc (A)</th>
                          <th className="p-2 text-right">L (m)</th>
                          <th className="p-2 text-right">S (mm²)</th>
                          <th className="p-2 text-right">ΔU (V)</th>
                          <th className="p-2 text-right">ΔU (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stringsAnalysis.map((s, idx) => {
                          const run = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === s.mpptIndex) || { mpptIndex: s.mpptIndex, lengthM: 0, sectionMm2: 4 };
                          const rho = 0.023;
                          const L = Number(run.lengthM || 0);
                          const I = Number(s.iscCalculation || 0);
                          const S = Number(run.sectionMm2 || 4);
                          const V = Number(s.vmpHot || 0) || 1;
                          const du = (2 * L * I * rho) / (S || 1);
                          const dup = (du / V) * 100;
                          const color = dup > 3 ? 'text-red-600' : (dup > 1 ? 'text-orange-600' : 'text-green-600');
                          return (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="p-2 font-bold">MPPT {s.mpptIndex}</td>
                              <td className="p-2 text-right">{(s.vmpHot || 0).toFixed(1)}</td>
                              <td className="p-2 text-right">{(s.iscCalculation || 0).toFixed(2)}</td>
                              <td className="p-2 text-right">{L}</td>
                              <td className="p-2 text-right">{S}</td>
                              <td className="p-2 text-right">{du.toFixed(2)}</td>
                              <td className={`p-2 text-right font-black ${color}`}>{dup.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-500">
                    Formule: ΔU = (2 × L × I × ρ) / S ; ΔU(%) = ΔU / Vmp_été × 100
                  </div>
                </div>
              )}
'''
        txt = txt.replace(hook, block + "\n" + hook)
    return txt

apply('components/CalculationAudit.tsx', patch_audit)

# --- PdfReport.tsx ---

def patch_pdf(txt:str)->str:
    if 'Liaison DC (chute de tension)' in txt:
        return txt
    # insert after MPPT distribution section ("Répartition détaillée des chaînes") and before Validation matériel
    hook = "<section className=\"mb-6\">\n            <h3 className=\"text-[10px] font-black text-slate-800 uppercase mb-3 tracking-tight\">Validation Matériel de protection DC</h3>"
    if hook in txt:
        block = r'''

        {project.inverterConfig.type === 'central' && stringsAnalysis.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] font-black text-slate-800 uppercase mb-3 tracking-tight border-b pb-1">Liaison DC (chute de tension)</h3>
          <p className="text-[8px] text-slate-500 mb-3">Longueur entre chaînes PV (MPPT) et coffret DC / onduleur. Objectif souvent visé ≤ 1% ; au-delà de 3% il est recommandé d'augmenter la section ou de réduire la longueur.</p>

          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-400 font-black uppercase">
                <tr>
                  <th className="p-3 text-left">MPPT</th>
                  <th className="p-3 text-right">Vmp été (V)</th>
                  <th className="p-3 text-right">I calc (A)</th>
                  <th className="p-3 text-right">L (m)</th>
                  <th className="p-3 text-right">S (mm²)</th>
                  <th className="p-3 text-right">ΔU (V)</th>
                  <th className="p-3 text-right">ΔU (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stringsAnalysis.map((s, idx2) => {
                  const run = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === s.mpptIndex) || { mpptIndex: s.mpptIndex, lengthM: 0, sectionMm2: 4 };
                  const rho = 0.023;
                  const L = Number(run.lengthM || 0);
                  const I = Number(s.iscCalculation || 0);
                  const S = Number(run.sectionMm2 || 4);
                  const V = Number(s.vmpHot || 0) || 1;
                  const du = (2 * L * I * rho) / (S || 1);
                  const dup = (du / V) * 100;
                  const color = dup > 3 ? 'text-red-600' : (dup > 1 ? 'text-orange-600' : 'text-green-600');
                  return (
                    <tr key={idx2}>
                      <td className="p-3 font-bold">MPPT {s.mpptIndex}</td>
                      <td className="p-3 text-right">{(s.vmpHot || 0).toFixed(1)}</td>
                      <td className="p-3 text-right">{(s.iscCalculation || 0).toFixed(2)}</td>
                      <td className="p-3 text-right">{L}</td>
                      <td className="p-3 text-right">{S}</td>
                      <td className="p-3 text-right">{du.toFixed(2)}</td>
                      <td className={`p-3 text-right font-black ${color}`}>{dup.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 font-mono text-[6.5px] text-slate-400">
            ΔU = (2 × L × I × ρ) / S ; ΔU(%) = ΔU / Vmp_été × 100
          </div>
        </section>
        )}
'''
        txt = txt.replace(hook, block + "\n" + hook)
    return txt

apply('components/PdfReport.tsx', patch_pdf)

