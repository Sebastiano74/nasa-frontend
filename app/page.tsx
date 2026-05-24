'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// URL del backend su Railway (già impostato correttamente)
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

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyHazardous, setShowOnlyHazardous] = useState(false);
  const [startDate, setStartDate] = useState('2026-05-03');
  const [endDate, setEndDate] = useState('2026-05-10');
  const [selectedAsteroid, setSelectedAsteroid] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">NASA NEO Dashboard</h1>
      <div className="flex gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium">Data inizio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Data fine</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button onClick={handleSearch} className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700">Cerca</button>
      </div>
      <p className="mb-4">{filteredList.length} asteroidi {showOnlyHazardous ? '(solo pericolosi)' : '(totali)'}</p>
      <button onClick={() => setShowOnlyHazardous(!showOnlyHazardous)} className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        {showOnlyHazardous ? 'Mostra tutti' : 'Mostra solo pericolosi'}
      </button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Diametro (km)</TableHead>
            <TableHead>Distanza min (km)</TableHead>
            <TableHead>Velocità (km/h)</TableHead>
            <TableHead>Pericoloso</TableHead>
            <TableHead>Data avvicinamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredList.map(ast => (
            <TableRow key={ast.id} onClick={() => loadDetails(ast.id)} className="cursor-pointer hover:bg-gray-100">
              <TableCell>{ast.name}</TableCell>
              <TableCell>{ast.diameter_min_km.toFixed(2)} - {ast.diameter_max_km.toFixed(2)}</TableCell>
              <TableCell>{ast.miss_distance_km !== 'N/A' ? Number(ast.miss_distance_km).toLocaleString() : 'N/A'}</TableCell>
              <TableCell>{ast.relative_velocity_kmh !== 'N/A' ? Number(ast.relative_velocity_kmh).toLocaleString() : 'N/A'}</TableCell>
              <TableCell>{ast.hazardous}</TableCell>
              <TableCell>{ast.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Distribuzione dei diametri minimi (km)</h2>
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