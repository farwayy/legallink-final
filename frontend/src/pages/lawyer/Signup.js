import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import AuthLayout from "../../components/AuthLayout";
import { Mail, Scale, ShieldCheck, Briefcase, FileCheck2, ArrowRight, ArrowLeft, Clock, X, Check, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { API_URL } from "../../config";

const STEPS = ["Basic info", "Verify", "Credentials", "Submit"];

const ADVOCATE_LAYOUT = {
  eyebrow: "Advocate registration",
  title: <>Practise with <em>verified</em> standing.</>,
  description: "Join LegalLink's network of Bar Council verified advocates and receive case inquiries from citizens and legal aid organisations across Pakistan.",
  highlights: [
    { icon: ShieldCheck, title: "Bar Council verification", text: "Your enrolment is checked by the LegalLink review committee." },
    { icon: Briefcase, title: "Client case inquiries", text: "Accept private and pro bono matters that match your expertise." },
    { icon: Scale, title: "Hearings & case management", text: "Track hearings, documents and client communication in one docket." },
  ],
};

const LawyerSignup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Messages shown inside the form (instead of browser pop-ups)
  // type: "error" | "success" | "warning" | "info"
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);
  const say = (type, text) => setNotice({ type, text });

  useEffect(() => {
    if (notice && noticeRef.current) noticeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notice]);

  const goToStep = (n) => {
    setNotice(null);
    setStep(n);
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
    photo: null,
    barCouncilId: "",
    stateOfPractice: [],
    experience: "",
    totalCases: "",
    officialDocument: null,
    specialization: [],
    officeAddress: "",
    languages: [],
    bio: "",
    password: "",
  });

  const handleRecaptcha = (token) => {
    setRecaptchaToken(token);
    setRecaptchaVerified(true);
  };

  // Password validation
  const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push("at least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
    if (!/[0-9]/.test(password)) errors.push("one number");
    if (!/[!@#$%^&*(),.?":_{}|<>]/.test(password)) errors.push("one special character");
    return errors;
  };

  // Step 1 checks, so problems show up before the last step
  const checkBasicInfo = () => {
    if (formData.name.trim().length < 3) return "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return "Enter a valid email address.";
    if (formData.phone.length !== 10) return "Phone number must be 10 digits after +92, for example 3001234567.";
    if (!/^[0-9]{5}-[0-9]{7}-[0-9]{1}$/.test(formData.cnic)) return "CNIC must have 13 digits, like 12345-1234567-1.";
    if (!formData.photo) return "Add a profile photo (JPG or PNG, up to 100 KB).";
    const pw = validatePassword(formData.password);
    if (pw.length > 0) return `Your password needs ${pw.join(", ")}.`;
    if (formData.password !== confirmPassword) return "The two passwords don't match.";
    return "";
  };

  // Step 3 checks
  const checkCredentials = () => {
    if (!formData.barCouncilId.trim()) return "Enter your Bar Council enrolment number.";
    if (formData.stateOfPractice.length === 0) return "Choose at least one province where you practise.";
    if (formData.experience === "" || Number(formData.experience) < 0) return "Enter your years of experience.";
    if (formData.totalCases === "" || Number(formData.totalCases) < 0) return "Enter how many cases you have handled.";
    if (!formData.officialDocument) return "Upload your Bar Council document.";
    if (formData.specialization.length === 0) return "Choose at least one area of expertise.";
    if (!formData.officeAddress.trim()) return "Enter your office address.";
    if (formData.languages.length === 0) return "Choose at least one language.";
    return "";
  };

  // Is this email / CNIC / Bar Council number already registered? (checked on the step itself)
  const [checking, setChecking] = useState(false);
  const alreadyTaken = async (fields) => {
    setChecking(true);
    try {
      const res = await fetch(`${API_URL}/auth/check-available`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "lawyer", ...fields }),
      });
      const data = await res.json();
      return data.taken ? Object.values(data.taken)[0] || "" : "";
    } catch (e) {
      return ""; // the final submit checks again
    } finally {
      setChecking(false);
    }
  };

  const continueFromBasicInfo = async () => {
    const problem = checkBasicInfo();
    if (problem) return say("error", problem);
    const taken = await alreadyTaken({ email: formData.email.trim(), cnic: formData.cnic });
    if (taken) return say("error", taken);
    goToStep(2);
  };

  const continueFromCredentials = async () => {
    const problem = checkCredentials();
    if (problem) return say("error", problem);
    const taken = await alreadyTaken({ barCouncilId: formData.barCouncilId.trim() });
    if (taken) return say("error", taken);
    goToStep(4);
  };

  // Send verification code
  const handleSendVerification = async () => {
    if (!formData.phone || !formData.email) {
      say("error", "Enter your phone number and email first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/auth/send-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formData.phone,
            email: formData.email,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        setCodeSent(true);
        if (data.emailSent === false && data.devCode) {
          say("warning", `The email couldn't be sent, so here is your code for testing: ${data.devCode}`);
        } else {
          say("success", `We sent a 6-digit code to ${formData.email}. Check your inbox and spam folder.`);
        }
      } else {
        say("error", data.message || "We couldn't send the code. Check your email address and try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      say("error", "We can't reach LegalLink right now. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      say("error", "Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch(`${API_URL}/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, code: verificationCode }),
      });
      const data = await response.json();
      if (response.ok) {
        goToStep(3);
      } else {
        say("error", data.message || "That code isn't right.");
      }
    } catch (err) {
      say("error", "We can't reach LegalLink right now. Check your internet connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Handle CNIC - only digits, max 13, auto-add dashes
    if (name === "cnic") {
      let cleaned = value.replace(/\D/g, "");
      if (cleaned.length > 13) cleaned = cleaned.slice(0, 13);

      let formatted = "";
      if (cleaned.length === 0) {
        formatted = "";
      } else if (cleaned.length <= 5) {
        formatted = cleaned;
      } else if (cleaned.length <= 12) {
        formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      } else {
        formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12, 13)}`;
      }

      setFormData({ ...formData, [name]: formatted });
      return;
    }

    // Handle Phone - only digits, max 10 (without +92)
    if (name === "phone") {
      let cleaned = value.replace(/\D/g, "");
      if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
      setFormData({ ...formData, [name]: cleaned });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (e, field) => {
    const value = e.target.value;
    if (value === "") return;

    if (field === "stateOfPractice" || field === "specialization" || field === "languages") {
      if (!formData[field].includes(value)) {
        setFormData({ ...formData, [field]: [...formData[field], value] });
      }
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const removeItem = (field, itemToRemove) => {
    setFormData({
      ...formData,
      [field]: formData[field].filter(item => item !== itemToRemove)
    });
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      if (field === "photo" && file.size > 100 * 1024) {
        say("error", "Your photo must be smaller than 100 KB.");
        e.target.value = "";
        return;
      }
      if (
        field === "photo" &&
        !["image/jpeg", "image/jpg", "image/png"].includes(file.type)
      ) {
        say("error", "Your photo must be a JPG or PNG file.");
        e.target.value = "";
        return;
      }
      if (field === "officialDocument") {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (!["pdf", "jpg", "jpeg", "png", "doc", "docx"].includes(ext)) {
          say("error", "Your Bar Council document must be a PDF, JPG, PNG or Word file.");
          e.target.value = "";
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          say("error", "Your Bar Council document must be smaller than 10 MB.");
          e.target.value = "";
          return;
        }
      }
      setNotice(null);
      setFormData({ ...formData, [field]: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check everything again in case an earlier step was changed
    const problem = checkBasicInfo() || checkCredentials();
    if (problem) {
      say("error", problem);
      return;
    }

    if (!recaptchaVerified) {
      say("error", "Tick \"I'm not a robot\" first.");
      return;
    }

    setLoading(true);

    const submitData = new FormData();
    Object.keys(formData).forEach((key) => {
      if (
        key === "specialization" ||
        key === "languages" ||
        key === "stateOfPractice"
      ) {
        submitData.append(key, JSON.stringify(formData[key]));
      } else if (formData[key] !== null) {
        submitData.append(key, formData[key]);
      }
    });
    // Add +92 prefix to phone before submitting
    submitData.set("phone", `+92${formData.phone}`);
    submitData.append("verificationCode", verificationCode);
    submitData.append("recaptchaToken", recaptchaToken);

    try {
      const response = await axios.post(
        `${API_URL}/auth/lawyer/signup`,
        submitData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log("Response:", response.data);
      setSubmitted(true);
    } catch (error) {
      console.error("Error:", error.response?.data);
      const msg = error.response?.data?.message || "";
      if (/verification code/i.test(msg)) {
        // The code expired or was replaced: send them back to get a new one
        setStep(2);
        say("error", `${msg} Then continue again.`);
      } else if (/already exists/i.test(msg)) {
        say("error", "An advocate account with this email, CNIC or Bar Council number already exists. Try signing in instead.");
      } else {
        say("error", msg || "We couldn't submit your application. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout {...ADVOCATE_LAYOUT}>
        <div style={{ textAlign: "center" }}>
          <span className="auth-chip"><Clock size={12} /> Under review</span>
          <h1 className="auth-title">Application submitted</h1>
          <p className="auth-subtitle">
            Thank you for registering. Our admin team is reviewing your credentials and will email you once your account is verified.
          </p>
          <div className="auth-note" style={{ marginBottom: 22 }}>
            <Mail size={16} />
            <span>Verification typically takes 2–3 business days.</span>
          </div>
          <button className="auth-btn" onClick={() => navigate("/")}>Back to home</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...ADVOCATE_LAYOUT} wide backTo="/signup?role=lawyer" backLabel="Account types">
      <span className="auth-chip"><Scale size={12} /> Advocate account</span>
      <h1 className="auth-title">Register as an advocate</h1>
      <p className="auth-subtitle">Four short steps. Have your CNIC and Bar Council enrolment details ready.</p>

      <div className="auth-steps" aria-label={`Step ${step} of ${STEPS.length}`}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = step === n ? " is-active" : step > n ? " is-done" : "";
          return (
            <React.Fragment key={label}>
              {i > 0 && <span className={`auth-step-line${step > i ? " is-done" : ""}`} />}
              <span className={`auth-step${state}`}>
                <span className="auth-step-dot">{step > n ? <Check size={14} strokeWidth={3} /> : n}</span>
                <span className="auth-step-label">{label}</span>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {notice && (
        <div ref={noticeRef} className={`auth-alert auth-alert-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.type === "error" ? <AlertCircle size={17} /> : notice.type === "success" ? <CheckCircle2 size={17} /> : <Info size={17} />}
          <span>{notice.text}</span>
        </div>
      )}

      {step > 1 && (
        <button
          type="button"
          className="auth-back-link"
          style={{ background: "none", border: "none", padding: 0, marginBottom: 14 }}
          onClick={() => goToStep(step - 1)}
        >
          <ArrowLeft size={15} /> Previous step
        </button>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div>
          <h2 className="auth-section-title">Basic Information</h2>

          <div className="mb-3">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              name="name"
              className="form-control"
              onChange={handleChange}
              required
            />
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Email *</label>
              <input
                type="email"
                name="email"
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Phone *</label>
              <div className="input-group">
                <span className="input-group-text">+92</span>
                <input
                  type="tel"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="3001234567"
                  maxLength="10"
                  required
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">CNIC *</label>
              <input
                type="text"
                name="cnic"
                className="form-control"
                value={formData.cnic}
                onChange={handleChange}
                placeholder="12345-1234567-1"
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Photo * (JPG/PNG, max 100KB)</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="form-control"
                onChange={(e) => handleFileChange(e, "photo")}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Password *</label>
            <input
              type="password"
              name="password"
              className="form-control"
              onChange={handleChange}
              required
            />
            <small className="text-muted">
              Must be at least 8 characters, contain uppercase, number, and special character
            </small>
          </div>

          <div className="mb-3">
            <label className="form-label">Confirm Password *</label>
            <input
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="button"
            className="auth-btn"
            onClick={continueFromBasicInfo}
            disabled={checking}
          >
            {checking ? <><span className="btn-spinner" />Checking…</> : <>Continue <ArrowRight size={17} /></>}
          </button>
        </div>
      )}

      {/* Step 2: Verification */}
      {step === 2 && (
        <div>
          <h2 className="auth-section-title">Verify Your Contact</h2>

          <div className="auth-note" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 18, marginBottom: 18 }}>
            <span><strong>Phone:</strong> +92{formData.phone}</span>
            <span><strong>Email:</strong> {formData.email}</span>
          </div>

          <div className="mb-3">
            <label className="form-label">Enter 6-digit verification code</label>
            <div className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                maxLength="6"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                type="button"
                className="auth-btn auth-btn-outline auth-btn-inline"
                onClick={handleSendVerification}
                disabled={loading}
              >
                {loading ? <><span className="btn-spinner" />Sending…</> : codeSent ? "Send again" : "Send code"}
              </button>
            </div>
            <small className="text-muted">A 6-digit code will be sent to your email</small>
          </div>

          <button
            type="button"
            className="auth-btn"
            style={{ marginTop: 8 }}
            onClick={handleVerifyCode}
            disabled={verifying}
          >
            {verifying ? "Checking code…" : <>Verify & continue <ArrowRight size={17} /></>}
          </button>
        </div>
      )}

      {/* Step 3: Professional Credentials */}
      {step === 3 && (
        <div>
          <h2 className="auth-section-title">Professional Credentials</h2>

          <div className="mb-3">
            <label className="form-label">Bar Council Enrollment Number *</label>
            <input
              type="text"
              name="barCouncilId"
              className="form-control"
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">State of Practice *</label>
            <div className="d-flex gap-2 flex-wrap mb-2">
              {formData.stateOfPractice.map((item, idx) => (
                <span key={idx} className="auth-tag">
                  {item}
                  <button type="button" onClick={() => removeItem("stateOfPractice", item)} aria-label={`Remove ${item}`}><X size={12} /></button>
                </span>
              ))}
            </div>
            <select
              className="form-select"
              onChange={(e) => handleSelectChange(e, "stateOfPractice")}
              value=""
            >
              <option value="">Select State of Practice</option>
              <option value="Punjab">Punjab</option>
              <option value="Sindh">Sindh</option>
              <option value="KPK">KPK</option>
              <option value="Balochistan">Balochistan</option>
              <option value="Islamabad">Islamabad</option>
              <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
              <option value="Azad Kashmir">Azad Kashmir</option>
            </select>
            <small className="text-muted">Select states where you are licensed to practice</small>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Years of Experience *</label>
              <input
                type="number"
                name="experience"
                className="form-control"
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Total Cases Handled *</label>
              <input
                type="number"
                name="totalCases"
                className="form-control"
                placeholder="Number of cases you've handled"
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Official Council Document *</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="form-control"
                onChange={(e) => handleFileChange(e, "officialDocument")}
                required
              />
              <small className="text-muted">PDF, JPG, PNG or Word document, up to 10 MB</small>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Area of Expertise *</label>
            <div className="d-flex gap-2 flex-wrap mb-2">
              {formData.specialization.map((item, idx) => (
                <span key={idx} className="auth-tag">
                  {item}
                  <button type="button" onClick={() => removeItem("specialization", item)} aria-label={`Remove ${item}`}><X size={12} /></button>
                </span>
              ))}
            </div>
            <select
              className="form-select"
              onChange={(e) => handleSelectChange(e, "specialization")}
              value=""
            >
              <option value="">Select Specialization</option>
              <option value="Corporate Law">Corporate Law</option>
              <option value="Family Law">Family Law</option>
              <option value="Criminal Law">Criminal Law</option>
              <option value="Domestic Violence">Domestic Violence</option>
              <option value="Civil Law">Civil Law</option>
              <option value="Property Law">Property Law</option>
              <option value="Human Rights">Human Rights</option>
              <option value="Women Rights">Women Rights</option>
              <option value="Tax Law">Tax Law</option>
              <option value="Labor Law">Labor Law</option>
              <option value="Cyber Law">Cyber Law</option>
              <option value="Immigration Law">Immigration Law</option>
            </select>
            <small className="text-muted">Select your areas of expertise</small>
          </div>

          <div className="mb-3">
            <label className="form-label">Office Address *</label>
            <textarea
              name="officeAddress"
              className="form-control"
              rows="2"
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Languages *</label>
            <div className="d-flex gap-2 flex-wrap mb-2">
              {formData.languages.map((item, idx) => (
                <span key={idx} className="auth-tag">
                  {item}
                  <button type="button" onClick={() => removeItem("languages", item)} aria-label={`Remove ${item}`}><X size={12} /></button>
                </span>
              ))}
            </div>
            <select
              className="form-select"
              onChange={(e) => handleSelectChange(e, "languages")}
              value=""
            >
              <option value="">Select Language</option>
              <option value="English">English</option>
              <option value="Urdu">Urdu</option>
              <option value="Punjabi">Punjabi</option>
              <option value="Sindhi">Sindhi</option>
              <option value="Pashto">Pashto</option>
              <option value="Balochi">Balochi</option>
              <option value="Arabic">Arabic</option>
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Bio/Professional Summary</label>
            <textarea
              name="bio"
              className="form-control"
              rows="3"
              onChange={handleChange}
            />
          </div>

          <button
            type="button"
            className="auth-btn"
            onClick={continueFromCredentials}
            disabled={checking}
          >
            {checking ? <><span className="btn-spinner" />Checking…</> : <>Continue <ArrowRight size={17} /></>}
          </button>
        </div>
      )}

      {/* Step 4: Captcha & Submit */}
      {step === 4 && (
        <div>
          <h2 className="auth-section-title">Final Step</h2>
          {/* Google reCAPTCHA */}
          <div className="mb-4 text-center">
            <ReCAPTCHA
              sitekey="6LeYjs0sAAAAAERIGSoDZBsEigpysKm8a-4i9-Q2"
              onChange={handleRecaptcha}
            />
          </div>
          <div className="auth-alert auth-alert-warning">
            <FileCheck2 size={17} />
            <small style={{ color: "inherit", fontSize: 13 }}>
              By submitting, you confirm that all information provided
              is accurate. False information may lead to rejection.
            </small>
          </div>
          <button
            type="button"
            className="auth-btn"
            onClick={handleSubmit}
            disabled={loading || !recaptchaVerified}
          >
            {loading ? <><span className="btn-spinner" />Submitting…</> : "Submit Application"}
          </button>
        </div>
      )}

      <div className="auth-switch">
        Already registered?{" "}
        <Link to="/login?role=lawyer" className="auth-link">Sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default LawyerSignup;