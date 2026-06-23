export interface Branch {
  name: string;
  codeName: string; // CS, IT, AIDS, ENTC, MECH, CIVIL, CHEM
  choiceIdSuffix: string; // e.g. '10' for General, '11' for Tuition Fee Waiver (TFWS)
  baseCutoff: number; // General Open Male cutoff for 2024
  cutoff2023: number;
  cutoff2022: number;
  cutoff2021: number;
  cutoff2020: number;
  intakeCapacity?: number;
}

export interface College {
  id: string;
  name: string;
  city: "Pune" | "Mumbai" | "Nagpur" | "Sangli" | "Amravati" | "Karad" | "Aurangabad";
  code: string; // DTE Code, e.g. 6006 for COEP
  type: "Government" | "Govt-Aided" | "Autonomous" | "Private";
  ranking: number;
  minoritySeat?: "Gujarati" | "Sindhi" | "Hindi" | "None";
  femaleOnly?: boolean;
  branches: Branch[];
  
  // Enhanced detail structures
  annualFee: number; // Open category baseline annual fee in INR
  placementRate: number; // placement percentage (e.g., 96.5 for 96.5%)
  averageSalary: string; // e.g., "12.8 LPA"
  highestSalary: string; // e.g., "50.5 LPA"
  topRecruiters: string[];
  establishedYear: number;
}

export interface StudentEntry {
  id?: string;
  name: string;
  email: string;
  phone: string;
  percentile: number;
  category: string;
  gender: string;
  minority: string;
  cityFilter: string;
  branchFilter: string;
  searchQuery: string;
  shortlistedCount: number;
  favoritesCount: number;
  shortlistedColleges: Array<{
    collegeName: string;
    branchName: string;
    city: string;
    cutoff: number;
  }>;
  submittedAt: any; // Firestore serverTimestamp or Date ISO string
  deviceIsolated: boolean;
}

