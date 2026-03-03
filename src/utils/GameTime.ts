export class GameTime {
  /**
   * Calculates the current year based on the game turn.
   *
   * @param turn - The current game turn (1-indexed)
   * @returns The resulting year, where positive numbers represent BC and negative or 0 represent AD
   */
  public static calculateYear(turn: number): number {
    let year = 4000; // Starts at 4000 BC
    
    // We iterate from turn 1 up to the current turn to simulate time passing
    for (let currentTurn = 1; currentTurn < turn; currentTurn++) {
      // In Civilization 1, the year represents BC when positive and AD when negative/0
      // We'll calculate the actual chronological year (negative BC, positive AD) for logic,
      // but returning positive for BC to match existing codebase logic
      
      const realYear = year > 0 ? -year : Math.abs(year);

      let skip = 20;

      if (realYear >= 1850) {
        skip = 1;
      } else if (realYear >= 1750) {
        skip = 2;
      } else if (realYear >= 1500) {
        skip = 5;
      } else if (realYear >= 1000) {
        skip = 10;
      }

      // Update the year
      if (year > 0) {
        year -= skip; // Moving towards 0 BC
        if (year <= 0) {
           // Transition from 1 BC to 1 AD, crossing 0. In this game logic we just let it be negative or zero
        }
      } else {
        year -= skip; // Year becomes more negative (which means AD year goes up)
      }
    }
    
    return year;
  }
}
