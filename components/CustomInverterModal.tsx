
import React, { useState } from 'react';
import { Component, InverterElectricalSpecs } from '../types';
import { XIcon } from './icons';

interface CustomInverterModalProps {
  initialInverter: Component;
  initialPhase: 'Mono' | 'Tri';
  onSave: (inverter: Component, phase: 'Mono' | 'Tri') => void;
  onClose: () => void;
}

const CustomInverterModal: React.FC<CustomInverterModalProps> = ({ initialInverter, initialPhase, onSave, onClose }) => {
  const specs = initialInverter.electrical as InverterElectricalSpecs;
  
  const [formData, setFormData] = useState({
    description: initialInverter.description || 'Onduleur Personnalisé',
    maxAcPower: specs?.maxAcPower || 5000,
    maxDcPower: specs?.maxDcPower || 6000,
    maxInputVoltage: specs?.maxInputVoltage || 600,
    minMpptVoltage: specs?.minMpptVoltage || 80,
    maxMpptVoltage: specs?.maxMpptVoltage || 550,
    maxInputCurrent: specs?.maxInputCurrent || 15,
    mpptCount: specs?.mpptCount || 2,
    maxStrings: specs?.maxStrings || 2,
    isMicro: specs?.isMicro || false,
    phase: initialPhase || 'Mono'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    
    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : (name === 'description' || name === 'phase' ? value : parseFloat(value) || 0)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedInverter: Component = {
      ...initialInverter,
      description: formData.description,
      power: formData.maxAcPower,
      electrical: {
        maxAcPower: formData.maxAcPower,
        maxDcPower: formData.maxDcPower,
        maxInputVoltage: formData.maxInputVoltage,
        minMpptVoltage: formData.minMpptVoltage,
        maxMpptVoltage: formData.maxMpptVoltage,
        maxInputCurrent: formData.maxInputCurrent,
        mpptCount: formData.mpptCount,
        maxStrings: formData.maxStrings,
        isMicro: formData.isMicro
      } as InverterElectricalSpecs
    };
    onSave(updatedInverter, formData.phase as 'Mono' | 'Tri');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="bg-slate-800 text-white p-4 rounded-t-xl flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <span className="text-orange-400">⚙️</span> Configuration Onduleur Personnalisé
          </h3>
          <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded-full transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            Définissez les caractéristiques pour le calcul des sections de câbles et l'audit de conformité.
          </div>

          <div>
             <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Nom / Modèle</label>
             <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Type d'onduleur</label>
              <select name="isMicro" value={formData.isMicro ? "true" : "false"} onChange={(e) => setFormData(p => ({...p, isMicro: e.target.value === "true"}))} className="w-full p-2 border rounded font-bold text-slate-800 outline-none">
                <option value="false">Centralisé / Hybride</option>
                <option value="true">Micro-onduleur</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Raccordement</label>
              <select name="phase" value={formData.phase} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 outline-none">
                <option value="Mono">Monophasé</option>
                <option value="Tri">Triphasé</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Puissance AC (VA)</label>
               <input type="number" name="maxAcPower" value={formData.maxAcPower} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
               <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Puissance DC Max (Wc)</label>
               <input type="number" name="maxDcPower" value={formData.maxDcPower} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {!formData.isMicro && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Vmax DC (V)</label>
                   <input type="number" name="maxInputVoltage" value={formData.maxInputVoltage} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Imax DC (A)</label>
                   <input type="number" step="0.1" name="maxInputCurrent" value={formData.maxInputCurrent} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Nb. de MPPT</label>
                   <input type="number" name="mpptCount" value={formData.mpptCount} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Strings Max</label>
                   <input type="number" name="maxStrings" value={formData.maxStrings} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Min MPPT (V)</label>
                   <input type="number" name="minMpptVoltage" value={formData.minMpptVoltage} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Max MPPT (V)</label>
                   <input type="number" name="maxMpptVoltage" value={formData.maxMpptVoltage} onChange={handleChange} className="w-full p-2 border rounded font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">Appliquer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomInverterModal;
