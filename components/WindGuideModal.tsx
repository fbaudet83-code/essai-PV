import React, { useState, useEffect } from 'react';
import { XIcon, PhotoIcon } from './icons';

interface WindGuideModalProps {
  onClose: () => void;
}

// --- CONFIGURATION DÉFAUT (URL EN DUR) ---
// Lien officiel Dropbox converti en mode 'raw' pour affichage direct dans l'iframe
const DEFAULT_OFFICIAL_PDF_URL = "https://www.dropbox.com/scl/fi/zcv9qg4vxyp6wshhi3ood/Temperature-et-Vent-France.pdf?rlkey=j519tisqqo17vjx7btish244q&st=2smeag3x&raw=1"; 

const WindGuideModal: React.FC<WindGuideModalProps> = ({ onClose }) => {
  const [pdfSource, setPdfSource] = useState<string | null>(null);
  const [isUrl, setIsUrl] = useState(false);

  useEffect(() => {
    // 1. Chercher d'abord si l'admin a surchargé l'URL manuellement dans cette session
    const savedOfficialUrl = localStorage.getItem('richardson_official_pdf_url');
    
    // 2. Utiliser l'URL sauvegardée OU l'URL par défaut "en dur" définie au-dessus
    const finalUrl = savedOfficialUrl || DEFAULT_OFFICIAL_PDF_URL;

    if (finalUrl && finalUrl.trim() !== "") {
      setPdfSource(finalUrl);
      setIsUrl(true);
      return;
    }

    // 3. Fallback : PDF local (historique)
    const savedPdf = localStorage.getItem('richardson_referentiel_pdf');
    if (savedPdf) {
      try {
        const byteCharacters = atob(savedPdf.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfSource(url);
        setIsUrl(false);
      } catch (e) {
        console.error("Erreur de conversion PDF local:", e);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        try {
          localStorage.setItem('richardson_referentiel_pdf', base64);
          const url = URL.createObjectURL(file);
          setPdfSource(url);
          setIsUrl(false);
        } catch (err) {
          const url = URL.createObjectURL(file);
          setPdfSource(url);
          alert("Fichier lourd : il sera visible pour cette session mais ne pourra pas être mémorisé par le navigateur.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 overflow-hidden">
      <div className="bg-[#323639] w-full max-w-6xl h-full md:h-[95vh] rounded-none md:rounded-lg shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        
        <header className="bg-[#2d3239] text-white px-6 py-3 flex justify-between items-center shrink-0 shadow-lg border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="bg-[#ff0000] p-1.5 rounded flex items-center justify-center shadow-lg">
                <span className="text-[10px] font-black leading-none text-white">PDF</span>
            </div>
            <div>
                <h3 className="font-bold text-sm leading-none">Référentiel Solaire Richardson</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
                    {isUrl ? "Document Officiel (Lien Cloud)" : "Document de session locale"}
                </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={onClose} className="bg-[#e53935] hover:bg-[#d32f2f] px-6 py-2 rounded text-white transition-all shadow-lg active:scale-95">
                <XIcon className="w-5 h-5" />
              </button>
          </div>
        </header>

        <div className="flex-1 bg-[#525659] relative flex items-center justify-center">
          {pdfSource ? (
            <iframe 
              src={pdfSource} 
              className="w-full h-full border-none bg-white" 
              title="Référentiel PDF"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
                    <PhotoIcon className="w-12 h-12 text-white/20" />
                </div>
                <div className="max-w-md">
                    <h4 className="text-white text-xl font-bold mb-2">Chargement du document...</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Si le document ne s'affiche pas, vérifiez votre connexion internet.
                    </p>
                </div>
            </div>
          )}
        </div>
        
        <footer className="bg-[#2d3239] border-t border-white/5 px-8 py-2 flex justify-between items-center shrink-0">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">
            Référentiel National • Richardson Solaire v3.0
          </p>
          {pdfSource && !isUrl && (
            <button onClick={() => { localStorage.removeItem('richardson_referentiel_pdf'); window.location.reload(); }} className="text-[9px] text-red-400 font-bold uppercase hover:underline">
              Réinitialiser
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}; export default WindGuideModal;