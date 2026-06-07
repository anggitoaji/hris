import type { Kpi, Project, Meeting, MarketingItem, DonutItem } from "../types";

// =====================================================================
//  MOCK DATA — ganti dengan hasil fetch dari ../services/api saat siap.
//  KPI & jumlah karyawan bisa diisi dari API yang SUDAH ADA.
//  Project, Meeting, Marketing, Modem belum punya backend (mock dulu).
// =====================================================================

export const KPIS: Kpi[] = [
  { label: "Produktivitas",     value: 88, change: 8, direction: "up",   accent: "green",  trend: [60, 62, 58, 65, 63, 70, 68, 72, 75, 73, 80, 88] },
  { label: "Pencapaian Target", value: 76, change: 4, direction: "down", accent: "amber",  trend: [82, 80, 81, 78, 79, 77, 78, 76, 77, 75, 76, 76] },
  { label: "Keuangan",          value: 92, change: 6, direction: "up",   accent: "violet", trend: [70, 72, 71, 74, 76, 78, 80, 83, 85, 88, 90, 92] },
];

export const PROJECTS: Project[] = [
  { name: "Implementasi HRIS Modul Absensi", progress: 70,  status: "Berjalan", deadline: "30 Mei 2025", color: "#16a34a" },
  { name: "Pengembangan Dashboard KPI",      progress: 45,  status: "Berjalan", deadline: "10 Jun 2025", color: "#2563eb" },
  { name: "Rekrutmen Massal Q2 2025",        progress: 100, status: "Selesai",  deadline: "15 Mei 2025", color: "#16a34a" },
];

export const MEETINGS: Meeting[] = [
  { name: "Town Hall Meeting",    subtitle: "MoM Q2 – Mei 2025", date: "24 Mei 2025" },
  { name: "Sprint Review – HRIS", subtitle: "MoM Sprint #15",    date: "22 Mei 2025" },
  { name: "Evaluasi Kinerja Q1",  subtitle: "MoM Evaluasi",      date: "20 Mei 2025" },
];

export const MARKETING: MarketingItem[] = [
  { name: "Propose PT XYZ",      time: "09:15", color: "#16a34a" },
  { name: "Analisis Pasar",      time: "08:45", color: "#7c3aed" },
  { name: "Campaign Digital",    time: "08:30", color: "#f59e0b" },
  { name: "Follow Up Klien",     time: "08:10", color: "#16a34a" },
  { name: "Konten Sosial Media", time: "07:50", color: "#7c3aed" },
];

export const MODEM_CUSTOMERS: DonutItem[] = [
  { name: "ATMI",     units: 4000, color: "#16a34a" },
  { name: "JALIN",    units: 1200, color: "#2563eb" },
  { name: "ARTAJASA", units: 600,  color: "#f59e0b" },
];

export const MODEM_STOCK: DonutItem[] = [
  { name: "RBM33", sub: "Barang jadi",              units: 40, color: "#16a34a" },
  { name: "RB951", sub: "Barang jadi",              units: 20, color: "#2563eb" },
  { name: "RBM22", sub: "Alokasi pasang Sinar Mas", units: 12, color: "#f59e0b" },
];
