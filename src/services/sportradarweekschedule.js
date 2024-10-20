// src/services/sportradarService.js
import axios from 'axios'; // Change require to import
import dotenv from 'dotenv'; // Change require to import

// Load environment variables from .env file
dotenv.config();

// Function to get game boxscore from Sportradar
export const getWeekSchedule = async () => {
  try {
    const apiKey = process.env.SPORTRADAR_API_KEY; // Make sure the API key is set in your .env file
    const url = `https://api.sportradar.com/nfl/official/trial/v7/en/games/current_week/schedule.json?api_key=${apiKey}`;
    //const url = `https://api.sportradar.us/football/v7/games/${gameId}/boxscore.json?api_key=${apiKey}`;
    //const url = `https://api.sportradar.com/nfl/official/trial/v7/en/games/${gameId}/boxscore.json?api_key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;
    const transformData = {
        id: data.id,
        year: data.year,
        type: data.type,
        name: data.name,
        week: {
          id: data.week.id,
          sequence: data.week.sequence,
          title: data.week.title,
          games: data.week.games.map((game) => {
            return {
              id: game.id,
              status: game.status,
              scheduled: game.scheduled,
              game_type: game.game_type,
              conference_game: game.conference_game,
              title: game.title,
              home: {
                id: game.home.id,
                name: game.home.name,
                alias: game.home.alias,
              },
              away: {
                id: game.away.id,
                name: game.away.name,
                alias: game.away.alias,
              },
              broadcast: game.broadcast ? { network: game.broadcast.network } : null,
              time_zones: game.time_zones ? { venue: game.time_zones.venue } : null,
              scoring: game.scoring
                ? {
                    home_points: game.scoring.home_points,
                    away_points: game.scoring.away_points,
                    periods: game.scoring.periods.map((period) => ({
                      period_type: period.period_type,
                      id: period.id,
                      number: period.number,
                      sequence: period.sequence,
                      home_points: period.home_points,
                      away_points: period.away_points,
                    })),
                  }
                : null,
            };
          }),
        },
      };
    
  //   // Restructuring the response to match your desired format
  //   const transformedData = {
  //       id: data.id,
  //       status: data.status,
  //       scheduled: data.scheduled,
  //       clock: data.clock,
  //       quarter: data.quarter,
  //       summary: {
  //       home: {
  //           id: data.summary.home.id,
  //           name: data.summary.home.name,
  //           alias: data.summary.home.alias,
  //           points: data.summary.home.points,
  //       },
  //       away: {
  //           id: data.summary.away.id,
  //           name: data.summary.away.name,
  //           alias: data.summary.away.alias,
  //           points: data.summary.away.points,
  //       },
  //   },
  // };
  return transformData;
    //return response.data;
  } catch (error) {
    console.error('Error fetching data from Sportradar:', error);
    throw new Error('Unable to retrieve game data at this time');
  }
};

// Export the function as default
export default getWeekSchedule;
