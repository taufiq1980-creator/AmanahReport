import React, { useState, useRef } from 'react';
import { 
  Plus, 
  FileText, 
  Camera, 
  Users, 
  CheckCircle, 
  ArrowLeft, 
  Globe, 
  Trash2, 
  DollarSign, 
  MapPin,
  Calendar,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Upload,
  Receipt,
  Heart,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertTriangle,
  Mic,
  StopCircle,
  LocateFixed,
  Search,
  Share2,
  Cpu,
  Eye,
  Smartphone,
  TrendingUp,
  AlertOctagon,
  Languages,
  ScanLine
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Button } from './components/Button';
import { extractReceiptData, generateImageCaption, generateImpactStory, translateStory, generateSummaryFromVoice } from './services/geminiService';
import { DistributionPhoto, ImpactReport, ReceiptData, ViewState } from './types';

// Supported Languages
const SUPPORTED_LANGUAGES = [
  "English", "Indonesian", "Arabic", "Spanish", "French", 
  "German", "Turkish", "Urdu", "Hindi", "Bengali", 
  "Chinese", "Japanese", "Russian", "Swahili", "Portuguese"
];

const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "SAR", "AED", "TRY", "MYR"];

// Mock Data
const INITIAL_REPORTS: ImpactReport[] = [
  {
    id: '1',
    campaignName: 'Sumatera Disaster Relief 2025',
    location: 'West Sumatera',
    beneficiariesCount: 500,
    date: '2025-01-15',
    totalSpend: 15000000,
    currency: 'IDR',
    receipts: [
      {
        storeName: "Padang Supplies Depot",
        date: "2025-01-14",
        totalAmount: 5000000,
        currency: "IDR",
        trustScore: 98,
        items: [{ name: "Rice Bags (20kg)", quantity: 20, price: 250000 }],
        originalImage: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400"
      }
    ],
    photos: [
      {
        base64: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=400",
        caption: "Volunteers distributing rice bags to families in the affected village.",
        timestamp: "2025-01-15T10:30:00Z"
      },
      {
        base64: "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=400",
        caption: "Community gathering at the distribution point receiving clean water and supplies.",
        timestamp: "2025-01-15T11:15:00Z"
      }
    ],
    story: 'We successfully distributed emergency supplies including blankets, clean water, and food kits to 500 survivors of the recent floods. The community expressed immense gratitude for the swift response. Volunteers worked through the night to ensure every family received a package.',
    status: 'published',
    language: 'English'
  }
];

// Chart Data
const LEAKAGE_DATA = [
  { name: 'Direct Aid', value: 65, color: '#10b981' }, // Emerald-500
  { name: 'Ops & Admin', value: 20, color: '#3b82f6' }, // Blue-500
  { name: 'Leakage/Fraud', value: 15, color: '#ef4444' }, // Red-500
];

const TRUST_DATA = [
  { name: 'Traditional', trust: 45 },
  { name: 'Verified', trust: 92 },
];

