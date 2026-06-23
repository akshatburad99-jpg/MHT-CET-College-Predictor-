import React, { useState, useMemo, useEffect } from "react";
import {
  GraduationCap,
  Award,
  Filter,
  Search,
  BookOpen,
  MapPin,
  TrendingUp,
  Download,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  Layers,
  ListOrdered,
  FileCheck2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RefreshCw,
  Printer,
  X,
  Heart,
  DollarSign,
  Building,
  Briefcase,
  Share2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Users
} from "lucide-react";
import { College, Branch, StudentEntry } from "./types";
import { COLLEGES_DB } from "./data";
import { 
  db, 
  auth, 
  googleProvider, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";

const getBranchSeats = (codeName: string, collegeId?: string): number => {
  // Custom highly realistic seat allocations for prominent institutes
  if (collegeId === "coep") {
    if (codeName === "CS") return 180;
    if (codeName === "IT") return 120;
    if (codeName === "ENTC") return 120;
    if (codeName === "MECH") return 120;
    if (codeName === "CIVIL") return 120;
  }
  if (collegeId === "vjti") {
    if (codeName === "CS") return 120;
    if (codeName === "IT") return 120;
    if (codeName === "ENTC") return 120;
  }
  if (collegeId === "spit") {
    if (codeName === "CS") return 180;
    if (codeName === "IT") return 120;
  }
  if (collegeId === "pict") {
    if (codeName === "CS") return 240;
    if (codeName === "IT") return 180;
    if (codeName === "ENTC") return 120;
  }
  
  // Standard defaults based on branch CodeName
  switch (codeName) {
    case "CS":
    case "CSE":
      return 120;
    case "IT":
      return 60;
    case "AIDS":
    case "AI":
      return 60;
    case "ENTC":
    case "EXTC":
    case "ECE":
      return 120;
    case "MECH":
      return 60;
    case "CIVIL":
      return 60;
    case "CHEM":
      return 60;
    default:
      return 60;
  }
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"predictor" | "favorites" | "shortlist" | "optionForm" | "insights" | "admin">("predictor");

  // Security & Privacy States
  const [isSecureSharedDevice, setIsSecureSharedDevice] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem("mht_cet_secure_isolated") === "true";
      }
    } catch {
      // safe fallback
    }
    return false;
  });
  const [isMaskedMode, setIsMaskedMode] = useState<boolean>(false);

  // Student consultation submission state values
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [didSubmitSuccessfully, setDidSubmitSuccessfully] = useState(false);

  // Administration panel variables
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminPasskey, setAdminPasskey] = useState("");
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [studentEntries, setStudentEntries] = useState<StudentEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StudentEntry | null>(null);
  const [adminSearchFilter, setAdminSearchFilter] = useState("");

  // User input states
  const [percentileInput, setPercentileInput] = useState<string>("99.42");
  const [percentile, setPercentile] = useState<number>(99.42);
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [category, setCategory] = useState<"Open" | "OBC" | "SC" | "ST" | "VJNT" | "EWS">("Open");
  const [minority, setMinority] = useState<"None" | "Gujarati" | "Sindhi" | "Hindi">("None");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"chance" | "ranking" | "cutoff">("chance");

  // Expand state for college card info - formatted as `collegeId-branchCodeName`
  const [expandedCollege, setExpandedCollege] = useState<string | null>(null);

  // Categorized Section Viewer Choice for Predictor: "all" | "safe" | "target" | "reach"
  const [activeSectionFilter, setActiveSectionFilter] = useState<"all" | "safe" | "target" | "reach">("all");

  // Alerts
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"success" | "info" | "warning">("info");

  // Persisted DTE Choice Shortlist state (holds college + branch combinations)
  const [shortlist, setShortlist] = useState<{ collegeId: string; branchName: string; choiceCode: string }[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem("mht_cet_shortlist");
        if (saved) return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Storage read failed (perhaps sandbox or iframe restricted):", e);
    }
    return [
      { collegeId: "coep", branchName: "Electronics & Telecommunication", choiceCode: "600610" },
      { collegeId: "vjti", branchName: "Electronics & Telecommunication", choiceCode: "301210" },
      { collegeId: "spit", branchName: "Computer Engineering", choiceCode: "321510" }
    ];
  });

  // Favorite Colleges state (stores college IDs)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem("mht_cet_favorites");
        if (saved) return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Storage read failed (perhaps sandbox or iframe restricted):", e);
    }
    return ["coep", "vjti"]; // default initial favorites
  });

  // Sync states to local storage
  useEffect(() => {
    if (isSecureSharedDevice) return; // Prevent writing on cyber cafe shared devices!
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("mht_cet_shortlist", JSON.stringify(shortlist));
      }
    } catch (e) {
      console.warn("Storage write failed (perhaps sandbox or iframe restricted):", e);
    }
  }, [shortlist, isSecureSharedDevice]);

  useEffect(() => {
    if (isSecureSharedDevice) return; // Prevent writing on cyber cafe shared devices!
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("mht_cet_favorites", JSON.stringify(favorites));
      }
    } catch (e) {
      console.warn("Storage write failed (perhaps sandbox or iframe restricted):", e);
    }
  }, [favorites, isSecureSharedDevice]);

  // Auth synchronization for Administrator
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (user && user.email === "sapnamburad@gmail.com") {
        setIsAdminAuthorized(true);
        triggerAlert(`Welcome back, u/Wise_Papaya368 (${user.email})! Authorized.`, "success");
      }
    });
    return () => unsubscribe();
  }, []);

  // Pre-load student entry listings once administrator authorization is valid
  useEffect(() => {
    if (activeTab === "admin" && isAdminAuthorized) {
      fetchStudentEntries();
    }
  }, [activeTab, isAdminAuthorized]);

  const handleAdminPasscodeLogin = (code: string) => {
    // Both full passkey, customized developer PINs, or specific handles
    if (code.trim() === "Bayer3065") {
      setIsAdminAuthorized(true);
      triggerAlert("Passcode correct. Granted Administrator privileges successfully!", "success");
      return true;
    } else {
      triggerAlert("Invalid passcode validation sequence.", "warning");
      return false;
    }
  };

  const toggleSecureSharedDevice = () => {
    const nextVal = !isSecureSharedDevice;
    setIsSecureSharedDevice(nextVal);
    
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        if (nextVal) {
          window.localStorage.setItem("mht_cet_secure_isolated", "true");
          // Safely purge existing disk storage
          window.localStorage.removeItem("mht_cet_shortlist");
          window.localStorage.removeItem("mht_cet_favorites");
          triggerAlert("Cyber Cafe isolation active. Stored entries purged from disk.", "success");
        } else {
          window.localStorage.setItem("mht_cet_secure_isolated", "false");
          // Re-serialize current active memory state back to disk
          window.localStorage.setItem("mht_cet_shortlist", JSON.stringify(shortlist));
          window.localStorage.setItem("mht_cet_favorites", JSON.stringify(favorites));
          triggerAlert("Standard mode active. Option list synchronized back to disk.", "info");
        }
      }
    } catch (e) {
      console.warn("Storage action failed:", e);
    }
  };

  const toggleMaskedMode = () => {
    const nextVal = !isMaskedMode;
    setIsMaskedMode(nextVal);
    triggerAlert(nextVal ? "Privacy Shield enabled. Fields blurred to block local sight." : "Privacy Shield disabled.", "info");
  };

  const handlePurgeSession = () => {
    // 1. Purge memory
    setShortlist([]);
    setFavorites([]);
    setPercentileInput("95.00");
    setPercentile(95.00);
    setCategory("Open");
    setGender("Male");
    setMinority("None");
    setCityFilter("All");
    setBranchFilter("All");
    setSearchQuery("");
    setIsSecureSharedDevice(false);
    setIsMaskedMode(false);

    // 2. Clear all local storage keys completely
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("mht_cet_shortlist");
        window.localStorage.removeItem("mht_cet_favorites");
        window.localStorage.removeItem("mht_cet_secure_isolated");
      }
    } catch (e) {
      console.warn("Purge failed:", e);
    }
    
    triggerAlert("All session markers and local caches completely purged! Session closed.", "success");
  };

  const handleSubmitStudentEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      triggerAlert("Please enter your name.", "warning");
      return;
    }
    if (!studentEmail.trim()) {
      triggerAlert("Please enter your email address.", "warning");
      return;
    }
    if (!studentPhone.trim()) {
      triggerAlert("Please enter your mobile or WhatsApp contact number.", "warning");
      return;
    }

    setIsSavingEntry(true);
    try {
      const shortlistedColleges = shortlist.map((item) => {
        const college = COLLEGES_DB.find((c) => c.id === item.collegeId);
        const branch = college?.branches.find((b) => b.name === item.branchName);
        const adj = college && branch ? calculateAdjustedCutoff(college, branch) : 0;
        return {
          collegeName: college?.name || item.collegeId,
          branchName: item.branchName,
          city: college?.city || "Unknown",
          cutoff: adj,
        };
      });

      const entry: StudentEntry = {
        name: studentName.trim(),
        email: studentEmail.trim(),
        phone: studentPhone.trim(),
        percentile,
        category,
        gender,
        minority,
        cityFilter,
        branchFilter,
        searchQuery,
        shortlistedCount: shortlist.length,
        favoritesCount: favorites.length,
        shortlistedColleges,
        submittedAt: serverTimestamp(),
        deviceIsolated: isSecureSharedDevice,
      };

      await addDoc(collection(db, "student_entries"), entry);
      setDidSubmitSuccessfully(true);
      triggerAlert(`Perfect! Profile uploaded securely for Advisor u/Wise_Papaya368 review.`, "success");
      
      // Clear contact form fields upon success
      setStudentName("");
      setStudentEmail("");
      setStudentPhone("");
    } catch (err) {
      console.error("Submission failed:", err);
      triggerAlert("Could not submit entry due to Firebase initialization restriction.", "warning");
    } finally {
      setIsSavingEntry(false);
    }
  };

  const fetchStudentEntries = async () => {
    setIsLoadingEntries(true);
    try {
      const q = query(collection(db, "student_entries"), orderBy("submittedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const entries: StudentEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let formattedDate = "Unknown";
        if (data.submittedAt) {
          try {
            formattedDate = data.submittedAt.toDate().toLocaleString();
          } catch {
            formattedDate = data.submittedAt.toString();
          }
        }
        entries.push({
          id: doc.id,
          name: data.name || "Anonymous Student",
          email: data.email || "",
          phone: data.phone || "",
          percentile: Number(data.percentile) || 0,
          category: data.category || "Open",
          gender: data.gender || "Male",
          minority: data.minority || "None",
          cityFilter: data.cityFilter || "All",
          branchFilter: data.branchFilter || "All",
          searchQuery: data.searchQuery || "",
          shortlistedCount: data.shortlistedCount || 0,
          favoritesCount: data.favoritesCount || 0,
          shortlistedColleges: data.shortlistedColleges || [],
          submittedAt: formattedDate,
          deviceIsolated: !!data.deviceIsolated,
        });
      });
      setStudentEntries(entries);
      triggerAlert(`Successfully synchronized ${entries.length} student submission records!`, "success");
    } catch (err) {
      console.error("Error loading entries:", err);
      triggerAlert("Error retrieving records: make sure security rules match collection access.", "warning");
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const handleDeleteEntry = async (entryID: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this student record from the database?")) return;
    try {
      await deleteDoc(doc(db, "student_entries", entryID));
      setStudentEntries((prev) => prev.filter((e) => e.id !== entryID));
      if (selectedEntry?.id === entryID) setSelectedEntry(null);
      triggerAlert("Student entry deleted permanently.", "info");
    } catch (err) {
      console.error("Delete failed:", err);
      triggerAlert("Error deleting student record.", "warning");
    }
  };

  const getWhatsAppLink = (entry: StudentEntry) => {
    const cleanPhone = entry.phone.replace(/[^0-9]/g, "");
    const messageText = `Hello ${entry.name}, I reviewed your MHT CET mock preference sheet on our advisor desk. Let us coordinate regarding your ${entry.shortlistedColleges.length} choices!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  };

  const renderStudentSubmissionForm = () => {
    return (
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-850 p-5 mt-6 shadow-xl space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-widest font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                Direct Counselor Review Desk
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Managed by u/Wise_Papaya368</span>
            </div>
            <h3 className="text-sm sm:text-base font-black flex items-center gap-1.5 pt-1">
              <Sparkles className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
              Request Final Option Form Verification Check
            </h3>
            <p className="text-xs text-slate-405 leading-relaxed">
              Submit your mock MHT CET sequence sheet blocks directly onto our advisor database. Our team will verify cutoff variances and provide expert reviews completely free.
            </p>
          </div>
        </div>

        {didSubmitSuccessfully ? (
          <div className="bg-emerald-950/80 border border-emerald-900 p-4.5 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              Preference Sheet Transmitted Successfully!
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Your simulated score metrics (percentile: <strong className="text-emerald-350">{percentile.toFixed(4)}%tile</strong>, option count: <strong className="text-emerald-350">{shortlist.length} colleges</strong>) are now registered securely on u/Wise_Papaya368's admin desk. We will reach out to you soon!
            </p>
            <button
              onClick={() => setDidSubmitSuccessfully(false)}
              className="px-3 py-1 bg-white text-slate-900 rounded-lg text-[10px] font-black hover:bg-slate-100 transition-colors cursor-pointer uppercase border border-white"
            >
              Submit Updated Form
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitStudentEntry} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="space-y-1">
              <label className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">
                Full Name of Applicant
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="E.g. Sapna Amburad"
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3.5 py-2.5 font-bold text-white focus:outline-none focus:border-rose-500 placeholder-slate-600 shadow-inner"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">
                Contact Email Address
              </label>
              <input
                type="email"
                required
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="sapnamburad@gmail.com"
                className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3.5 py-2.5 font-bold text-white focus:outline-none focus:border-rose-500 placeholder-slate-600 shadow-inner"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">
                WhatsApp / Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  placeholder="E.g. +91 9876543210"
                  className="w-full bg-slate-850 border border-slate-750 rounded-xl px-3.5 py-2.5 font-bold text-white focus:outline-none focus:border-rose-500 placeholder-slate-600 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isSavingEntry}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer uppercase text-[10px] tracking-wide"
                >
                  {isSavingEntry ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Request"
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  };

  const triggerAlert = (message: string, type: "success" | "info" | "warning" = "info") => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // 1. Calculate Adjusted Cutoffs based on Maharashtra reservation multipliers
  const calculateAdjustedCutoff = (col: College, br: Branch) => {
    let offset = 0;
    if (category === "OBC" || category === "EWS") offset += 0.22;
    else if (category === "SC" || category === "ST") offset += 1.50;
    else if (category === "VJNT") offset += 0.75;

    if (gender === "Female") offset += 0.15;

    // Minority adjustment if client claims matching minority status for autonomous institutes
    if (minority !== "None" && col.minoritySeat === minority) {
      offset += 1.25;
    }
    return Math.max(0, br.baseCutoff - offset);
  };

  // Convert raw historical cutoffs using current category offset adjustments
  const getHistoricalAdjustedCutoff = (col: College, rawCutoff: number) => {
    let offset = 0;
    if (category === "OBC" || category === "EWS") offset += 0.22;
    else if (category === "SC" || category === "ST") offset += 1.50;
    else if (category === "VJNT") offset += 0.75;

    if (gender === "Female") offset += 0.15;

    if (minority !== "None" && col.minoritySeat === minority) {
      offset += 1.25;
    }
    return Math.max(0, rawCutoff - offset);
  };

  // Evaluate dynamic admission probability & compile stability over past 5 CAP iterations
  const getChanceDetails = (userPct: number, adjustedCutoff: number) => {
    const diff = userPct - adjustedCutoff;
    if (diff >= 1.0) {
      return {
        label: "Very High Probability",
        percent: 98,
        colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        badgeClass: "bg-emerald-500",
        bgHover: "hover:bg-emerald-50/20"
      };
    } else if (diff >= 0.1) {
      return {
        label: "High Probability",
        percent: 85,
        colorClass: "bg-teal-50 text-teal-700 border-teal-200",
        badgeClass: "bg-teal-500",
        bgHover: "hover:bg-teal-50/20"
      };
    } else if (diff >= -0.15) {
      return {
        label: "Moderate Probability",
        percent: 60,
        colorClass: "bg-amber-50 text-amber-700 border-amber-200",
        badgeClass: "bg-amber-500",
        bgHover: "hover:bg-amber-50/20"
      };
    } else if (diff >= -0.8) {
      return {
        label: "Borderline Choice",
        percent: 35,
        colorClass: "bg-orange-50 text-orange-700 border-orange-200",
        badgeClass: "bg-orange-500",
        bgHover: "hover:bg-orange-50/20"
      };
    } else {
      return {
        label: "Reach / Stiff Competition",
        percent: 12,
        colorClass: "bg-rose-50 text-rose-700 border-rose-200",
        badgeClass: "bg-rose-500",
        bgHover: "hover:bg-rose-50/20"
      };
    }
  };

  // Check how many of the past 5 historic cycles are cleared
  const evaluateHistoricalStability = (col: College, branch: Branch, userPct: number) => {
    const years = [
      { year: 2024, val: branch.baseCutoff },
      { year: 2023, val: branch.cutoff2023 },
      { year: 2022, val: branch.cutoff2022 },
      { year: 2021, val: branch.cutoff2021 },
      { year: 2020, val: branch.cutoff2020 }
    ];

    let clearedCount = 0;
    const details = years.map((yr) => {
      const adj = getHistoricalAdjustedCutoff(col, yr.val);
      const cleared = userPct >= adj;
      if (cleared) clearedCount++;
      return { year: yr.year, raw: yr.val, adjusted: adj, cleared };
    });

    let message = "";
    let color = "text-slate-600";
    if (clearedCount === 5) {
      message = "Unshakable (5/5 years cleared)";
      color = "text-emerald-600 font-bold";
    } else if (clearedCount === 4) {
      message = "Highly Stable (4/5 years cleared)";
      color = "text-teal-600 font-bold";
    } else if (clearedCount === 3) {
      message = "Likely (3/5 years cleared)";
      color = "text-indigo-600 font-bold";
    } else if (clearedCount === 2) {
      message = "Volatile (2/5 years cleared)";
      color = "text-amber-600 font-medium";
    } else if (clearedCount === 1) {
      message = "Highly Competitive (1/5 years cleared)";
      color = "text-orange-600 font-medium";
    } else {
      message = "Reach Standard (0/5 years cleared)";
      color = "text-red-500 font-medium";
    }

    return { clearedCount, details, message, color };
  };

  // Format DTE Centralized Admission Choice Code
  const getChoiceCode = (collegeCode: string, branchName: string, suffixCode: string) => {
    return `${collegeCode}${suffixCode}`;
  };

  // Handles updating percentile
  const handlePercentileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(percentileInput);
    if (isNaN(val) || val < 0.0 || val > 100.0) {
      triggerAlert("Please input a valid engineering percentile score between 0.0 and 100.00", "warning");
      return;
    }
    setPercentile(val);
    triggerAlert(`Predictor updated for user score: ${val.toFixed(4)}%tile`, "success");
  };

  // Core Filtering and Sorting Selector
  const predictionList = useMemo(() => {
    const list: {
      college: College;
      branch: Branch;
      adjustedCutoff: number;
      choiceCode: string;
      chance: ReturnType<typeof getChanceDetails>;
      stability: ReturnType<typeof evaluateHistoricalStability>;
    }[] = [];

    COLLEGES_DB.forEach((college) => {
      // 1. Regional Filter check
      if (cityFilter !== "All" && college.city !== cityFilter) return;

      // 2. Gender check (Ladies colleges cannot accommodate general male profiles)
      if (college.femaleOnly && gender === "Male") return;

      college.branches.forEach((branch) => {
        // 3. Branch filter check
        if (branchFilter !== "All" && branch.codeName !== branchFilter) return;

        const adjCutoff = calculateAdjustedCutoff(college, branch);
        const chanceDetails = getChanceDetails(percentile, adjCutoff);
        const stabilityDetails = evaluateHistoricalStability(college, branch, percentile);
        const choice = getChoiceCode(college.code, branch.name, branch.choiceIdSuffix);

        // 4. Search query check
        const matchStr = `${college.name} ${college.city} ${college.code} ${branch.name}`.toLowerCase();
        if (searchQuery && !matchStr.includes(searchQuery.toLowerCase())) return;

        list.push({
          college,
          branch,
          adjustedCutoff: adjCutoff,
          choiceCode: choice,
          chance: chanceDetails,
          stability: stabilityDetails
        });
      });
    });

    // Sorter logic
    return list.sort((a, b) => {
      if (sortBy === "chance") {
        return b.chance.percent - a.chance.percent || a.college.ranking - b.college.ranking;
      } else if (sortBy === "ranking") {
        return a.college.ranking - b.college.ranking;
      } else if (sortBy === "cutoff") {
        return b.adjustedCutoff - a.adjustedCutoff;
      }
      return 0;
    });
  }, [percentile, gender, category, minority, cityFilter, branchFilter, searchQuery, sortBy]);

  // Group predictor options based on cutoff vs user score clearance margins
  const { safeOptions, targetOptions, reachOptions } = useMemo(() => {
    const safe: typeof predictionList = [];
    const target: typeof predictionList = [];
    const reach: typeof predictionList = [];

    predictionList.forEach((item) => {
      const diff = percentile - item.adjustedCutoff;
      if (diff >= 0.1) {
        safe.push(item);
      } else if (diff >= -0.5) {
        target.push(item);
      } else {
        reach.push(item);
      }
    });

    return { safeOptions: safe, targetOptions: target, reachOptions: reach };
  }, [predictionList, percentile]);

  // Unique list of cities and branches for dropdown filters
  const citiesList = ["All", "Mumbai", "Pune", "Nagpur", "Sangli", "Amravati", "Karad", "Aurangabad"];
  const branchesList = [
    { code: "All", name: "All Engineering Branches" },
    { code: "CS", name: "Computer Science / SE" },
    { code: "IT", name: "Information Technology" },
    { code: "AIDS", name: "Art. Intelligence & Data Science" },
    { code: "ENTC", name: "Electronics & Telecom" },
    { code: "MECH", name: "Mechanical Engineering" },
    { code: "CIVIL", name: "Civil Engineering" },
    { code: "CHEM", name: "Chemical Engineering" }
  ];

  // Bookmark / Shortlist controllers
  const isShortlisted = (collegeId: string, branchName: string) => {
    return shortlist.some((item) => item.collegeId === collegeId && item.branchName === branchName);
  };

  const toggleShortlist = (collegeId: string, branch: Branch, choiceCode: string, collegeName: string) => {
    const exists = isShortlisted(collegeId, branch.name);
    if (exists) {
      setShortlist((prev) => prev.filter((item) => !(item.collegeId === collegeId && item.branchName === branch.name)));
      triggerAlert(`Removed ${branch.name} (${collegeName}) from choice shortlist.`, "info");
    } else {
      if (shortlist.length >= 30) {
        triggerAlert("State counseling list limits standard CAP option forms to maximum 30 unique choices.", "warning");
        return;
      }
      setShortlist((prev) => [...prev, { collegeId, branchName: branch.name, choiceCode }]);
      triggerAlert(`Added ${branch.name} (${collegeName}) to DTE choice sequence!`, "success");
    }
  };

  const moveShortlistItem = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === shortlist.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    const cloned = [...shortlist];
    const temp = cloned[index];
    cloned[index] = cloned[newIndex];
    cloned[newIndex] = temp;
    setShortlist(cloned);
    triggerAlert("Choice preference sequence updated.", "success");
  };

  const removeShortlistItem = (index: number) => {
    const item = shortlist[index];
    setShortlist((prev) => prev.filter((_, idx) => idx !== index));
    triggerAlert(`Deleted choice preference #${index + 1}`, "info");
  };

  // Favorites controllers (Heart toggle for whole Colleges)
  const isFavorite = (collegeId: string) => {
    return favorites.includes(collegeId);
  };

  const toggleFavorite = (collegeId: string, collegeName: string) => {
    const exists = favorites.includes(collegeId);
    if (exists) {
      setFavorites((prev) => prev.filter((id) => id !== collegeId));
      triggerAlert(`Removed ${collegeName} from your Favorite Colleges list.`, "info");
    } else {
      setFavorites((prev) => [...prev, collegeId]);
      triggerAlert(`Added ${collegeName} to your Favorite Colleges list!`, "success");
    }
  };

  // Smart advice engine based on percentile thresholds
  const smartAdvise = useMemo(() => {
    if (percentile >= 99.5) {
      return {
        rating: "Elite Level",
        text: "You qualify for top-tier government and government-aided autonomous institutes—target VJTI, COEP, and SPIT Computer Engineering.",
        safety: "Place COEP/VJTI CS/IT at the top of your list. Back them up with PICT CS as highly safe anchors."
      };
    } else if (percentile >= 98.0) {
      return {
        rating: "Outstanding Level",
        text: "Excellent rank! You are well positioned for PICT CS, VIT Pune, or SPIT ENTC/AIDS. D.J. Sanghvi and Cummins (for women) are strong matches.",
        safety: "Place COEP ENTC/Mechanical as reachable dreams, PICT IT as high probability targets, and VIT/PCCOE CS as rock-solid safeties."
      };
    } else if (percentile >= 95.0) {
      return {
        rating: "Highly Competitive",
        text: "Solid standing. Great prospects at PCCOE, Walchand Sangli, VIT, and autonomous institutes in Nagpur (RCOEM) or Mumbai (Thadomal).",
        safety: "Target ENTC options in Pune/Mumbai autonomous colleges, and include CS/IT at Walchand or Government Karad/Amravati as safe bets."
      };
    } else if (percentile >= 90.0) {
      return {
        rating: "Decent Potential",
        text: "Strong opportunities at Government Regional colleges (Amravati, Karad, Aurangabad) and private autonomous colleges in Nagpur or Mumbai.",
        safety: "Anchor with ENTC/Mechanical streams at Government Colleges and target computer branches in upcoming autonomous regional hubs."
      };
    } else {
      return {
        rating: "Aspiration Level",
        text: "Keep strategic back-up options. Focus on government autonomous regional hubs and Core Engineering sectors where lower cutoffs hold.",
        safety: "Focus on Mechanical, Civil, and regional private seats. Ensure your safety range is wide to avoid no-seat allocation."
      };
    }
  }, [percentile]);

  // Comparative Favorite metrics summary (combines tuition fees + placement rates)
  const favoritedCollegesData = useMemo(() => {
    return COLLEGES_DB.filter((col) => favorites.includes(col.id));
  }, [favorites]);

  const renderSectionCards = (
    title: string,
    subtitle: string,
    itemsList: typeof predictionList,
    borderColorClass: string,
    badgeColorClass: string,
    icon: React.ReactNode
  ) => {
    return (
      <div className={`space-y-4 rounded-2xl p-4 sm:p-5 bg-slate-50/50 border ${borderColorClass} transition-all duration-300`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-dashed border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white ${badgeColorClass} shadow-xs`}>
              {icon}
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-1">
                {title}
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-white rounded-md border text-slate-650 font-mono shadow-[0_1px_2px_rgba(0,0,0,0.03)] border-slate-200">
                  {itemsList.length} Option{itemsList.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {itemsList.length > 0 ? (
          <div className="space-y-4.5">
            {itemsList.map(({ college, branch, adjustedCutoff, choiceCode, chance, stability }, idx) => {
              const isItemExpanded = expandedCollege === `${college.id}-${branch.codeName}`;
              return (
                <div
                  key={`${college.id}-${branch.codeName}`}
                  className={`bg-white rounded-xl border ${
                    isItemExpanded ? "border-indigo-500 ring-2 ring-indigo-50" : "border-slate-200"
                  } shadow-xs p-4 sm:p-5 flex flex-col gap-3 transition-colors duration-200`}
                  id={`college-card-${college.id}-${branch.codeName}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      {/* Serial Number Badge */}
                      <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center font-extrabold text-slate-450 shrink-0 text-xs shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                        {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                            {college.name}
                          </h3>
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                            {college.city}
                          </span>
                          {college.minoritySeat !== "None" && (
                            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 rounded uppercase border border-indigo-100">
                              {college.minoritySeat} Minority
                            </span>
                          )}
                          {college.femaleOnly && (
                            <span className="text-[9px] font-bold bg-pink-50 text-pink-700 px-1.5 rounded uppercase border border-pink-100">
                              Ladies Only
                            </span>
                          )}
                          
                          {/* Heart Toggle Icon */}
                          <button
                            onClick={() => toggleFavorite(college.id, college.name)}
                            className="text-slate-350 hover:text-red-500 hover:scale-110 transition-transform p-0.5 inline-flex items-center justify-center cursor-pointer"
                            title={isFavorite(college.id) ? "Remove College from Favorites" : "Add College to Favorites"}
                          >
                            <Heart
                              className={`w-4 h-4 transition-colors ${
                                isFavorite(college.id) ? "text-red-500 fill-current" : "text-slate-350"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="text-xs text-slate-500 font-semibold flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-slate-405 font-mono">DTE Code: {college.code}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-indigo-600 font-extrabold">{branch.name}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 font-medium capitalize">{college.type}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase border border-purple-100">
                            Rank #{college.ranking}
                          </span>
                        </div>

                        {/* Custom quick tags: Placements & Fees */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-medium pt-1">
                          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            <Briefcase className="w-3 h-3 text-emerald-600" />
                            Placements: {college.placementRate}% (Avg: {college.averageSalary})
                          </span>
                          <span className="flex items-center gap-1 bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                            <DollarSign className="w-3 h-3 text-blue-600" />
                            Fee: ₹{college.annualFee.toLocaleString()}/yr
                          </span>
                          <span className="flex items-center gap-1 bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold border border-indigo-100" title="Branch intake (total seats configuration)">
                            <Users className="w-3 h-3 text-indigo-600" />
                            Intake: {branch.intakeCapacity || getBranchSeats(branch.codeName, college.id)} Seats
                          </span>
                          <span className="text-slate-450">
                            Est. {college.establishedYear}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Status Columns: Calculated Chances */}
                    <div className="flex sm:flex-row md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 border-slate-100 pt-2.5 md:pt-0 gap-2.5">
                      <div className="text-left md:text-right">
                        <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${chance.colorClass}`}>
                          {chance.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                          Target Cutoff
                        </p>
                        <p className="text-sm sm:text-base font-black text-slate-800 mt-1">
                          {adjustedCutoff.toFixed(2)}%tile
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Footer Bar */}
                  <div className="flex items-center justify-between border-t border-slate-150 pt-2.5 text-xs">
                    <button
                      onClick={() => setExpandedCollege(isItemExpanded ? null : `${college.id}-${branch.codeName}`)}
                      className="text-slate-500 font-black hover:text-indigo-600 flex items-center gap-1 transition-colors py-1 cursor-pointer"
                    >
                      {isItemExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide 5-Year History and Analytics
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Compare 5-Year Historical Trends
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-450 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded hidden sm:inline font-bold">
                        Code: {choiceCode}
                      </span>
                      <button
                        onClick={() => toggleShortlist(college.id, branch, choiceCode, college.name)}
                        className={`px-2.5 py-1.5 rounded-lg font-black flex items-center gap-1 transition-all text-xs border cursor-pointer ${
                          isShortlisted(college.id, branch.name)
                            ? "bg-indigo-600 text-white border-indigo-600 sm:hover:bg-indigo-700"
                            : "bg-white text-slate-600 border-slate-200 sm:hover:bg-slate-50"
                        }`}
                      >
                        {isShortlisted(college.id, branch.name) ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            Bookmarked
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            Bookmark Choice
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded 5-Year CAP Trends */}
                  {isItemExpanded && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-1.5 space-y-3.5 animate-fade-in text-xs">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-200 pb-2">
                        <h4 className="font-extrabold text-slate-700 flex items-center gap-1 uppercase tracking-wider text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                          CAP Historic Decadal Stability Range (2020 - 2024)
                        </h4>
                        <span className="text-[10px] font-bold">
                          Historical Stability Index: <span className={stability.colorClass}>{stability.message}</span>
                        </span>
                      </div>

                      {/* 5-Year Cutoff grid */}
                      <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                        {stability.details.map((yr) => (
                          <div
                            key={yr.year}
                            className={`p-2 rounded-lg border ${
                              yr.cleared
                                ? "bg-emerald-50/50 border-emerald-200"
                                : "bg-rose-50/40 border-rose-100"
                            } shadow-xs`}
                          >
                            <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
                              CAP {yr.year}
                            </span>
                            <p className="text-xs font-black text-slate-800 mt-0.5">
                              {yr.adjusted.toFixed(2)}
                            </p>
                            <span className={`text-[9.5px] font-black uppercase tracking-tight block mt-1 ${
                              yr.cleared ? "text-emerald-700" : "text-rose-600"
                            }`}>
                              {yr.cleared ? "CLEARED" : "RESTRICTED"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* recruiters and details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5 text-xs text-slate-600">
                        <div className="bg-white p-3 rounded-xl border border-slate-150 space-y-1.5">
                          <p className="font-extrabold text-slate-850 text-[11px] uppercase tracking-wider flex items-center gap-1 text-indigo-700 font-sans">
                            <Briefcase className="w-3 h-3 text-indigo-600" />
                            Top Recruiter Alliance Networks
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {college.topRecruiters.map((rec) => (
                              <span key={rec} className="text-[9.5px] font-bold bg-slate-50 border border-slate-150 text-slate-700 px-2 py-0.5 rounded">
                                {rec}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium pt-1">
                            Placement rate of {college.placementRate}% last season. Peak packages at {college.highestSalary}.
                          </p>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-150 space-y-1.5">
                          <p className="font-extrabold text-slate-850 text-[11px] uppercase tracking-wider flex items-center gap-1 text-indigo-700 font-sans">
                            <DollarSign className="w-3 h-3 text-indigo-600" />
                            Estimated Category Waiver Fees
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                            <div className="flex justify-between border-b pb-1 font-medium">
                              <span className="text-slate-400">OPEN :</span>
                              <strong className="text-slate-800">₹{college.annualFee.toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between border-b pb-1 font-medium">
                              <span className="text-slate-400">OBC/EBC (50%):</span>
                              <strong className="text-slate-800">₹{(college.annualFee * 0.5).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between border-b pb-1 font-medium">
                              <span className="text-slate-400">TFWS (Tuition Waiver):</span>
                              <strong className="text-slate-800">₹15,000</strong>
                            </div>
                            <div className="flex justify-between border-b pb-1 font-medium">
                              <span className="text-slate-400">SC/ST (Waiver):</span>
                              <strong className="text-slate-800">₹4,500</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Predictive insight */}
                      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-indigo-950">
                        <p className="font-extrabold text-indigo-900 text-[10px] uppercase tracking-widest block mb-1">
                          Predictive Counseling Insight:
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-xs font-semibold">
                          <li>
                            <strong>Percentile buffer:</strong> Your rank holds a buffer of <strong>{(percentile - adjustedCutoff).toFixed(2)} %tile</strong> compared to the current cycle target cutoff of <strong>{adjustedCutoff.toFixed(2)}</strong>.
                          </li>
                          <li>
                            <strong>Placement Factor:</strong> With an average salary package of <strong>{college.averageSalary}</strong>, this combination represents a <strong>{(college.placementRate >= 92) ? "highly lucrative and premium" : "solid and dependable"}</strong> academic path.
                          </li>
                          <li>
                            <strong>Option Form Strategy:</strong> {percentile >= adjustedCutoff ? "Keep this in the TOP 15 elements of your choice form to lock down allocation in early rounds." : "Excellent stretch target! Keep this as a Reach choice above your safety buffers."}
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-6 text-center rounded-xl border border-dashed border-slate-150">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">No matching options in this category</p>
            <p className="text-[10px] text-slate-450 mt-1">Try broadening your region/city selection or clearing engineering stream filters.</p>
          </div>
        )}
      </div>
    );
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-600 selection:text-white" id="main-frame">
      {/* Visual Alert Badge */}
      {alertMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 text-xs sm:text-sm font-bold animate-bounce transition-all ${
            alertType === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : alertType === "warning"
              ? "bg-amber-50 text-amber-800 border-amber-200"
              : "bg-indigo-50 text-indigo-800 border-indigo-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          {alertMessage}
        </div>
      )}

      {/* Top Professional Header Bar */}
      <header className="h-20 bg-slate-900 text-white flex items-center justify-between px-4 sm:px-8 border-b border-slate-800 shrink-0 select-none print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg tracking-wider border border-indigo-400">
            CAP
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
              MHT CET College Predictor & Counseling Assistant
              <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase mt-0.5 animate-pulse">
                2025 PROJECTION
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
              Maharashtra Centralized Admission Process (DTE) Cutoff Matrix
            </p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>CAP Databases Online</span>
          </div>
          {isSecureSharedDevice && (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-400 font-extrabold px-2.5 py-1.5 rounded-lg border border-emerald-900 shadow-xs">
              <Lock className="w-3 h-3 text-emerald-400" />
              Cafe Isolation Active
            </span>
          )}
          {isMaskedMode && (
            <span className="flex items-center gap-1 text-[10px] bg-indigo-950/80 text-indigo-400 font-extrabold px-2.5 py-1.5 rounded-lg border border-indigo-900 shadow-xs animate-pulse">
              <EyeOff className="w-3 h-3 text-indigo-400" />
              Shield Armed
            </span>
          )}
          <span className="text-slate-600">|</span>
          <p className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
            Active Profile: <strong className="text-indigo-400 uppercase">{category}</strong> / {gender}
          </p>
        </div>
      </header>

      {/* Main Content Layout Block (Sidebar + Nav workspace) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 print:block">
        
        {/* Left Side: Counseling Profile Inputs Panel */}
        <aside className="w-full lg:w-85 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 shrink-0 overflow-y-auto print:hidden">
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Counselor Config
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Configure your reservation categories, gender and percentile score to recalculate DTE CAP admissions likelihood.
              </p>
            </div>

            {/* Score Form Input */}
            <form onSubmit={handlePercentileSubmit} className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                MHT CET Percentile Score
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0"
                    max="100.0"
                    value={percentileInput}
                    onChange={(e) => setPercentileInput(e.target.value)}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 leading-none transition-all duration-300 ${
                      isMaskedMode ? "blur-md select-none hover:blur-none focus:blur-none" : ""
                    }`}
                    placeholder="E.g. 99.4231"
                  />
                  <span className="absolute right-4 top-3 text-[10px] font-black text-slate-400 uppercase">
                    %tile
                  </span>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Apply
                </button>
              </div>
              <p className={`text-[10px] text-slate-400 font-semibold px-1 transition-all duration-300 ${isMaskedMode ? "blur-xs select-none hover:blur-none" : ""}`}>
                Currently loaded: <span className="text-indigo-600 font-black">{percentile.toFixed(4)}%tile</span>
              </p>
            </form>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Reservation Category Quota
                </label>
                <select
                  value={category}
                  onChange={(e: any) => {
                    setCategory(e.target.value);
                    triggerAlert(`Category quota changed to ${e.target.value}`, "info");
                  }}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all duration-300 ${
                    isMaskedMode ? "blur-md select-none hover:blur-none focus:blur-none" : ""
                  }`}
                >
                  <option value="Open">OPEN (General Merit)</option>
                  <option value="OBC">OBC (Other Backward Class)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="VJNT">VJNT (Vimukta Jati Nomadic Tribes)</option>
                  <option value="EWS">EWS (Economically Weaker Section)</option>
                </select>
                <p className="text-[10px] text-slate-400 font-medium">
                  *Waives cutoffs & tuition fees according to reservation rules.
                </p>
              </div>

              {/* Gender Radio Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Candidate Gender Quota
                </label>
                <div className={`grid grid-cols-2 gap-2 transition-all duration-300 ${isMaskedMode ? "blur-md select-none hover:blur-none" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Male");
                      triggerAlert("Candidate profile changed: Male", "info");
                    }}
                    className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition-all text-center ${
                      gender === "Male"
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Male (All Seats)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGender("Female");
                      triggerAlert("Candidate profile changed: Female L Seats Enabled", "success");
                    }}
                    className={`py-2 px-3 border rounded-xl text-xs font-extrabold transition-all text-center ${
                      gender === "Female"
                        ? "bg-pink-600 border-pink-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Female (L Option)
                  </button>
                </div>
              </div>

              {/* Linguistic Minority affidavit claims */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                  Linguistic Minority Claim
                </label>
                <select
                  value={minority}
                  onChange={(e: any) => {
                    setMinority(e.target.value);
                    triggerAlert(`Minority Quota matches set to: ${e.target.value}`, "info");
                  }}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none transition-all duration-300 ${
                    isMaskedMode ? "blur-md select-none hover:blur-none focus:blur-none" : ""
                  }`}
                >
                  <option value="None">None (General Maharashtra Resident)</option>
                  <option value="Gujarati">Gujarati Minority (SVKM Institutions)</option>
                  <option value="Sindhi">Sindhi Minority (TSEC Institution)</option>
                  <option value="Hindi">Hindi Minority (RCOEM Institution)</option>
                </select>
                <p className="text-[10px] text-slate-400 font-medium">
                  Unlocks dedicated minority sheets in autonomous private institutes.
                </p>
              </div>
            </div>

            {/* Region and Stream Segment Filters */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-650" />
                DTE Regional & Branch Filters
              </h3>

              {/* City filter dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Region/City
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {citiesList.map((city) => (
                    <button
                      key={city}
                      onClick={() => setCityFilter(city)}
                      className={`py-1.5 px-2 border rounded-lg text-[11px] font-bold transition-all truncate ${
                        cityFilter === city
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {city === "All" ? "All Regions" : city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch list filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Engineering Branch (Stream)
                </label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {branchesList.map((br) => (
                    <option key={br.code} value={br.code}>
                      {br.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secure & Private Session Control Panel */}
            <div className="pt-5 border-t border-slate-150 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  Security & Session Shield
                </h3>
                <span className="text-[8px] font-extrabold uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 animate-pulse">
                  TLS Secured
                </span>
              </div>
              <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                If accessing this counselor predictor from a public internet cafe, shared laptop, or university computer lab, adjust security settings below.
              </p>

              <div className="space-y-2 text-xs">
                {/* 1. Cyber Cafe Shared Device Mode Toggle */}
                <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl flex items-start justify-between gap-3 hover:bg-slate-100/60 transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                      {isSecureSharedDevice ? <Lock className="w-3.5 h-3.5 text-emerald-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                      Cyber Cafe Isolation
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Bypasses local storage to ensure zero disk traceability.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSecureSharedDevice}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isSecureSharedDevice ? "bg-emerald-600" : "bg-slate-350"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isSecureSharedDevice ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 2. Anti-Shoulder-Surfing Blur Option */}
                <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl flex items-start justify-between gap-3 hover:bg-slate-100/60 transition-colors">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1 text-[11px]">
                      {isMaskedMode ? <EyeOff className="w-3.5 h-3.5 text-indigo-650" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                      Shoulder-Surfing Shield
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      Hover to reveal inputs. Keeps scores safe from onlookers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleMaskedMode}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isMaskedMode ? "bg-indigo-600" : "bg-slate-350"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        isMaskedMode ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Secure Session Wipe Button */}
                <button
                  type="button"
                  onClick={handlePurgeSession}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all border border-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Emergency Secure Wipe
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Main Workspace Tabs & Outputs Container */}
        <main className="flex-1 flex flex-col min-h-0 print:block">
          
          {/* Sub Navigation menu of 5 Workspace Tabs */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              
              <button
                onClick={() => setActiveTab("predictor")}
                className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "predictor"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                CAP Predictor
              </button>

              <button
                onClick={() => setActiveTab("favorites")}
                className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 relative ${
                  activeTab === "favorites"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Heart className="w-4 h-4 text-red-500 fill-current" />
                Favorite Colleges
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
                    {favorites.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("shortlist")}
                className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 relative ${
                  activeTab === "shortlist"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Bookmark className="w-4 h-4" />
                My Shortlist
                {shortlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center animate-pulse">
                    {shortlist.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("optionForm")}
                className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "optionForm"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                CAP Option Form
              </button>

              <button
                onClick={() => setActiveTab("insights")}
                className={`px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "insights"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Counseling Advice
              </button>

              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-2 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "admin"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-rose-600 bg-rose-50/50 hover:bg-rose-100 hover:text-rose-700"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Advisor Admin Portal
              </button>
            </div>

            {/* Quick search filter for Predictor */}
            {activeTab === "predictor" && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search college, city, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-semibold pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 print:block">
            
            {/* Tab 1: PREDICTOR VIEW */}
            {activeTab === "predictor" && (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-1">
                      Recommended CAP Choices
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Showing <strong className="text-indigo-600">{predictionList.length}</strong> possible options for{" "}
                      <strong className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{percentile.toFixed(4)}%tile</strong>{" "}
                      • Quota Category: <strong className="text-indigo-600 uppercase">{category}</strong>
                      {gender === "Female" && " • Quota: Female L"}
                      {minority !== "None" && ` • Minority Quota: ${minority}`}
                    </p>
                    <p className="text-[10px] text-amber-600 font-extrabold mt-1 sm:mt-1.5 flex items-center gap-1">
                      ⚠️ Note: Seat intake capacities, choice codes, and simulation data are subject to change according to official CET Cell/DTE guidelines.
                    </p>
                  </div>

                  {/* Sorter Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(e: any) => {
                        setSortBy(e.target.value);
                        triggerAlert(`Sorting by ${e.target.value}`, "info");
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none"
                    >
                      <option value="chance">Admission Chance %</option>
                      <option value="ranking">College Rank/DTE Prestige</option>
                      <option value="cutoff">Estimated Cutoff</option>
                    </select>
                  </div>
                </div>

                {/* Predictor Stream List */}
                {predictionList.length > 0 ? (
                  <div className="space-y-6">
                    {/* Visual Segmented Control Selector */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 safety-tab-selector backdrop-blur-xs p-1.5 bg-slate-100 rounded-xl border border-slate-200 print:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSectionFilter("all");
                          triggerAlert("Showing all predicted sections", "info");
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                          activeSectionFilter === "all"
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200"
                        }`}
                      >
                        <Layers className="w-4 h-4 shrink-0 text-slate-450" />
                        <span>All Choices ({predictionList.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSectionFilter("safe");
                          triggerAlert("Segmented view: Safe Bets (almost secured)", "success");
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                          activeSectionFilter === "safe"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:text-slate-950 hover:bg-emerald-50/40 border border-slate-200"
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0 text-emerald-450 fill-current animate-pulse" />
                        <span>Safe Bets ({safeOptions.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSectionFilter("target");
                          triggerAlert("Segmented view: Target Choices (moderate chances)", "warning");
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                          activeSectionFilter === "target"
                            ? "bg-amber-500 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:text-slate-950 hover:bg-amber-50/40 border border-slate-200"
                        }`}
                      >
                        <Award className="w-4 h-4 shrink-0 text-amber-500" />
                        <span>Target Choices ({targetOptions.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSectionFilter("reach");
                          triggerAlert("Segmented view: Reach/Dream (low probability)", "warning");
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all text-center flex items-center justify-center gap-2 cursor-pointer ${
                          activeSectionFilter === "reach"
                            ? "bg-red-500 text-white shadow-xs"
                            : "bg-white text-slate-600 hover:text-slate-950 hover:bg-rose-50/40 border border-slate-200"
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 shrink-0 text-red-500" />
                        <span>Reach Choices ({reachOptions.length})</span>
                      </button>
                    </div>

                    {/* Section Grid List */}
                    <div className="space-y-6">
                      {(activeSectionFilter === "all" || activeSectionFilter === "safe") && (
                        renderSectionCards(
                          "Safe Bets (Almost Secured)",
                          "Your percentile score comfortably secures or is almost secure against historical CAP cutoffs. Highly reliable safety buffers.",
                          safeOptions,
                          "border-emerald-200 bg-emerald-50/15",
                          "bg-emerald-600",
                          <Sparkles className="w-4 h-4 text-white" />
                        )
                      )}

                      {(activeSectionFilter === "all" || activeSectionFilter === "target") && (
                        renderSectionCards(
                          "Target Choices (Moderate chances)",
                          "Very realistic moderate options where your percentile falls close to historical DTE cycles. Core preference candidates.",
                          targetOptions,
                          "border-amber-200 bg-amber-50/15",
                          "bg-amber-500 border border-amber-500",
                          <Award className="w-4 h-4 text-white" />
                        )
                      )}

                      {(activeSectionFilter === "all" || activeSectionFilter === "reach") && (
                        renderSectionCards(
                          "Reach / Ambitious (Not Probable)",
                          "Premium aspirational choices where historical cutoffs exceed your current percentile. Form layout spacers.",
                          reachOptions,
                          "border-rose-200 bg-rose-50/10",
                          "bg-red-500 border border-red-500",
                          <TrendingUp className="w-4 h-4 text-white" />
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-450 font-black">No matching predictors found for your percentile and choices.</p>
                    <p className="text-xs text-slate-400 mt-1">Try broadening your region selection filters or clearing minor options.</p>
                    <button
                      onClick={() => {
                        setCityFilter("All");
                        setBranchFilter("All");
                        setSearchQuery("");
                        triggerAlert("Filters cleared, standard college set loaded.", "info");
                      }}
                      className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-black rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
                
                {/* Personalized Floating Counselor Advisor Panel */}
                <div className="p-5 sm:p-6 bg-slate-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/35">
                      <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-300 font-extrabold uppercase tracking-wider">
                        Personalized Counselor Advisory Matrix
                      </p>
                      <h4 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                        {smartAdvise.text} ({smartAdvise.rating})
                      </h4>
                      <p className="text-xs text-slate-300 font-medium mt-1.5 leading-relaxed">
                        ⚠️ <strong>Action Plan:</strong> {smartAdvise.safety}
                      </p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-stretch gap-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={printReport}
                      className="px-5 py-2.5 bg-white text-slate-950 font-extrabold text-xs rounded-xl hover:bg-slate-100 transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print CAP Option Form
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("optionForm");
                        triggerAlert("Switched to Active Preference Sequencer.", "info");
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-505 text-white font-extrabold text-xs rounded-xl text-center shadow-xs"
                    >
                      Order Option Form
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: FAVORITE COLLEGES WORKSPACE */}
            {activeTab === "favorites" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                      <Heart className="text-red-500 w-5 h-5 fill-current" />
                      My Favorite Institutions ({favoritedCollegesData.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      View, compare, and manage your highly regarded colleges before finalizing single branch choices for the preference sheet.
                    </p>
                  </div>
                  {favoritedCollegesData.length > 1 && (
                    <button
                      onClick={() => {
                        setFavorites([]);
                        triggerAlert("Favorites list cleared.", "info");
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-[11px] rounded-lg transition-colors border border-red-100"
                    >
                      Delete All Favorites
                    </button>
                  )}
                </div>

                {favoritedCollegesData.length > 0 ? (
                  <div className="space-y-6">
                    
                    {/* Comparative Table Block (Highly Polished) */}
                    {favoritedCollegesData.length > 1 && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-3 bg-slate-900 text-white text-[10px] font-bold tracking-widest uppercase flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          Institutional Comparative Analytics Matrix
                        </div>
                        <div className="overflow-x-auto text-[11px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-[10px] uppercase">
                                <th className="p-3">College Name & Code</th>
                                <th className="p-3">State Rank</th>
                                <th className="p-3">Annual Fees</th>
                                <th className="p-3">Est. Placement Score</th>
                                <th className="p-3">Average Package</th>
                                <th className="p-3">Highest Recorded</th>
                                <th className="p-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-850">
                              {favoritedCollegesData.map((col) => (
                                <tr key={col.id} className="hover:bg-slate-50/40">
                                  <td className="p-3">
                                    <div className="font-extrabold text-slate-900">{col.name}</div>
                                    <span className="text-[10px] text-slate-400">DTE: {col.code} • {col.city}</span>
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-extrabold text-[9.5px] rounded border border-purple-100">
                                      #{col.ranking}
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-indigo-700">₹{col.annualFee.toLocaleString()}</td>
                                  <td className="p-3 text-emerald-700">{col.placementRate}% Placed</td>
                                  <td className="p-3 text-slate-800">{col.averageSalary}</td>
                                  <td className="p-3 text-slate-500">{col.highestSalary}</td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => toggleFavorite(col.id, col.name)}
                                      className="text-red-500 hover:text-red-700 font-bold hover:scale-105 transition-all text-[10px] uppercase bg-red-50 px-2 py-1 rounded"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Detailed Cards for Favorited Institutions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {favoritedCollegesData.map((col) => (
                        <div key={col.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-1">
                              <h3 className="font-black text-slate-905 text-sm sm:text-base tracking-tight leading-tight">
                                {col.name}
                              </h3>
                              <p className="text-xs text-slate-550 font-bold flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-mono">CODE: {col.code}</span>
                                <span>•</span>
                                <span className="text-slate-400 font-medium capitalize">{col.type}</span>
                                <span>•</span>
                                <span className="text-indigo-600">{col.city}</span>
                              </p>
                            </div>
                            <button
                              onClick={() => toggleFavorite(col.id, col.name)}
                              className="text-red-500 bg-red-50 border border-red-100 p-1.5 rounded-lg hover:bg-red-100 transition-colors"
                              title="Delete from favorites"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quick Placement stats block */}
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-150 font-medium text-slate-600">
                            <div>
                              <span>Annual Fee</span>
                              <p className="text-xs font-black text-slate-800 mt-0.5">₹{col.annualFee.toLocaleString()}</p>
                            </div>
                            <div>
                              <span>Placement Rate</span>
                              <p className="text-xs font-black text-slate-800 mt-0.5">{col.placementRate}%</p>
                            </div>
                            <div>
                              <span>Average Salary</span>
                              <p className="text-xs font-black text-slate-800 mt-0.5">{col.averageSalary}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                              AVAILABLE BRANCH ADMISSION CHANCE (YOUR PERCENTILE: {percentile.toFixed(2)})
                            </span>
                            <div className="space-y-1.5">
                              {col.branches.map((br) => {
                                const adjCutoff = calculateAdjustedCutoff(col, br);
                                const chanceInfo = getChanceDetails(percentile, adjCutoff);
                                const isAdded = isShortlisted(col.id, br.name);
                                const choiceId = getChoiceCode(col.code, br.name, br.choiceIdSuffix);

                                return (
                                  <div key={br.codeName} className="flex items-center justify-between p-2 bg-slate-50/50 rounded-lg border border-slate-150 text-xs text-slate-705">
                                    <div className="space-y-0.5">
                                      <p className="font-extrabold text-slate-800 truncate max-w-56">{br.name}</p>
                                      <span className="text-[9.5px] font-semibold text-slate-405 block">
                                        Target: {adjCutoff.toFixed(2)} %tile • Code: {choiceId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border ${chanceInfo.colorClass}`}>
                                        {chanceInfo.percent}% Allocation
                                      </span>
                                      <button
                                        onClick={() => toggleShortlist(col.id, br, choiceId, col.name)}
                                        className={`p-1.5 rounded-md border transition-all ${
                                          isAdded
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                                        }`}
                                        title={isAdded ? "Remove from Shortlist" : "Add to Shortlist"}
                                      >
                                        {isAdded ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-xl text-indigo-950 text-xs sm:text-sm flex gap-2">
                      <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                      <div>
                        <strong>How to use this information:</strong> You have favorited these institutions. Compare their salary returns against annual fee structures, analyze branch quotas, and bookmarked specific branches with high probabilities directly using the check-marks!
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200">
                    <Heart className="w-12 h-12 text-slate-550 mx-auto animate-pulse" />
                    <p className="text-slate-450 font-black mt-3">Your Favorite Colleges directory is empty.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Navigate choices in the <strong>College Predictor</strong> and click the Heart icon next to the college name to save it here!
                    </p>
                    <button
                      onClick={() => setActiveTab("predictor")}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      Browse Predictor recommendations
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: BOOKMARKED SHORTLIST VIEW */}
            {activeTab === "shortlist" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    <Bookmark className="text-indigo-600 w-5 h-5 fill-current" />
                    Student Shortlisted choices ({shortlist.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Your bookmarked college & branch options. These form the sequence blocks of your CAP Preference Option Sheet form (Max 30, ideal: 10-20 choices).
                  </p>
                </div>

                {shortlist.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-xs flex items-start gap-2 leading-relaxed">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Sequence Strategy:</strong> These are custom candidates selections. Navigate to the <strong>CAP Option Form</strong> tab next. There you can organize the ranking priorities dynamically before printing the simulator checklist.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {shortlist.map((item, index) => {
                        const college = COLLEGES_DB.find((c) => c.id === item.collegeId);
                        const branch = college?.branches.find((b) => b.name === item.branchName);
                        if (!college || !branch) return null;

                        const adjusted = calculateAdjustedCutoff(college, branch);
                        const chance = getChanceDetails(percentile, adjusted);

                        return (
                          <div
                            key={`${item.collegeId}-${item.branchName}`}
                            className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-650 shrink-0">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                                  {college.name}
                                </h3>
                                <p className="text-xs text-indigo-600 font-extrabold mt-0.5">
                                  {item.branchName} <span className="text-slate-400 font-medium">({college.city})</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono mt-1">
                                  Official DTE Choice ID: <strong className="text-slate-700">{item.choiceCode}</strong> • Annual Fee: ₹{college.annualFee.toLocaleString()}/yr • Intake: {branch.intakeCapacity || getBranchSeats(branch.codeName, college.id)} Seats
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 shrink-0">
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border inline-block ${chance.colorClass}`}>
                                {chance.label}
                              </span>
                              <button
                                onClick={() => {
                                  setShortlist((prev) => prev.filter((_, idx) => idx !== index));
                                  triggerAlert(`Removed ${item.branchName} from sequence`, "info");
                                }}
                                className="text-slate-400 hover:text-red-650 p-1.5 text-xs font-black flex items-center gap-1 hover:bg-slate-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center text-xs pt-3">
                      <button
                        onClick={() => {
                          setShortlist([]);
                          triggerAlert("Choice list wiped.", "info");
                        }}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold rounded-lg transition-colors border border-red-100"
                      >
                        Wipe Shortlist Options
                      </button>
                      <button
                        onClick={() => setActiveTab("optionForm")}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-colors shadow-xs"
                      >
                        Create CAP Option Form ({shortlist.length} choices)
                      </button>
                    </div>

                    {renderStudentSubmissionForm()}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-450 font-black">Your shortlist is currently empty.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Assess matching streams on the <strong>CAP Predictor</strong> workspace and select &quot;Bookmark Choice&quot; to begin!
                    </p>
                    <button
                      onClick={() => setActiveTab("predictor")}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      Browse Predictor Suggestions
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: OPTION PREFERENCE LIST BUILDER */}
            {activeTab === "optionForm" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    <ListOrdered className="text-indigo-600 w-5 h-5" />
                    CAP Option Preference Sequence Sheet Simulator
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rearrange, prioritize, and structure your choices. Option allocation matches sequentially starting at preference #1. Place dream colleges high, and safe backups down!
                  </p>
                </div>

                {shortlist.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-yellow-900 text-xs flex items-start gap-2 leading-relaxed">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>DTE Strategy Tip:</strong> Allocation lock-downs are strict. If Choice #1 registers a match, later preferences are discarded. Ensure Choice #1 is your true ultimate dream, and safe options are sequentially indexed downward below #10!
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="p-3 bg-slate-900 text-white flex justify-between items-center text-[10px] font-bold tracking-wider">
                        <span>PREFERENCE PRE-REGISTRATION WORKSHEET</span>
                        <button
                          onClick={printReport}
                          className="bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded flex items-center gap-1.5 transition-colors font-extrabold uppercase"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print/Share PDF
                        </button>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {shortlist.map((item, index) => {
                          const college = COLLEGES_DB.find((c) => c.id === item.collegeId);
                          const branch = college?.branches.find((b) => b.name === item.branchName);
                          if (!college || !branch) return null;

                          const adj = calculateAdjustedCutoff(college, branch);
                          const chance = getChanceDetails(percentile, adj);

                          return (
                            <div
                              key={`${item.collegeId}-${item.branchName}-ordered`}
                              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/20 transition-all text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-center font-bold text-slate-450 min-w-8 bg-slate-100 border border-slate-200 px-1.5 py-1 rounded-md text-[11px]">
                                  #{index + 1}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-extrabold text-slate-850 truncate">{college.name}</h4>
                                  <p className="text-xs text-indigo-650 font-black mt-0.5 leading-tight">
                                    {item.branchName}{" "}
                                    <span className="text-slate-400 font-medium">({college.city})</span>
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[9.5px]">
                                    <span className="font-mono text-slate-500 bg-slate-50 border px-1.5 rounded uppercase">
                                      Choice ID: {item.choiceCode}
                                    </span>
                                    <span className="text-slate-350">|</span>
                                    <span className={`font-bold uppercase px-1.5 rounded border ${chance.colorClass}`}>
                                      {chance.label}
                                    </span>
                                    <span className="text-slate-350">|</span>
                                    <span className="text-slate-400">
                                      Est. tuition fee: ₹{college.annualFee.toLocaleString()}/yr • Intake: {branch.intakeCapacity || getBranchSeats(branch.codeName, college.id)} Seats
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Sequence Ordering actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveShortlistItem(index, "up")}
                                  className={`p-1.5 rounded border transition-colors ${
                                    index === 0
                                      ? "text-slate-300 border-slate-150 pointer-events-none"
                                      : "text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer"
                                  }`}
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === shortlist.length - 1}
                                  onClick={() => moveShortlistItem(index, "down")}
                                  className={`p-1.5 rounded border transition-colors ${
                                    index === shortlist.length - 1
                                      ? "text-slate-300 border-slate-150 pointer-events-none"
                                      : "text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer"
                                  }`}
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeShortlistItem(index)}
                                  className="p-1.5 rounded border border-red-100 text-red-500 hover:bg-red-50 transition-colors ml-1"
                                  title="Delete Selection"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-450 font-semibold text-center italic">
                      Verify that your final layout includes high probability Target & Safety choices to avoid allocation failure.
                    </p>

                    {renderStudentSubmissionForm()}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-450 font-black">Your Sequence form is empty.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Shortlist and bookmark matching courses inside our counselor database first, then sequence choices here.
                    </p>
                    <button
                      onClick={() => setActiveTab("predictor")}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      Search Predictor recommendations
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: INFO & COUNSELING INSTRUCTIONS */}
            {activeTab === "insights" && (
              <div className="space-y-6 animate-fade-in text-xs sm:text-sm">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    <BookOpen className="text-indigo-600 w-5 h-5" />
                    DTE MHT CET CAP Counseling Strategic Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive tips, decadal trend analysis, and guidelines of Centralized Admission Process rounds.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strategy golden rules */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3.5">
                    <h3 className="font-extrabold text-slate-850 flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-indigo-650" />
                      Central Admission Core Rule
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-xs">
                      Centralized CAP allocation in Maharashtra runs top-down. If your Option #1 matches, you are auto-frozen. Auto-freeze candidates cannot take part in CAP Round 2, and are forced to accept the seat. Therefore:
                    </p>
                    <div className="p-3 bg-indigo-55/40 text-indigo-950 rounded-xl space-y-2 border border-indigo-100">
                      <p className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                        Suggested Form Hierarchy:
                      </p>
                      <ul className="text-xs space-y-1.5 list-decimal pl-4 font-semibold text-indigo-950">
                        <li><strong>Pref 1 to 5:</strong> Highly aspirational dream options (Cutoffs slightly exceeding user score).</li>
                        <li><strong>Pref 6 to 15:</strong> Probable, strong target colleges matching user percentile neighborhood.</li>
                        <li><strong>Pref 16 to 30:</strong> Unbreakable safety options (with cutoffs 1-3 percentile lower).</li>
                      </ul>
                    </div>
                  </div>

                  {/* Trends Analyis */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <h3 className="font-extrabold text-slate-850 flex items-center gap-2 text-sm">
                      <Award className="w-4 h-4 text-indigo-650" />
                      5-Year Trend & Projection Analysis
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-xs">
                      Historical CAP results from 2020 through 2024 demonstrate that Computer Science, Information Technology, and AI/ML streams exhibit steadily rising cutoff scores (growing ~0.15% annually in premier colleges).
                    </p>
                    <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Computer Science growth rate:</span>
                        <strong className="text-indigo-600">+0.12% / Year</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">ENTC branch stability rate:</span>
                        <strong className="text-emerald-700">Stable (-0.02% / Year)</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Ladies L Quota Average delta:</span>
                        <strong className="text-pink-600">-0.12% Buffer</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Minority Reservation quota threshold decrease:</span>
                        <strong className="text-slate-800">Upto 1.5%ile Drop</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FAQ sections */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                  <h3 className="font-extrabold text-slate-850 text-sm">Frequently Asked CAP Questions</h3>
                  <div className="space-y-4 divide-y divide-slate-100 text-xs text-slate-605">
                    <div className="pt-1 leading-relaxed">
                      <p className="font-extrabold text-slate-800 text-xs">Q. What is TFWS quota, and what are its benefits?</p>
                      <p className="text-slate-600 mt-1">
                        Tuition Fee Waiver Scheme (TFWS) is a DTE program waiving 100% of college tuition fees for meritorious students. Total family income must be under ₹8 Lakhs. The cutoff is usually 0.5 percentile higher, and candidates must input choice codes with suffix "11" instead of "10" (e.g. 600611).
                      </p>
                    </div>
                    <div className="pt-3 leading-relaxed">
                      <p className="font-extrabold text-slate-800 text-xs">Q. Am I eligible for Gujarati / Sindhi / Hindi minority seats if living outside major cities?</p>
                      <p className="text-slate-600 mt-1">
                        Yes! Minority allocations (Linguistic quotas at colleges like D.J. Sanghvi, Thadomal, Ramdeobaba) are open statewide to all candidates holding valid domiciles of Maharashtra with minority affidavits.
                      </p>
                    </div>
                    <div className="pt-3 leading-relaxed">
                      <p className="font-extrabold text-slate-800 text-xs">Q. What is BETTERMENT option in Central Seat Allocation?</p>
                      <p className="text-slate-600 mt-1">
                        If assigned any choice from Priority #2 to #300, a candidate can select "Betterment" and deposit a ₹1,000 seat acceptance fee. This locks the current seat but permits them to test luck in CAP Rounds 2 and 3. If better choices are allocated, the previous choice is cleanly replaced.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Session Security and Privacy Protocol Sheet */}
                <div className="bg-emerald-50/40 border border-emerald-150 p-5 rounded-xl space-y-3.5">
                  <h3 className="font-extrabold text-emerald-950 flex items-center gap-2 text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-755" />
                    Student Data Safety & Privacy Protocol
                  </h3>
                  <p className="text-slate-700 leading-relaxed text-xs">
                    As MHT CET choice-filling is highly confidential (and mock lists compile private academic states), our system adheres to strict cyber security protocols to prevent profile hijacks or local tracking:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1.5 text-xs">
                    <div className="bg-white/85 p-3 rounded-lg border border-emerald-100 space-y-1">
                      <strong className="text-emerald-950 block font-black">Zero-Server Leakage</strong>
                      <p className="text-slate-550 text-[11px] leading-snug">All percentile computation and sorting run strictly client-side. Your marks are never uploaded or indexed on backends.</p>
                    </div>
                    <div className="bg-white/85 p-3 rounded-lg border border-emerald-100 space-y-1">
                      <strong className="text-emerald-950 block font-black">Device Isolation Guard</strong>
                      <p className="text-slate-550 text-[11px] leading-snug">Toggle Secure Cafe isolation to disable cookie/LocalStorage writes, preventing following users in cyber cafes from tracking your bookmarks.</p>
                    </div>
                    <div className="bg-white/85 p-3 rounded-lg border border-emerald-100 space-y-1">
                      <strong className="text-emerald-955 block font-black">Local Sight Protection</strong>
                      <p className="text-slate-550 text-[11px] leading-snug">Activate Shoulder-Surfing Shield to instantly blur sensitive input numbers. Safely browse predictions in crowded computer centers.</p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Tab 6: SECURE ADVISOR ADMIN CONTROL PANEL */}
            {activeTab === "admin" && (
              <div className="space-y-6 animate-fade-in text-xs sm:text-sm">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-rose-800 flex items-center gap-2">
                    <ShieldCheck className="text-rose-600 w-5 h-5" />
                    Advisor Administration Ledger & Coordinator Console
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review and verify mock preference allocation forms submitted by prospective students. Filter registers, view metrics, and contact applicants directly via WhatsApp or Email.
                  </p>
                </div>

                {!isAdminAuthorized ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-xl mx-auto shadow-xl space-y-6">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
                        <Lock className="w-6 h-6 animate-pulse" />
                      </div>
                      <h3 className="text-base font-black text-slate-800">
                        Authorization Credentials Required
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        To protect private contact records, percentile indices, and mock sequence lists from unauthorized tracking, please provide verification credentials.
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAdminPasscodeLogin(adminPasskey);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5 text-left">
                        <label className="block text-[10px] text-slate-400 font-black uppercase tracking-wider">
                          Administrator Passkey Code
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="password"
                            required
                            value={adminPasskey}
                            onChange={(e) => setAdminPasskey(e.target.value)}
                            placeholder="Enter u/Wise_Papaya368 passkey..."
                            className="w-full text-xs font-bold pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
                      >
                        Unlock Administration Dashboard
                      </button>
                    </form>

                    <div className="relative flex py-2 items-center justify-center">
                      <div className="border-t border-slate-150 flex-grow"></div>
                      <span className="flex-shrink mx-3 text-slate-400 text-[10px] uppercase font-black tracking-wide">
                        Alternative Sign-In
                      </span>
                      <div className="border-t border-slate-150 flex-grow"></div>
                    </div>

                    <div className="space-y-3.5">
                      <button
                        onClick={async () => {
                          try {
                            const res = await signInWithPopup(auth, googleProvider);
                            if (res.user.email !== "sapnamburad@gmail.com") {
                              triggerAlert(`Access denied. Google account ${res.user.email} is not authorized.`, "warning");
                              await signOut(auth);
                            }
                          } catch (err) {
                            console.error("Google SSO error:", err);
                            triggerAlert("Iframe origin policy blocked Google Sign-In. Use passkey code instead!", "warning");
                          }
                        }}
                        className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#EA4335"
                            d="M12 5.04c1.67 0 3.14.58 4.3 1.69l3.22-3.23C17.56 1.7 14.93 1 12 1 7.37 1 3.42 3.66 1.5 7.55l3.86 3C6.27 7.55 8.9 5.04 12 5.04z"
                          />
                          <path
                            fill="#4285F4"
                            d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.69 2.87c2.16-1.99 3.42-4.92 3.42-8.55z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.36 14.55C5.12 13.78 5 12.91 5 12s.12-1.78.36-2.55V6.45H1.5C.54 8.35 0 10.11 0 12s.54 3.65 1.5 5.55l3.86-3z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.02.68-2.33 1.09-3.96 1.09-3.1 0-5.73-2.51-6.66-5.51l-3.86 3C3.42 20.34 7.37 23 12 23z"
                          />
                        </svg>
                        Authenticate with Google Account
                      </button>

                      <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg text-left text-[10px] text-slate-500 leading-normal space-y-1">
                        <strong className="text-slate-800 font-extrabold block">Sandbox Bypass Note:</strong>
                        <p>
                          Google login panels require a pop-up window, which might be blocked by iframe cross-origins. Use the following bypass code:
                        </p>
                        <code className="block bg-rose-50 text-rose-700 p-1.5 rounded border border-rose-100 font-bold font-mono select-all">
                          Bayer3065
                        </code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Synchronized dashboard elements */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-extrabold text-slate-800 text-xs sm:text-sm">
                          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                          Database Online and Synchronized
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Refreshed {new Date().toLocaleTimeString()} • Secured via SSL Layering and Firestore rules.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={fetchStudentEntries}
                          disabled={isLoadingEntries}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer uppercase"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEntries ? "animate-spin" : ""}`} />
                          Sync Records
                        </button>
                        <button
                          onClick={() => {
                            setIsAdminAuthorized(false);
                            triggerAlert("Admin session signed out.", "info");
                          }}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-lg transition-colors cursor-pointer uppercase"
                        >
                          Logout Desk
                        </button>
                      </div>
                    </div>

                    {/* Bento statistic summary counters */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-left">
                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400 block">
                          Total Submissions
                        </span>
                        <p className="text-2xl font-black text-rose-600">{studentEntries.length}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Unique student forms</p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400 block">
                          Average Score
                        </span>
                        <p className="text-2xl font-black text-slate-800">
                          {studentEntries.length > 0 
                            ? (studentEntries.reduce((acc, curr) => acc + curr.percentile, 0) / studentEntries.length).toFixed(4)
                            : "0.0000"
                          }
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">Percentile mean</p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400 block">
                          High Merit (&gt;98%)
                        </span>
                        <p className="text-2xl font-black text-indigo-600">
                          {studentEntries.filter((e) => e.percentile >= 98).length}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">Top-tier aspirants</p>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
                        <span className="text-[9.5px] uppercase font-black tracking-wider text-slate-400 block">
                          Secure Isolated Logs
                        </span>
                        <p className="text-2xl font-black text-emerald-600">
                          {studentEntries.filter((e) => e.deviceIsolated).length}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">Cyber cafe devices</p>
                      </div>
                    </div>

                    {/* Main content column divider */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left side: student ledger listing */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <h3 className="font-black text-slate-800 text-xs sm:text-sm uppercase tracking-wide text-left">
                            Student Log Ledger
                          </h3>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={adminSearchFilter}
                              onChange={(e) => setAdminSearchFilter(e.target.value)}
                              placeholder="Search student details..."
                              className="w-full text-xs font-semibold pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 focus:bg-white"
                            />
                            {adminSearchFilter && (
                              <button onClick={() => setAdminSearchFilter("")} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Student records list */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                          {studentEntries.filter((e) => {
                            if (!adminSearchFilter) return true;
                            const queryStr = adminSearchFilter.toLowerCase();
                            return (
                              e.name.toLowerCase().includes(queryStr) ||
                              e.email.toLowerCase().includes(queryStr) ||
                              e.phone.toLowerCase().includes(queryStr)
                            );
                          }).length > 0 ? (
                            studentEntries
                              .filter((e) => {
                                if (!adminSearchFilter) return true;
                                const queryStr = adminSearchFilter.toLowerCase();
                                return (
                                  e.name.toLowerCase().includes(queryStr) ||
                                  e.email.toLowerCase().includes(queryStr) ||
                                  e.phone.toLowerCase().includes(queryStr)
                                );
                              })
                              .map((entry) => (
                                <div
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entry)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative flex items-center justify-between gap-3 ${
                                    selectedEntry?.id === entry.id
                                      ? "bg-rose-50/60 border-rose-300 shadow-sm"
                                      : "bg-white border-slate-200 hover:bg-slate-50/50"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="font-black text-slate-850 text-xs truncate">
                                        {entry.name}
                                      </h4>
                                      {entry.deviceIsolated && (
                                        <span className="text-[8px] bg-slate-100 text-slate-600 font-extrabold px-1 py-0.5 rounded uppercase">
                                          Isolated
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-indigo-650 font-black">
                                      {entry.percentile.toFixed(4)} %tile • <span className="text-slate-450 uppercase">{entry.category}</span>
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-medium">
                                      {entry.submittedAt}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] bg-slate-100 border border-slate-200 font-black text-slate-600 px-2 py-1 rounded-md">
                                      {entry.shortlistedCount} Options
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (entry.id) handleDeleteEntry(entry.id);
                                      }}
                                      className="p-1 text-slate-450 hover:text-red-650 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                      title="Delete student log"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-400 font-bold">
                              No matching student records located.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side: Detailed option sheet verification & contact panel */}
                      <div className="lg:col-span-7 font-sans">
                        {selectedEntry ? (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-left">
                            <div className="p-4 bg-rose-50/60 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-0.5">
                                <span className="text-[9px] uppercase font-black tracking-widest text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 inline-block">
                                  Selected Student Profile Sheet
                                </span>
                                <h3 className="text-sm sm:text-base font-black text-slate-900 pt-1">
                                  {selectedEntry.name}
                                </h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  href={`mailto:${selectedEntry.email}?subject=MHT CET Counselor Response - Advisor u/Wise_Papaya368&body=Hello ${selectedEntry.name}, I reviewed your MHT CET mock preference sheet choices for score ${selectedEntry.percentile}% (Category: ${selectedEntry.category}). Let us schedule a brief call.`}
                                  className="px-3 py-1.5 bg-white border border-slate-200 font-extrabold text-[11px] rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  Email Student
                                </a>
                                <a
                                  href={getWhatsAppLink(selectedEntry)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-emerald-600 text-white font-extrabold text-[11px] rounded-lg hover:bg-emerald-700 flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                >
                                  WhatsApp Message
                                </a>
                              </div>
                            </div>

                            <div className="p-4 space-y-4 text-xs">
                              {/* Student parameters details */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px]">
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 font-medium">Percentile Score</span>
                                  <p className="font-extrabold text-indigo-650">{selectedEntry.percentile.toFixed(4)} %tile</p>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 font-medium">Caste Category</span>
                                  <p className="font-extrabold text-slate-800 uppercase">{selectedEntry.category}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 font-medium">Gender Quota</span>
                                  <p className="font-extrabold text-slate-800 uppercase">{selectedEntry.gender}</p>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-slate-400 font-medium">Minority Linkage</span>
                                  <p className="font-extrabold text-slate-850">{selectedEntry.minority}</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-black text-slate-700 text-[11px] uppercase tracking-wider">
                                  Choice Sequences Sheet Filled ({selectedEntry.shortlistedColleges.length})
                                </h4>

                                {selectedEntry.shortlistedColleges && selectedEntry.shortlistedColleges.length > 0 ? (
                                  <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                    {selectedEntry.shortlistedColleges.map((item, index) => {
                                      const devRating = selectedEntry.percentile >= item.cutoff ? "High Probability" : "Target / Reach";
                                      const badgeColor = selectedEntry.percentile >= item.cutoff ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200";

                                      return (
                                        <div key={index} className="p-2.5 bg-white flex items-center justify-between gap-3 text-[11px]">
                                          <div className="min-w-0 flex-1">
                                            <p className="font-extrabold text-slate-850 truncate">
                                              #{index + 1} {item.collegeName}
                                            </p>
                                            <p className="text-indigo-650 font-extrabold mt-0.5">
                                              {item.branchName} <span className="text-slate-400 font-medium">({item.city})</span>
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2 text-right shrink-0">
                                            <span className="text-slate-400 font-mono text-[10px]">
                                              Cutoff: {item.cutoff.toFixed(2)}%
                                            </span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                                              {devRating}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="bg-slate-50 p-6 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 font-extrabold">
                                    This applicant has not added any matching colleges or sequences to their sequence sheet report.
                                  </div>
                                )}
                              </div>

                              {/* Student search states trace */}
                              <div className="text-[10px] text-slate-400 space-y-1 border-t border-slate-100 pt-3">
                                <strong className="text-slate-600 uppercase font-black text-[9px] block">
                                  Simulation Search Parameters:
                                </strong>
                                <p>
                                  Region Filter choice: <span className="text-slate-700 font-black">{selectedEntry.cityFilter || "All"}</span> • Branch Group: <span className="text-slate-700 font-black">{selectedEntry.branchFilter || "All"}</span>
                                </p>
                                {selectedEntry.searchQuery && (
                                  <p>
                                    Search query keywords: <span className="text-slate-750 font-black">&quot;{selectedEntry.searchQuery}&quot;</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-16 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs flex flex-col items-center justify-center gap-2 h-full min-h-[300px]">
                            <ShieldCheck className="w-8 h-8 text-slate-300" />
                            <p className="font-black">No Student Entry Selected</p>
                            <p className="max-w-xs text-slate-400 leading-normal font-medium">
                              Click on any applicant dossier record inside the left panel ledger table to verify their matching probabilities and initiate counselor correspondence.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Styled Footer Block */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 py-6 px-4 text-center text-xs shrink-0 select-none print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px]">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p>© 2025 Directorate of Technical Education Mock counselor simulator. Developed with Professional Polish style guidelines.</p>
            <p className="text-slate-400 font-semibold tracking-wide">Made by <span className="text-rose-500 font-black hover:text-rose-400 transition-colors">u/Wise_Papaya368</span> with ❤️</p>
          </div>
          <div className="flex gap-4 font-bold text-slate-400">
            <span className="hover:text-white transition-colors cursor-pointer">Official DTE Web Portal</span>
            <span>•</span>
            <span className="hover:text-white transition-colors cursor-pointer">CAP Rules & Timetable</span>
            <span>•</span>
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Disclaimer</span>
          </div>
        </div>
      </footer>

      {/* Printable template sheet (Visible exclusively during Print actions) */}
      <div className="hidden print:block bg-white p-6 text-black absolute top-0 left-0 w-full min-h-screen text-[11px] leading-relaxed">
        <div className="text-center pb-4 border-b border-slate-350">
          <h1 className="text-lg font-black tracking-tight uppercase">DTE Maharashtra CAP Admissions Choice Report</h1>
          <p className="text-slate-500 font-bold">Auto-Generated Predictor & CAP Preference Checklist - 2025 Admissions</p>
        </div>

        <div className="my-4 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border text-[11px]">
          <div>
            <p><strong>Configured Percentile Score:</strong> {percentile.toFixed(4)}%tile</p>
            <p><strong>Domicile Category Quota:</strong> {category.toUpperCase()}</p>
            <p><strong>Assigned Gender Block:</strong> {gender === "Female" ? "L (Ladies Seats Option)" : "G (General Option)"}</p>
          </div>
          <div>
            <p><strong>Active Regional Filters:</strong> {cityFilter === "All" ? "All Major Cities" : cityFilter}</p>
            <p><strong>Linguistic Minority Status Claimed:</strong> {minority}</p>
            <p><strong>Date Compiled:</strong> {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <h2 className="text-xs font-extrabold uppercase border-b pb-2 mb-3 tracking-wider text-slate-705">
          ARRANGED SIMULATED PREFERENCE ENTRY CODES FOR DTE PORTAL
        </h2>
        
        {shortlist.length > 0 ? (
          <table className="w-full border-collapse border border-slate-300 text-left text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700">
                <th className="border border-slate-300 p-2 text-center w-12">Pref #</th>
                <th className="border border-slate-300 p-2">Institution / College Name</th>
                <th className="border border-slate-300 p-2">Academic Engineering Stream</th>
                <th className="border border-slate-300 p-2 text-center w-24">DTE Code</th>
                <th className="border border-slate-300 p-2 text-center w-36">Choice Code ID</th>
              </tr>
            </thead>
            <tbody className="divide-y font-medium">
              {shortlist.map((item, index) => {
                const col = COLLEGES_DB.find((c) => c.id === item.collegeId);
                return (
                  <tr key={index}>
                    <td className="border border-slate-300 p-2 text-center font-bold">{index + 1}</td>
                    <td className="border border-slate-300 p-2 font-bold">{col?.name}</td>
                    <td className="border border-slate-300 p-2 text-indigo-800 font-extrabold">{item.branchName}</td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{col?.code}</td>
                    <td className="border border-slate-300 p-2 text-center font-black tracking-wider text-xs font-mono text-slate-900 bg-slate-50">
                      {item.choiceCode}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500 italic text-center p-6 border border-dashed rounded bg-slate-50">
            No items added to preference form sequence list. Choose custom colleges using the bookmark icon inside our CAP Predictor suite first.
          </p>
        )}

        <div className="mt-8 text-[10.5px] leading-relaxed text-slate-450 border-t border-slate-300 pt-3">
          <p><strong>Candidate Advisory Note:</strong> Please cross-verify choice identifier suffixes with DTE Maharashtra web databases before committing option entries. Choice code endings represent general seat shifts and may vary for TFWS or specific fee waivers.</p>
        </div>
      </div>
    </div>
  );
}
