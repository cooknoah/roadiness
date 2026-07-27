import { estimateCosts, formatMoney } from '../lib/tripUtils.js'
import { metersToMiles } from '../lib/routing.js'

const FIELDS = [
  { key: 'mpg', label: 'Vehicle MPG', min: 1, step: 1 },
  { key: 'gasPrice', label: 'Gas price / gal', min: 0, step: 0.1, prefix: '$' },
  { key: 'lodgingPerNight', label: 'Lodging / night', min: 0, step: 5, prefix: '$' },
  { key: 'foodPerDay', label: 'Food / day', min: 0, step: 5, prefix: '$' },
]

export default function Costs({ route, dayCount, settings, onChange }) {
  const costs = estimateCosts(route, dayCount, settings)
  const miles = route ? Math.round(metersToMiles(route.distanceMeters)) : 0

  return (
    <div className="costs">
      <div className="cost-fields">
        {FIELDS.map((f) => (
          <label key={f.key} className="setting-row">
            <span className="setting-label">{f.label}</span>
            <span className="number-wrap">
              {f.prefix && <span className="number-prefix">{f.prefix}</span>}
              <input
                type="number"
                min={f.min}
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => onChange({ [f.key]: parseFloat(e.target.value) || 0 })}
              />
            </span>
          </label>
        ))}
      </div>

      {!route ? (
        <div className="empty-state">
          <div className="empty-road" aria-hidden="true" />
          <p>Add stops to see what this adventure will run you.</p>
        </div>
      ) : (
        <div className="cost-receipt">
          <div className="receipt-line">
            <span>Fuel ({miles} mi ÷ {settings.mpg} mpg)</span>
            <span>{formatMoney(costs.fuel)}</span>
          </div>
          <div className="receipt-line">
            <span>Lodging ({costs.nights} {costs.nights === 1 ? 'night' : 'nights'})</span>
            <span>{formatMoney(costs.lodging)}</span>
          </div>
          <div className="receipt-line">
            <span>Food ({costs.days} {costs.days === 1 ? 'day' : 'days'})</span>
            <span>{formatMoney(costs.food)}</span>
          </div>
          <div className="receipt-total">
            <span>Estimated total</span>
            <span>{formatMoney(costs.total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
