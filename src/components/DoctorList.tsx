import React from 'react'
import doctors from '@/data/doctors'
import { Button } from './ui/button'

const parseKm = (s: string) => {
    const m = s.match(/([0-9]+(\.[0-9]+)?)/)
    return m ? parseFloat(m[0]) : 999
}

const DoctorList: React.FC<{ specialty: string }> = ({ specialty }) => {
    // find doctors matching specialty, fallback to General Medicine
    let list = doctors.filter(d => d.specialty.toLowerCase() === specialty.toLowerCase())
    if (list.length === 0) list = doctors.filter(d => d.specialty === 'General Medicine')
    list = list.sort((a, b) => parseKm(a.location) - parseKm(b.location))

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-900">{d.name}</h3>
                            <p className="text-blue-600 text-sm font-medium">{d.specialty}</p>
                        </div>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{d.location}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <a href={d.contact} className="flex-1">
                            <Button variant="outline" className="w-full">Call</Button>
                        </a>
                        <Button className="flex-1" onClick={() => alert('Secure messaging coming soon.')}>Message</Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default DoctorList
