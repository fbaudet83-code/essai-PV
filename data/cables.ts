
import { Component } from '../types';

export const DEFAULT_CABLES: { [key: string]: Component } = {
    // AC Cables Couronnes 50m Triphasé (5G) - Miguelez
    '81010511509200': { id: '81010511509200', description: 'CABLE R2V 5G1.5 C100 MIGUELEZ', unit: 'piece', price: 'A0AUP1' },
    '81010512509200': { id: '81010512509200', description: 'CABLE R2V 5G2.5 C100 MIGUELEZ', unit: 'piece', price: 'A0AUU0' },
    '81010411509200': { id: '81010411509200', description: 'CABLE R2V 4G1.5 C100 MIGUELEZ', unit: 'piece', price: 'A0AUM5' },
    '81010411509205': { id: '81010411509205', description: 'CABLE R2V 4G1.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUN3' },
    '81010412509205': { id: '81010412509205', description: 'CABLE R2V 4G2.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUT3' },
    '81010511509205': { id: '81010511509205', description: 'CABLE R2V 5G1.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUQ9' },
    '81010512509205': { id: '81010512509205', description: 'CABLE R2V 5G2.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUV8' },
    '810105100609205': { id: '810105100609205', description: 'CABLE R2V 5G6 C50 MIGUELEZ', unit: 'piece', price: 'A0AV18' },

    // AC Cables Couronnes 50m Monophasé (3G) - Miguelez
    '81010311509200': { id: '81010311509200', description: 'CABLE R2V 3G1.5 C100 MIGUELEZ', unit: 'piece', price: 'A0AUJ1' },
    '81010312509200': { id: '81010312509200', description: 'CABLE R2V 3G2.5 C100 MIGUELEZ', unit: 'piece', price: 'A0AUR7' },
    '81010311509205': { id: '81010311509205', description: 'CABLE R2V 3G1.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUK9' },
    '81010312509205': { id: '81010312509205', description: 'CABLE R2V 3G2.5 C50 MIGUELEZ', unit: 'piece', price: 'A0AUS5' },
    '810103100609205': { id: '810103100609205', description: 'CABLE R2V 3G6 C50 MIGUELEZ', unit: 'piece', price: 'A0AUX4' },
    '810103101009205': { id: '810103101009205', description: 'CABLE R2V 3G10 C50 MIGUELEZ', unit: 'piece', price: 'A0AV42' },
    '810103101009200': { id: '810103101009200', description: 'CABLE R2V 3G10 C100 MIGUELEZ', unit: 'piece', price: 'A0AV59' },
    '810103101609207': { id: '810103101609207', description: 'CABLE R2V 3G16 T500 MIGUELEZ', unit: 'piece', price: 'A3ERE1' },
    'CABLE-R2V-3G25-C': { id: 'CABLE-R2V-3G25-C', description: 'CABLE R2V 3G25 C', unit: 'piece', price: 'ND' },
    
    // DC Cables
    '821101000609200': { id: '821101000609200', description: 'CABLE H1Z2Z2 1x6 (noir) C100 MIGUELEZ', unit: 'piece', price: 'A3ERG' },
    '821101000609400': { id: '821101000609400', description: 'CABLE H1Z2Z2 1x6 (rouge) C100 MIGUELEZ', unit: 'piece', price: 'A3ERF' },
    'CABLE-DC-10MM': { id: 'CABLE-DC-10MM', description: 'Câble Solaire DC H1Z2Z2-K 10mm²', unit: 'm', price: '' },
    'MC4-EXT-2M': { id: '303037', description: 'Rallonge MC4 2M', unit: 'piece', price: 'A0BEX2' },
    
    // Grounding
    '820001000608600': { id: '820001000608600', description: 'CABLE TERRE H07V-K 1X6 VJ C100', unit: 'piece', price: 'A0AV34' },

    // Communication FoxESS
    'CAB14124171': { id: 'CAB14124171', description: 'CABLE LIYCY 2X0.75 C100', unit: 'piece', price: 'A01NF9' },
};