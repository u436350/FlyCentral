import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Building2, Star, Wifi, MapPin, Search, X } from 'lucide-react'

const api = (path) => axios.get(`/api${path}`).then(r => r.data)

const AMENITY_ICONS = {
  pool: '🏊', spa: '💆', wifi: '📶', breakfast: '🍳', gym: '💪',
  beach: '🏖️', all_inclusive: '🍽️', kids_club: '👶', parking: '🅿️',
  restaurant: '🍴', bar: '🍸', butler: '🎩', pyramid_view: '🔺',
  river_view: '🌊', rooftop_terrace: '🌅', airport_shuttle: '🚌',
  tennis: '🎾', limousine: '🚗', helipad: '🚁', valet: '🔑',
}

function HotelCard({ hotel, onSelect }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onSelect(hotel)}>
      <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-700 dark:to-gray-600 relative overflow-hidden">
        {hotel.images && (
          <img src={hotel.images} alt={hotel.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
        )}
        <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1 rounded-lg">
          <div className="flex items-center gap-1">
            {'⭐'.repeat(Math.min(hotel.stars, 5))}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 bg-blue-600/90 text-white px-3 py-1 rounded-lg font-bold text-sm">
          ab {hotel.price_per_night} € / Nacht
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{hotel.name}</h3>
          <span className="text-xs text-amber-500 font-bold ml-2 flex-shrink-0">★ {hotel.rating}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-3">
          <MapPin size={12}/> {hotel.city}, {hotel.country}
        </p>
        <div className="flex flex-wrap gap-1">
          {hotel.amenities?.slice(0, 4).map(a => (
            <span key={a} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full" title={a}>
              {AMENITY_ICONS[a] || '✓'} {a.replace('_', ' ')}
            </span>
          ))}
          {hotel.amenities?.length > 4 && (
            <span className="text-xs text-blue-500 px-1">+{hotel.amenities.length - 4}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function HotelDetail({ hotel, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="h-64 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-700 relative overflow-hidden rounded-t-2xl">
          {hotel.images?.[0] && (
            <img src={hotel.images[0]} alt={hotel.name} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'}/>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 bg-white/80 dark:bg-gray-900/80 p-2 rounded-full hover:bg-white">
            <X size={18}/>
          </button>
          <div className="absolute bottom-4 left-4 text-white">
            <p className="text-2xl font-bold drop-shadow">{hotel.name}</p>
            <p className="text-sm drop-shadow">{hotel.city}, {hotel.country} · {'⭐'.repeat(hotel.stars)}</p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-3xl font-bold text-blue-600">{hotel.price_per_night} €</span>
            <span className="text-sm text-gray-500">/ Nacht</span>
            <span className="ml-auto text-amber-500 font-bold">★ {hotel.rating} ({hotel.reviews?.toLocaleString()} Bewertungen)</span>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">{hotel.description}</p>

          {/* Zimmertypen */}
          <h3 className="font-bold mb-3">Zimmertypen</h3>
          <div className="space-y-2 mb-5">
            {hotel.room_types?.map((room, i) => (
              <div key={i} className="border dark:border-gray-700 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{room.type}</p>
                  <p className="text-xs text-gray-500">{room.beds} {room.beds === 1 ? 'Bett' : 'Betten'} · {room.available} verfügbar</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{room.price} € <span className="text-xs font-normal text-gray-400">/Nacht</span></p>
                  <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 mt-1">Auswählen</button>
                </div>
              </div>
            ))}
          </div>

          {/* Ausstattung */}
          <h3 className="font-bold mb-3">Ausstattung</h3>
          <div className="flex flex-wrap gap-2">
            {hotel.amenities?.map(a => (
              <span key={a} className="text-sm bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
                {AMENITY_ICONS[a] || '✓'} {a.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HotelsPage() {
  const [city, setCity] = useState('')
  const [stars, setStars] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [searchQuery, setSearchQuery] = useState({ city: 'Istanbul' })
  const [selectedHotel, setSelectedHotel] = useState(null)

  const { data, isFetching } = useQuery({
    queryKey: ['hotels', searchQuery],
    queryFn: () => {
      const p = new URLSearchParams()
      if (searchQuery.city) p.append('city', searchQuery.city)
      if (searchQuery.stars) p.append('stars', searchQuery.stars)
      if (searchQuery.maxPrice) p.append('max_price', searchQuery.maxPrice)
      return api(`/hotels/search?${p}`)
    },
  })

  const { data: cities } = useQuery({ queryKey: ['hotel-cities'], queryFn: () => api('/hotels') })

  const handleSearch = () => setSearchQuery({ city, stars, maxPrice })

  const hotels = data?.results || []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={28} className="text-blue-600"/>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hotel-Suche</h1>
          <p className="text-sm text-gray-500">{data?.count || 0} Hotels verfügbar</p>
        </div>
      </div>

      {/* Such-Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border dark:border-gray-700 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
              placeholder="Stadt oder Land…"
              className="w-full border dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white pl-9"
            />
            <Search size={16} className="absolute left-3 top-3 text-gray-400"/>
          </div>
          <select value={stars} onChange={e => setStars(e.target.value)} className="border dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white">
            <option value="">Alle Kategorien</option>
            <option value="3">3+ Sterne</option>
            <option value="4">4+ Sterne</option>
            <option value="5">5 Sterne</option>
          </select>
          <input
            type="number"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="Max. Preis (€/Nacht)"
            className="border dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
          />
          <button onClick={handleSearch} className="bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Search size={16}/> Suchen
          </button>
        </div>

        {/* Quick-Stadt-Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {['Istanbul', 'Antalya', 'Dubai', 'Berlin', 'München', 'Cairo', 'Bangkok'].map(c => (
            <button key={c} onClick={() => { setCity(c); setSearchQuery({ city: c }); }}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${searchQuery.city === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {isFetching ? (
        <div className="text-center py-12 text-gray-400">Hotels werden geladen…</div>
      ) : hotels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30"/>
          <p>Keine Hotels für "{searchQuery.city}" gefunden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hotels.map(hotel => (
            <HotelCard key={hotel.id} hotel={hotel} onSelect={setSelectedHotel}/>
          ))}
        </div>
      )}

      {selectedHotel && <HotelDetail hotel={selectedHotel} onClose={() => setSelectedHotel(null)}/>}
    </div>
  )
}
