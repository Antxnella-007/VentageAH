export function auditCategory(eventType: string): "Invoices" | "Treasury" | "Security" | "AI" {
  if (eventType.includes("APPROVAL") || eventType.includes("SECURITY")) return "Security";
  if (eventType.includes("PAYMENT") || eventType.includes("TREASURY")) return "Treasury";
  if (eventType.includes("QVAC") || eventType.includes("ANOMALY") || eventType.includes("PROCESSING")) {
    return "AI";
  }
  return "Invoices";
}
