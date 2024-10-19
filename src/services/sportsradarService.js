// src/services/sportradarService.js
import axios from 'axios'; // Change require to import
import dotenv from 'dotenv'; // Change require to import

// Load environment variables from .env file
dotenv.config();

// Function to get game boxscore from Sportradar
export const getGameBoxscore = async (gameId) => {
  try {
    const apiKey = process.env.SPORTRADAR_API_KEY; // Make sure the API key is set in your .env file
    const url = `https://api.sportradar.us/football/v7/games/${gameId}/boxscore.json?api_key=${apiKey}`;

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching data from Sportradar:', error);
    throw new Error('Unable to retrieve game data at this time');
  }
};

// Export the function as default
export default getGameBoxscore;
