
// SERVICE DE STOCKAGE LOCAL (Remplacement Firebase)
// Ce service utilise le LocalStorage pour persister les données.
// Il utilise des événements personnalisés pour simuler le "Temps Réel".

export const auth = null; 
export const db = null;   

const EVENT_NAME = 'local-db-update';

/**
 * Charge les données en fusionnant les valeurs par défaut (code) 
 * et les modifications locales (navigateur).
 */
export const subscribeToData = (collectionName: string, callback: (data: any) => void) => {
    
    const loadData = () => {
        try {
            const localJson = localStorage.getItem(`richardson_${collectionName}`);
            if (localJson) {
                const localData = JSON.parse(localJson);
                if (Object.keys(localData).length > 0) {
                    // On renvoie les données locales. 
                    callback(localData);
                    return;
                }
            }
        } catch (e) {
            console.error("Erreur lecture localStorage", e);
        }
    };

    loadData();

    const handleStorageChange = (e: CustomEvent) => {
        if (e.detail && e.detail.collection === collectionName) {
            loadData();
        }
    };

    window.addEventListener(EVENT_NAME as any, handleStorageChange);
    return () => window.removeEventListener(EVENT_NAME as any, handleStorageChange);
};

export const saveToCloud = async (collectionName: string, data: any) => {
    try {
        localStorage.setItem(`richardson_${collectionName}`, JSON.stringify(data));
        const event = new CustomEvent(EVENT_NAME, { detail: { collection: collectionName } });
        window.dispatchEvent(event);
    } catch (e) {
        console.error("Erreur sauvegarde locale:", e);
        throw e;
    }
};

/**
 * Supprime les données locales pour forcer l'application à utiliser 
 * les données "en dur" définies dans le code source.
 */
export const resetToDefaults = () => {
    const collections = ['k2', 'esdec', 'inverters', 'panels', 'boxes', 'cables'];
    collections.forEach(col => {
        localStorage.removeItem(`richardson_${col}`);
        const event = new CustomEvent(EVENT_NAME, { detail: { collection: col } });
        window.dispatchEvent(event);
    });
    // Recharger la page pour appliquer les changements proprement
    window.location.reload();
};

export const loginAdmin = async (email: string, pass: string) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Mise à jour du mot de passe selon la demande utilisateur : admin1213
            if (email.toLowerCase() === 'admin@richardson.fr' && pass === 'admin1213') {
                const user = { uid: 'local-admin', email: email, displayName: 'Admin Local' };
                sessionStorage.setItem('isAdmin', 'true');
                resolve(user);
            } else {
                reject(new Error("Identifiants incorrects. Aide : admin@richardson.fr / admin1213"));
            }
        }, 500);
    });
};

export const logoutAdmin = async () => {
    sessionStorage.removeItem('isAdmin');
    return Promise.resolve();
};

export const getAllData = () => {
    const collections = ['k2', 'esdec', 'inverters', 'panels', 'boxes', 'cables'];
    const backup: any = {};
    collections.forEach(col => {
        const data = localStorage.getItem(`richardson_${col}`);
        if (data) backup[col] = JSON.parse(data);
    });
    return backup;
};

export const importAllData = (backup: any) => {
    Object.keys(backup).forEach(col => {
        if (backup[col]) {
            localStorage.setItem(`richardson_${col}`, JSON.stringify(backup[col]));
            const event = new CustomEvent(EVENT_NAME, { detail: { collection: col } });
            window.dispatchEvent(event);
        }
    });
};
