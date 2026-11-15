import React, { useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageHero from "../components/landing/PageHero";
import { useTheme } from '../contexts/ThemeContext';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import {
  FileText,
  Download,
  Printer,
  Eye,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  FileCheck,
  Scale,
  Briefcase,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

const Documents = () => {
  const { isDark } = useTheme();
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [userName, setUserName] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [date, setDate] = useState(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  );
  const [showPreview, setShowPreview] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('pdf');

  const customizationRef = useRef(null);

  const templates = [
    {
      id: 1,
      name: 'Legal Notice',
      category: 'Notices',
      iconKey: 'notice',
      description: 'Formal legal notice to be served upon opposing party prior to formal litigation.',
      content: `WHEREAS, the undersigned has been appointed as legal counsel for the above-named party;

AND WHEREAS, the opposing party has failed to fulfill their legal and contractual obligations;

NOW THEREFORE, take notice that legal proceedings shall be initiated against you within 15 days of receiving this notice unless the demanded action is satisfied in full.`
    },
    {
      id: 2,
      name: 'Affidavit (Bayān-e-Halfi)',
      category: 'Court Documents',
      iconKey: 'affidavit',
      description: 'Sworn statement of facts executed on legal judicial stamp paper for court submission.',
      content: `I, the undersigned, do hereby solemnly affirm and declare as under:

1. That I am the deponent herein and fully conversant with the facts of this matter.

2. That the statements made herein are true and correct to the best of my knowledge and belief.

3. That I am filing this affidavit voluntarily without any coercion, threat or undue influence.`
    },
    {
      id: 3,
      name: 'Power of Attorney (Mukhtar-Nama)',
      category: 'Authorizations',
      iconKey: 'poa',
      description: 'Irrevocable or General legal authorization conferring power to represent before judicial forums.',
      content: `KNOW ALL MEN BY THESE PRESENTS that I/We, the undersigned, do hereby appoint and authorize the Attorney-in-Fact to act on my/our behalf in all legal, civil, and revenue matters.

The Attorney shall have full authority to institute suits, file replies, sign petitions, and represent me/us before any Court, Tribunal, or Revenue Authority in Pakistan.`
    },
    {
      id: 4,
      name: 'Commercial Agreement Contract',
      category: 'Contracts',
      iconKey: 'contract',
      description: 'Standard binding commercial contract enforceable under Contract Act 1872.',
      content: `THIS AGREEMENT is made and entered into on this date between the parties herein.

The parties agree to the following terms and covenants:

1. Term of Agreement: This agreement shall remain in effect for a period of one calendar year.

2. Obligations: Both parties shall fulfill their respective covenants as outlined herein with utmost good faith.

3. Dispute Resolution: Any controversy arising under this agreement shall be settled through formal arbitration in accordance with the Arbitration Act 1940.`
    },
    {
      id: 5,
      name: 'Demand Letter for Recovery',
      category: 'Notices',
      iconKey: 'recovery',
      description: 'Formal recovery letter demanding payment of outstanding debt or damages.',
      content: `Dear Sir/Madam,

This is a formal demand for immediate remittance of the outstanding sum of PKR _________ which has remained overdue despite repeated verbal reminders.

Please remit the full amount within 7 days of receiving this letter, failing which civil and criminal recovery proceedings shall be instituted at your risk and cost.`
    },
    {
      id: 6,
      name: 'Cease and Desist Order Notice',
      category: 'Legal Actions',
      iconKey: 'cease',
      description: 'Formal statutory injunction demand requiring immediate termination of unlawful acts.',
      content: `RE: CEASE AND DESIST NOTICE FOR IMMEDIATE COMPLIANCE

You are hereby ordered to immediately cease and desist from all unlawful activities as described herein:

Your actions constitute an actionable infringement of statutory rights causing continuous and irreparable injury.

Failure to desist within 48 hours will result in immediate emergency injunctive suits and claim for exemplary damages.`
    }
  ];

  const handleTemplateClick = (template) => {
    setSelectedDoc(template);
    setShowPreview(false);
    setTimeout(() => {
      customizationRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const getFullDocumentHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${selectedDoc?.name || 'Legal Document'}</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 50px 70px;
            color: #111827;
            font-size: 13pt;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #1E3F2E;
            padding-bottom: 12px;
          }
          .logo {
            font-size: 22pt;
            font-weight: bold;
            color: #1E3F2E;
            letter-spacing: 2px;
          }
          .subtitle {
            font-size: 11pt;
            color: #4B5563;
            margin-top: 4px;
          }
          .title {
            text-align: center;
            font-size: 17pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 25px 0;
            text-transform: uppercase;
            color: #0F172A;
          }
          .date {
            text-align: right;
            margin-bottom: 25px;
            font-size: 12pt;
          }
          .content {
            margin: 25px 0;
            text-align: justify;
            white-space: pre-line;
          }
          .signature {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
          }
          .sig-box {
            width: 240px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #111827;
            margin-bottom: 6px;
          }
          .footer {
            text-align: center;
            margin-top: 60px;
            font-size: 9.5pt;
            color: #6B7280;
            border-top: 1px solid #E5E7EB;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">LEGALLINK PAKISTAN</div>
          <div class="subtitle">Accredited Judicial Drafting & Legal Aid Assistance</div>
          <div class="subtitle">www.legallink.pk • info@legallink.pk</div>
        </div>

        <div class="title">${selectedDoc?.name || 'LEGAL INSTRUMENT'}</div>

        <div class="date">
          <strong>Date:</strong> ${date}<br>
          ${caseNumber ? `<strong>Reference / Docket:</strong> ${caseNumber}<br>` : ''}
          ${userName ? `<strong>In Favor Of:</strong> ${userName}` : ''}
        </div>

        <div class="content">
To Whom It May Concern,

This legal instrument constitutes an official document formulated via the LegalLink Legal Technology Suite.

${selectedDoc?.content || ''}

The signatories hereto acknowledge having perused, verified, and authenticated the factual contents described herein.
        </div>

        <div class="signature">
          <div class="sig-box" style="float: left;">
            <div class="sig-line"></div>
            <div>Authorized Signatory / Deponent</div>
          </div>
          <div class="sig-box" style="float: right;">
            <div class="sig-line"></div>
            <div>Advocate High Court / LegalLink</div>
          </div>
        </div>

        <div style="clear: both;"></div>

        <div class="footer">
          <p>Verified through LegalLink Digital Docket System • Valid for Pakistan Bar Council Judicial Filing</p>
          <p>© ${new Date().getFullYear()} LegalLink Pakistan. All Rights Reserved.</p>
        </div>
      </body>
      </html>
    `;
  };

  const generateDOCX = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'LEGALLINK PAKISTAN',
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: selectedDoc?.name || 'LEGAL DOCUMENT',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: `Date: ${date}`, alignment: AlignmentType.RIGHT }),
            ...(caseNumber ? [new Paragraph({ text: `Ref: ${caseNumber}`, alignment: AlignmentType.RIGHT })] : []),
            ...(userName ? [new Paragraph({ text: `Prepared For: ${userName}`, alignment: AlignmentType.RIGHT })] : []),
            new Paragraph({ text: '' }),
            new Paragraph(selectedDoc?.content || ''),
            new Paragraph({ text: '' }),
            new Paragraph({ text: '_________________________', alignment: AlignmentType.LEFT }),
            new Paragraph('Authorized Signature'),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${selectedDoc.name.replace(/\s/g, '_')}_${caseNumber || 'template'}.docx`);
  };

  const handleDownload = async () => {
    if (downloadFormat === 'html') {
      const content = getFullDocumentHTML();
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDoc.name.replace(/\s/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (downloadFormat === 'pdf') {
      const element = document.createElement('div');
      element.innerHTML = getFullDocumentHTML();
      const opt = {
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `${selectedDoc.name.replace(/\s/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      };
      html2pdf().set(opt).from(element).save();
    } else if (downloadFormat === 'docx') {
      await generateDOCX();
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(getFullDocumentHTML());
    printWindow.document.close();
    printWindow.print();
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  return (
    <div className="ll-user-page">
      <div className="ll-ambient-grid" />
      <Navbar />
      <PageHero
        kicker="Legal templates"
        accent="Ready-made"
        title="Legal Document Templates"
        text="Fill in, preview and download legal notices, affidavits, powers of attorney and agreements as PDF or Word."
        icon="file"
      />

      <main className="container position-relative py-5 lx-after-hero" style={{ zIndex: 1 }} data-reveal>
        

        {/* Templates 3D Grid */}
        <div className="row g-4 mb-5 ll-perspective-wrap" data-reveal>
          {templates.map((template) => {
            const isSelected = selectedDoc?.id === template.id;
            return (
              <div className="col-md-6 col-lg-4" key={template.id}>
                <div
                  className="ll-card-3d h-100 p-4 d-flex flex-column justify-content-between"
                  onClick={() => handleTemplateClick(template)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--ll-brand-gold)' : 'var(--ll-border)',
                    boxShadow: isSelected
                      ? 'var(--ll-shadow-3d-hover)'
                      : 'var(--ll-shadow-3d)',
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '14px',
                          background: isDark ? 'rgba(212, 175, 55, 0.12)' : '#F1F5F9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid var(--ll-border)',
                        }}
                      >
                        {template.iconKey === 'notice' && <FileText size={22} color={isDark ? "#D4AF37" : "#1E3F2E"} />}
                        {template.iconKey === 'affidavit' && <Scale size={22} color={isDark ? "#D4AF37" : "#1E3F2E"} />}
                        {template.iconKey === 'poa' && <ShieldCheck size={22} color={isDark ? "#D4AF37" : "#1E3F2E"} />}
                        {template.iconKey === 'contract' && <Briefcase size={22} color={isDark ? "#D4AF37" : "#1E3F2E"} />}
                        {template.iconKey === 'recovery' && <CreditCard size={22} color={isDark ? "#D4AF37" : "#1E3F2E"} />}
                        {template.iconKey === 'cease' && <AlertTriangle size={22} color="#DC2626" />}
                      </div>

                      <span
                        className="ll-badge-3d"
                        style={{
                          fontSize: '11px',
                          background: isSelected
                            ? isDark ? '#D4AF37' : '#1E3F2E'
                            : 'var(--ll-bg-subtle)',
                          color: isSelected
                            ? isDark ? '#0A1A13' : '#FFFFFF'
                            : 'var(--ll-text-secondary)',
                        }}
                      >
                        {template.category}
                      </span>
                    </div>

                    <h4
                      style={{
                        fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: 'var(--ll-text-primary)',
                        marginBottom: '8px',
                      }}
                    >
                      {template.name}
                    </h4>

                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--ll-text-secondary)',
                        lineHeight: 1.5,
                        marginBottom: '16px',
                      }}
                    >
                      {template.description}
                    </p>
                  </div>

                  <button
                    className="ll-btn-3d w-100"
                    style={{
                      borderRadius: '10px',
                      fontSize: '13px',
                      background: isSelected
                        ? 'linear-gradient(135deg, #D4AF37, #B48216)'
                        : isDark ? '#15241D' : '#F1F4F0',
                      color: isSelected
                        ? '#0A1A13'
                        : 'var(--ll-text-primary)',
                      border: '1px solid var(--ll-border)',
                    }}
                  >
                    {isSelected ? 'Selected for Drafting' : 'Select Template'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Customization Drawer / Editor */}
        <div ref={customizationRef}>
          {selectedDoc && (
            <div
              className="ll-glass-card p-4 p-md-5 mb-5"
              style={{
                borderRadius: '24px',
                border: '1px solid var(--ll-brand-gold)',
                boxShadow: isDark
                  ? '0 20px 45px rgba(0,0,0,0.7), 0 0 25px rgba(212, 175, 55, 0.2)'
                  : '0 16px 36px rgba(30, 63, 46, 0.12)',
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-3 border-bottom" style={{ borderColor: 'var(--ll-border)' }}>
                <div className="d-flex align-items-center gap-3">
                  <span style={{ fontSize: '28px' }}>{selectedDoc.icon}</span>
                  <div>
                    <h3
                      style={{
                        fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                        fontWeight: 700,
                        color: 'var(--ll-text-primary)',
                        margin: 0,
                      }}
                    >
                      Customize: {selectedDoc.name}
                    </h3>
                    <span style={{ fontSize: '13px', color: 'var(--ll-text-muted)' }}>
                      Fill in parties and case reference to generate your official document
                    </span>
                  </div>
                </div>

                <button
                  className="ll-btn-3d ll-btn-3d-secondary"
                  onClick={() => setSelectedDoc(null)}
                  style={{ borderRadius: '10px', padding: '6px 14px', fontSize: '13px' }}
                >
                  <X size={15} />
                  <span>Close Editor</span>
                </button>
              </div>

              <div className="row g-4" data-reveal>
                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13.5px', color: 'var(--ll-text-primary)' }}>
                    Client / Party Full Name
                  </label>
                  <input
                    type="text"
                    className="ll-input-3d"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Muhammad Aslam Khan"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13.5px', color: 'var(--ll-text-primary)' }}>
                    Case Docket / Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    className="ll-input-3d"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="e.g. LL-2025-CIV-8849"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13.5px', color: 'var(--ll-text-primary)' }}>
                    Execution Date
                  </label>
                  <input
                    type="text"
                    className="ll-input-3d"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold" style={{ fontSize: '13.5px', color: 'var(--ll-text-primary)' }}>
                    Download Export Format
                  </label>
                  <select
                    className="ll-input-3d"
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                  >
                    <option value="pdf">Adobe PDF Document (.pdf)</option>
                    <option value="docx">Microsoft Word (.docx)</option>
                    <option value="html">Standalone Webpage (.html)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-3 flex-wrap mt-4 pt-3 border-top" style={{ borderColor: 'var(--ll-border)' }}>
                <button
                  className="ll-btn-3d ll-btn-3d-primary"
                  onClick={handlePreview}
                >
                  <Eye size={16} />
                  <span>Preview Parchment</span>
                </button>

                <button
                  className="ll-btn-3d ll-btn-3d-gold"
                  onClick={handleDownload}
                >
                  <Download size={16} />
                  <span>Download {downloadFormat.toUpperCase()}</span>
                </button>

                <button
                  className="ll-btn-3d ll-btn-3d-secondary"
                  onClick={handlePrint}
                >
                  <Printer size={16} />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Document Preview Modal */}
        {showPreview && selectedDoc && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5, 8, 14, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '920px',
                backgroundColor: isDark ? '#111827' : '#FFFFFF',
                borderRadius: '20px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
                overflow: 'hidden',
                border: '1px solid var(--ll-border)',
              }}
            >
              <div className="d-flex justify-content-between align-items-center p-3 px-4 border-bottom" style={{ borderColor: 'var(--ll-border)' }}>
                <span className="fw-bold" style={{ color: 'var(--ll-text-primary)' }}>
                  Parchment Preview: {selectedDoc.name}
                </span>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--ll-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <iframe
                srcDoc={getFullDocumentHTML()}
                title="Document Preview"
                style={{ width: '100%', height: '70vh', border: 'none', background: '#FFFFFF' }}
              />

              <div className="d-flex justify-content-end gap-2 p-3 px-4 border-top" style={{ borderColor: 'var(--ll-border)' }}>
                <button
                  className="ll-btn-3d ll-btn-3d-gold"
                  onClick={handleDownload}
                >
                  <Download size={15} />
                  <span>Download File</span>
                </button>
                <button
                  className="ll-btn-3d ll-btn-3d-secondary"
                  onClick={handlePrint}
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-5">
          <p style={{ color: 'var(--ll-text-muted)', fontSize: '13.5px' }}>
            <strong>Legal Notice:</strong> Templates provided are standard draft instruments. For active contested litigation, please consult with a verified advocate on LegalLink.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Documents;
