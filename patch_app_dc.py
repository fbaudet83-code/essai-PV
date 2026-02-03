import re, pathlib
p=pathlib.Path('/mnt/data/work_step14/App.tsx')
txt=p.read_text(encoding='utf-8')
changed=False
if 'dcCablingRuns' not in txt:
    txt2=re.sub(r"configuredStrings: \[\],\n\s*agcpValue: undefined", "configuredStrings: [],\n      dcCablingRuns: [],\n      agcpValue: undefined", txt)
    if txt2!=txt:
        txt=txt2; changed=True

# Insert UI block after AC cablage input block label "Câblage AC (m)" section end.
# We'll locate the closing div after the input and small hint line "Coffret AC ➜ point de raccordement".
marker='Coffret AC ➜ point de raccordement'
if marker in txt and 'Câblage DC (m)' not in txt:
    # find position after the hint line's containing </div></div> (two closes) just after hint.
    idx=txt.index(marker)
    # find end of the small text div line by finding next '</div>' after idx, then next '</div>'
    end1=txt.find('</div>', idx)
    end2=txt.find('</div>', end1+6)
    insert_pos=end2+6
    insert_block="""

                                        {!isMicroSystem && project.inverterConfig.brand !== InverterBrand.NONE && project.inverterConfig.brand !== InverterBrand.ENPHASE && project.inverterConfig.brand !== InverterBrand.APSYSTEMS && (
                                          <div className=\"mt-4\">
                                            <div className=\"flex items-center justify-between\">
                                              <b>Câblage DC par MPPT (m)</b>
                                              <Tooltip text=\"Longueur entre le générateur PV (chaîne associée au MPPT) et le coffret DC / onduleur. À renseigner par MPPT utilisé.\" />
                                            </div>
                                            <div className=\"text-xs text-slate-500 mt-1\">Panneaux ➜ coffret DC / onduleur (par MPPT utilisé)</div>
                                            <div className=\"mt-3 space-y-2\">
                                              {Array.from(new Set((project.inverterConfig.configuredStrings || []).map(s => s.mpptIndex || 1))).sort((a,b)=>a-b).map((mpptIdx) => {
                                                const run = (project.inverterConfig.dcCablingRuns || []).find(r => r.mpptIndex === mpptIdx) || { mpptIndex: mpptIdx, lengthM: 0, sectionMm2: 4 };
                                                return (
                                                  <div key={mpptIdx} className=\"flex items-center gap-2\">
                                                    <div className=\"w-20 text-xs font-semibold text-slate-600\">MPPT {mpptIdx}</div>
                                                    <input
                                                      className=\"w-24 rounded border border-slate-200 px-2 py-1 text-sm\"
                                                      type=\"number\"
                                                      min={0}
                                                      value={run.lengthM ?? 0}
                                                      onChange={(e) => {
                                                        const v = Number(e.target.value);
                                                        setProject(prev => {
                                                          const others = (prev.inverterConfig.dcCablingRuns || []).filter(r => r.mpptIndex !== mpptIdx);
                                                          return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: [...others, { ...run, mpptIndex: mpptIdx, lengthM: v }] } };
                                                        });
                                                      }}
                                                    />
                                                    <span className=\"text-xs text-slate-500\">m</span>
                                                    <select
                                                      className=\"w-28 rounded border border-slate-200 px-2 py-1 text-sm\"
                                                      value={run.sectionMm2 ?? 4}
                                                      onChange={(e) => {
                                                        const s = Number(e.target.value);
                                                        setProject(prev => {
                                                          const others = (prev.inverterConfig.dcCablingRuns || []).filter(r => r.mpptIndex !== mpptIdx);
                                                          return { ...prev, inverterConfig: { ...prev.inverterConfig, dcCablingRuns: [...others, { ...run, mpptIndex: mpptIdx, sectionMm2: s }] } };
                                                        });
                                                      }}
                                                    >
                                                      {[2.5,4,6,10].map(v => <option key={v} value={v}>{v} mm²</option>)}
                                                    </select>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
"""
    txt = txt[:insert_pos] + insert_block + txt[insert_pos:]
    changed=True

if changed:
    p.write_text(txt, encoding='utf-8')
    print('updated App.tsx')
else:
    print('no changes')
