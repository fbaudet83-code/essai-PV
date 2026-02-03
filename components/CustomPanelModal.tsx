
import React, { useState, useEffect } from 'react';
import { Panel, PanelElectricalSpecs } from '../types';
import { XIcon } from './icons';

interface CustomPanelModalProps {
  initialPanel: Panel;
  onSave: (panel: Panel) => void;
  onClose: () => void;
}

const CustomPanelModal: React.FC<CustomPanelModalProps> = ({ initialPanel, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    width: initialPanel.width || 1134,
    height: initialPanel.height || 1722,
    power: initialPanel.power || 425,
    voc: initialPanel.electrical?.voc || 0,
    isc: initialPanel.electrical?.isc || 0,
    vmp: initialPanel.electrical?.vmp || 0,
    tempCoeffVoc: initialPanel.electrical?.tempCoeffVoc || -0.26
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPanel: Panel = {
      ...initialPanel,
      width: formData.width,
      height: formData.height,
      power: formData.power,
      electrical: {
        ...initialPanel.electrical,
        voc: formData.voc,
        isc: formData.isc,
        vmp: formData.vmp,
        imp: initialPanel.electrical?.imp || 13, // Default fallback if not edited
        tempCoeffVoc: formData.tempCoeffVoc
      } as PanelElectricalSpecs
    };
    onSave(updatedPanel);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="bg-slate-800 text-white p-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <span className="text-orange-400">⚙️</span> Configuration Panneau
          </h3>
          <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded-full transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            Ces données sont temporaires et servent aux calculs de compatibilité onduleur et de calpinage pour ce projet.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
               <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Puissance (Wc)</label>
               <input type="number" name="power" value={formData.power} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
               <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Hauteur (mm)</label>
               <input type="number" name="height" value={formData.height} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
               <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Largeur (mm)</label>
               <input type="number" name="width" value={formData.width} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Données Électriques (STC)</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tension Max (Voc)</label>
                    <div className="relative">
                        <input type="number" step="0.01" name="voc" value={formData.voc} onChange={handleChange} className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">V</span>
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Courant Isc</label>
                    <div className="relative">
                        <input type="number" step="0.01" name="isc" value={formData.isc} onChange={handleChange} className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">A</span>
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tension Vmp</label>
                    <div className="relative">
                        <input type="number" step="0.01" name="vmp" value={formData.vmp} onChange={handleChange} className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">V</span>
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coeff. Temp Voc</label>
                    <div className="relative">
                        <input type="number" step="0.01" name="tempCoeffVoc" value={formData.tempCoeffVoc} onChange={handleChange} className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="-0.26" />
                        <span className="absolute right-2 top-2 text-xs text-slate-400">%/°C</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">Appliquer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomPanelModal;
