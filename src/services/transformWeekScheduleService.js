// Function to transform the week schedule data to match the desired structure
export const transformWeekSchedule = (data) => {
    return {
      id: data?.id || "N/A",
      year: data?.year || "N/A",
      type: data?.type || "N/A",
      name: data?.name || "N/A",
      week: {
        id: data?.week?.id || "N/A",
        sequence: data?.week?.sequence || "N/A",
        title: data?.week?.title || "N/A",
        games: data?.week?.games?.map((game) => ({
          id: game?.id || "N/A",
          status: game?.status || "N/A",
          scheduled: game?.scheduled || "N/A",
          game_type: game?.game_type || "N/A",
          conference_game: game?.conference_game || false,
          title: game?.title || "N/A",
          home: {
            id: game?.home?.id || "N/A",
            name: game?.home?.name || "N/A",
            alias: game?.home?.alias || "N/A",
          },
          away: {
            id: game?.away?.id || "N/A",
            name: game?.away?.name || "N/A",
            alias: game?.away?.alias || "N/A",
          },
          broadcast: game?.broadcast ? { network: game.broadcast.network } : null,
          time_zones: game?.time_zones ? { venue: game.time_zones.venue } : null,
          scoring: game?.scoring
            ? {
                home_points: game.scoring.home_points,
                away_points: game.scoring.away_points,
                periods: game.scoring.periods?.map((period) => ({
                  period_type: period?.period_type || "N/A",
                  id: period?.id || "N/A",
                  number: period?.number || 0,
                  sequence: period?.sequence || 0,
                  home_points: period?.home_points || 0,
                  away_points: period?.away_points || 0,
                })),
              }
            : null,
        })),
      },
    };
  };
  
  
  // Use `export default` to make this an ES module
  export default transformWeekSchedule;
  