import re, pathlib
p=pathlib.Path('/mnt/data/work_step14/App.tsx')
txt=p.read_text(encoding='utf-8')
if 'Câblage DC (m)' in txt:
    print('already present');
    exit(0)

block = '''

                            {!isMicroSystem && project.inverterConfig.configuredStrings && project.inverterConfig.configuredStrings.length > 0 && (
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-1 mb-1">
                                        <Tooltip
                                            content={
                                                <div className="text-left leading-snug">
                                                    <b>Câblage DC (m)</b>
                                                    <div className="mt-1">
                                                        Longueur aller simple entre le <b>générateur PV (chaîne/MPPT)</b> et le <b>coffret DC / onduleur</b>.
                                                        Utilisée pour estimer la chute de tension DC par MPPT.
                                                    </div>
                                                </div>
                                            }
                                            position="top"
                                        >
                                            <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                Câblage DC (m)
                                                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 text-[10px] leading-none">?</span>
                                            </span>
                                        </Tooltip>
                                    </div>

                                    <div className="space-y-2">
                                        {Array.from(new Set(project.inverterConfig.configuredStrings.map(s => s.mpptIndex))).sort((a,b) => a-b).map((mppt) => {
                                            const run = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mppt) || { mpptIndex: mppt, lengthM: 10, sectionMm2: 4 };
                                            const updateRun = (patch: any) => {
                                                setProject(prev => {
                                                    const runs = [...(prev.inverterConfig.dcCablingRuns || [])];
                                                    const idx = runs.findIndex(r => r.mpptIndex === mppt);
                                                    const next = { ...run, ...patch, mpptIndex: mppt };
                                                    if (idx >= 0) runs[idx] = next; else runs.push(next);
                                                    return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: runs } };
                                                });
                                            };

                                            return (
                                                <div key={mppt} className="flex items-center gap-2">
                                                    <div className="w-16 text-[10px] font-black text-slate-600">MPPT {mppt}</div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="number"
                                                            value={run.lengthM}
                                                            onChange={(e) => updateRun({ lengthM: parseFloat(e.target.value) || 0 })}
                                                            className="w-full p-1 rounded-md border border-slate-200 bg-white text-[12px] font-black text-purple-700 outline-none"
                                                            min="0"
                                                        />
                                                        <div className="text-[8px] text-slate-400 font-bold italic mt-1">Générateur PV → coffret DC / onduleur</div>
                                                    </div>
                                                    <select
                                                        value={run.sectionMm2}
                                                        onChange={(e) => updateRun({ sectionMm2: parseFloat(e.target.value) || 4 })}
                                                        className="w-24 p-1 rounded-md border border-slate-200 bg-white text-[12px] font-black text-slate-700"
                                                    >
                                                        {[2.5,4,6,10].map(v => (
                                                            <option key={v} value={v}>{v} mm²</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
'''

# insert after AC cablage block end (after its closing </div>)
marker = r"</div>\n\s*</div>\n\s*</div>\n\s*\)\}\n\s*</div>"
# The marker is too broad; instead find the AC cablage block end specifically: the italic line "Coffret AC → point de raccordement" then close divs.
pattern = r"Coffret AC → point de raccordement\n\s*</div>\n\s*</div>"

m = re.search(pattern, txt)
if not m:
    raise SystemExit('pattern not found for insertion')

insert_pos = m.end()
new_txt = txt[:insert_pos] + block + txt[insert_pos:]

p.write_text(new_txt, encoding='utf-8')
print('inserted DC cablage UI')
