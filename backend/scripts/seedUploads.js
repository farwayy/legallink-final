const fs = require('fs');
const path = require('path');

function createPdfBuffer(title, subtitle, details) {
  const content = [
    'BT',
    '/F1 18 Tf',
    '50 720 Td',
    '(' + title.replace(/[()\\]/g, '') + ') Tj',
    '/F1 12 Tf',
    '0 -28 Td',
    '(' + subtitle.replace(/[()\\]/g, '') + ') Tj',
    '0 -20 Td',
    '(================================================================) Tj',
  ];

  details.forEach((line) => {
    content.push('0 -22 Td');
    content.push('(' + line.replace(/[()\\]/g, '') + ') Tj');
  });

  content.push('0 -35 Td');
  content.push('(----------------------------------------------------------------) Tj');
  content.push('0 -20 Td');
  content.push('(Official Verification Record: LegalLink Electronic Accreditation Registry) Tj');
  content.push('0 -18 Td');
  content.push('(Digitally Certified Document - Pakistan Bar Council Validated) Tj');
  content.push('ET');

  const stream = content.join('\n');
  const streamLen = Buffer.byteLength(stream, 'utf-8');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
    '5 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + stream + '\nendstream\nendobj'
  ];

  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  let body = '%PDF-1.4\n';

  const offsets = [];
  objects.forEach(obj => {
    offsets.push(body.length);
    body += obj + '\n';
  });

  const startxref = body.length;
  body += xref;
  offsets.forEach(off => {
    body += String(off).padStart(10, '0') + ' 00000 n \n';
  });

  body += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF\n';
  return Buffer.from(body, 'binary');
}

function ensureUploadsExist() {
  const uploadsDir = path.resolve(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 1. Bilal Hassan License (Pending Lawyer)
  const bilalPath = path.join(uploadsDir, 'bar_license_bilal.pdf');
  if (!fs.existsSync(bilalPath)) {
    const pdf = createPdfBuffer(
      'PUNJAB BAR COUNCIL - ADVOCATE HIGH COURT CERTIFICATE',
      'Certificate of Practice & Enrollment',
      [
        'Advocate Full Name: Adv. Bilal Hassan',
        'Bar Council Enrollment ID: PB-54321/LHR',
        'Jurisdiction: Lahore High Court Bar Association',
        'CNIC: 35201-9876543-1',
        'Legal Practice Area: Criminal & Civil Defense, Corporate Law',
        'Experience: 4 Years of Practice at High Court of Punjab',
        'Status: Active Practitioner in Good Standing'
      ]
    );
    fs.writeFileSync(bilalPath, pdf);
    console.log('✅ Created bar_license_bilal.pdf');
  }

  // 2. Tariq Mehmood License
  const tariqPath = path.join(uploadsDir, 'bar_license_tariq.pdf');
  if (!fs.existsSync(tariqPath)) {
    const pdf = createPdfBuffer(
      'SINDH BAR COUNCIL - ADVOCATE ENROLLMENT DECREE',
      'Practicing Certificate for High Court of Sindh',
      [
        'Advocate Full Name: Adv. Tariq Mehmood',
        'Bar Council ID: SBC-12345/KHI',
        'CNIC: 42101-1234567-1',
        'Experience: 10 Years Active Legal Practice',
        'Specialization: Constitutional Law, Corporate Litigation',
        'Status: Accredited Advocate'
      ]
    );
    fs.writeFileSync(tariqPath, pdf);
    console.log('✅ Created bar_license_tariq.pdf');
  }

  // 3. Ayesha Siddiqui License
  const ayeshaPath = path.join(uploadsDir, 'bar_license_ayesha.pdf');
  if (!fs.existsSync(ayeshaPath)) {
    const pdf = createPdfBuffer(
      'ISLAMABAD BAR COUNCIL - ADVOCATE HIGH COURT REGISTRATION',
      'Official Practicing License',
      [
        'Advocate Full Name: Adv. Ayesha Siddiqui',
        'Bar Council ID: IBC-67890/ISB',
        'CNIC: 37405-7654321-2',
        'Experience: 7 Years Active Legal Practice',
        'Specialization: Family Law, Human Rights, Women Protection',
        'Status: Accredited Advocate'
      ]
    );
    fs.writeFileSync(ayeshaPath, pdf);
    console.log('✅ Created bar_license_ayesha.pdf');
  }

  // 4. Sample Bar License fallback
  const samplePdfPath = path.join(uploadsDir, 'sample_bar_license.pdf');
  if (!fs.existsSync(samplePdfPath)) {
    const pdf = createPdfBuffer(
      'PAKISTAN BAR COUNCIL - OFFICIAL ADVOCATE ENROLLMENT LICENSE',
      'Electronic Legal Accreditation Verification',
      [
        'Record Type: Bar Council Certificate of Practice',
        'Accreditation Platform: LegalLink Verified Legal Network',
        'Status: Document Verified & On File',
        'Validity: High Court and Subordinate Courts Jurisdiction'
      ]
    );
    fs.writeFileSync(samplePdfPath, pdf);
    console.log('✅ Created sample_bar_license.pdf');
  }

  // 5. NGO Certificate: ngo-1791456287112.jpg
  const ngoPath = path.join(uploadsDir, 'ngo-1791456287112.jpg');
  if (!fs.existsSync(ngoPath)) {
    // Copy sample image or write valid JPEG
    const sourceImage = path.resolve(__dirname, '../../frontend/public/images/ll10.jpg');
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, ngoPath);
      console.log('✅ Created ngo-1791456287112.jpg from sample image');
    }
  }

  // 6. Sample NGO Certificate fallback
  const sampleNgoPath = path.join(uploadsDir, 'sample_ngo_certificate.jpg');
  if (!fs.existsSync(sampleNgoPath)) {
    const sourceImage = path.resolve(__dirname, '../../frontend/public/images/ll10.jpg');
    if (fs.existsSync(sourceImage)) {
      fs.copyFileSync(sourceImage, sampleNgoPath);
      console.log('✅ Created sample_ngo_certificate.jpg');
    }
  }
}

module.exports = {
  createPdfBuffer,
  ensureUploadsExist
};

if (require.main === module) {
  ensureUploadsExist();
  console.log('Uploads seeding complete.');
}
