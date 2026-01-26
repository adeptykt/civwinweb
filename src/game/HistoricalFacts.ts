/**
 * Historical facts database with interesting real-world events
 * Years are represented as actual historical years (e.g., 500 BC = -500, 2000 AD = 2000)
 */

export interface HistoricalFact {
  year: number;
  title: string;
  description: string;
}

export const historicalFacts: HistoricalFact[] = [
  // Prehistoric period - Early Bronze Age
  { year: -4000, title: "Early Bronze Age", description: "Bronze Age civilizations emerge in the Near East. Early forms of writing and organized agriculture spread." },
  { year: -3900, title: "Rise of Mesopotamia", description: "Sumer emerges as one of the world's first civilizations, developing irrigation and early writing systems." },
  { year: -3800, title: "Egyptian Dynasties", description: "Early Egyptian dynasties establish themselves along the Nile River, creating a powerful civilization." },
  { year: -3700, title: "Akkadian Expansion", description: "The Akkadian empire grows in influence, spreading Semitic culture throughout Mesopotamia." },
  { year: -3600, title: "Development of Script", description: "Writing systems develop in multiple civilizations, allowing for record-keeping and literature." },
  { year: -3500, title: "First Cities", description: "The first true cities emerge in Mesopotamia. Complex societies and trade networks develop." },
  { year: -3400, title: "Ancient Commerce", description: "Long-distance trade networks connect Mesopotamia, Egypt, and the Indus Valley." },
  { year: -3300, title: "Pyramids Begin", description: "Construction of monumental pyramids begins in Egypt, showcasing advanced engineering and organization." },
  { year: -3200, title: "Bronze Technology", description: "Bronze working techniques spread widely, creating stronger tools and weapons than copper." },
  { year: -3100, title: "Egyptian Unification", description: "Upper and Lower Egypt unite under a single pharaoh, establishing the Old Kingdom." },
  { year: -3000, title: "Rise of Egyptian Civilization", description: "The Old Kingdom of Egypt reaches its peak. The Great Pyramid of Giza stands as a testament to Egyptian power." },
  { year: -2900, title: "Palace Culture", description: "Elaborate palace complexes are built in Minoan Crete, marking the height of early Aegean civilization." },
  { year: -2800, title: "Great Pyramid Era", description: "The height of pyramid construction in Egypt, with massive monuments built by thousands of workers." },
  { year: -2700, title: "Akkadian Power", description: "The Akkadian Empire reaches its zenith under Sargon of Akkad, the first true emperor." },
  { year: -2600, title: "Harappan Growth", description: "The Indus Valley civilization expands, with cities like Mohenjo-daro becoming major trade centers." },
  { year: -2500, title: "Indus Valley Civilization", description: "The Harappan civilization flourishes with sophisticated urban planning and drainage systems." },
  { year: -2400, title: "Babylonian Rise", description: "Babylon emerges as a powerful city-state in Mesopotamia, beginning its ascent to dominance." },
  { year: -2300, title: "Egyptian Decline", description: "The Old Kingdom of Egypt declines as the power of pharaohs weakens." },
  { year: -2200, title: "Ur-Nammu's Law", description: "The Code of Ur-Nammu, one of the oldest known law codes, is established in ancient Sumer." },
  { year: -2100, title: "Ur's Golden Age", description: "The city of Ur becomes the dominant power in Mesopotamia under the Third Dynasty of Ur." },
  { year: -2000, title: "Shang Dynasty China", description: "The Shang Dynasty rules China, developing early forms of writing and advanced bronze technology." },
  { year: -1900, title: "Amorite Dominance", description: "Amorite peoples gain control of Mesopotamian city-states, establishing new dynasties." },
  { year: -1800, title: "Babylonian Empire", description: "Babylon becomes the dominant power in Mesopotamia under Hammurabi and his legal code." },
  { year: -1700, title: "Hittite Kingdom", description: "The Hittite Empire rises in Anatolia, developing iron working technology and powerful armies." },
  { year: -1600, title: "Egyptian Renaissance", description: "The New Kingdom begins in Egypt, marked by powerful pharaohs and imperial expansion." },
  { year: -1500, title: "Mycenaean Greece", description: "Bronze Age Greece flourishes with the Mycenaean civilization at its height of power." },
  { year: -1400, title: "Minoan Culture", description: "The Minoan civilization of Crete develops advanced art, architecture, and maritime trade." },
  { year: -1300, title: "Trojan War Era", description: "The legendary Trojan War period occurs, as recorded in Homer's epics." },
  { year: -1200, title: "Bronze Age Collapse", description: "Major civilizations decline, including the Mycenaean and Hittite empires, ushering in the Iron Age." },
  { year: -1100, title: "Dark Ages Begin", description: "Greece enters a period of cultural decline and reduced urbanization following the Bronze Age collapse." },
  { year: -1000, title: "Iron Age Begins", description: "The Iron Age spreads across Europe and Asia, revolutionizing tool and weapon making." },
  { year: -900, title: "Assyrian Empire", description: "The Assyrian Empire begins its rise to power in Mesopotamia with military innovations." },
  { year: -800, title: "Founding of Rome", description: "According to legend, Rome is founded by Romulus on the Tiber River in Italy." },
  { year: -700, title: "Homeric Epic Age", description: "Homer composes the Iliad and Odyssey, foundational works of Western literature." },
  { year: -600, title: "Confucius Born", description: "Confucius is born in China, eventually becoming one of history's most influential philosophers." },
  { year: -500, title: "Classical Athens", description: "Athens becomes the center of Greek civilization during its Golden Age under Pericles." },
  { year: -400, title: "Peloponnesian War", description: "The Peloponnesian War rages between Athens and Sparta, reshaping Greek politics." },
  { year: -300, title: "Alexander the Great", description: "Alexander the Great conquers the Persian Empire, spreading Greek culture across the known world." },
  { year: -200, title: "Han Dynasty", description: "The Han Dynasty rules China, establishing the Silk Road and advancing technology." },
  { year: -100, title: "Roman Expansion", description: "Rome expands its empire across the Mediterranean, becoming the dominant world power." },
  { year: -50, title: "Julius Caesar", description: "Julius Caesar conquers Gaul and becomes one of Rome's most powerful generals, reshaping the republic." },
  { year: -6, title: "Birth of Jesus Christ", description: "Jesus Christ is born in Bethlehem, Judea. His teachings will eventually become the foundation of Christianity." },
  
  // Common era
  { year: 1, title: "Reign of Augustus", description: "Augustus Caesar rules the Roman Empire at its height, establishing the Pax Romana and expanding trade across the known world." },
  { year: 100, title: "Roman Peace", description: "The Pax Romana flourishes under the rule of the Roman Empire at its height." },
  { year: 200, title: "Three Kingdoms China", description: "China fractures into three kingdoms following the collapse of the Han Dynasty." },
  { year: 300, title: "Rise of Christianity", description: "Christianity spreads throughout the Roman Empire, eventually becoming the dominant religion." },
  { year: 400, title: "Fall of Rome", description: "The Roman Empire in the West collapses, marking the beginning of the Middle Ages in Europe." },
  { year: 500, title: "Dark Ages", description: "Europe enters the Early Middle Ages with feudalism emerging as the dominant system." },
  { year: 600, title: "Islamic Golden Age", description: "Islam spreads rapidly across the Middle East and North Africa under the Umayyad Caliphate." },
  { year: 700, title: "Tang Dynasty", description: "The Tang Dynasty rules China during a period of cultural and economic prosperity." },
  { year: 800, title: "Charlemagne", description: "Charlemagne is crowned Emperor of the Romans, establishing the Carolingian Empire." },
  { year: 900, title: "Medieval Europe", description: "The feudal system dominates medieval Europe with kings, nobles, and peasants in strict hierarchy." },
  { year: 1000, title: "Millennium Change", description: "Medieval Europe experiences significant cultural and technological developments." },
  { year: 1100, title: "The Crusades", description: "European Christians launch military campaigns to reclaim the Holy Land from Muslim rule." },
  { year: 1200, title: "Magna Carta Era", description: "King John of England signs the Magna Carta, limiting royal power and establishing rights." },
  { year: 1300, title: "Renaissance Begins", description: "The Renaissance begins in Italy, marking the rebirth of classical learning and culture." },
  { year: 1400, title: "Age of Exploration", description: "European explorers like Columbus and da Gama discover new routes and continents." },
  { year: 1500, title: "Gutenberg's Press", description: "The printing press revolutionizes communication, spreading knowledge throughout Europe." },
  { year: 1600, title: "Scientific Revolution", description: "Scientists like Galileo and Kepler revolutionize our understanding of the universe." },
  { year: 1700, title: "Enlightenment", description: "The Age of Enlightenment emphasizes reason, science, and individual rights." },
  { year: 1750, title: "Industrial Revolution", description: "The Industrial Revolution begins in Britain, transforming manufacturing and society." },
  { year: 1800, title: "Napoleonic Era", description: "Napoleon Bonaparte reshapes Europe through military conquest and legal reforms." },
  { year: 1850, title: "Victorian Age", description: "The Victorian Era in Britain is marked by industrial progress and imperial expansion." },
  { year: 1900, title: "Belle Époque", description: "The early 20th century marks an era of peace and cultural flourishing in Europe." },
  { year: 1920, title: "Roaring Twenties", description: "The 1920s bring jazz, flappers, and economic prosperity to America and Europe." },
  { year: 1945, title: "World War II Ends", description: "World War II concludes, reshaping global politics and leading to the nuclear age." },
  { year: 1969, title: "Moon Landing", description: "Apollo 11 lands on the Moon, with Neil Armstrong becoming the first human to walk on it." },
  { year: 2000, title: "Y2K Millennium", description: "The year 2000 marks the new millennium with widespread digital celebrations worldwide." },
  { year: 2020, title: "Modern Era", description: "Humanity continues to advance through technology, space exploration, and renewable energy." },
];

/**
 * Get a historical fact for a given year
 * Falls back to nearby years if exact year not found
 */
export function getHistoricalFact(year: number): HistoricalFact | null {
  // First try to find exact match
  let fact = historicalFacts.find(f => f.year === year);
  
  if (fact) return fact;

  // If no exact match, find closest year
  let closest: HistoricalFact | null = null;
  let closestDistance = Infinity;

  for (const f of historicalFacts) {
    const distance = Math.abs(f.year - year);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = f;
    }
  }

  return closest;
}

/**
 * Get a random historical fact
 */
export function getRandomHistoricalFact(): HistoricalFact {
  return historicalFacts[Math.floor(Math.random() * historicalFacts.length)];
}
