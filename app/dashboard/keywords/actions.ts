"use server";

import { State, City } from "country-state-city";

export async function getCitiesForStates(selectedStates: string[]) {
    // This runs entirely on the server to keep the massive city JSON out of the client bundle
    const inStates = State.getStatesOfCountry('IN');
    const allCities: string[] = [];

    for (const stateName of selectedStates) {
        // Flexible matching
        const normalized = stateName.toLowerCase().replace(/[^a-z]/g, '');
        const firstWord = stateName.split(' ')[0].toLowerCase();
        
        let stateRecord = inStates.find(x => x.name.toLowerCase().replace(/[^a-z]/g, '') === normalized);
        
        if (!stateRecord) {
            // Fallback: match by the very specific first word of the state (like "Jammu" or "Andaman")
            stateRecord = inStates.find(x => x.name.toLowerCase().includes(firstWord));
        }
        
        if (stateRecord) {
            const mappedCities = City.getCitiesOfState('IN', stateRecord.isoCode);
            mappedCities.forEach(c => allCities.push(c.name));
        }
    }
    
    return [...new Set(allCities)].sort();
}
