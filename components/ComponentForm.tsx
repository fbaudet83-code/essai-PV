
import { useState, useEffect } from 'react';
import React from 'react';
import { Component } from '../types';

interface ComponentFormProps {
  component: Partial<Component> | null;
  onSave: (component: Component) => void;
  onCancel: () => void;
}

type ComponentType = 'panel' | 'inverter' | 'other';

const ComponentForm: React.FC<ComponentFormProps> = ({ component, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Component>>({});
  const [electricalData, setElectricalData] = useState<any>({});
  const [compType, setCompType] = useState<ComponentType>('other');

  useEffect(() => {
    if (component) {
        setFormData(component);
        if (component.electrical) {
            setElectricalData(component.electrical);
        } else {
            setElectricalData({});
        }

        // Determine type based on existing data or heuristic
        if (component.id?.includes('ENP') || component.id?.includes('APS') || component.id?.includes('FOX') || (component.electrical as any)?.maxInputVoltage) {
            setCompType('inverter');
        } else if ((component.width && component.width > 800) || (component.electrical as any)?.voc) {
            setCompType('panel');
        } else {
            setCompType('panel'); // Default to panel for convenience
        }
    } else {
        setFormData({ unit: 'piece', price: '' });
        setElectricalData({});
        setCompType('panel');
    }
  }, [component]);

  if (!component) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numFields = ['length', 'width', 'height', 'power'];
    setFormData(prev => ({ 
        ...prev, 
        [name]: numFields.includes(name) ? (parseFloat(value) || 0) : value 
    }));
  };

  const handleElectricalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setElectricalData((prev: any) => ({
          ...prev,
          [name]: parseFloat(value) || 0
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id && formData.description && formData.unit) {
        const finalComponent = { ...formData } as Component;
        
        // Check if any electrical data was entered
        if (Object.keys(electricalData).length > 0) {
            finalComponent.electrical = electricalData;
        }
        onSave(finalComponent);
    } else {
      alert('Veuillez remplir les champs Référence, Description et Unité.');
    }
  };

  const isPanel = compType === 'panel';
  const isInverter = compType === 'inverter';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">Éditer le composant</h3>
            <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500">Type :</label>
                <select 
                    value={compType} 
                    onChange={(e) => setCompType(e.target.value as ComponentType)}
                    className="p-1 border rounded text-xs bg-slate-100 font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
                >
                    <option value="panel">Panneau PV</option>
                    <option value="inverter">Onduleur / Micro</option>
                    <option value="other">Autre (Rail/Acc.)</option>
                </select>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600">Référence (ID)</label>
              <input
                type="text"
                name="id"
                value={formData.id || ''}
                onChange={handleChange}
                className="mt-1 w-full p-2 border border-slate-300 rounded-md transition-all duration-150 focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Description</label>
              <input
                type="text"
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                className="mt-1 w-full p-2 border border-slate-300 rounded-md transition-all duration-150 focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-600">Unité</label>
                <select name="unit" value={formData.unit || 'piece'} onChange={handleChange} className="mt-1 w-full p-2 border border-slate-300 rounded-md transition-all duration-150 focus:ring-2 focus:ring-blue-300 focus:border-blue-500 bg-white">
                    <option value="piece">pièce</option>
                    <option value="m">m</option>
                    <option value="unite">unité</option>
                </select>
              </div>
               <div>
                <label className="text-sm font-medium text-slate-600">Code Richardson</label>
                <input
                    type="text"
                    name="price"
                    value={formData.price || ''}
                    onChange={handleChange}
                    className="mt-1 w-full p-2 border border-slate-300 rounded-md transition-all duration-150 focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
                />
                </div>
            </div>

            <div className="border-t pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Dimensions & Puissance (Physique)</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-600">Longueur (mm)</label>
                        <input type="number" name="length" value={formData.length || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ex: Rail" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">Largeur (mm)</label>
                        <input type="number" name="width" value={formData.width || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ex: Panneau" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">Hauteur (mm)</label>
                        <input type="number" name="height" value={formData.height || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ex: Panneau" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600">Puissance (Wc/VA)</label>
                        <input type="number" name="power" value={formData.power || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ex: Panneau/Onduleur" />
                    </div>
                </div>
            </div>

            {/* Electrical Specs Form Section */}
            {(isPanel || isInverter) && (
                <div className="border-t pt-4 mt-2 bg-yellow-50 -mx-4 px-4 pb-4">
                    <h4 className="text-xs font-bold text-yellow-700 uppercase mb-2">
                        Données Électriques ({isPanel ? 'Panneau' : 'Onduleur'})
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600">Voc (V) / Max Input V</label>
                            <input type="number" step="0.01" name={isPanel ? 'voc' : 'maxInputVoltage'} 
                                value={isPanel ? electricalData.voc || '' : electricalData.maxInputVoltage || ''} 
                                onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm font-mono" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">Isc (A) / Max Input I</label>
                            <input type="number" step="0.01" name={isPanel ? 'isc' : 'maxInputCurrent'} 
                                value={isPanel ? electricalData.isc || '' : electricalData.maxInputCurrent || ''} 
                                onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm font-mono" />
                        </div>
                        
                        {isPanel && (
                            <>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Vmp (V)</label>
                                    <input type="number" step="0.01" name="vmp" value={electricalData.vmp || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Imp (A)</label>
                                    <input type="number" step="0.01" name="imp" value={electricalData.imp || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm font-mono" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Coeff Voc (%/°C)</label>
                                    <input type="number" step="0.01" name="tempCoeffVoc" value={electricalData.tempCoeffVoc || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm font-mono" placeholder="-0.26" />
                                </div>
                            </>
                        )}

                        {isInverter && (
                            <>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Min MPPT (V)</label>
                                    <input type="number" step="0.1" name="minMpptVoltage" value={electricalData.minMpptVoltage || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Max MPPT (V)</label>
                                    <input type="number" step="0.1" name="maxMpptVoltage" value={electricalData.maxMpptVoltage || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">Max AC Power (VA)</label>
                                    <input type="number" name="maxAcPower" value={electricalData.maxAcPower || ''} onChange={handleElectricalChange} className="w-full p-1 border rounded text-sm" />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            
            <div className="border-t pt-4 mt-2 space-y-3">
                <h4 className="text-xs font-bold text-blue-500 uppercase mb-1">Liens & Documentations</h4>
                <div>
                    <label className="text-xs font-medium text-slate-600">URL Fiche Technique (Datasheet PDF)</label>
                    <input type="text" name="datasheetUrl" value={formData.datasheetUrl || ''} onChange={handleChange} className="w-full p-2 border rounded text-xs font-mono bg-slate-50" placeholder="https://..." />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-600">URL Manuel d'installation (PDF)</label>
                    <input type="text" name="manualUrl" value={formData.manualUrl || ''} onChange={handleChange} className="w-full p-2 border rounded text-xs font-mono bg-slate-50" placeholder="https://..." />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-600">URL Vidéo de support (YouTube)</label>
                    <input type="text" name="videoUrl" value={formData.videoUrl || ''} onChange={handleChange} className="w-full p-2 border rounded text-xs font-mono bg-slate-50" placeholder="https://youtube.com/..." />
                </div>
                <div>
                    <label className="text-xs font-medium text-slate-600">URL Image du produit</label>
                    <input type="text" name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} className="w-full p-2 border rounded text-xs font-mono bg-slate-50" placeholder="https://..." />
                </div>
            </div>

          </div>
          <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">Annuler</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-bold">Sauvegarder</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComponentForm;
