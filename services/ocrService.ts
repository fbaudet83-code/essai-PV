import { Component, PanelElectricalSpecs, InverterElectricalSpecs } from '../types';

// Dynamic script loader helper
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    const pdfjsLib = (window as any).pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    // Scan up to 3 pages for specs
    const maxPages = Math.min(pdf.numPages, 3);
    
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Add text items with coordinates to potentially reconstruct layout if needed
        // For now, simple join with newlines for rows
        let lastY = -1;
        let pageText = '';
        
        for(const item of textContent.items) {
            // Newline detection based on Y coordinate change
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += '\n';
            }
            pageText += item.str + ' ';
            lastY = item.transform[5];
        }
        
        fullText += pageText + '\n';
    }
    return fullText;
};

export const extractTextFromImage = async (file: File): Promise<string> => {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const Tesseract = (window as any).Tesseract;

    const { data: { text } } = await Tesseract.recognize(file, 'eng+fra', {
        logger: (m: any) => console.debug(m)
    });
    return text;
};

// Helper to find numbers in a line
const extractNumbers = (line: string): number[] => {
    // Matches 450, 35.56, 35,56 etc.
    const regex = /\b\d{1,4}(?:[.,]\d{1,2})?\b/g;
    const matches = line.match(regex);
    if (!matches) return [];
    return matches.map(m => parseFloat(m.replace(',', '.'))).filter(n => !isNaN(n));
};

