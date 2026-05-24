'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
// Rimuovo import di Table e altri componenti Shadcn non più usati

// URL backend (fisso)
const API_BASE_URL = 'https://nasa-backend-production-b2e2.up.railway.app';

function flattenAsteroidData(nasaData: any) {
  const result = [];
  const neo = nasaData.near_earth_objects;
  for (const date in neo) {
    for (const asteroid of neo[date]) {
      const approach = asteroid.close_approach_data?.[0] || {};
      result.push({
        id: asteroid.id,
        name: asteroid.name,
        diameter_min_km: asteroid.estimated_diameter.kilometers.estimated_diameter_min,
        diameter_max_km: asteroid.estimated_diameter.kilometers.estimated_diameter_max,
        miss_distance_km: approach.miss_distance?.kilometers || 'N/A',
        relative_velocity_kmh: approach.relative_velocity?.kilometers_per_hour || 'N/A',
        hazardous: asteroid.is_potentially_hazardous_asteroid ? 'Sì' : 'No',
        date: date,
        close_approach_date_full: approach.close_approach_date_full || null,
      });
    }
  }
  return result;
}

function prepareDiameterData(asteroidList: any[]) {
  const bins = [
    { range: '0-0.05', min: 0, max: 0.05, count: 0 },
    { range: '0.05-0.1', min: 0.05, max: 0.1, count: 0 },
    { range: '0.1-0.2', min: 0.1, max: 0.2, count: 0 },
    { range: '0.2-0.5', min: 0.2, max: 0.5, count: 0 },
    { range: '>0.5', min: 0.5, max: Infinity, count: 0 },
  ];
  for (const ast of asteroidList) {
    const diam = ast.diameter_min_km;
    for (const bin of bins) {
      if (diam >= bin.min && diam < bin.max) {
        bin.count++;
        break;
      }
    }
  }
  return bins.map(bin => ({ range: bin.range, count: bin.count }));
}

