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
  // Ancient period
  { year: -3000, title: "Rise of Egyptian Civilization", description: "The Old Kingdom of Egypt reaches its peak, with the Great Pyramid of Giza already 500 years old." },
  { year: -2500, title: "Indus Valley Civilization", description: "The Harappan civilization flourishes in the Indus River valley with sophisticated urban planning." },
  { year: -2000, title: "Shang Dynasty China", description: "The Shang Dynasty rules China, developing early forms of writing and bronze technology." },
  { year: -1500, title: "Mycenaean Greece", description: "Bronze Age Greece flourishes with the Mycenaean civilization at its height." },
  { year: -1000, title: "Iron Age Begins", description: "The Iron Age spreads across Europe and Asia, revolutionizing tool and weapon making." },
  { year: -800, title: "Founding of Rome", description: "According to legend, Rome is founded by Romulus on the Tiber River in Italy." },
  { year: -700, title: "Homeric Epic Age", description: "Homer composes the Iliad and Odyssey, foundational works of Western literature." },
  { year: -600, title: "Confucius Born", description: "Confucius is born in China, eventually becoming one of history's most influential philosophers." },
  { year: -500, title: "Classical Athens", description: "Athens becomes the center of Greek civilization during its Golden Age under Pericles." },
  { year: -400, title: "Peloponnesian War", description: "The Peloponnesian War rages between Athens and Sparta, reshaping Greek politics." },
  { year: -300, title: "Alexander the Great", description: "Alexander the Great conquers the Persian Empire, spreading Greek culture across the known world." },
  { year: -200, title: "Han Dynasty", description: "The Han Dynasty rules China, establishing the Silk Road and advancing technology." },
  { year: -100, title: "Roman Expansion", description: "Rome expands its empire across the Mediterranean, becoming the dominant world power." },
  
  // Common era
  { year: 1, title: "Birth of Christ", description: "Year 1 AD marks the traditional date of Jesus Christ's birth in Judea." },
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