// --- ADVANCED PARSER ---
export const parseDatasheet = (rawText: string): Partial<Component> => {
    // 1. Normalize text but keep lines structure
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = rawText.replace(/\s+/g, ' ').replace(/O/g, '0').replace(/o/g, '0');
    
    const result: Partial<Component> = {
        unit: 'piece',
        electrical: {} as any
    };

    // 2. Detect Type
    const isMicro = /micro[- ]?inverter|micro[- ]?onduleur|iq8|ds3/i.test(fullText);
    const isInverter = isMicro || /inverter|onduleur|mppt|hybrid/i.test(fullText);
    const isPanel = !isInverter && (/module|panneau|photovoltaic|cell|solar|bifacial/i.test(fullText) || /Voc/i.test(fullText));

    // 3. Extract Dimensions (L x W x H)
    // We look for numbers between 1000 and 2500 (Panels)
    const dimRegex = /(\d{3,4})\s*[xX*×]\s*(\d{3,4})(?:\s*[xX*×]\s*(\d{2,3}))?/;
    const dimMatch = fullText.match(dimRegex);
    if (dimMatch) {
        const vals = [parseFloat(dimMatch[1]), parseFloat(dimMatch[2])];
        if (isPanel) {
            result.height = Math.max(...vals); // Usually height is the longer side
            result.width = Math.min(...vals);
        } else {
            result.width = vals[0];
            result.height = vals[1];
        }
    }

    // 4. Identifier / Description / Brand
    // Try to find Model Name pattern (e.g., HSM-ND48-DR450)
    const modelRegex = /([A-Z0-9]{2,}-[A-Z0-9-]{3,})/i;
    const modelMatch = fullText.match(modelRegex);
    let modelBaseName = modelMatch ? modelMatch[1] : (isPanel ? 'Panneau' : 'Onduleur');

    // 5. SMART TABLE PARSING FOR ELECTRICAL DATA
    // The goal is to find the column index of the Highest Power and use that index for other values.
    
    let targetColumnIndex = 0; // Default to first value found
    let powerFound = false;

    // A. FIND POWER (and determine column index)
    // Look for lines containing Power keywords
    for (const line of lines) {
        if (/(Pmax|Power|Puissance|Nominale|Pnom)/i.test(line) && !powerFound) {
            const numbers = extractNumbers(line);
            // Filter numbers that look like wattage (e.g. 300 to 700 for panels)
            const validPowers = numbers.filter(n => n > 200 && n < 800);
            
            if (validPowers.length > 0) {
                // Heuristic: The highest power is usually the flagship model.
                // We want to capture that one.
                const maxPower = Math.max(...validPowers);
                result.power = maxPower;
                
                // Find index of this max power in the extracted numbers
                // This index will be used to pluck Voc, Isc, etc from their respective lines
                targetColumnIndex = numbers.indexOf(maxPower);
                powerFound = true;
                
                // Refine ID
                if (modelBaseName && !modelBaseName.includes(maxPower.toString())) {
                    modelBaseName += `-${maxPower}`;
                }
            }
        }
    }

    // Fallback if no table detected
    if (!result.power) {
        const simplePower = fullText.match(/(?:Pmax|Power|Puissance)[^0-9]*(\d{3})/i);
        if (simplePower) result.power = parseFloat(simplePower[1]);
    }

    // B. EXTRACT OTHER VALUES USING COLUMN INDEX
    if (isPanel) {
        const elec = result.electrical as PanelElectricalSpecs;
        
        const extractValueFromLine = (regex: RegExp, rangeMin: number, rangeMax: number): number | undefined => {
            for (const line of lines) {
                if (regex.test(line)) {
                    const numbers = extractNumbers(line);
                    // Filter mainly by range to avoid picking up voltage in a current line if mixed text
                    // But primarily trust the structure
                    if (numbers.length > 0) {
                        // If we have a target index and enough numbers, pick that one
                        if (powerFound && numbers.length > targetColumnIndex) {
                            const val = numbers[targetColumnIndex];
                            if (val >= rangeMin && val <= rangeMax) return val;
                        }
                        // Fallback: Pick the first valid one if structure doesn't match
                        const valid = numbers.find(n => n >= rangeMin && n <= rangeMax);
                        if (valid) return valid;
                    }
                }
            }
            return undefined;
        };

        // Voc (20V - 60V)
        elec.voc = extractValueFromLine(/Voc|Ouvert|Open/i, 20, 60) || 0;
        
        // Vmp (20V - 50V)
        elec.vmp = extractValueFromLine(/Vmp|Vmpp|Pmax.*?Voltage|Tension.*?Maximale/i, 20, 50) || 0;

        // Isc (8A - 20A)
        elec.isc = extractValueFromLine(/Isc|Court|Short/i, 8, 20) || 0;

        // Imp (8A - 20A)
        elec.imp = extractValueFromLine(/Imp|Impp|Pmax.*?Current|Courant.*?Maximal/i, 8, 20) || 0;

        // Temp Coeff Voc (look for small negative numbers)
        for (const line of lines) {
            if (/(Temp|Coeff).*?Voc/i.test(line)) {
                // Look for -0.25 or -0,25
                const match = line.match(/-0[.,]\d{2,3}/);
                if (match) {
                    elec.tempCoeffVoc = parseFloat(match[0].replace(',', '.'));
                    break;
                }
            }
        }

    } else if (isInverter) {
        // ... (Existing Inverter Logic preserved/simplified) ...
        const elec = result.electrical as InverterElectricalSpecs;
        // Simple extraction for inverters as they rarely have 5-column tables in the same way panels do for main specs
        // (Usually inputs are grouped)
        
        const vmaxMatch = fullText.match(/(?:Max.*?Input.*?Voltage|Tension.*?Entrée.*?Max)[^0-9]*(\d{2,4})/i);
        if (vmaxMatch) elec.maxInputVoltage = parseFloat(vmaxMatch[1]);

        const mpptMatch = fullText.match(/(?:MPPT|Plage)[^0-9]*(\d{2,3})\s*[-~to]\s*(\d{2,4})/i);
        if (mpptMatch) {
            elec.minMpptVoltage = parseFloat(mpptMatch[1]);
            elec.maxMpptVoltage = parseFloat(mpptMatch[2]);
        }
        
        const imaxMatch = fullText.match(/(?:Max.*?Input.*?Current|Courant.*?Entrée.*?Max)[^0-9]*(\d{1,3}(?:[.,]\d)?)/i);
        if (imaxMatch) elec.maxInputCurrent = parseFloat(imaxMatch[1].replace(',', '.'));
        
        elec.maxAcPower = result.power || 0;
    }

    result.id = modelBaseName;
    result.description = `${isPanel ? 'Panneau' : 'Onduleur'} ${modelBaseName} ${result.power ? result.power + 'W' : ''}`;

    return result;
};