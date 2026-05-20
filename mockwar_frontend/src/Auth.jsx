import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // 🔥 NEW: useSearchParams
import { auth, googleProvider } from './firebase';
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import axios from 'axios';
import { Smartphone, Mail, ShieldCheck, User, MapPin, CalendarDays, Zap, Camera, Check, Gift } from 'lucide-react'; // 🔥 NEW: Gift icon
const API_BASE = "https://mockwar-backend.onrender.com";
// 🗺️ All India States & Top Districts
const INDIA_STATES = {
  "Andaman and Nicobar Islands": ["Nicobar", "North and Middle Andaman", "South Andaman"],
  "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Sri Potti Sriramulu Nellore", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa", "Parvathipuram Manyam", "Anakapalli", "Kakinada", "Konaseema", "Eluru", "NTR", "Bapatla", "Palnadu", "Tirupati", "Annamayya", "Sri Sathya Sai", "Nandyal"],
  "Arunachal Pradesh": ["Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang"],
  "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
  "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
  "Chandigarh": ["Chandigarh"],
  "Chhattisgarh": ["Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband", "Gaurela Pendra Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Kondagaon", "Korba", "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
  "Goa": ["North Goa", "South Goa"],
  "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
  "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  "Jammu and Kashmir": ["Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"],
  "Jharkhand": ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"],
  "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"],
  "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
  "Ladakh": ["Kargil", "Leh"],
  "Lakshadweep": ["Lakshadweep"],
  "Madhya Pradesh": ["Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Narmadapuram", "Indore", "Jabalpur", "Jhabua", "Katni", "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena", "Narsinghpur", "Neemuch", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha", "Niwari"],
  "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "Manipur": ["Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"],
  "Meghalaya": ["East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"],
  "Mizoram": ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"],
  "Nagaland": ["Chumukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek", "Tuensang", "Tseminyu", "Wokha", "Zunheboto"],
  "Odisha": ["Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"],
  "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
  "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran", "Malerkotla"],
  "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
  "Sikkim": ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim"],
  "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
  "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal Rural", "Warangal Urban", "Yadadri Bhuvanagiri"],
  "Tripura": ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
  "Uttarakhand": ["Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"],
  "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
};

