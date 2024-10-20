import express from 'express';
import { getGameBoxscore } from '../../services/sportsradarService.js'

const router = express.Router();

// Define the route for getting the game score by gameId
router.get('/game-score/:gameId', async (req, res) => {
  try {
    // Extract gameId from the request parameters
    const gameId = req.params.gameId;
    console.log("in router gameid=" + gameId);
    // Fetch game boxscore data using the Sportradar service
    const boxscore = await getGameBoxscore(gameId);

    // Check if response data contains expected structure
    if (!boxscore) {
        return res.status(404).json({ error: 'Game not found or data is incomplete' });
      }

      // Extract data safely
    const homeTeam = boxscore.summary?.home;
    const awayTeam = boxscore.summary?.away;

    if (!homeTeam || !awayTeam) {
      return res.status(404).json({ error: 'Incomplete game data' });
    }

    const score = {
      id: boxscore.id,
      status: boxscore.status,
      scheduled: boxscore.scheduled,
      clock: boxscore.clock,
      quarter: boxscore.quarter,
      summary: {
        home: {
          id: homeTeam.id,
          name: homeTeam.name,
          alias: homeTeam.alias,
          points: homeTeam.points,
        },
        away: {
          id: awayTeam.id,
          name: awayTeam.name,
          alias: awayTeam.alias,
          points: awayTeam.points,
        },
      },
    };

    res.status(200).json(score);
  } catch (error) {
    console.error('Error fetching game data:', error);
    res.status(500).json({ error: 'Unable to retrieve game data at this time' });
  }
});
//     // Extract relevant score details
//     const score = {
//       home_team: boxscore.home.name,
//       home_score: boxscore.home.points,
//       away_team: boxscore.away.name,
//       away_score: boxscore.away.points,
//     };

//     // Send score as response
//     res.status(200).json(score);
//   } catch (error) {
//     console.error('Error fetching game data:', error); 
//     res.status(500).json({ error: error.message });
//   }
// });

// Use `export default` to make this an ES module
export default router;