// Funzione per calcolare il countdown verso una data futura
function getCountdown(targetDateStr: string | null) {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return { days, hours, minutes, seconds: secs };
}

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyHazardous, setShowOnlyHazardous] = useState(false);
  const [startDate, setStartDate] = useState('2026-05-03');
  const [endDate, setEndDate] = useState('2026-05-10');
  const [selectedAsteroid, setSelectedAsteroid] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  const fetchAsteroids = (start: string, end: string) => {
    setLoading(true);
    fetch(`${API_BASE_URL}/asteroids?start_date=${start}&end_date=${end}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAsteroids(startDate, endDate);
  }, []);

  // Effetto per aggiornare il countdown ogni secondo per il prossimo asteroide pericoloso
  useEffect(() => {
    if (!data) return;
    const asteroidList = flattenAsteroidData(data);
    const hazardousList = asteroidList.filter(ast => ast.hazardous === 'Sì');
    if (hazardousList.length === 0) return;
    // Trova il prossimo asteroide in base alla data di avvicinamento (usando close_approach_date_full)
    const now = new Date();
    const nextHazardous = hazardousList
      .filter(ast => ast.close_approach_date_full)
      .map(ast => ({ ...ast, approachDate: new Date(ast.close_approach_date_full) }))
      .filter(ast => ast.approachDate > now)
      .sort((a, b) => a.approachDate.getTime() - b.approachDate.getTime())[0];
    if (!nextHazardous) return;

    const updateCountdown = () => {
      const cd = getCountdown(nextHazardous.close_approach_date_full);
      setCountdown(cd);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const handleSearch = () => {
    if (startDate && endDate) fetchAsteroids(startDate, endDate);
  };

  const loadDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/asteroid/${id}`);
      const details = await res.json();
      setSelectedAsteroid(details);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) return <div className="p-8">Caricamento asteroidi...</div>;
  if (error) return <div className="p-8 text-red-500">Errore: {error}</div>;
  if (!data) return null;

  const asteroidList = flattenAsteroidData(data);
  const filteredList = showOnlyHazardous ? asteroidList.filter(ast => ast.hazardous === 'Sì') : asteroidList;
  const chartData = prepareDiameterData(filteredList);
  const totalCount = filteredList.length;
  const hazardousCount = filteredList.filter(ast => ast.hazardous === 'Sì').length;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">NASA NEO Dashboard</h1>
      <p className="mb-2 text-gray-600">
        Monitoraggio asteroidi in avvicinamento alla Terra tramite API NASA NeoWs.
      </p>

      {/* Selettore date e filtro */}
      <div className="flex flex-wrap gap-4 items-end mb-6 mt-4">
        <div>
          <label className="block text-sm font-medium">Data inizio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Data fine</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button onClick={handleSearch} className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700">Cerca</button>
        <button onClick={() => setShowOnlyHazardous(!showOnlyHazardous)} className={`px-4 py-1 rounded ${showOnlyHazardous ? 'bg-red-600' : 'bg-blue-600'} text-white hover:opacity-80`}>
          {showOnlyHazardous ? 'Mostra tutti' : 'Mostra solo pericolosi'}
        </button>
      </div>

      {/* Conteggio asteroidi */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <p className="text-lg font-semibold">{totalCount} asteroidi trovati</p>
        <p className="text-md">{hazardousCount} potenzialmente pericolosi</p>
      </div>

      {/* Countdown per prossimo pericoloso */}
      {countdown && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
          <h2 className="text-xl font-bold text-red-700">Prossimo asteroide pericoloso</h2>
          <div className="text-3xl font-mono mt-2">
            {countdown.days}d {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
          </div>
        </div>
      )}

      {/* Griglia di card (invece della tabella) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filteredList.map(ast => (
          <div
            key={ast.id}
            onClick={() => loadDetails(ast.id)}
            className={`cursor-pointer rounded-lg shadow-md p-4 transition-transform hover:scale-105 ${ast.hazardous === 'Sì' ? 'bg-red-50 border-l-8 border-red-600' : 'bg-white border-l-8 border-gray-300'}`}
          >
            <h3 className="text-lg font-bold">{ast.name}</h3>
            <p className="text-sm text-gray-600">Data: {ast.date}</p>
            <p>Diametro: {ast.diameter_min_km.toFixed(2)} - {ast.diameter_max_km.toFixed(2)} km</p>
            <p>Distanza: {ast.miss_distance_km !== 'N/A' ? Number(ast.miss_distance_km).toLocaleString() : 'N/A'} km</p>
            <p>Velocità: {ast.relative_velocity_kmh !== 'N/A' ? Number(ast.relative_velocity_kmh).toLocaleString() : 'N/A'} km/h</p>
            <p className={`font-bold ${ast.hazardous === 'Sì' ? 'text-red-600' : 'text-green-600'}`}>
              {ast.hazardous === 'Sì' ? '⚠️ Pericoloso' : '✅ Sicuro'}
            </p>
          </div>
        ))}
      </div>

      {/* Istogramma */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Distribuzione diametri minimi (km)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="range" type="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3182CE" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>Nessun dato per il grafico</p>
        )}
      </div>

      {/* Modale dettaglio (identico a prima) */}
      {selectedAsteroid && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedAsteroid.name}</h2>
              <button onClick={() => setSelectedAsteroid(null)} className="text-gray-500 hover:text-gray-700">Chiudi</button>
            </div>
            {detailsLoading ? (
              <p>Caricamento dettagli...</p>
            ) : (
              <div className="space-y-2">
                <p><strong>ID:</strong> {selectedAsteroid.id}</p>
                <p><strong>Diametro (km):</strong> {selectedAsteroid.estimated_diameter?.kilometers?.estimated_diameter_min?.toFixed(2)} - {selectedAsteroid.estimated_diameter?.kilometers?.estimated_diameter_max?.toFixed(2)}</p>
                <p><strong>Magnitudine assoluta:</strong> {selectedAsteroid.absolute_magnitude_h}</p>
                <p><strong>Pericoloso:</strong> {selectedAsteroid.is_potentially_hazardous_asteroid ? 'Sì' : 'No'}</p>
                <p><strong>URL JPL:</strong> <a href={selectedAsteroid.nasa_jpl_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Vai al sito</a></p>
                <h3 className="font-semibold mt-4">Dati di avvicinamento:</h3>
                {selectedAsteroid.close_approach_data?.map((approach: any, idx: number) => (
                  <div key={idx} className="border-t pt-2 text-sm">
                    <p>Data: {approach.close_approach_date_full}</p>
                    <p>Velocità: {parseFloat(approach.relative_velocity.kilometers_per_hour).toLocaleString()} km/h</p>
                    <p>Distanza: {parseFloat(approach.miss_distance.kilometers).toLocaleString()} km</p>
                    <p>Distanza lunare: {parseFloat(approach.miss_distance.lunar).toLocaleString()} LD</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}