function Auth() {
  const navigate = useNavigate();
  
  // 🔥 NEW: Extract Referral Code from URL (e.g., ?ref=PLAYERWIN)
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref") || "";
  
  // 🔄 UI States
  const [loginMethod, setLoginMethod] = useState('phone'); 
  const [isNewUser, setIsNewUser] = useState(false); 
  const [loading, setLoading] = useState(false);

  // 📱 Phone Auth
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // 📝 Registration Form (🔥 Added referred_by field)
  const [regData, setRegData] = useState({
    name: '', dob: '', state: '', district: '', uid: '', phone: '', email: '', live_photo: '', referred_by: referralCode
  });

  // 📸 Camera States & Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);

  // --- 📸 CAMERA FUNCTIONS ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      alert("Camera access denied! Live photo is mandatory for KYC.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      setRegData({ ...regData, live_photo: base64Image });
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };
  // ---------------------------

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken(true);
      await verifyTokenWithDjango(token);
    } catch (error) {
      alert("Google Login Failed!");
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    if (phone.length !== 10) return alert("Please enter a valid 10-digit mobile number");
    try {
      setLoading(true);
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const confirmation = await signInWithPhoneNumber(auth, "+91" + phone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setLoading(false);
    } catch (error) {
      alert("Failed to send OTP.");
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) return alert("Please enter a valid 6-digit OTP");
    try {
      setLoading(true);
      const result = await confirmationResult.confirm(otp);
      const token = await result.user.getIdToken();
      await verifyTokenWithDjango(token);
    } catch (error) {
      alert("Incorrect OTP!");
      setLoading(false);
    }
  };

  const verifyTokenWithDjango = async (idToken) => {
    try {
      const response = await axios.post(`${API_BASE}/api/auth/firebase-login/`, { id_token: idToken });
      if (response.data.is_new_user) {
        setIsNewUser(true);
        setRegData({ ...regData, uid: response.data.uid, phone: response.data.phone || phone, email: response.data.email || '' });
        setLoading(false);
      } else {
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        navigate('/'); 
      }
    } catch (error) {
      alert("Server error during verification.");
      setLoading(false);
    }
  };

  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (!regData.live_photo) return alert("Please capture a live photo for KYC!");
    
    setLoading(true);
    try {
      // 🔥 Send the registration data (including referred_by) to Django
      const response = await axios.post(`${API_BASE}/api/auth/complete-registration/`, regData);
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      alert(`Account Created! Your Gamer Tag is: ${response.data.username}`);
      navigate('/'); 
    } catch (error) {
      alert("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div id="recaptcha-container"></div>

      <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.4)] w-full max-w-md border border-slate-800/80 z-10 animate-scale-up">
        
        <div className="text-center mb-8 relative">
          <div className="inline-flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest mb-4">
            <Zap size={12} className="mr-1" /> Elite Access
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400">MOCKWAR</h1>
        </div>

        {/* 📋 REGISTRATION FORM */}
        {isNewUser ? (
          <form onSubmit={handleRegistrationSubmit} className="space-y-4 animate-fade-in">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mb-4 flex items-center gap-3">
              <ShieldCheck className="text-emerald-400" size={24} />
              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Verified. Setup Profile & KYC.</p>
            </div>
            
            {/* 🔥 NEW: Show Referral Trust Badge if code exists */}
            {regData.referred_by && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl mb-4 flex items-center justify-center gap-2">
                <Gift className="text-amber-400" size={16} />
                <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">
                  Referral Applied: {regData.referred_by}
                </p>
              </div>
            )}
            
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="text" placeholder="Full Name" required onChange={(e) => setRegData({...regData, name: e.target.value})}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:border-blue-500 outline-none transition-colors" />
            </div>

            {/* 🔥 MANDATORY EMAIL IF CAME VIA PHONE OTP */}
            {loginMethod === 'phone' && (
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" placeholder="Email Address" required onChange={(e) => setRegData({...regData, email: e.target.value})}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:border-blue-500 outline-none transition-colors" />
              </div>
            )}

            {/* 🔥 MANDATORY PHONE IF CAME VIA GOOGLE */}
            {loginMethod === 'google' && (
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="tel" maxLength="10" placeholder="Mobile Number" required onChange={(e) => setRegData({...regData, phone: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:border-blue-500 outline-none tracking-widest font-bold transition-colors" />
              </div>
            )}
            
            <div className="relative">
              <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="date" required onChange={(e) => setRegData({...regData, dob: e.target.value})}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-slate-400 focus:text-white focus:border-blue-500 outline-none transition-colors" />
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select required value={regData.state} onChange={(e) => setRegData({...regData, state: e.target.value, district: ''})}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-400 focus:text-white focus:border-blue-500 outline-none text-sm transition-colors">
                  <option value="">State</option>
                  {Object.keys(INDIA_STATES).map(state => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>

              <div className="relative flex-1">
                <select required value={regData.district} disabled={!regData.state} onChange={(e) => setRegData({...regData, district: e.target.value})}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-400 focus:text-white focus:border-blue-500 outline-none disabled:opacity-30 text-sm transition-colors">
                  <option value="">District</option>
                  {regData.state && INDIA_STATES[regData.state].map(dist => <option key={dist} value={dist}>{dist}</option>)}
                </select>
              </div>
            </div>

            {/* 📸 LIVE PHOTO SECTION */}
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 text-center mt-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex justify-center items-center gap-2"><Camera size={16}/> Live KYC Photo</h3>
              
              {isCameraOpen ? (
                <div className="space-y-3">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-40 object-cover rounded-lg border border-slate-700 mx-auto" />
                  <button type="button" onClick={capturePhoto} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-500">Capture</button>
                </div>
              ) : regData.live_photo ? (
                <div className="space-y-3">
                  <div className="relative w-28 h-28 mx-auto">
                    <img src={regData.live_photo} alt="KYC" className="w-full h-full object-cover rounded-full border-4 border-emerald-500 shadow-lg" />
                    <div className="absolute bottom-0 right-0 bg-emerald-500 p-1.5 rounded-full"><Check size={16} className="text-white"/></div>
                  </div>
                  <button type="button" onClick={startCamera} className="text-xs text-blue-400 hover:text-blue-300 font-bold underline">Retake Photo</button>
                </div>
              ) : (
                <button type="button" onClick={startCamera} className="w-full bg-slate-800 text-slate-300 font-bold py-3 rounded-lg border border-slate-700 hover:bg-slate-700 flex justify-center items-center gap-2">
                  <Camera size={18} /> Open Camera
                </button>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] mt-6 transition-all active:scale-95 disabled:opacity-50">
              {loading ? "INITIALIZING..." : "INITIALIZE ACCOUNT"}
            </button>
          </form>
        ) : (
          
          /* 🔐 LOGIN SECTION */
          <div className="space-y-6">
            <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800/60">
              <button onClick={() => setLoginMethod('phone')} className={`flex-1 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all ${loginMethod === 'phone' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                <Smartphone size={14} className="inline mr-1.5 mb-0.5" /> SMS OTP
              </button>
              <button onClick={() => setLoginMethod('google')} className={`flex-1 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all ${loginMethod === 'google' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                <Mail size={14} className="inline mr-1.5 mb-0.5" /> G-MAIL
              </button>
            </div>

            {loginMethod === 'phone' && (
              <div className="space-y-4 animate-fade-in">
                {!otpSent ? (
                  <>
                    <div className="flex gap-2">
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-500 font-black flex items-center">+91</div>
                      <input type="tel" maxLength="10" placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:border-blue-500 outline-none tracking-widest transition-colors font-bold" />
                    </div>
                    <button onClick={sendOTP} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all active:scale-95 disabled:opacity-50">
                      {loading ? "CONNECTING..." : "SECURE OTP LOGIN"}
                    </button>
                  </>
                ) : (
                  <>
                    <input type="text" maxLength="6" placeholder="------" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-4 text-white focus:border-emerald-500 outline-none tracking-[1em] text-center text-3xl font-black transition-colors" />
                    <button onClick={verifyOTP} disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 disabled:opacity-50">
                      {loading ? "VERIFYING..." : "CONFIRM & ENTER"}
                    </button>
                  </>
                )}
              </div>
            )}

            {loginMethod === 'google' && (
              <div className="animate-fade-in pt-2">
                <button onClick={handleGoogleLogin} disabled={loading} className="w-full bg-white hover:bg-slate-200 text-slate-900 font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                  {loading ? "AUTHENTICATING..." : "AUTHORIZE WITH GOOGLE"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <p className="mt-8 text-[10px] text-slate-600 font-bold uppercase tracking-widest">Secure Encryption • MockWar Gaming</p>
    </div>
  );
}

export default Auth;