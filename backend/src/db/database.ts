import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "spur_chat.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON messages(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages(created_at);

    CREATE TABLE IF NOT EXISTS faq_knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL
    );
  `);

  // Seed FAQ knowledge if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM faq_knowledge").get() as { c: number };
  if (count.c === 0) {
    seedFAQ();
  }

  console.log("✅ Migrations complete");
}

function seedFAQ() {
  const insert = db.prepare(`
    INSERT INTO faq_knowledge (category, question, answer) VALUES (?, ?, ?)
  `);

  const faqs = [
    ["shipping", "What are your shipping options?", "We offer Standard Shipping (5–7 business days, free on orders above ₹999), Express Shipping (2–3 business days, ₹149), and Same-Day Delivery in select cities for orders placed before 12 PM (₹299)."],
    ["shipping", "Do you ship internationally?", "Yes! We ship to USA, UK, UAE, Singapore, and Australia. International delivery takes 10–15 business days. Shipping charges vary by destination and are calculated at checkout."],
    ["shipping", "How do I track my order?", "Once your order is shipped, you'll receive a tracking link via email and SMS. You can also track it at spurstore.com/track using your order ID."],
    ["returns", "What is your return policy?", "We accept returns within 30 days of delivery. Items must be unused, unwashed, and in original packaging with tags intact. Sale items are final sale and not eligible for return."],
    ["returns", "How do I initiate a return?", "Visit spurstore.com/returns, enter your order ID and email, select the items to return, and print the prepaid return label. Once we receive and inspect the item, your refund is processed within 5–7 business days."],
    ["returns", "Do you offer exchanges?", "Yes, exchanges are free for size or color changes within 30 days. The replacement item ships once we receive your return."],
    ["refunds", "How long does a refund take?", "Refunds are processed within 5–7 business days of us receiving the return. The amount is credited back to your original payment method. UPI and wallet refunds are instant; card refunds may take 3–5 additional banking days."],
    ["refunds", "Can I get a refund for a sale item?", "Sale items are final sale. However, if you received a defective or wrong item, we'll replace or refund it regardless of sale status — just contact support within 7 days."],
    ["support", "What are your support hours?", "Our support team is available Monday–Saturday, 9 AM to 7 PM IST. You can reach us via this chat, email at support@spurstore.com, or WhatsApp at +91-98765-43210."],
    ["support", "How quickly will I get a response?", "Chat responses are immediate (AI) or within 2 hours (human agent during business hours). Email responses within 24 hours. WhatsApp within 4 hours during business hours."],
    ["orders", "Can I cancel my order?", "Orders can be cancelled within 2 hours of placement if they haven't been dispatched. Go to My Orders > Select Order > Cancel. Post-dispatch, you'll need to initiate a return after delivery."],
    ["orders", "Can I modify my order?", "Order modifications (address change, item change) are possible within 1 hour of placement by contacting support. After that, the order is locked for processing."],
    ["payments", "What payment methods do you accept?", "We accept UPI (GPay, PhonePe, Paytm), all major credit/debit cards, net banking, EMI (3/6/12 months on eligible cards), Pay Later (Simpl, LazyPay), and Cash on Delivery for orders below ₹5,000."],
    ["payments", "Is my payment information secure?", "Absolutely. We use 256-bit SSL encryption and are PCI-DSS compliant. We never store your card details on our servers. All transactions are processed through Razorpay, a RBI-regulated payment gateway."],
    ["products", "Are your products authentic?", "Yes, 100%. We source directly from brands and authorized distributors. Every product comes with a brand warranty where applicable. We have a zero-tolerance policy for counterfeit goods."],
    ["products", "What if I receive a damaged or wrong item?", "We're sorry! Please report damaged or wrong items within 48 hours of delivery via chat or email with photos. We'll arrange an immediate replacement or full refund, including shipping."],
  ];

  const insertMany = db.transaction((rows: typeof faqs) => {
    for (const row of rows) {
      insert.run(...row);
    }
  });

  insertMany(faqs);
  console.log("✅ FAQ knowledge seeded");
}
