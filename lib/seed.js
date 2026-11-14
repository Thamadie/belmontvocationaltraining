'use strict';

// Sample programmes added on first start. Employers are described generically
// (partner networks), not named companies. Edit or delete them in the admin panel.

const common = `Your support from Belmont:
- German language course (A1 to B1, Goethe-Institut syllabus)
- Europass CV and application documents
- Placement with the training company
- Blocked account (Fintiba) and visa guidance
- Pre-departure preparation and support after arrival`;

module.exports = [
  {
    title: 'Nursing Specialist (Pflegefachfrau / Pflegefachmann)',
    employer: 'Partner hospital network – Bavaria',
    location: 'Munich',
    field: 'Nursing',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1190,
    allowanceMax: 1400,
    seats: 12,
    featured: true,
    summary: 'Three-year dual nursing training in hospitals around Munich, paid from the first month.',
    description: `About the programme:
Germany's generalist nursing training combines classes at a nursing school with practical placements in hospitals, care homes and community care. After three years you are a state-registered nurse.

What you learn:
- Patient care in surgery, internal medicine, paediatrics and geriatrics
- Medication, wound care and documentation
- Communication with patients, families and doctors

Requirements:
- O/L or A/L results
- German B1 certificate before departure
- Updated Europass CV
- Motivation to work with people

${common}`,
  },
  {
    title: 'B.Sc. Nursing Degree (English & German)',
    employer: 'Partner university of applied sciences',
    location: 'Berlin',
    field: 'Nursing',
    type: 'Nursing degree',
    intake: 'Summer (Mar / Apr)',
    durationYears: 4.5,
    germanLevel: 'A1',
    education: 'A/L (Science, Maths or IT)',
    allowanceMin: null,
    allowanceMax: null,
    seats: 8,
    featured: true,
    summary: 'Nursing degree for A/L students with Science, Maths or IT. IELTS 5.5 and German A1.',
    description: `About the programme:
A nursing degree that combines university study with clinical practice. Most places start in the April / summer intake.

Requirements:
- A/L with relevant subjects such as Science, Mathematics or IT
- German A1 (B1 / B2 is built up during the programme)
- IELTS 5.5
- Updated Europass CV

After graduating:
- 18-month post-study residence permit to find a job
- Full-time career as a registered nurse in Germany

${common}`,
  },
  {
    title: 'Hotel Management Assistant (Hotelfachmann / Hotelfachfrau)',
    employer: 'Partner hotel group – city hotels',
    location: 'Berlin',
    field: 'Hotel & Hospitality',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1000,
    allowanceMax: 1150,
    seats: 10,
    featured: true,
    summary: 'Learn every department of an international hotel: reception, restaurant, housekeeping and events.',
    description: `About the programme:
You rotate through all departments of a four-star city hotel while attending vocational school one or two days a week.

What you learn:
- Front office, reservations and guest service
- Restaurant and bar service
- Housekeeping, events and hotel administration

Requirements:
- O/L or A/L results
- German B1 certificate
- Friendly, service-minded personality

${common}`,
  },
  {
    title: 'Chef (Koch / Köchin)',
    employer: 'Partner restaurant & hotel kitchens',
    location: 'Hamburg',
    field: 'Hotel & Hospitality',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1000,
    allowanceMax: 1100,
    seats: 6,
    featured: false,
    summary: 'Professional cooking training in hotel and restaurant kitchens in Hamburg.',
    description: `About the programme:
Train as a professional chef in busy hotel and restaurant kitchens.

What you learn:
- Cooking techniques, menus and food presentation
- Food hygiene and kitchen organisation
- Purchasing, storage and cost control

Requirements:
- O/L or A/L results
- German B1 certificate

${common}`,
  },
  {
    title: 'IT Specialist – Application Development (Fachinformatiker)',
    employer: 'Partner software companies',
    location: 'Frankfurt',
    field: 'IT',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'A/L preferred',
    allowanceMin: 1050,
    allowanceMax: 1250,
    seats: 8,
    featured: true,
    summary: 'Become a software developer through Germany’s dual IT training.',
    description: `About the programme:
Work on real software projects from day one while learning the theory at vocational school.

What you learn:
- Programming, databases and web development
- Software testing and project work
- Working in agile development teams

Requirements:
- A/L preferred (Maths or IT an advantage)
- German B1 certificate
- Interest in computers and problem solving

${common}`,
  },
  {
    title: 'IT Specialist – System Integration',
    employer: 'Partner IT service providers',
    location: 'Stuttgart',
    field: 'IT',
    type: 'Ausbildung',
    intake: 'Summer (Mar / Apr)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1050,
    allowanceMax: 1200,
    seats: 6,
    featured: false,
    summary: 'Networks, servers and IT support for companies in the Stuttgart region.',
    description: `About the programme:
Plan, install and maintain IT systems and networks for business customers.

What you learn:
- Networks, servers and cloud services
- IT security basics
- User support and documentation

Requirements:
- O/L or A/L results
- German B1 certificate

${common}`,
  },
  {
    title: 'Automotive Mechatronics Technician (Kfz-Mechatroniker)',
    employer: 'Partner car dealerships & workshops',
    location: 'Stuttgart',
    field: 'Automobile',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3.5,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1000,
    allowanceMax: 1200,
    seats: 10,
    featured: true,
    summary: 'Service and repair modern cars, from engines to electronics and electric vehicles.',
    description: `About the programme:
Train in authorised workshops in the home region of Germany's car industry.

What you learn:
- Engine, brakes and transmission service
- Vehicle electronics and diagnostics
- High-voltage and electric vehicle systems

Requirements:
- O/L or A/L results
- German B1 certificate
- Technical interest

${common}`,
  },
  {
    title: 'Car Body & Vehicle Construction Mechanic',
    employer: 'Partner body & paint workshops',
    location: 'Wolfsburg',
    field: 'Automobile',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3.5,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 950,
    allowanceMax: 1150,
    seats: 5,
    featured: false,
    summary: 'Repair and build car bodies and vehicle structures.',
    description: `What you learn:
- Body repair, welding and metalwork
- Measuring and straightening vehicle frames
- Working with modern materials

Requirements:
- O/L or A/L results
- German B1 certificate

${common}`,
  },
  {
    title: 'Mechatronics Technician (Mechatroniker)',
    employer: 'Partner manufacturing companies',
    location: 'Nuremberg',
    field: 'Mechatronics',
    type: 'Ausbildung',
    intake: 'Winter (Sep / Oct)',
    durationYears: 3.5,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1100,
    allowanceMax: 1300,
    seats: 8,
    featured: true,
    summary: 'Mechanics, electronics and automation in modern industrial production.',
    description: `About the programme:
Build, program and maintain automated machines and production lines.

What you learn:
- Mechanical and electrical assembly
- Programmable logic controllers (PLC)
- Maintenance and troubleshooting of production systems

Requirements:
- O/L or A/L results (Maths / Science an advantage)
- German B1 certificate

${common}`,
  },
  {
    title: 'Elderly Care Nurse (Pflegefachkraft – Altenpflege)',
    employer: 'Partner care homes – Saxony',
    location: 'Leipzig',
    field: 'Nursing',
    type: 'Ausbildung',
    intake: 'Summer (Mar / Apr)',
    durationYears: 3,
    germanLevel: 'B1',
    education: 'O/L or above',
    allowanceMin: 1150,
    allowanceMax: 1350,
    seats: 15,
    featured: false,
    summary: 'Nursing training focused on elderly care, with high demand and excellent job prospects.',
    description: `About the programme:
Care for elderly people in care homes and home-care services, with nursing school classes in Leipzig.

Requirements:
- O/L or A/L results
- German B1 certificate
- Patience and empathy

${common}`,
  },
];