export default function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [reports, setReports] = useState<ImpactReport[]>(INITIAL_REPORTS);
  const [selectedReport, setSelectedReport] = useState<ImpactReport | null>(null);

  // Wizard State
  const [isProcessing, setIsProcessing] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNoteText, setVoiceNoteText] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [wizardData, setWizardData] = useState<{
    campaignName: string;
    location: string;
    coordinates?: { lat: number; lng: number };
    beneficiariesCount: number;
    receipts: ReceiptData[];
    photos: DistributionPhoto[];
    language: string;
    currency: string;
  }>({
    campaignName: '',
    location: '',
    beneficiariesCount: 0,
    receipts: [],
    photos: [],
    language: 'English',
    currency: 'USD'
  });

  // --- Handlers ---

  const handleNavigate = (newView: ViewState) => {
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'receipt' | 'photo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];

      if (type === 'receipt') {
        const data = await extractReceiptData(base64Data);
        // Default the wizard currency to the first receipt's currency if not set
        const updatedCurrency = wizardData.receipts.length === 0 ? data.currency : wizardData.currency;
        setWizardData(prev => ({ 
          ...prev, 
          receipts: [...prev.receipts, data],
          currency: updatedCurrency
        }));
      } else {
        const caption = await generateImageCaption(base64Data);
        setWizardData(prev => ({ 
          ...prev, 
          photos: [...prev.photos, { base64, caption, timestamp: new Date().toISOString() }] 
        }));
      }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          const text = await generateSummaryFromVoice(base64Audio);
          setVoiceNoteText(text);
          setIsProcessing(false);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setWizardData(prev => ({
            ...prev,
            coordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            },
            location: `${prev.location} (GPS Verified)`
          }));
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not retrieve GPS location.");
        }
      );
    }
  };

  const generateReport = async () => {
    setIsProcessing(true);
    const story = await generateImpactStory(
      wizardData.campaignName,
      wizardData.location,
      wizardData.beneficiariesCount,
      wizardData.receipts,
      wizardData.photos.map(p => p.caption),
      voiceNoteText,
      wizardData.language
    );

    const totalSpend = wizardData.receipts.reduce((acc, r) => acc + r.totalAmount, 0);

    const newReport: ImpactReport = {
      id: Date.now().toString(),
      campaignName: wizardData.campaignName,
      location: wizardData.location,
      coordinates: wizardData.coordinates,
      beneficiariesCount: wizardData.beneficiariesCount,
      date: new Date().toISOString().split('T')[0],
      totalSpend,
      currency: wizardData.currency,
      receipts: wizardData.receipts,
      photos: wizardData.photos,
      story,
      status: 'draft',
      language: wizardData.language
    };

    setReports([newReport, ...reports]);
    setSelectedReport(newReport);
    setWizardData({ campaignName: '', location: '', beneficiariesCount: 0, receipts: [], photos: [], language: 'English', currency: 'USD' });
    setVoiceNoteText("");
    setWizardStep(1);
    setIsProcessing(false);
    handleNavigate('view-report');
  };

  const handleTranslate = async (lang: string) => {
    if (!selectedReport) return;
    setIsProcessing(true);
    const translatedStory = await translateStory(selectedReport.story, lang);
    setSelectedReport({ ...selectedReport, story: translatedStory, language: lang });
    setIsProcessing(false);
  };

  const startNewReport = () => {
    setWizardData({ campaignName: '', location: '', beneficiariesCount: 0, receipts: [], photos: [], language: 'English', currency: 'USD' });
    setVoiceNoteText("");
    setWizardStep(1);
    handleNavigate('create-receipt');
  };

  // --- Components ---

  const Sidebar = () => (
    <div className="w-64 bg-blue-950 text-white flex flex-col fixed h-full shadow-xl z-10 hidden md:flex">
      <div className="p-8">
        <div className="flex items-center gap-3 text-sky-400 mb-8 cursor-pointer" onClick={() => handleNavigate('landing')}>
          <Heart fill="currentColor" size={28} />
          <h1 className="text-xl font-bold tracking-tight text-white">Amanah<span className="text-sky-400">Reports</span></h1>
        </div>
        <nav className="space-y-2">
          <button 
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button 
            onClick={startNewReport}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${['create-receipt', 'create-photos', 'create-summary'].includes(view) ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Plus size={20} />
            <span className="font-medium">New Report</span>
          </button>
        </nav>
      </div>
      <div className="mt-auto p-8 border-t border-blue-900">
        <button onClick={() => handleNavigate('landing')} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full">
          <LogOut size={18} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  const StatCard = ({ icon: Icon, label, value, colorClass, trend }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon size={24} />
        </div>
        {trend && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  );

  // --- Views ---

  const renderLanding = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className="px-6 py-5 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-slate-50/90 backdrop-blur-md z-50 border-b border-slate-100/50">
        <div className="flex items-center gap-2 text-blue-700 cursor-pointer" onClick={() => handleNavigate('landing')}>
           <Heart fill="currentColor" size={26} />
           <span className="font-bold text-xl tracking-tight text-slate-900">Amanah<span className="text-blue-600">Reports</span></span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
          <button onClick={() => handleNavigate('features')} className="hover:text-blue-600 transition-colors">Features</button>
          <button onClick={() => handleNavigate('how-it-works')} className="hover:text-blue-600 transition-colors">How it Works</button>
          <button onClick={() => handleNavigate('donors')} className="hover:text-blue-600 transition-colors">Donors</button>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={() => handleNavigate('dashboard')}>Log In</Button>
          <Button onClick={() => handleNavigate('dashboard')}>Get Started</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 py-20 bg-blue-950 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/20 blur-3xl rounded-full translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-1/2 h-full bg-cyan-500/10 blur-3xl rounded-full -translate-x-1/4 translate-y-1/4"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sky-400 text-xs font-medium mb-6">
            <ShieldCheck size={14} /> Trusted by 500+ NGOs Worldwide
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Building Trust Through <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Radical Transparency</span>
          </h1>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Empower your NGO with AI-driven reporting. Scan receipts, verify field distributions, and generate professional impact reports in seconds—not hours.
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
             <Button size="lg" className="px-8 py-4 text-lg shadow-blue-500/25" onClick={() => handleNavigate('dashboard')}>
               Start Free Trial <ArrowRight size={20} className="ml-2" />
             </Button>
          </div>
        </div>
      </section>

      {/* Transparency Facts Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto w-full border-b border-slate-100 bg-white scroll-mt-20">
        
        {/* Headline about Importance of Charity Reporting */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">Why Accurate Reporting is the Lifeblood of Charity</h2>
          <p className="text-xl text-slate-600 leading-relaxed">
             In the world of humanitarian aid, a report is more than just data—it is the bridge of trust between a donor's heart and a beneficiary's hand. Accurate, transparent reporting ensures that every contribution achieves its intended impact, fostering a sustainable cycle of generosity and hope.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-600 text-xs font-bold uppercase tracking-wide mb-6">
               <AlertOctagon size={14} /> The Global Challenge
             </div>
             <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">
               The High Cost of <span className="text-red-500">Opacity</span>
             </h2>
             <p className="text-lg text-slate-600 mb-6 leading-relaxed">
               Transparency isn't just a buzzword; it's the lifeline of modern philanthropy. In an era where trust is fragile, donors demand to know exactly where their money goes. 
             </p>
             <p className="text-lg text-slate-600 mb-8 leading-relaxed">
               Studies estimate that substantial portions of global humanitarian aid can be lost to leakage, mismanagement, or fraud. This "opacity tax" doesn't just waste money—it destroys the trust required to help those in need.
             </p>
             
             <div className="flex gap-4">
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex-1">
                 <h4 className="text-3xl font-bold text-slate-900 mb-1">~15%</h4>
                 <p className="text-sm text-slate-500">Est. Global Aid Leakage</p>
               </div>
               <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex-1">
                 <h4 className="text-3xl font-bold text-slate-900 mb-1">-40%</h4>
                 <p className="text-sm text-slate-500">Donor Retention w/o Trust</p>
               </div>
             </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm">
             <div className="mb-8">
               <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                 Fund Distribution Reality
               </h3>
               <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={LEAKAGE_DATA}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {LEAKAGE_DATA.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                     />
                     <Legend verticalAlign="bottom" height={36}/>
                   </PieChart>
                 </ResponsiveContainer>
               </div>
               <p className="text-xs text-slate-400 text-center mt-2 italic">
                 *Illustrative representation of global aid challenges
               </p>
             </div>

             <div className="pt-8 border-t border-slate-200">
               <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                 <TrendingUp size={20} className="text-emerald-500"/> The Trust Dividend
               </h3>
               <div className="h-48 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={TRUST_DATA} layout="vertical" margin={{ left: 40 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" tick={{fontSize: 12, fill: '#64748b'}} width={80} />
                     <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                     <Bar dataKey="trust" name="Donor Trust Score" radius={[0, 4, 4, 0]} barSize={32}>
                       {TRUST_DATA.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index === 1 ? '#10b981' : '#94a3b8'} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-950 text-slate-400 py-12 px-6 border-t border-blue-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white opacity-80">
             <Heart fill="currentColor" size={20} />
             <span className="font-bold text-lg">AmanahReports</span>
          </div>
          <div className="text-sm">
            © 2025 AmanahReports. Built for transparency.
          </div>
        </div>
      </footer>
    </div>
  );

  const renderFeaturesPage = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <nav className="px-6 py-5 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-slate-50/90 backdrop-blur-md z-50 border-b border-slate-100/50">
        <div className="flex items-center gap-2 text-blue-700 cursor-pointer" onClick={() => handleNavigate('landing')}>
           <Heart fill="currentColor" size={26} />
           <span className="font-bold text-xl tracking-tight text-slate-900">Amanah<span className="text-blue-600">Reports</span></span>
        </div>
        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => handleNavigate('how-it-works')}>How it Works</Button>
           <Button onClick={() => handleNavigate('dashboard')}>Get Started</Button>
        </div>
      </nav>

      <section className="py-20 px-6 max-w-7xl mx-auto w-full flex-1">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-wide mb-6">
            <Zap size={14} /> Powered by Gemini
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-6">Everything you need to build trust</h2>
          <p className="text-slate-500 max-w-3xl mx-auto text-lg">
            AmanahReports is equipped with state-of-the-art tools designed to make reporting effortless for field workers and transparent for donors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {/* Feature 1 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ScanLine size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AI Receipt Extraction</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                Turn chaos into structured data. Our Gemini-powered engine instantly reads messy, wrinkled, or handwritten receipts, extracting line items, prices, and merchant details with high accuracy.
              </p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Detects currency & dates automatically</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Calculates totals even if cut off</li>
              </ul>
           </div>

           {/* Feature 2 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Camera size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Visual Verification</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                 A picture is worth a thousand trusted dollars. Verify distribution events with AI scene analysis that generates context-aware captions and cross-references visual data with campaign goals.
              </p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Auto-generates descriptive captions</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Validates activity against report type</li>
              </ul>
           </div>

           {/* Feature 3 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Automated Storytelling</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                 From spreadsheet to story. Transform raw financial data and field notes into compelling, heartwarming narratives that donors will actually read and share.
              </p>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Professional tone & structure</li>
                <li className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500"/> Highlight beneficiary impact</li>
              </ul>
           </div>

           {/* Feature 4 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Languages size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Global Language Support</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                 Break down language barriers. Automatically translate your impact reports into 15+ languages including Arabic, Indonesian, French, and Spanish to connect with global donors.
              </p>
           </div>

           {/* Feature 5 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Mic size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Voice-to-Summary</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                 Field workers are busy. Instead of typing long reports on small screens, simply record a voice note, and our AI will transcribe and summarize the key details perfectly.
              </p>
           </div>

           {/* Feature 6 */}
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <LocateFixed size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">GPS Location Proof</h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                 Pinpoint accuracy for every distribution. Automatically capture GPS coordinates when creating reports to prove exactly where the aid was delivered.
              </p>
           </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
           <div className="bg-blue-950 rounded-3xl p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/30 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/20 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2"></div>
              
              <div className="relative z-10 max-w-2xl mx-auto">
                 <h2 className="text-3xl font-bold text-white mb-6">Ready to upgrade your reporting?</h2>
                 <p className="text-blue-200 mb-8 text-lg">Join 500+ NGOs using AmanahReports to build stronger relationships with their donors through transparency.</p>
                 <Button size="lg" onClick={() => handleNavigate('dashboard')}>
                   Get Started for Free <ArrowRight size={20} className="ml-2" />
                 </Button>
              </div>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-950 text-slate-400 py-12 px-6 border-t border-blue-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white opacity-80">
             <Heart fill="currentColor" size={20} />
             <span className="font-bold text-lg">AmanahReports</span>
          </div>
          <div className="text-sm">
            © 2025 AmanahReports. Built for transparency.
          </div>
        </div>
      </footer>
    </div>
  );

  const renderDonorsPage = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <nav className="px-6 py-5 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-slate-50/90 backdrop-blur-md z-50 border-b border-slate-100/50">
        <div className="flex items-center gap-2 text-blue-700 cursor-pointer" onClick={() => handleNavigate('landing')}>
           <Heart fill="currentColor" size={26} />
           <span className="font-bold text-xl tracking-tight text-slate-900">Amanah<span className="text-blue-600">Reports</span></span>
        </div>
        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => handleNavigate('features')}>Features</Button>
           <Button onClick={() => handleNavigate('dashboard')}>Get Started</Button>
        </div>
      </nav>

      <section className="py-20 px-6 max-w-7xl mx-auto w-full flex-1">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold uppercase tracking-wide mb-6">
            <Users size={14} /> For Donors
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-6">See where your impact goes</h2>
          <p className="text-slate-500 max-w-3xl mx-auto text-lg">
            Experience a new level of connection with your philanthropy. Real-time updates, verified proof, and stories that matter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
            <div className="order-2 md:order-1">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Real-time Financial Tracking</h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                    Don't wait for the annual report. See exactly when and where your funds are deployed. 
                    Our receipt extraction technology ensures every dollar is accounted for with granular detail.
                </p>
                <div className="flex items-center gap-4 text-sm font-semibold text-blue-600">
                    <span className="flex items-center gap-2"><CheckCircle size={16}/> Itemized Receipts</span>
                    <span className="flex items-center gap-2"><CheckCircle size={16}/> GPS Verified</span>
                </div>
            </div>
            <div className="order-1 md:order-2 bg-white p-6 rounded-2xl shadow-lg border border-slate-100 -rotate-2">
                 {/* Visual Representation of Receipt/Chart */}
                 <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                     <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                         <DollarSign size={20} />
                     </div>
                     <div>
                         <div className="font-bold text-slate-900">Donation #8821</div>
                         <div className="text-xs text-slate-500">Deployed to: West Java Flood Relief</div>
                     </div>
                 </div>
                 <div className="space-y-3">
                     <div className="flex justify-between text-sm">
                         <span className="text-slate-600">Rice Bags (50kg)</span>
                         <span className="font-medium text-slate-900">$450.00</span>
                     </div>
                     <div className="flex justify-between text-sm">
                         <span className="text-slate-600">Clean Water Kits</span>
                         <span className="font-medium text-slate-900">$200.00</span>
                     </div>
                     <div className="flex justify-between text-sm">
                         <span className="text-slate-600">Logistics</span>
                         <span className="font-medium text-slate-900">$50.00</span>
                     </div>
                     <div className="flex justify-between text-sm pt-2 border-t border-slate-100 font-bold">
                         <span className="text-slate-900">Total Impact</span>
                         <span className="text-emerald-600">$700.00</span>
                     </div>
                 </div>
            </div>
        </div>
      </section>

      <footer className="bg-blue-950 text-slate-400 py-12 px-6 border-t border-blue-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white opacity-80">
             <Heart fill="currentColor" size={20} />
             <span className="font-bold text-lg">AmanahReports</span>
          </div>
          <div className="text-sm">
            © 2025 AmanahReports. Built for transparency.
          </div>
        </div>
      </footer>
    </div>
  );

  const renderHowItWorksPage = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <nav className="px-6 py-5 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-slate-50/90 backdrop-blur-md z-50 border-b border-slate-100/50">
        <div className="flex items-center gap-2 text-blue-700 cursor-pointer" onClick={() => handleNavigate('landing')}>
           <Heart fill="currentColor" size={26} />
           <span className="font-bold text-xl tracking-tight text-slate-900">Amanah<span className="text-blue-600">Reports</span></span>
        </div>
        <div className="flex gap-4">
           <Button variant="ghost" onClick={() => handleNavigate('features')}>Features</Button>
           <Button onClick={() => handleNavigate('dashboard')}>Get Started</Button>
        </div>
      </nav>

      <section className="py-20 px-6 max-w-7xl mx-auto w-full flex-1">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">How It Works</h2>
          <p className="text-slate-500 max-w-3xl mx-auto text-lg">
            A simple 3-step process to transform field data into trusted impact reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-0 w-full h-1 bg-blue-100 -z-10 transform scale-x-75"></div>
            
            {[
                { 
                    title: "1. Capture Data", 
                    desc: "Field workers snap photos of receipts and distribution events directly from the app.",
                    icon: Camera 
                },
                { 
                    title: "2. AI Processing", 
                    desc: "Gemini AI extracts data, verifies authenticity, and drafts the narrative instantly.",
                    icon: Cpu 
                },
                { 
                    title: "3. Share Report", 
                    desc: "Review the generated report and publish it to donors via link or PDF.",
                    icon: Share2 
                }
            ].map((step, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                        <step.icon size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
            ))}
        </div>
      </section>

      <footer className="bg-blue-950 text-slate-400 py-12 px-6 border-t border-blue-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-white opacity-80">
             <Heart fill="currentColor" size={20} />
             <span className="font-bold text-lg">AmanahReports</span>
          </div>
          <div className="text-sm">
            © 2025 AmanahReports. Built for transparency.
          </div>
        </div>
      </footer>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, Field Officer.</p>
        </div>
        <Button onClick={startNewReport} size="lg" className="shadow-blue-200">
          <Plus size={20} className="mr-2" /> Create New Report
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={FileText} 
          label="Total Reports" 
          value={reports.length} 
          colorClass="bg-blue-50 text-blue-600" 
          trend
        />
        <StatCard 
          icon={Users} 
          label="Lives Impacted" 
          value={reports.reduce((acc, r) => acc + r.beneficiariesCount, 0).toLocaleString()} 
          colorClass="bg-sky-50 text-sky-600"
          trend 
        />
        <StatCard 
          icon={DollarSign} 
          label="Funds Distributed" 
          value={`$${reports.reduce((acc, r) => acc + r.totalSpend, 0).toLocaleString()}`} 
          colorClass="bg-emerald-50 text-emerald-600" 
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Recent Activities</h2>
          <Button variant="ghost" size="sm">View All</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Campaign</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {
                  setSelectedReport(report);
                  handleNavigate('view-report');
                }}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{report.campaignName}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" /> {report.location}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{report.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {report.currency || '$'} {report.totalSpend.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight size={18} className="text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderWizardSteps = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-2xl mx-auto relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
        {[
          { step: 1, label: "Scan Receipts", icon: Receipt },
          { step: 2, label: "Evidence", icon: Camera },
          { step: 3, label: "Review", icon: FileText },
        ].map((s) => (
          <div key={s.step} className={`flex flex-col items-center gap-2 bg-slate-50 px-2`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              (view === 'create-receipt' && s.step === 1) || 
              (view === 'create-photos' && s.step === 2) || 
              (view === 'create-summary' && s.step === 3) || 
              (s.step < wizardStep) 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
              : 'bg-white border-2 border-slate-200 text-slate-400'
            }`}>
              <s.icon size={18} />
            </div>
            <span className={`text-xs font-semibold ${
               (view === 'create-receipt' && s.step === 1) || 
               (view === 'create-photos' && s.step === 2) || 
               (view === 'create-summary' && s.step === 3) 
               ? 'text-blue-600' : 'text-slate-500'
            }`}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCreateReceipt = () => (
    <div className="max-w-3xl mx-auto">
      {renderWizardSteps()}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
            <Camera size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Upload Receipts</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Take a clear photo of your store receipts. Our AI will extract the items, prices, and merchant details automatically.</p>
        
          <div className="mt-8">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              id="receipt-upload"
              onChange={(e) => handleFileUpload(e, 'receipt')}
              disabled={isProcessing}
            />
            <label htmlFor="receipt-upload">
              <div className="group relative flex flex-col items-center justify-center w-full max-w-lg mx-auto h-48 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <p className="mb-2 text-sm text-slate-500 group-hover:text-blue-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                </div>
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Extracting & Analyzing...
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {wizardData.receipts.length > 0 && (
          <div className="p-8 bg-slate-50">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-500" /> 
              Processed Receipts ({wizardData.receipts.length})
            </h3>
            <div className="space-y-4">
              {wizardData.receipts.map((receipt, idx) => (
                <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-lg">{receipt.storeName}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                             receipt.trustScore > 80 ? 'bg-green-50 text-green-700 border-green-200' :
                             receipt.trustScore > 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                             'bg-red-50 text-red-700 border-red-200'
                          }`}>
                             {receipt.trustScore}% Trust Score
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Calendar size={14}/> {receipt.date}</p>
                      </div>
                      <div className="text-right bg-emerald-50 px-3 py-1 rounded-lg">
                        <p className="font-bold text-emerald-700">{receipt.currency} {receipt.totalAmount.toLocaleString()}</p>
                      </div>
                    </div>
                    {/* Fraud Analysis Note */}
                    {receipt.fraudNotes && (
                      <div className="bg-slate-50 text-slate-600 text-xs p-2 rounded mb-3 border border-slate-200 italic">
                        AI Analysis: {receipt.fraudNotes}
                      </div>
                    )}
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-50">
                          {receipt.items.map((item, i) => (
                            <tr key={i}>
                              <td className="py-1 text-slate-700">{item.name}</td>
                              <td className="py-1 text-slate-500 text-right">x{item.quantity}</td>
                              <td className="py-1 text-slate-500 text-right">{item.price.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={() => { handleNavigate('create-photos'); setWizardStep(2); }} size="lg">
                Continue to Evidence <ChevronRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreatePhotos = () => (
    <div className="max-w-3xl mx-auto">
      {renderWizardSteps()}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Distribution Evidence</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">Upload photos of the event. Our AI will analyze the scene to generate captions and verify the activity.</p>
        
          <div className="mt-8">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              id="photo-upload"
              onChange={(e) => handleFileUpload(e, 'photo')}
              disabled={isProcessing}
            />
            <label htmlFor="photo-upload">
              <div className="group relative flex flex-col items-center justify-center w-full max-w-lg mx-auto h-48 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <p className="mb-2 text-sm text-slate-500 group-hover:text-blue-600"><span className="font-semibold">Click to upload photos</span></p>
                </div>
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
                    <div className="flex items-center gap-2 text-blue-600 font-medium">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Analyzing Scene...
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {wizardData.photos.length > 0 && (
          <div className="p-8 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {wizardData.photos.map((photo, idx) => (
                <div key={idx} className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm group hover:shadow-md transition-all">
                  <div className="relative h-48">
                    <img src={photo.base64} alt="Distribution" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">Verified by AI</div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">AI Analysis</p>
                    <p className="text-sm text-slate-800 leading-relaxed">{photo.caption}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => { handleNavigate('create-receipt'); setWizardStep(1); }}>
                Back
              </Button>
              <Button onClick={() => { handleNavigate('create-summary'); setWizardStep(3); }} size="lg">
                Continue to Details <ChevronRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateSummary = () => (
    <div className="max-w-2xl mx-auto">
      {renderWizardSteps()}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100">
           <h2 className="text-2xl font-bold text-slate-900">Finalize Report</h2>
           <p className="text-slate-500 mt-1">Provide the campaign details to generate the full impact story.</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Campaign Name</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. Winter Blanket Drive 2024"
              value={wizardData.campaignName}
              onChange={(e) => setWizardData({...wizardData, campaignName: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-4 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    className="w-full border border-slate-300 rounded-xl p-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Village, District"
                    value={wizardData.location}
                    onChange={(e) => setWizardData({...wizardData, location: e.target.value})}
                  />
                </div>
                <Button 
                   variant="outline" 
                   type="button" 
                   title="Verify Location with GPS"
                   onClick={getLocation}
                   className="px-4"
                >
                  <LocateFixed size={20} />
                </Button>
              </div>
              {wizardData.coordinates && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> GPS Verified: {wizardData.coordinates.lat.toFixed(4)}, {wizardData.coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Beneficiaries</label>
              <div className="relative">
                <Users className="absolute left-4 top-4 text-slate-400" size={20} />
                <input 
                  type="number" 
                  className="w-full border border-slate-300 rounded-xl p-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="0"
                  value={wizardData.beneficiariesCount}
                  onChange={(e) => setWizardData({...wizardData, beneficiariesCount: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Report Language</label>
                <div className="relative">
                   <Languages className="absolute left-4 top-4 text-slate-400" size={20} />
                   <select
                      className="w-full border border-slate-300 rounded-xl p-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white"
                      value={wizardData.language}
                      onChange={(e) => setWizardData({...wizardData, language: e.target.value})}
                   >
                      {SUPPORTED_LANGUAGES.map(lang => (
                         <option key={lang} value={lang}>{lang}</option>
                      ))}
                   </select>
                </div>
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Currency</label>
                <div className="relative">
                   <DollarSign className="absolute left-4 top-4 text-slate-400" size={20} />
                   <select
                      className="w-full border border-slate-300 rounded-xl p-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white"
                      value={wizardData.currency}
                      onChange={(e) => setWizardData({...wizardData, currency: e.target.value})}
                   >
                      {CURRENCIES.map(curr => (
                         <option key={curr} value={curr}>{curr}</option>
                      ))}
                   </select>
                </div>
             </div>
          </div>

          {/* Voice Notes Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
             <div className="flex justify-between items-center mb-3">
               <label className="block text-sm font-bold text-slate-700">Voice Note for Report Summary</label>
               {isRecording ? (
                 <span className="flex items-center gap-2 text-red-500 text-xs font-bold animate-pulse">
                   <span className="w-2 h-2 bg-red-500 rounded-full"></span> Recording...
                 </span>
               ) : (
                 <span className="text-xs text-slate-400">Tap mic to speak</span>
               )}
             </div>
             
             <div className="flex gap-4 items-start">
               <Button 
                 variant={isRecording ? "danger" : "secondary"} 
                 onClick={isRecording ? stopRecording : startRecording}
                 type="button"
                 className="rounded-full w-12 h-12 flex items-center justify-center p-0 flex-shrink-0"
               >
                 {isRecording ? <StopCircle size={24} /> : <Mic size={24} />}
               </Button>
               
               <div className="flex-1">
                 {voiceNoteText ? (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 italic">
                       "{voiceNoteText}"
                    </div>
                 ) : (
                    <p className="text-sm text-slate-400 pt-3">
                       {isRecording ? "Listening..." : "Describe the distribution event here. AI will summarize it."}
                    </p>
                 )}
               </div>
             </div>
          </div>

        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <Button variant="ghost" onClick={() => { handleNavigate('create-photos'); setWizardStep(2); }}>
            Back
          </Button>
          <Button 
            size="lg"
            onClick={generateReport}
            disabled={!wizardData.campaignName || !wizardData.location}
            isLoading={isProcessing}
            className="shadow-blue-300"
          >
            Generate Report <ArrowLeft className="ml-2 rotate-180" size={20}/>
          </Button>
        </div>
      </div>
    </div>
  );

  const renderViewReport = () => {
    if (!selectedReport) return null;

    return (
      <div className="max-w-4xl mx-auto pb-20">
         <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={() => handleNavigate('dashboard')}>
             <ArrowLeft size={16} className="mr-2" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
             <Globe size={18} className="text-slate-400" />
             <select
               className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none cursor-pointer"
               value={selectedReport.language}
               onChange={(e) => handleTranslate(e.target.value)}
               disabled={isProcessing}
             >
               {SUPPORTED_LANGUAGES.map(lang => (
                 <option key={lang} value={lang}>{lang}</option>
               ))}
             </select>
          </div>
        </div>

        {/* Paper Effect Report */}
        <div className="bg-white p-12 rounded-none shadow-2xl border-t-8 border-blue-600 relative overflow-hidden min-h-[800px]">
           {/* Watermark */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
             <Heart size={400} />
           </div>

           <div className="flex justify-between items-start mb-12 relative z-10">
             <div>
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                   <Heart fill="currentColor" size={24} />
                   <span className="font-bold text-xl tracking-tight text-slate-900">Amanah<span className="text-blue-600">Reports</span></span>
                </div>
                <h1 className="text-4xl font-serif font-bold text-slate-900 mt-6 mb-2">{selectedReport.campaignName}</h1>
                <div className="flex items-center gap-6 text-slate-500 mt-2 text-sm uppercase tracking-wide font-medium">
                  <span className="flex items-center gap-1"><MapPin size={16} /> {selectedReport.location}</span>
                  <span className="flex items-center gap-1"><Calendar size={16} /> {selectedReport.date}</span>
                </div>
                {selectedReport.coordinates && (
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    GPS: {selectedReport.coordinates.lat.toFixed(6)}, {selectedReport.coordinates.lng.toFixed(6)}
                  </p>
                )}
             </div>
             <div className="text-right">
                <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg inline-block mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider">Total Impact</p>
                  <p className="text-2xl font-bold font-mono">
                    {selectedReport.currency || '$'} {selectedReport.totalSpend.toLocaleString()}
                  </p>
                </div>
                <div className="text-slate-400 text-sm">Ref: #{selectedReport.id}</div>
             </div>
           </div>

           {/* Impact Story */}
           <div className="mb-12 relative z-10">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Impact Summary</h3>
             {isProcessing ? (
               <div className="animate-pulse space-y-3">
                 <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                 <div className="h-4 bg-slate-100 rounded w-full"></div>
                 <div className="h-4 bg-slate-100 rounded w-5/6"></div>
               </div>
             ) : (
               <div className="prose max-w-none text-slate-800">
                 <p className="whitespace-pre-line text-lg font-serif leading-8">
                   {selectedReport.story}
                 </p>
               </div>
             )}
           </div>

           {/* Evidence Gallery */}
           <div className="mb-12 relative z-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 border-b border-slate-100 pb-2">Visual Verification</h3>
            <div className="grid grid-cols-2 gap-6">
              {selectedReport.photos.map((photo, i) => (
                 <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <img src={photo.base64} className="w-full h-48 object-cover rounded shadow-sm mb-3 grayscale hover:grayscale-0 transition-all duration-500" />
                    <div className="flex items-start gap-2 px-2 pb-1">
                      <CheckCircle size={14} className="text-emerald-500 mt-1 flex-shrink-0" />
                      <p className="text-sm text-slate-600 italic font-serif">{photo.caption}</p>
                    </div>
                 </div>
              ))}
            </div>
           </div>

           {/* Financial Table */}
           <div className="relative z-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 border-b border-slate-100 pb-2">Expenditure Breakdown</h3>
            <table className="w-full">
               <thead>
                 <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                   <th className="pb-3 pl-2">Item</th>
                   <th className="pb-3 text-right">Quantity</th>
                   <th className="pb-3 text-right">Unit Price</th>
                   <th className="pb-3 text-right pr-2">Total</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {selectedReport.receipts.flatMap(r => r.items).map((item, i) => (
                   <tr key={i} className="border-b border-slate-50 last:border-0">
                     <td className="py-4 pl-2 font-medium text-slate-800">{item.name}</td>
                     <td className="py-4 text-slate-600 text-right">{item.quantity}</td>
                     <td className="py-4 text-slate-600 text-right">{item.price.toLocaleString()}</td>
                     <td className="py-4 font-bold text-slate-900 text-right pr-2">{(item.quantity * item.price).toLocaleString()}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>

           <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-end text-slate-400 text-xs relative z-10">
             <div>
               <p>Generated by AmanahReports AI</p>
               <p>{new Date().toLocaleDateString()}</p>
             </div>
             <div className="text-right">
               <div className="h-12 w-32 bg-slate-100 mb-2 rounded opacity-50"></div>
               <p>Authorized Signature</p>
             </div>
           </div>
        </div>
      </div>
    );
  };

  // If view is landing, render landing page (no sidebar)
  if (view === 'landing') {
    return renderLanding();
  }
  // Render dedicated Donors Page
  if (view === 'donors') {
    return renderDonorsPage();
  }
  // Render dedicated How It Works Page
  if (view === 'how-it-works') {
    return renderHowItWorksPage();
  }
  // Render dedicated Features Page
  if (view === 'features') {
    return renderFeaturesPage();
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar for Desktop */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 md:ml-64">
        {/* Mobile Header (only visible on small screens) */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
           <div className="flex items-center gap-2 text-emerald-400">
              <Heart fill="currentColor" size={20} />
              <h1 className="font-bold">AmanahReports</h1>
           </div>
           <button onClick={() => handleNavigate('dashboard')} className="p-2"><LayoutDashboard/></button>
        </div>

        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {view === 'dashboard' && renderDashboard()}
          {view === 'create-receipt' && renderCreateReceipt()}
          {view === 'create-photos' && renderCreatePhotos()}
          {view === 'create-summary' && renderCreateSummary()}
          {view === 'view-report' && renderViewReport()}
        </div>
      </div>
    </div>
  );
}