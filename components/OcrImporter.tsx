
import React, { useState, useRef } from 'react';
import { Component } from '../types';
import { extractTextFromPdf, extractTextFromImage, parseDatasheet } from '../services/ocrService';
import { SpinnerIcon, XIcon, PhotoIcon } from './icons';
import ComponentForm from './ComponentForm';

interface OcrImporterProps {
  onImport: (component: Component) => void;
  onClose: () => void;
}

const OcrImporter: React.FC<OcrImporterProps> = ({ onImport, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [scannedData, setScannedData] = useState<Partial<Component> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setStatusText('Analyse du fichier en cours...');
    
    try {
        let text = '';
        if (file.type === 'application/pdf') {
            setStatusText('Lecture du PDF (Extraction texte)...');
            text = await extractTextFromPdf(file);
        } else if (file.type.startsWith('image/')) {
            setStatusText('Lecture de l\'image (OCR Tesseract)...');
            text = await extractTextFromImage(file);
        } else {
            throw new Error("Format non supporté. Utilisez PDF, JPG ou PNG.");
        }

        setStatusText('Analyse intelligente des données...');
        const parsedData = parseDatasheet(text);
        
        // Auto-generate a temp ID if not found
        if (!parsedData.id) {
            parsedData.id = `NEW-${Math.floor(Math.random()*10000)}`;
        }
        // Set Datasheet URL (can be updated later to a real URL)
        parsedData.datasheetUrl = ''; 

        setScannedData(parsedData);

    } catch (error) {
        console.error(error);
        alert(`Erreur d'analyse: ${error instanceof Error ? error.message : 'Inconnue'}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
      }
  };

  const handleClick = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
        {!scannedData ? (
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <h3 className="text-xl font-bold text-slate-800 mb-2">Import Intelligent (OCR)</h3>
                <p className="text-sm text-slate-500 mb-6">
                    Déposez une fiche technique (PDF ou Image) pour extraire automatiquement les caractéristiques.
                </p>

                <div 
                    onDrop={handleDrop} 
                    onDragOver={e => e.preventDefault()}
                    onClick={handleClick}
                    className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors ${isProcessing ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'}`}
                >
                    {isProcessing ? (
                        <>
                            <SpinnerIcon className="w-10 h-10 text-blue-600 mb-3" />
                            <p className="text-sm font-semibold text-blue-700 animate-pulse">{statusText}</p>
                        </>
                    ) : (
                        <>
                            <PhotoIcon className="w-12 h-12 text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-600">Cliquez ou Déposez un fichier ici</p>
                            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG acceptés</p>
                        </>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".pdf,image/*" 
                        onChange={(e) => e.target.files && e.target.files[0] && handleFile(e.target.files[0])} 
                    />
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                    <strong>Note :</strong> L'IA analysera le texte pour trouver la Puissance, les Tensions (Voc/Vmp), Courants (Isc) et Dimensions. Vérifiez toujours les données avant validation.
                </div>
            </div>
        ) : (
            // Re-use ComponentForm for validation
            <ComponentForm 
                component={scannedData}
                onSave={(comp) => {
                    onImport(comp);
                    onClose();
                }}
                onCancel={() => setScannedData(null)}
            />
        )}
    </div>
  );
};

export default OcrImporter;
