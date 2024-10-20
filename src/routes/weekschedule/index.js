import express from 'express';
import { getWeekSchedule } from '../../services/sportradarweekschedule.js';
import { transformWeekSchedule } from '../../services/transformWeekScheduleService.js';

const router = express.Router();

// Define the route for getting the week schedule
router.get('/week-schedule', async (req, res) => {
  try {
    // Fetch week schedule data using the Sportradar service
    const weekSchedule = await getWeekSchedule();
    console.log("Fetched Week Schedule:", JSON.stringify(weekSchedule, null, 2));

    // Check if response data contains expected structure
    if (!weekSchedule) {
      return res.status(404).json({ error: 'Week schedule not found or data is incomplete' });
    }

    // Transform the data
    let transformedData;
    try {
      transformedData = transformWeekSchedule(weekSchedule);
    } catch (transformationError) {
      console.error("Error during data transformation:", transformationError);
      return res.status(500).json({ error: 'Data transformation failed' });
    }

    // Send the transformed data as a response
    res.status(200).json(transformedData);
  } catch (error) {
    console.error('Error fetching week schedule:', error);
    res.status(500).json({ error: 'Unable to retrieve week schedule at this time' });
  }
});

// Use `export default` to make this an ES module
export default router;

// import express from 'express';
// import { getWeekSchedule } from '../../services/sportradarweekschedule.js';
// import {transformWeekSchedule } from '../../services/transformWeekScheduleService.js'
// const router = express.Router();

// // Define the route for getting the week schedule
// router.get('/week-schedule', async (req, res) => {
//   try {
//     // Fetch week schedule data using the Sportradar service
//     const weekSchedule = await getWeekSchedule();

//     // Check if response data contains expected structure
//     if (!weekSchedule) {
//       return res.status(404).json({ error: 'Week schedule not found or data is incomplete' });
//     }

//     // Transform the data if needed (assuming transformData is available)
//     const transformedWeekSchedule = transformWeekSchedule(weekSchedule);

//     // Send the transformed data as a response
//     res.status(200).json(transformedWeekSchedule);
//   } catch (error) {
//     console.error('Error fetching week schedule:', error);
//     res.status(500).json({ error: 'Unable to retrieve week schedule at this time' });
//   }
// });

// // Use `export default` to make this an ES module
// export default router;