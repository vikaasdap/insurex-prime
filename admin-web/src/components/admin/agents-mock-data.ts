import { recentPolicySalesList } from "./admin-mock-data";
import type { RecentPolicySale } from "./admin-mock-data";

// ─── Full Agent Entity ────────────────────────────────────────────────────────
export interface AgentFull {
  id: string;
  name: string;
  code: string;
  avatar: string;
  email: string;
  phone: string;
  /** Default password while unchanged; null once the agent chose their own. Super Admin view only. */
  password?: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  policiesSold: number;
  premiumGenerated: number;
  customers: number;
  status: "Active" | "Inactive";
  joinDate: string; // ISO date string "YYYY-MM-DD"
  rating: number;
  specialization: "Health" | "Motor" | "Life" | "Both" | "All";
  region: string;
  recentPolicies?: RecentPolicySale[];
  activity?: AgentActivity[];
}

export interface AgentActivity {
  id: string;
  action: string;
  detail: string;
  time: string;
}

// ─── Demo Agent Roster (10 agents) ───────────────────────────────────────────
export const agentsFullList: AgentFull[] = [
  {
    id: "agt-01",
    name: "Rajesh Verma",
    code: "AGT-01",
    avatar: "RV",
    email: "rajesh.verma@insurex.com",
    phone: "+91 98765 43210",
    address: "42, MG Road, Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    policiesSold: 125,
    premiumGenerated: 840000,
    customers: 103,
    status: "Active",
    joinDate: "2024-01-15",
    rating: 4.9,
    specialization: "Both",
    region: "Mumbai North",
    recentPolicies: recentPolicySalesList.filter((p) => p.agentCode === "AGT-01").slice(0, 3),
    activity: [
      {
        id: "a1",
        action: "Policy Issued",
        detail: "Health Gold (POL-10021) — Rahul Sharma",
        time: "10 mins ago",
      },
      {
        id: "a2",
        action: "Policy Renewed",
        detail: "Two-Wheeler Protect (POL-10018) — Sandeep Roy",
        time: "2 hours ago",
      },
      {
        id: "a3",
        action: "New Customer",
        detail: "Registered Deepika Rao as a new policyholder",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "agt-02",
    name: "Priya Sharma",
    code: "AGT-02",
    avatar: "PS",
    email: "priya.sharma@insurex.com",
    phone: "+91 98234 56780",
    address: "15, Sector 18, Noida",
    city: "Noida",
    state: "Uttar Pradesh",
    pincode: "201301",
    policiesSold: 98,
    premiumGenerated: 620000,
    customers: 81,
    status: "Active",
    joinDate: "2024-03-10",
    rating: 4.8,
    specialization: "Motor",
    region: "Delhi NCR",
    recentPolicies: recentPolicySalesList.filter((p) => p.agentCode === "AGT-02").slice(0, 3),
    activity: [
      {
        id: "a4",
        action: "Policy Issued",
        detail: "Car Comprehensive (POL-10020) — Arun Kumar",
        time: "30 mins ago",
      },
      {
        id: "a5",
        action: "Commission Credited",
        detail: "₹6,200 commission credited for August",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "agt-03",
    name: "Amit Kumar",
    code: "AGT-03",
    avatar: "AK",
    email: "amit.kumar@insurex.com",
    phone: "+91 90876 54321",
    address: "88, Koramangala 5th Block",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560095",
    policiesSold: 76,
    premiumGenerated: 480000,
    customers: 65,
    status: "Active",
    joinDate: "2024-05-20",
    rating: 4.7,
    specialization: "Health",
    region: "Bengaluru South",
    recentPolicies: recentPolicySalesList.filter((p) => p.agentCode === "AGT-03").slice(0, 3),
    activity: [
      {
        id: "a6",
        action: "Policy Issued",
        detail: "Family Floater Plus (POL-10019) — Meera Nair",
        time: "1 hour ago",
      },
    ],
  },
  {
    id: "agt-04",
    name: "Sneha Patel",
    code: "AGT-04",
    avatar: "SP",
    email: "sneha.patel@insurex.com",
    phone: "+91 99001 23456",
    address: "23, CG Road, Navrangpura",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380009",
    policiesSold: 54,
    premiumGenerated: 345000,
    customers: 48,
    status: "Active",
    joinDate: "2024-07-01",
    rating: 4.6,
    specialization: "Health",
    region: "Ahmedabad Central",
    activity: [
      {
        id: "a7",
        action: "Policy Pending",
        detail: "Critical Care 360 (POL-10017) under review",
        time: "45 mins ago",
      },
    ],
  },
  {
    id: "agt-05",
    name: "Vikram Malhotra",
    code: "AGT-05",
    avatar: "VM",
    email: "vikram.malhotra@insurex.com",
    phone: "+91 91234 56789",
    address: "7, Park Street",
    city: "Kolkata",
    state: "West Bengal",
    pincode: "700016",
    policiesSold: 42,
    premiumGenerated: 290000,
    customers: 36,
    status: "Active",
    joinDate: "2024-08-12",
    rating: 4.5,
    specialization: "Motor",
    region: "Kolkata East",
    activity: [
      {
        id: "a8",
        action: "New Customer",
        detail: "Registered Rohit Das as a new policyholder",
        time: "3 hours ago",
      },
    ],
  },
  {
    id: "agt-06",
    name: "Divya Nair",
    code: "AGT-06",
    avatar: "DN",
    email: "divya.nair@insurex.com",
    phone: "+91 94567 89012",
    address: "12, Marine Drive, Fort",
    city: "Kochi",
    state: "Kerala",
    pincode: "682001",
    policiesSold: 38,
    premiumGenerated: 255000,
    customers: 31,
    status: "Active",
    joinDate: "2024-09-05",
    rating: 4.4,
    specialization: "Health",
    region: "Kochi Metro",
    activity: [
      {
        id: "a9",
        action: "Policy Renewed",
        detail: "Senior Citizen Care (POL-10015) renewal processed",
        time: "4 hours ago",
      },
    ],
  },
  {
    id: "agt-07",
    name: "Arjun Singh",
    code: "AGT-07",
    avatar: "AS",
    email: "arjun.singh@insurex.com",
    phone: "+91 87654 32100",
    address: "56, Hazratganj",
    city: "Lucknow",
    state: "Uttar Pradesh",
    pincode: "226001",
    policiesSold: 29,
    premiumGenerated: 198000,
    customers: 24,
    status: "Inactive",
    joinDate: "2024-10-14",
    rating: 3.9,
    specialization: "Both",
    region: "Lucknow Central",
    activity: [
      {
        id: "a10",
        action: "Account Deactivated",
        detail: "Status set to Inactive pending re-training",
        time: "2 days ago",
      },
    ],
  },
  {
    id: "agt-08",
    name: "Meenakshi Pillai",
    code: "AGT-08",
    avatar: "MP",
    email: "meenakshi.pillai@insurex.com",
    phone: "+91 95432 10987",
    address: "3, Anna Salai, Triplicane",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600005",
    policiesSold: 55,
    premiumGenerated: 370000,
    customers: 47,
    status: "Active",
    joinDate: "2024-04-18",
    rating: 4.5,
    specialization: "Health",
    region: "Chennai South",
    activity: [
      {
        id: "a11",
        action: "Policy Issued",
        detail: "Health Gold Plus (POL-10028) — Suresh Menon",
        time: "1 day ago",
      },
    ],
  },
  {
    id: "agt-09",
    name: "Harish Rathod",
    code: "AGT-09",
    avatar: "HR",
    email: "harish.rathod@insurex.com",
    phone: "+91 92345 67891",
    address: "22, Link Road, Baner",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411045",
    policiesSold: 18,
    premiumGenerated: 126000,
    customers: 15,
    status: "Inactive",
    joinDate: "2025-01-10",
    rating: 3.7,
    specialization: "Motor",
    region: "Pune West",
    activity: [
      {
        id: "a12",
        action: "Account Deactivated",
        detail: "License renewal pending verification",
        time: "1 week ago",
      },
    ],
  },
  {
    id: "agt-10",
    name: "Sunita Reddy",
    code: "AGT-10",
    avatar: "SR",
    email: "sunita.reddy@insurex.com",
    phone: "+91 93456 78912",
    address: "45, Jubilee Hills",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    policiesSold: 62,
    premiumGenerated: 418000,
    customers: 53,
    status: "Active",
    joinDate: "2024-06-01",
    rating: 4.6,
    specialization: "Both",
    region: "Hyderabad West",
    activity: [
      {
        id: "a13",
        action: "Top Performer Badge",
        detail: "Ranked 2nd in Hyderabad region for Sep 2026",
        time: "3 days ago",
      },
    ],
  },
];

// ─── Agent KPI Data ───────────────────────────────────────────────────────────
export const agentKpiData = {
  totalAgents: agentsFullList.length,
  activeAgents: agentsFullList.filter((a) => a.status === "Active").length,
  inactiveAgents: agentsFullList.filter((a) => a.status === "Inactive").length,
  totalPoliciesSold: agentsFullList.reduce((sum, a) => sum + a.policiesSold, 0),
  totalPremiumGenerated: agentsFullList.reduce((sum, a) => sum + a.premiumGenerated, 0),
  agentsGrowth: "+2 this month",
  activeGrowth: "+8.3%",
  inactiveGrowth: "2 on hold",
  soldGrowth: "+12.4%",
};

// ─── Agent chart data – policies sold per agent ───────────────────────────────
export const agentPoliciesChartData = agentsFullList
  .filter((a) => a.status === "Active")
  .sort((a, b) => b.policiesSold - a.policiesSold)
  .slice(0, 8)
  .map((a) => ({
    name: a.code,
    fullName: a.name,
    policiesSold: a.policiesSold,
    premiumGenerated: a.premiumGenerated,
  }));
