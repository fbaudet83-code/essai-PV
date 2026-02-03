
import React from 'react';
import { XIcon } from './icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-200">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-600">{message}</p>
        </div>
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300">
            Annuler
          </button>
          <button onClick={onConfirm} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
