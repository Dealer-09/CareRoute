/**
 * Seeded demo doctor list — covers all specialties the triage engine can return.
 * In Phase 2/3 this moves to a real `doctors` table in Postgres.
 * Contacts are placeholder tel: links.
 */
const doctors = [
  // Cardiology
  { name: 'Dr. Rahul Desai', specialty: 'Cardiology', location: '4.1 km away', contact: 'tel:+910000000002' },
  { name: 'Dr. Sunita Rao', specialty: 'Cardiology', location: '6.3 km away', contact: 'tel:+910000000012' },

  // Pulmonology
  { name: 'Dr. Aditi Sharma', specialty: 'Pulmonology', location: '2.4 km away', contact: 'tel:+910000000001' },
  { name: 'Dr. Vikram Pillai', specialty: 'Pulmonology', location: '5.1 km away', contact: 'tel:+910000000013' },

  // Neurology
  { name: 'Dr. Neha Kapoor', specialty: 'Neurology', location: '3.2 km away', contact: 'tel:+910000000003' },
  { name: 'Dr. Arvind Menon', specialty: 'Neurology', location: '7.0 km away', contact: 'tel:+910000000014' },

  // ENT
  { name: 'Dr. Kavya Iyer', specialty: 'ENT', location: '1.8 km away', contact: 'tel:+910000000004' },
  { name: 'Dr. Deepak Nair', specialty: 'ENT', location: '4.5 km away', contact: 'tel:+910000000015' },

  // Gastroenterology
  { name: 'Dr. Manish Verma', specialty: 'Gastroenterology', location: '5.0 km away', contact: 'tel:+910000000005' },
  { name: 'Dr. Priya Singh', specialty: 'Gastroenterology', location: '8.2 km away', contact: 'tel:+910000000016' },

  // Endocrinology
  { name: 'Dr. Pooja Nanda', specialty: 'Endocrinology', location: '3.7 km away', contact: 'tel:+910000000006' },
  { name: 'Dr. Ramesh Gupta', specialty: 'Endocrinology', location: '6.1 km away', contact: 'tel:+910000000017' },

  // Urology
  { name: 'Dr. Anil Khurana', specialty: 'Urology', location: '2.9 km away', contact: 'tel:+910000000007' },

  // Rheumatology
  { name: 'Dr. Rhea Malhotra', specialty: 'Rheumatology', location: '4.6 km away', contact: 'tel:+910000000008' },

  // Dermatology
  { name: 'Dr. Sonal Jain', specialty: 'Dermatology', location: '3.0 km away', contact: 'tel:+910000000018' },
  { name: 'Dr. Amit Bose', specialty: 'Dermatology', location: '5.5 km away', contact: 'tel:+910000000019' },

  // Orthopedics
  { name: 'Dr. Rajesh Kumar', specialty: 'Orthopedics', location: '2.6 km away', contact: 'tel:+910000000020' },
  { name: 'Dr. Meena Patel', specialty: 'Orthopedics', location: '4.8 km away', contact: 'tel:+910000000021' },

  // Psychiatry
  { name: 'Dr. Ananya Krishnan', specialty: 'Psychiatry', location: '3.9 km away', contact: 'tel:+910000000022' },
  { name: 'Dr. Suresh Lal', specialty: 'Psychiatry', location: '6.7 km away', contact: 'tel:+910000000023' },

  // Ophthalmology
  { name: 'Dr. Rekha Chandran', specialty: 'Ophthalmology', location: '2.1 km away', contact: 'tel:+910000000024' },

  // Obstetrics & Gynecology
  { name: 'Dr. Nisha Mathur', specialty: 'Obstetrics & Gynecology', location: '3.3 km away', contact: 'tel:+910000000025' },
  { name: 'Dr. Lata Shetty', specialty: 'Obstetrics & Gynecology', location: '5.6 km away', contact: 'tel:+910000000026' },

  // General Medicine (fallback) — sorted ascending by distance
  { name: 'Dr. P. Yadav', specialty: 'General Medicine', location: '1.5 km away', contact: 'tel:+910000000011' },
  { name: 'Dr. S. Mehta', specialty: 'General Medicine', location: '2.2 km away', contact: 'tel:+910000000009' },
  { name: 'Dr. T. Banerjee', specialty: 'General Medicine', location: '3.5 km away', contact: 'tel:+910000000010' },

  // Emergency Medicine (for Red cases)
  { name: 'City General Hospital ER', specialty: 'Emergency Medicine', location: '3.8 km away', contact: 'tel:112' },
  { name: 'St. Mary\'s Emergency', specialty: 'Emergency Medicine', location: '5.2 km away', contact: 'tel:112' },
]

export default doctors
