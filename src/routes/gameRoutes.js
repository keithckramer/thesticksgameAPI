// // src/routes/gameRoutes.js
// import express from 'express';
// import getGameBoxscore from '../services/sportsradarService.js';

// const router = express.Router();

// // Define the route for getting the game score by gameId
// router.get('/game-score/:gameId', async (req, res) => {
//   try {
//     // Extract gameId from the request parameters
//     const gameId = req.params.gameId;

//     // Fetch game boxscore data using the Sportradar service
//     const boxscore = await sportradarService.getGameBoxscore(gameId);

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

// // Use `export default` to make this an ES module
// export default router;




