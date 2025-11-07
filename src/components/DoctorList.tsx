import React from 'react'
import doctors from '../data/doctors'

const parseKm = (s: string) => {
  const m = s.match(/([0-9]+(\.[0-9]+)?)/)
  return m ? parseFloat(m[0]) : 999
}

const DoctorList: React.FC<{specialty:string}> = ({specialty}) => {
  // find doctors matching specialty, fallback to General Medicine
  let list = doctors.filter(d => d.specialty.toLowerCase() === specialty.toLowerCase())
  if (list.length === 0) list = doctors.filter(d=> d.specialty === 'General Medicine')
  list = list.sort((a,b) => parseKm(a.location) - parseKm(b.location))

  return (
    <div className="doctor-list">
      {list.map((d,i)=> (
        <div key={i} className="card doc-card">
          <div className="row">
            <div>
              <strong>{d.name}</strong>
              <div className="muted">{d.specialty} • {d.location}</div>
            </div>
            <div className="actions">
              <a href={d.contact}>Call</a>
              <button onClick={()=>alert('Secure messaging coming soon.')}>Message</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default DoctorList
