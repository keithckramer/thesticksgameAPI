// src/services/sportradarService.js
import axios from 'axios'; // Change require to import
import dotenv from 'dotenv'; // Change require to import

// Load environment variables from .env file
dotenv.config();

// Function to get game boxscore from Sportradar
export const getGameBoxscore = async (gameId) => {
  try {
    const apiKey = process.env.SPORTRADAR_API_KEY; // Make sure the API key is set in your .env file
    console.log("GameID: " + gameId + " apiKey: " + apiKey);
    //const url = `https://api.sportradar.us/football/v7/games/${gameId}/boxscore.json?api_key=${apiKey}`;
    const url = `https://api.sportradar.com/nfl/official/trial/v7/en/games/${gameId}/boxscore.json?api_key=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;
    console.log(data);
    // Restructuring the response to match your desired format
    const transformedData = {
        id: data.id,
        status: data.status,
        scheduled: data.scheduled,
        clock: data.clock,
        quarter: data.quarter,
        summary: {
        home: {
            id: data.summary.home.id,
            name: data.summary.home.name,
            alias: data.summary.home.alias,
            points: data.summary.home.points,
        },
        away: {
            id: data.summary.away.id,
            name: data.summary.away.name,
            alias: data.summary.away.alias,
            points: data.summary.away.points,
        },
    },
  };
  return transformedData;
    //return response.data;
  } catch (error) {
    console.error('Error fetching data from Sportradar:', error);
    throw new Error('Unable to retrieve game data at this time');
  }
};

// Export the function as default
export default getGameBoxscore;
