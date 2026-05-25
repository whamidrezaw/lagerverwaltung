require('dotenv').config();
const mongoose = require('mongoose');
const Product  = require('./models/Product');

// FIX #11: unit برای هر دسته مناسب تنظیم شده
// Kräuter → 'Bund', Pilze → 'Schale', بقیه → 'Kiste'
const products = [
  // ── Obst ────────────────────────────────────────────────────────
  { emoji:'🍎', name:'Äpfel',       category:'Obst',         unit:'Kiste', currentStock:40, yesterdayStock:45, minStock:10 },
  { emoji:'🍐', name:'Birnen',      category:'Obst',         unit:'Kiste', currentStock:22, yesterdayStock:28, minStock:8  },
  { emoji:'🍑', name:'Pfirsiche',   category:'Obst',         unit:'Kiste', currentStock:15, yesterdayStock:20, minStock:5  },
  { emoji:'🍒', name:'Kirschen',    category:'Obst',         unit:'Kiste', currentStock:8,  yesterdayStock:14, minStock:5  },
  { emoji:'🍇', name:'Weintrauben', category:'Obst',         unit:'Kiste', currentStock:18, yesterdayStock:25, minStock:8  },
  { emoji:'🍉', name:'Wassermelone',category:'Obst',         unit:'Kiste', currentStock:12, yesterdayStock:12, minStock:4  },
  { emoji:'🍈', name:'Honigmelone', category:'Obst',         unit:'Kiste', currentStock:9,  yesterdayStock:14, minStock:4  },

  // ── Beeren ───────────────────────────────────────────────────────
  { emoji:'🍓', name:'Erdbeeren',   category:'Beeren',       unit:'Kiste', currentStock:24, yesterdayStock:30, minStock:10 },
  { emoji:'🫐', name:'Heidelbeeren',category:'Beeren',       unit:'Kiste', currentStock:16, yesterdayStock:22, minStock:6  },
  { emoji:'🍓', name:'Himbeeren',   category:'Beeren',       unit:'Kiste', currentStock:11, yesterdayStock:18, minStock:5  },

  // ── Zitrusfrüchte ─────────────────────────────────────────────────
  { emoji:'🍊', name:'Orangen',     category:'Zitrusfrüchte',unit:'Kiste', currentStock:55, yesterdayStock:62, minStock:15 },
  { emoji:'🍋', name:'Zitronen',    category:'Zitrusfrüchte',unit:'Kiste', currentStock:30, yesterdayStock:35, minStock:10 },
  { emoji:'🍋', name:'Limetten',    category:'Zitrusfrüchte',unit:'Kiste', currentStock:14, yesterdayStock:18, minStock:6  },
  { emoji:'🍊', name:'Mandarinen',  category:'Zitrusfrüchte',unit:'Kiste', currentStock:38, yesterdayStock:45, minStock:12 },
  { emoji:'🍋', name:'Grapefruits', category:'Zitrusfrüchte',unit:'Kiste', currentStock:20, yesterdayStock:24, minStock:8  },

  // ── Exotisch ─────────────────────────────────────────────────────
  { emoji:'🥭', name:'Mangos',      category:'Exotisch',     unit:'Kiste', currentStock:16, yesterdayStock:20, minStock:6  },
  { emoji:'🍍', name:'Ananas',      category:'Exotisch',     unit:'Kiste', currentStock:10, yesterdayStock:12, minStock:4  },
  { emoji:'🥝', name:'Kiwi',        category:'Exotisch',     unit:'Kiste', currentStock:22, yesterdayStock:28, minStock:8  },
  { emoji:'🍌', name:'Bananen',     category:'Exotisch',     unit:'Kiste', currentStock:45, yesterdayStock:45, minStock:15 },
  { emoji:'🥑', name:'Avocado',     category:'Exotisch',     unit:'Kiste', currentStock:28, yesterdayStock:35, minStock:10 },
  { emoji:'🍈', name:'Papaya',      category:'Exotisch',     unit:'Kiste', currentStock:8,  yesterdayStock:11, minStock:4  },
  { emoji:'🥥', name:'Kokosnuss',   category:'Exotisch',     unit:'Stück', currentStock:6,  yesterdayStock:8,  minStock:3  },

  // ── Gemüse ───────────────────────────────────────────────────────
  { emoji:'🍅', name:'Tomaten',     category:'Gemüse',       unit:'Kiste', currentStock:42, yesterdayStock:50, minStock:12 },
  { emoji:'🥒', name:'Gurken',      category:'Gemüse',       unit:'Kiste', currentStock:30, yesterdayStock:36, minStock:10 },
  { emoji:'🫑', name:'Paprika',     category:'Gemüse',       unit:'Kiste', currentStock:35, yesterdayStock:40, minStock:10 },
  { emoji:'🥕', name:'Karotten',    category:'Gemüse',       unit:'Kiste', currentStock:28, yesterdayStock:34, minStock:10 },
  { emoji:'🥦', name:'Brokkoli',    category:'Gemüse',       unit:'Kiste', currentStock:18, yesterdayStock:24, minStock:6  },
  { emoji:'🥬', name:'Salat',       category:'Gemüse',       unit:'Kiste', currentStock:22, yesterdayStock:28, minStock:8  },
  { emoji:'🧅', name:'Zwiebeln',    category:'Gemüse',       unit:'Kiste', currentStock:40, yesterdayStock:40, minStock:12 },
  { emoji:'🧄', name:'Knoblauch',   category:'Gemüse',       unit:'Kiste', currentStock:25, yesterdayStock:28, minStock:8  },
  { emoji:'🥔', name:'Kartoffeln',  category:'Gemüse',       unit:'Sack',  currentStock:60, yesterdayStock:60, minStock:20 },
  { emoji:'🍆', name:'Auberginen',  category:'Gemüse',       unit:'Kiste', currentStock:14, yesterdayStock:18, minStock:5  },
  { emoji:'🥗', name:'Spinat',      category:'Gemüse',       unit:'Kiste', currentStock:12, yesterdayStock:16, minStock:5  },
  { emoji:'🥦', name:'Blumenkohl',  category:'Gemüse',       unit:'Kiste', currentStock:16, yesterdayStock:20, minStock:6  },
  { emoji:'🥬', name:'Rosenkohl',   category:'Gemüse',       unit:'Kiste', currentStock:10, yesterdayStock:14, minStock:4  },
  { emoji:'🥬', name:'Weißkohl',    category:'Gemüse',       unit:'Kiste', currentStock:18, yesterdayStock:20, minStock:6  },
  { emoji:'🥬', name:'Rotkohl',     category:'Gemüse',       unit:'Kiste', currentStock:15, yesterdayStock:16, minStock:5  },
  { emoji:'🌽', name:'Mais',        category:'Gemüse',       unit:'Kiste', currentStock:20, yesterdayStock:24, minStock:6  },
  { emoji:'🥒', name:'Zucchini',    category:'Gemüse',       unit:'Kiste', currentStock:22, yesterdayStock:26, minStock:8  },
  { emoji:'🥕', name:'Rote Beete',  category:'Gemüse',       unit:'Kiste', currentStock:14, yesterdayStock:16, minStock:5  },
  { emoji:'🥬', name:'Lauch',       category:'Gemüse',       unit:'Bund',  currentStock:18, yesterdayStock:22, minStock:6  },
  { emoji:'🥬', name:'Sellerie',    category:'Gemüse',       unit:'Stück', currentStock:12, yesterdayStock:14, minStock:4  },
  { emoji:'🥬', name:'Rucola',      category:'Gemüse',       unit:'Bund',  currentStock:10, yesterdayStock:14, minStock:4  },
  { emoji:'🥬', name:'Feldsalat',   category:'Gemüse',       unit:'Bund',  currentStock:8,  yesterdayStock:12, minStock:4  },

  // ── Kräuter ─────────────────────────────────────────────────────
  { emoji:'🌿', name:'Basilikum',   category:'Kräuter',      unit:'Bund',  currentStock:14, yesterdayStock:18, minStock:5  },
  { emoji:'🌿', name:'Petersilie',  category:'Kräuter',      unit:'Bund',  currentStock:16, yesterdayStock:20, minStock:5  },
  { emoji:'🌿', name:'Schnittlauch',category:'Kräuter',      unit:'Bund',  currentStock:12, yesterdayStock:15, minStock:4  },
  { emoji:'🌿', name:'Minze',       category:'Kräuter',      unit:'Bund',  currentStock:8,  yesterdayStock:10, minStock:3  },
  { emoji:'🌿', name:'Koriander',   category:'Kräuter',      unit:'Bund',  currentStock:10, yesterdayStock:12, minStock:3  },
  { emoji:'🌿', name:'Dill',        category:'Kräuter',      unit:'Bund',  currentStock:8,  yesterdayStock:10, minStock:3  },

  // ── Pilze ────────────────────────────────────────────────────────
  { emoji:'🍄', name:'Champignons', category:'Pilze',        unit:'Schale',currentStock:20, yesterdayStock:25, minStock:6  },
  { emoji:'🍄', name:'Shiitake',    category:'Pilze',        unit:'Schale',currentStock:8,  yesterdayStock:12, minStock:3  },
  { emoji:'🍄', name:'Austernpilze',category:'Pilze',        unit:'Schale',currentStock:6,  yesterdayStock:9,  minStock:3  },
  { emoji:'🍄', name:'Pfifferlinge',category:'Pilze',        unit:'Schale',currentStock:4,  yesterdayStock:7,  minStock:3  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ MongoDB verbunden');

  const existing = await Product.countDocuments();
  if (existing > 0) {
    console.log(`⚠️  Datenbank hat bereits ${existing} Produkte — Abbruch`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await Product.insertMany(products, { ordered: false });
  console.log(`✅ ${result.length} Produkte erfolgreich importiert!`);

  // آمار خلاصه
  const cats = [...new Set(products.map(p => p.category))];
  cats.forEach(cat => {
    const count = products.filter(p => p.category === cat).length;
    console.log(`   ${cat}: ${count} Produkte`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Fehler:', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
