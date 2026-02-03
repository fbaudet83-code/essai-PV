import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
  stack?: string;
};

// Empêche l'"écran blanc" en cas d'erreur JS non gérée.
// Affiche un panneau d'erreur avec le message pour diagnostic.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    const e = err as any;
    return {
      hasError: true,
      message: e?.message ? String(e.message) : String(err),
      stack: e?.stack ? String(e.stack) : undefined,
    };
  }

  componentDidCatch(err: unknown) {
    // Log minimal côté console pour aider à copier/coller.
    // eslint-disable-next-line no-console
    console.error('PVApp runtime error:', err);
  }

  private reset = () => {
    this.setState({ hasError: false, message: undefined, stack: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-red-200 overflow-hidden">
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="text-red-800 font-black uppercase tracking-tight">Erreur d’exécution (écran blanc évité)</div>
            <div className="text-red-700 text-sm mt-1">Copie le message ci‑dessous et envoie‑le moi si besoin.</div>
          </div>

          <div className="p-4">
            <div className="text-xs font-mono bg-slate-900 text-slate-50 rounded-xl p-3 overflow-auto whitespace-pre-wrap">
              {this.state.message || 'Erreur inconnue'}
              {this.state.stack ? `\n\n${this.state.stack}` : ''}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={this.reset} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold">Réessayer</button>
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-900 font-bold border">Recharger</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
