import React, { useState, useRef, useEffect } from 'react';
import { Component } from '../types';
import { DeleteIcon, NewIcon, PhotoIcon, SaveIcon, XIcon } from './icons';
import ComponentForm from './ComponentForm';
import OcrImporter from './OcrImporter';
import ConfirmationModal from './ConfirmationModal';
import { saveToCloud, getAllData, importAllData, resetToDefaults } from '../services/firebase';

type ComponentDB = { [key: string]: Component };

interface AdminPageProps {
  k2: ComponentDB; esdec: ComponentDB; inverters: ComponentDB; panels: ComponentDB; boxes: ComponentDB; cables: ComponentDB;
  onUpdateK2: (db: ComponentDB) => void; onUpdateEsdec: (db: ComponentDB) => void; onUpdateInverters: (db: ComponentDB) => void;
  onUpdatePanels: (db: ComponentDB) => void; onUpdateBoxes: (db: ComponentDB) => void; onUpdateCables: (db: ComponentDB) => void;
  onExit: () => void;
}

type TabType = 'K2' | 'ESDEC' | 'ONDULEURS' | 'PANNEAUX' | 'COFFRETS' | 'CABLES' | 'REGLAGES';

const AdminPage: React.FC<AdminPageProps> = ({ 
    k2, esdec, inverters, panels, boxes, cables,
    onUpdateK2, onUpdateEsdec, onUpdateInverters, onUpdatePanels, onUpdateBoxes, onUpdateCables,
    onExit
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('PANNEAUX');
  const [editingComponent, setEditingComponent] = useState<Partial<Component> | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [officialPdfUrl, setOfficialPdfUrl] = useState('');
  
  const dbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('richardson_official_pdf_url');
    if (saved) setOfficialPdfUrl(saved);
  }, []);

  const getActiveDB = () => {
      switch(activeTab) {
          case 'K2': return k2;
          case 'ESDEC': return esdec;
          case 'ONDULEURS': return inverters;
          case 'PANNEAUX': return panels;
          case 'COFFRETS': return boxes;
          case 'CABLES': return cables;
          default: return panels;
      }
  };

  const activeDB = getActiveDB();

  const handleCloudSave = async (newData: ComponentDB, tab: TabType) => {
      setSaveStatus("Sauvegarde...");
      try {
          const collectionMap: Record<string, string> = {
              'K2': 'k2', 'ESDEC': 'esdec', 'ONDULEURS': 'inverters',
              'PANNEAUX': 'panels', 'COFFRETS': 'boxes', 'CABLES': 'cables'
          };
          if (collectionMap[tab]) {
              await saveToCloud(collectionMap[tab], newData);
          }
          setSaveStatus("✅ Sauvegardé !");
      } catch (e) {
          setSaveStatus("❌ Erreur");
      }
      setTimeout(() => setSaveStatus(''), 2000);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('richardson_official_pdf_url', officialPdfUrl);
    setSaveStatus("✅ Réglages sauvés !");
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const handleSaveComponent = (component: Component) => {
    const updatedDB = { ...activeDB };
    const oldKey = Object.keys(updatedDB).find(key => updatedDB[key].id === editingComponent?.id);
    if (oldKey && oldKey !== component.id) delete updatedDB[oldKey];
    updatedDB[component.id] = component;
    handleCloudSave(updatedDB, activeTab);
    setEditingComponent(null);
  };

  const tabs: {id: TabType, label: string}[] = [
      { id: 'PANNEAUX', label: 'Panneaux' },
      { id: 'ONDULEURS', label: 'Onduleurs' },
      { id: 'K2', label: 'Système K2' },
      { id: 'ESDEC', label: 'Système ESDEC' },
      { id: 'REGLAGES', label: '⚙️ PDF & Réglages' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-slate-100 font-sans">
      <div className="bg-slate-900 text-white p-6 rounded-t-xl flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
        <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-orange-500">🛠</span> Administration
            </h2>
            <p className="text-sm text-slate-400 mt-1">Gérez vos matériels et vos documents officiels.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-end">
            {saveStatus && <span className="text-sm font-bold text-green-400 animate-pulse mr-2">{saveStatus}</span>}
            <button onClick={onExit} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg">Retour au Calculateur</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-b-xl shadow-md min-h-[600px]">
        <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-2">
            {tabs.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>{tab.label}</button>
            ))}
        </div>
        
        {activeTab === 'REGLAGES' ? (
            <div className="max-w-2xl space-y-8 animate-scale-in">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="text-xl">📄</span> Configuration du Référentiel PDF Richardson
                    </h3>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                        Pour que tous les utilisateurs sur tous les ordinateurs voient le même PDF (Carte de vent, normes), 
                        hébergez votre fichier PDF en ligne et collez son URL directe ci-dessous.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">URL Directe du PDF (Partage universel)</label>
                            <input 
                                type="url" 
                                value={officialPdfUrl} 
                                onChange={(e) => setOfficialPdfUrl(e.target.value)}
                                placeholder="https://votre-site.com/normes-richardson.pdf"
                                className="w-full p-3 border rounded-lg font-mono text-sm bg-white shadow-inner focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleSaveSettings}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95"
                        >
                            Enregistrer l'URL officielle
                        </button>
                    </div>
                </div>

                <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                    <h3 className="text-lg font-bold text-red-800 mb-2">Maintenance Système</h3>
                    <p className="text-sm text-red-600/80 mb-6">Réinitialiser les bases de données si vous avez fait des erreurs irrécupérables.</p>
                    <button onClick={() => setShowResetConfirm(true)} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded font-bold hover:bg-red-600 hover:text-white transition-all text-xs">
                        ♻️ Réinitialiser tout aux valeurs d'usine
                    </button>
                </div>
            </div>
        ) : (
            <>
                <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="text-sm text-slate-600 font-bold uppercase tracking-widest">{activeTab} • {Object.keys(activeDB).length} RÉFÉRENCES</div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowOcrModal(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 font-semibold text-sm shadow-md transition-all"><PhotoIcon className="w-5 h-5 text-orange-400"/> Importer via PDF (OCR)</button>
                        <button onClick={() => setEditingComponent({ unit: 'piece', price: '' })} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold text-sm shadow-md transition-all"><NewIcon className="w-5 h-5"/> Ajouter matériel</button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest">
                        <tr><th className="px-6 py-4">Référence</th><th className="px-6 py-4">Description</th><th className="px-6 py-4">Détails</th><th className="px-6 py-4 text-right">Code Rich.</th><th className="px-6 py-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {(Object.values(activeDB) as Component[]).map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 py-3 font-bold text-slate-900">{item.id}</td>
                            <td className="px-6 py-3 text-slate-600">{item.description}</td>
                            <td className="px-6 py-3 text-xs text-slate-400">
                                {item.power ? <span className="inline-block bg-orange-100 text-orange-800 px-2 py-0.5 rounded mr-2 font-black">{item.power} {activeTab === 'PANNEAUX' ? 'Wc' : 'VA'}</span> : null}
                                {item.width ? <span>{item.height}x{item.width}mm</span> : null}
                            </td>
                            <td className="px-6 py-3 text-right font-mono font-bold text-slate-800">{item.price || '-'}</td>
                            <td className="px-6 py-3 text-right flex justify-end gap-3">
                                <button onClick={() => setEditingComponent(item)} className="text-blue-600 font-bold hover:underline">Modifier</button>
                                <button onClick={() => setDeleteTarget(item.id)} className="text-red-400 hover:text-red-600"><DeleteIcon className="w-5 h-5"/></button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
      
      {editingComponent && <ComponentForm component={editingComponent} onSave={handleSaveComponent} onCancel={() => setEditingComponent(null)} />}
      {showOcrModal && <OcrImporter onImport={(c) => { handleSaveComponent(c); setShowOcrModal(false); }} onClose={() => setShowOcrModal(false)} />}
      
      <ConfirmationModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) { const db = { ...activeDB }; delete db[deleteTarget]; handleCloudSave(db, activeTab); setDeleteTarget(null); } }} title="Supprimer matériel ?" message="Cette action est irréversible." />
      <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={resetToDefaults} title="⚠️ Réinitialisation Totale" message="Vous allez perdre tous vos prix et nouveaux produits. Continuer ?" />
    </div>
  );
}; export default AdminPage;