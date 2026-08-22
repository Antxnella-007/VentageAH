export const SUPPLIERS = [
  "CloudNet Ltd",
  "SecureWave Systems",
  "DataBridge Corp",
  "Pacific Hardware",
  "Nova Telecom",
  "CyberCore Solutions",
  "Atlas Logistics",
  "Vertex Software",
  "Quantum Networks",
  "BluePeak Services",
  "Orion Systems",
  "MetroCloud",
  "Nexus Technologies",
  "CoreLine Infrastructure",
] as const;

export const BRANCH_TARGETS = [
  { name: "San José", currentSpend: 53200, historicalAverage: 51000 },
  { name: "Heredia", currentSpend: 41400, historicalAverage: 39800 },
  { name: "Alajuela", currentSpend: 38100, historicalAverage: 37200 },
  { name: "Cartago", currentSpend: 54730, historicalAverage: 41700 },
] as const;

export const TREASURY_PAYMENTS: {
  supplier: string;
  amount: number;
  destinationAddress: string;
}[] = [
  { supplier: "CloudNet Ltd", amount: 8400, destinationAddress: "0xde00000000000000000000000000000000000001" },
  { supplier: "SecureWave Systems", amount: 3200, destinationAddress: "0xde00000000000000000000000000000000000002" },
  { supplier: "DataBridge Corp", amount: 4150, destinationAddress: "0xde00000000000000000000000000000000000003" },
  { supplier: "Pacific Hardware", amount: 2890, destinationAddress: "0xde00000000000000000000000000000000000004" },
  { supplier: "Nova Telecom", amount: 3600, destinationAddress: "0xde00000000000000000000000000000000000005" },
  { supplier: "CyberCore Solutions", amount: 2100, destinationAddress: "0xde00000000000000000000000000000000000006" },
  { supplier: "Atlas Logistics", amount: 1850, destinationAddress: "0xde00000000000000000000000000000000000007" },
  { supplier: "Vertex Software", amount: 4500, destinationAddress: "0xde00000000000000000000000000000000000008" },
  { supplier: "Quantum Networks", amount: 2750, destinationAddress: "0xde00000000000000000000000000000000000009" },
  { supplier: "BluePeak Services", amount: 1920, destinationAddress: "0xde0000000000000000000000000000000000000a" },
  { supplier: "Orion Systems", amount: 1680, destinationAddress: "0xde0000000000000000000000000000000000000b" },
  { supplier: "MetroCloud", amount: 2210, destinationAddress: "0xde0000000000000000000000000000000000000c" },
  { supplier: "Nexus Technologies", amount: 1980, destinationAddress: "0xde0000000000000000000000000000000000000d" },
  { supplier: "CoreLine Infrastructure", amount: 1440, destinationAddress: "0xde0000000000000000000000000000000000000e" },
];

export const TREASURY_TEST_ADDRESS = "0x56414e54414745000000000000000000de000001";

export const DEMO_INVOICE_TEMPLATES: {
  invoiceNumber: string;
  supplier: string;
  branch: string;
  date: string;
  total: number;
  currency: "USD";
}[] = [
  { invoiceNumber: "CN-3021", supplier: "CloudNet Ltd", branch: "Cartago", date: "2026-08-14", total: 8400, currency: "USD" },
  { invoiceNumber: "SW-1188", supplier: "SecureWave Systems", branch: "San José", date: "2026-08-11", total: 3200, currency: "USD" },
  { invoiceNumber: "DB-4410", supplier: "DataBridge Corp", branch: "Heredia", date: "2026-08-09", total: 4150, currency: "USD" },
  { invoiceNumber: "PH-9022", supplier: "Pacific Hardware", branch: "Alajuela", date: "2026-08-07", total: 2890, currency: "USD" },
  { invoiceNumber: "NT-7731", supplier: "Nova Telecom", branch: "Cartago", date: "2026-08-16", total: 3600, currency: "USD" },
  { invoiceNumber: "CC-2509", supplier: "CyberCore Solutions", branch: "San José", date: "2026-08-04", total: 2100, currency: "USD" },
  { invoiceNumber: "AL-6614", supplier: "Atlas Logistics", branch: "Heredia", date: "2026-08-18", total: 1850, currency: "USD" },
  { invoiceNumber: "VS-3308", supplier: "Vertex Software", branch: "Cartago", date: "2026-08-20", total: 4500, currency: "USD" },
  { invoiceNumber: "QN-1280", supplier: "Quantum Networks", branch: "Alajuela", date: "2026-08-12", total: 2750, currency: "USD" },
  { invoiceNumber: "BP-5044", supplier: "BluePeak Services", branch: "San José", date: "2026-08-06", total: 1920, currency: "USD" },
  { invoiceNumber: "OS-8199", supplier: "Orion Systems", branch: "Heredia", date: "2026-08-15", total: 1680, currency: "USD" },
  { invoiceNumber: "MC-2277", supplier: "MetroCloud", branch: "Cartago", date: "2026-08-21", total: 2210, currency: "USD" },
  { invoiceNumber: "NX-6402", supplier: "Nexus Technologies", branch: "Alajuela", date: "2026-08-03", total: 1980, currency: "USD" },
  { invoiceNumber: "CL-1103", supplier: "CoreLine Infrastructure", branch: "San José", date: "2026-08-19", total: 1440, currency: "USD" },
  { invoiceNumber: "CN-3044", supplier: "CloudNet Ltd", branch: "San José", date: "2026-08-08", total: 1260, currency: "USD" },
  { invoiceNumber: "VS-3319", supplier: "Vertex Software", branch: "Heredia", date: "2026-08-13", total: 980, currency: "USD" },
  { invoiceNumber: "NT-7748", supplier: "Nova Telecom", branch: "Alajuela", date: "2026-08-17", total: 1540, currency: "USD" },
  { invoiceNumber: "QN-1294", supplier: "Quantum Networks", branch: "Cartago", date: "2026-08-22", total: 3120, currency: "USD" },
  { invoiceNumber: "DB-4426", supplier: "DataBridge Corp", branch: "San José", date: "2026-08-05", total: 870, currency: "USD" },
  { invoiceNumber: "SW-1201", supplier: "SecureWave Systems", branch: "Cartago", date: "2026-08-10", total: 2410, currency: "USD" },
  { invoiceNumber: "PH-9038", supplier: "Pacific Hardware", branch: "Heredia", date: "2026-08-02", total: 640, currency: "USD" },
  { invoiceNumber: "CC-2522", supplier: "CyberCore Solutions", branch: "Alajuela", date: "2026-08-01", total: 1190, currency: "USD" },
  { invoiceNumber: "MC-2290", supplier: "MetroCloud", branch: "San José", date: "2026-08-23", total: 2050, currency: "USD" },
  { invoiceNumber: "AL-6629", supplier: "Atlas Logistics", branch: "Cartago", date: "2026-08-24", total: 730, currency: "USD" },
];
